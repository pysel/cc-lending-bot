import { IBotInterface, BotStatus, BotEvent, BotEventType } from '../types';
import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { getApys } from "lending-apy-fetcher-ts";
import { allProtocols } from './protocols';
import { getBestAPYForEachToken } from '../utils/apy';
import { executeAaveQuote, fetchAaveAllocationForToken, getERC20Balance } from './aave-allocations';
import { toAggregatedAssetId, toAToken } from '../utils/conversions';
import { prepareCallRequestAaveSupply, prepareCallRequestAaveWithdraw } from './quotes';
import { BalanceByAggregatedAsset, AggregatedBalanceParticular } from '../types/onebalance';
import { VaultManager } from '../lib/vault-manager';
import { Address } from 'viem';
import { ethers } from 'ethers';
import { DatabaseManager, Allocation } from '../lib/database';
import { VAULT_ABI_ETHERS } from '../lib/vault-manager';
import { ethereumProvider, arbitrumProvider, polygonProvider, optimismProvider, ETHEREUM, ARBITRUM, POLYGON, OPTIMISM } from "lending-apy-fetcher-ts";

// OneBalance API base URL and API key (for reference)
export const API_BASE_URL = 'https://be.onebalance.io/api';

// Create an axios client that points to our proxy
export const apiClient = (apiKey: string) => axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },  
});

const DEFAULT_ALLOCATION: Allocation = {
  amount: '0',
  atAPY: 0,
  chain: "ARBITRUM" // by default, allocate to arbitrum
};

async function wait() {
  await new Promise(resolve => setTimeout(resolve, 1000000));
}

/**
 * Main Bot class that handles the lending vault operations
 */
export class Bot implements IBotInterface {
  protected config: Config;
  private status: BotStatus = BotStatus.IDLE;
  private intervalId: NodeJS.Timeout | null = null;
  private apiClient: AxiosInstance;
  protected vaultManager: VaultManager | null = null;
  protected database: DatabaseManager;

  // these are used to track the events that could have been missed per token
  private lastKnownBlock: number = 0; // single block number
  protected existingAllocations: Record<string, Allocation> = {}; // token symbol -> current allocation

  constructor(config: Config) {
    this.config = config;
    this.apiClient = apiClient(this.config.oneBalanceApiKey);
    this.database = new DatabaseManager();

    // Initialize vault on Arbitrum only (where vault contract lives)
    this.initializeVault(this.config.arbitrumVaults);
    
    console.log('🏦 Vault initialized on Arbitrum');
  }

  /**
   * Starts the bot operations
   */
  public async start(): Promise<void> {
    if (this.status === BotStatus.RUNNING) {
      console.log('⚠️ Bot is already running');
      return;
    }

    try {
      this.status = BotStatus.RUNNING;
      // this.emitEvent({ type: BotEventType.START, timestamp: new Date() });

      console.log('🔄 Starting bot operations...');
      
      // Initialize database and load persisted state
      await this.database.initialize(this.config.arbitrumVaults);
      await this.loadBotState();
      
      await this.setupOneBalanceAccount();
      // await this.cleanup('USDT', 'ARBITRUM', this.config.arbitrumProvider);

      // Start vault event listening if vault is initialized
      await this.startVaultEventListening();
      
      // Sync all historical events that might have been missed
      await this.syncAllEvents();
      await new Promise(resolve => setTimeout(resolve, 199990000));
      
      
      while(true) {
        let apyData = await getApys(allProtocols);
        let bestApyData = getBestAPYForEachToken(apyData);

        console.log('🔍 Best APY data:', bestApyData); 

        for (const apyData of bestApyData) {
          // skip if the token is not enabled or if it's not in the existing allocations
          if (
            !this.vaultManager!.getVaultContracts().has(apyData.token_symbol) ||
            !this.existingAllocations[apyData.token_symbol]
          ) {
            continue;
          }

          // skip if the token is already at the best APY
          if (
            this.existingAllocations[apyData.token_symbol] && 
            (this.existingAllocations[apyData.token_symbol]!.atAPY >= apyData.apy || 
            (this.existingAllocations[apyData.token_symbol]!.chain === apyData.network && this.existingAllocations[apyData.token_symbol]!.atAPY < apyData.apy))
          ) {
            console.log(`🔍 Skipping ${apyData.token_symbol} because it's already at the best APY: ${this.existingAllocations[apyData.token_symbol]!.atAPY}%`);
            continue;
          }

          const token = apyData.token_symbol;
          const aggregatedAsset = toAggregatedAssetId(token);
          const existingAllocationAmount = this.existingAllocations[token]!.amount;

          if (existingAllocationAmount !== '0') {
            console.log(`🔍 Withdrawing ${existingAllocationAmount} ${token} from Aave`);
            const fromChain = this.existingAllocations[token]!.chain;
            const prepareWithdrawQuoteRequest = await prepareCallRequestAaveWithdraw(this.config, existingAllocationAmount, token, fromChain);
            await executeAaveQuote(this.config, prepareWithdrawQuoteRequest, aggregatedAsset);
          } else {
            console.log(`🔍 No existing allocation found for ${token}, skipping`);
            continue;
          }
          
          const tokenAddress = this.config.assetsHumanToChainAddress[token]![apyData.network]!;
          
          console.log(`🔍 Reallocating ${existingAllocationAmount} ${token} to Aave`);
          // reallocate the funds
          const prepareSupplyQuoteRequest = await prepareCallRequestAaveSupply(
            this.config, 
            apyData.network, 
            tokenAddress,
            existingAllocationAmount
          );

          try {
            await executeAaveQuote(this.config, prepareSupplyQuoteRequest, aggregatedAsset);
          } catch (error) {
            console.error(`❌ Error executing Aave supply quote:`, error);
            await wait();
            continue;
          }

          // update vault's current allocation and APY
          await this.setVaultCurrentAllocation(token, `Aave ${apyData.network}`, apyData.apy);

          await this.updateAllocation(token, {
            amount: existingAllocationAmount,
            atAPY: apyData.apy,
            chain: apyData.network
          });
        } 

        await wait();
      }

      // // quote from eth -> arbitrum aave supply
      // const prepareQuoteRequest = await prepareCallRequestAaveSupply(this.config, this.config.addressOneBalance!, '1', "USDC", "ARBITRUM", "POLYGON");
      // // console.log('🔍 Prepare quote request:', prepareQuoteRequest);

      // await executeAaveSupplyQuote(prepareQuoteRequest, this.config, this.config.addressOneBalance!);
    } catch (error) {
      this.status = BotStatus.ERROR;  
      // this.emitEvent({ 
      //   type: BotEventType.ERROR, 
      //   timestamp: new Date(), 
      //   message: `Failed to start bot: ${error instanceof Error ? error.message : String(error)}` 
      // });
      throw error;
    }
  }

  // ________ ONEBALANCE FUNCTIONS ________
  async setupOneBalanceAccount() {
    const wallet = this.config.getWallet();
    if (!this.config.addressOneBalance) {
      const predictedAddress = await this.predictAccountAddress(wallet.address, wallet.address);
      this.config.addressOneBalance = predictedAddress;
    }
    console.log('🔍 Account address:', this.config.addressOneBalance);
  }

  async getAggregatedBalance(address: string) {
    try {
      const response = await this.apiClient.get(`/v2/balances/aggregated-balance?address=${address}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching aggregated balance:', error);
      throw error;
    }
  }

  async getAggregatedBalanceForToken(address: string, aggregatedAsset: string): Promise<BalanceByAggregatedAsset> {
    try {
      const response = await this.apiClient.get(`/v2/balances/aggregated-balance?address=${address}`);

      const aggregatedBalance: AggregatedBalanceParticular = response.data;
      return aggregatedBalance.balanceByAggregatedAsset.find(asset => asset.aggregatedAssetId === aggregatedAsset)!;
    } catch (error) {
      console.error('Error fetching aggregated balance for token:', error);
      throw error;
    }
  }

  /**
   * Stops the bot operations
   */
  public async stop(): Promise<void> {
    if (this.status !== BotStatus.RUNNING) {
      console.log('⚠️ Bot is not running');
      return;
    }

    console.log('🛑 Stopping bot operations...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Save final state to database
    await this.saveBotState();
    console.log('💾 Bot state saved to database');

    this.status = BotStatus.STOPPED;
    // this.emitEvent({ type: BotEventType.STOP, timestamp: new Date() });
  }

  /**
   * Checks if the bot is currently running
   */
  public isRunning(): boolean {
    return this.status === BotStatus.RUNNING;
  }

  /**
   * Gets the current bot status
   */
  public getStatus(): BotStatus {
    return this.status;
  }

  /**
   * Gets the OneBalance account address
   */
  public getAccountAddressOneBalance(): string | null {
    return this.config.addressOneBalance;
  }

  /**
   * Initialize vault functionality with multiple token vaults (all on Arbitrum)
   */
  public initializeVault(vaultContracts: Record<string, string>): void {
    this.vaultManager = new VaultManager(this.config);
    
    // Add all vault contracts (they're all on Arbitrum)
    for (const [token, contractAddress] of Object.entries(vaultContracts)) {
      this.vaultManager.addVaultContract(token, contractAddress as `0x${string}`);
    }
    
    console.log('🏦 Vault manager initialized on Arbitrum:', vaultContracts);
  }

  /**
   * Start vault event listening for all token vault contracts on Arbitrum
   */
  private async startVaultEventListening(): Promise<void> {
    if (!this.vaultManager) {
      console.log('ℹ️ No vault manager initialized, skipping vault events');
      return;
    }

    console.log('🔍 Starting vault event listening on Arbitrum...');
    
    // Start block fetcher for all tokens
    this.startBlockFetcher();
    
    // Listen to events for each vault contract
    for (const [token, contractAddress] of this.vaultManager.getVaultContracts()) {
      await this.startVaultEventListeningForToken(token, contractAddress);
    }
  }

  /**
   * Start block fetcher that increments lastKnownBlock for all tokens on each new block
   */
  private startBlockFetcher(): void {
    console.log('📦 Starting Arbitrum block fetcher...');
    
    this.config.arbitrumProvider!.on('block', async (blockNumber: number) => {
      try {
        this.lastKnownBlock = blockNumber;
        await this.database.setLastKnownBlock(blockNumber);
      } catch (error) {
        console.error('❌ Error in block fetcher:', error);
      }
    });
  }

  /**
   * Start event listening for a specific token vault on Arbitrum
   */
  private async startVaultEventListeningForToken(token: string, contractAddress: Address): Promise<void> {
    console.log(`🔍 Starting event listening for ${token} vault: ${contractAddress}`);

    const depositFilter = {
      address: contractAddress,
      topics: [
        ethers.id("Deposit(address,uint256,uint256)")
      ]
    } 

    // Listen for deposit events
    this.config.arbitrumProvider!.on(depositFilter, async (deposit) => {
      console.log('🔍 Deposit event:', deposit);
      
      try {
        // Decode the amount and shares from the event data
        // Event: Deposit(address indexed user, uint256 amount, uint256 shares)
        const [decodedAmount, _] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], deposit.data);
        const amountString = decodedAmount.toString();
        
        // Process the deposit
        await this.allocateVaultFundsToAave(token, amountString);
        
        // Note: Block numbers are now handled by the block fetcher, no need to update here
      } catch (error) {
        console.error('❌ Error processing deposit event:', error);
      }
    });

    const withdrawFilter = {  
      address: contractAddress,
      topics: [
        ethers.id("Withdraw(address,uint256,uint256)")
      ]
    }

    this.config.arbitrumProvider!.on(withdrawFilter, async (withdrawal) => {
      console.log('🔍 Withdrawal event:', withdrawal);
      
      try {
        // Decode the amount and shares from the event data
        // Event: Withdraw(address indexed user, uint256 amount, uint256 shares)
        const [decodedAmount, _] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], withdrawal.data);
        const amountString = decodedAmount.toString();

        // Decode the user address from the indexed parameter
        const user = ethers.AbiCoder.defaultAbiCoder().decode(['address'], withdrawal.topics[1])[0];
        
        // Process the withdrawal
        await this.withdrawAaveFundsToUser(token, user, amountString);
        
        // Note: Block numbers are now handled by the block fetcher, no need to update here
      } catch (error) {
        console.error('❌ Error processing withdrawal event:', error);
      }
    });
  }

  /**
   * Process vault withdrawal by withdrawing from Aave directly to user
   */
  private async withdrawAaveFundsToUser(token: string, userAddress: string, amount: string): Promise<void> {
    console.log(`🔄 Processing ${token} withdrawal for ${userAddress}: ${amount}`);
    
    try {
      // Get current allocation info for this token
      const allocation = this.existingAllocations[token];
      if (!allocation) {
        throw new Error(`No allocation found for ${token}`);
      }

      // Withdraw from Aave directly to the user using Aave's withdraw(asset, amount, to) function
      // This sends tokens directly to the user without going through the bot
      const prepareWithdrawQuoteRequest = await prepareCallRequestAaveWithdraw(
        this.config,
        amount,
        token,
        allocation.chain,
        userAddress // Pass user address as the 'to' parameter for Aave withdrawal
      );

      await executeAaveQuote(this.config, prepareWithdrawQuoteRequest, toAggregatedAssetId(token));

      // Update allocation tracking
      const newAmount = (BigInt(allocation.amount) - BigInt(amount)).toString();
      await this.updateAllocation(token, {
        ...allocation,
        amount: newAmount
      });

      console.log(`✅ Processed ${token} withdrawal for ${userAddress} - funds sent directly from Aave`);
    } catch (error) {
      console.error(`❌ Error processing ${token} withdrawal:`, error);
      throw error;
    }
  }

  /**
   * Allocate deposited funds to Aave for yield farming
   * This is called after a deposit event is caught - funds are already in bot's OneBalance account
   */
  private async allocateVaultFundsToAave(token: string, amount: string): Promise<void> {
    console.log(`💰 Allocating ${amount} ${token} to Aave pool (funds already in bot account)`);

    try {
      // Funds are already in bot's OneBalance account from the deposit
      // Get current allocation info for this token to know where to allocate
      const allocation = this.existingAllocations[token];
      if (!allocation) {
        throw new Error(`No allocation found for ${token} in existing allocations`);
      }

      // Supply the funds directly to Aave (no need to withdraw from vault)
      const aggregatedAsset = toAggregatedAssetId(token);
      const aggregatedAssetBalance = await this.getAggregatedBalanceForToken(
        this.config.addressOneBalance!, 
        aggregatedAsset
      );

      if (aggregatedAssetBalance.balance < amount) {
        console.log(`ERROR: THIS SHOULD NEVER HAPPEN`); // because this function is called only after deposit happens on chain
        return;
      }
      const tokenAddress = this.config.assetsHumanToChainAddress[token]![allocation.chain]!;

      // const chainId = this.config.chainsHumanToOB[allocation.chain];
      // if (!chainId) {
      //   throw new Error(`Unknown chain name: ${allocation.chain}`);
      // }

      const prepareSupplyQuoteRequest = await prepareCallRequestAaveSupply(
        this.config,
        allocation.chain,
        tokenAddress,
        amount
      );

      console.log(prepareSupplyQuoteRequest);

      await executeAaveQuote(this.config, prepareSupplyQuoteRequest, aggregatedAsset);

      // Update allocation tracking
      const newAmount = (BigInt(allocation!.amount) + BigInt(amount)).toString();
      await this.updateAllocation(token, {
        ...allocation!,
        amount: newAmount
      });

      console.log(`✅ Allocated ${amount} ${token} to Aave pool`);
    } catch (error) {
      console.error(`❌ Error allocating ${token} to Aave:`, error);
      throw error;
    }
  }

  /**
   * Helper to get chain human name from chain ID
   */
  private getChainHumanName(chainId: string): string {
    for (const [humanName, id] of Object.entries(this.config.chainsHumanToOB)) {
      if (id === chainId) {
        return humanName;
      }
    }
    throw new Error(`Unknown chain ID: ${chainId}`);
  }

  async predictAccountAddress(sessionAddress: string, adminAddress: string) {
    try {
      const response = await this.apiClient.post('/account/predict-address', {
        sessionAddress,
        adminAddress
      });
      return response.data?.predictedAddress;
    } catch (error) {
      console.error('Error predicting account address:', error);
      throw error;
    }
  }

    /**
   * Load bot state from database
   */
  async loadBotState(): Promise<void> {
    const state = await this.database.getBotState();
    this.lastKnownBlock = state.lastKnownBlock;
    this.existingAllocations = state.allocations;
    
    console.log('📄 Loaded bot state from database:', {
      lastKnownBlock: this.lastKnownBlock,
      allocationsCount: Object.keys(this.existingAllocations).length
    });
  }

  /**
   * Save bot state to database
   */
  async saveBotState(): Promise<void> {
    await this.database.setBotState({
      lastKnownBlock: this.lastKnownBlock,
      allocations: this.existingAllocations
    });
  }

  /**
   * Update allocation in memory and database
   */
  async updateAllocation(token: string, allocation: Allocation): Promise<void> {
    this.existingAllocations[token] = allocation;
    await this.database.setAllocation(token, allocation);
  }

  async fetchExistingAllocations() {
    // Initialize default allocations for all vault tokens if not already set
    for (const [token, vaultAddress] of Object.entries(this.config.arbitrumVaults)) {
      if (!this.existingAllocations[token]) {
        const defaultAllocation = { ...DEFAULT_ALLOCATION };
        this.existingAllocations[token] = defaultAllocation;
        await this.database.setAllocation(token, defaultAllocation);
      }
    }

    for (const protocol of allProtocols) {
      const network = protocol.network;
      for (const token of this.vaultManager!.getVaultContracts().keys()) {
        const aToken = toAToken(token);
        const aTokenAddress = this.config.assetsHumanToChainAddress[aToken]![network]!;
        const allocation = await fetchAaveAllocationForToken(network, aTokenAddress, this.config.addressOneBalance!);
        console.log('🔍 Allocation:', allocation);

        if (allocation.balance === '0') {
          continue;
        }

        const { allocation: _, apy: currentAPY } = await this.getVaultCurrentAllocation(token);

        const newAllocation = {
          amount: allocation.balance,
          atAPY: currentAPY,
          chain: network
        };

        await this.updateAllocation(token, newAllocation);

        break; // should be only one allocation per token
      }
    }
  }

  /**
   * Update vault's current allocation and APY information
   * @param token - Token symbol (e.g., "USDC")
   * @param allocation - Current allocation description (e.g., "Aave Arbitrum")
   * @param apy - Current APY as percentage (e.g., 5.2 for 5.2%)
   */
  async setVaultCurrentAllocation(token: string, allocation: string, apy: number): Promise<void> {
    const vaultAddress = this.config.arbitrumVaults[token];
    if (!vaultAddress) {
      throw new Error(`Vault address not found for ${token}`);
    }
    
    if (!this.config.arbitrumProvider) {
      throw new Error('Arbitrum provider not initialized');
    }

    try {
      const wallet = this.config.getWallet();
      const vaultContract = new ethers.Contract(
        vaultAddress,
        ['function setCurrentAllocation(string memory _currentAllocation, uint256 _currentAPY) external'],
        wallet
      );

      // Convert percentage to basis points (multiply by 100)
      const apyBasisPoints = Math.round(apy * 100);
      
      console.log(`📝 Updating ${token} vault allocation: ${allocation} at ${apy}% APY`);
      
      const tx = await vaultContract['setCurrentAllocation']!(allocation, apyBasisPoints);
      const receipt = await tx.wait();
      
      console.log(`✅ Updated ${token} vault allocation successfully: ${receipt.hash}`);
    } catch (error) {
      console.error(`❌ Failed to update ${token} vault allocation:`, error);
      throw error;
    }
  }

  async syncAllEvents() {
    for (const [token, vaultAddress] of Object.entries(this.config.arbitrumVaults)) {
      await this.syncEventsForContract(token, vaultAddress);
    }
  }

  async syncEventsForContract(token: string, contractAddress: string) {
    const vaultContract = new ethers.Contract(
      contractAddress,
      VAULT_ABI_ETHERS,
      this.config.arbitrumProvider
    );
    console.log(`🔍 Syncing events for ${token} at ${contractAddress}`);

    const fromBlock = this.lastKnownBlock;
    const currentBlock = await this.config.arbitrumProvider!.getBlockNumber();
    
    console.log(`🔍 Syncing ${token} events from block ${fromBlock} to ${currentBlock}`);

    if (fromBlock >= currentBlock) {
      console.log(`✅ No new blocks to sync for ${token}`);
      return;
    }

    // Query events in 500-block windows
    const eventsDeposit: ethers.EventLog[] = [];
    const eventsWithdraw: ethers.EventLog[] = [];

    const depositFilter = vaultContract.filters['Deposit']?.();
    const withdrawFilter = vaultContract.filters['Withdraw']?.();

    for (let blockStart = fromBlock; blockStart <= currentBlock; blockStart += 500) {
      const blockEnd = Math.min(blockStart + 499, currentBlock);
      
      try {
        let deposits: ethers.EventLog[] = [];
        let withdrawals: ethers.EventLog[] = [];
        
        if (depositFilter) {
          deposits = await vaultContract.queryFilter(depositFilter, blockStart, blockEnd) as ethers.EventLog[];
          eventsDeposit.push(...deposits);
        }
        
        if (withdrawFilter) {
          withdrawals = await vaultContract.queryFilter(withdrawFilter, blockStart, blockEnd) as ethers.EventLog[];
          eventsWithdraw.push(...withdrawals);
        }
        
        console.log(`📥 Found ${deposits.length} deposits, ${withdrawals.length} withdrawals in blocks ${blockStart}-${blockEnd}`);
      } catch (error) {
        console.error(`❌ Error querying events for blocks ${blockStart}-${blockEnd}:`, error);
      }
    }

    // Process all events
    for (const event of eventsDeposit) {
      try {
        const user = event.args['user'];
        const amount = event.args['amount'];
        console.log(`📥 Processing historical ${token} deposit: ${amount} from ${user} at block ${event.blockNumber}`);
        await this.allocateVaultFundsToAave(token, amount.toString());
      } catch (error) {
        console.error(`❌ Error processing deposit event:`, error);
      }
    }

    for (const event of eventsWithdraw) {
      try {
        const user = event.args['user'];
        const amount = event.args['amount'];
        console.log(`📤 Processing historical ${token} withdrawal: ${amount} from ${user} at block ${event.blockNumber}`);
        await this.withdrawAaveFundsToUser(token, user, amount.toString());
      } catch (error) {
        console.error(`❌ Error processing withdrawal event:`, error);
      }
    }

    console.log(`✅ Sync complete for ${token} - processed ${eventsDeposit.length} deposits, ${eventsWithdraw.length} withdrawals`);
  }

  /**
   * Helper to get token symbol from vault contract address
   */
  private getTokenFromVaultAddress(vaultAddress: string): string | null {
    for (const [token, address] of Object.entries(this.config.arbitrumVaults)) {
      if (address === vaultAddress) {
        return token;
      }
    }
    return null;
  } 

  async getVaultCurrentAllocation(token: string): Promise<{ allocation: string, apy: number }> {
    const vaultAddress = this.config.arbitrumVaults[token];
    if (!vaultAddress) {
      throw new Error(`Vault address not found for ${token}`);
    }

    if (!this.config.arbitrumProvider) {
      throw new Error('Arbitrum provider not initialized');
    }

    const vaultContract = new ethers.Contract(
      vaultAddress,
      [
        'function currentAllocation() external view returns (string)',
        'function currentAPY() external view returns (uint256)'
      ],
      this.config.arbitrumProvider
    );

    const currentAllocation = await vaultContract['currentAllocation']!();

    // Read currentAPY as a view function
    const currentAPY = await vaultContract['currentAPY']!();

    return { allocation: currentAllocation, apy: Number(currentAPY) }; // Convert from basis points to percentage
  }

  /**
   * Cleanup function to withdraw entire aToken balance from Aave
   * @param baseToken - Base token symbol (e.g., "USDC")
   * @param targetChain - Chain where the allocation exists (e.g., "ARBITRUM")
   * @param provider - Blockchain provider for the target chain
   */
  async cleanup(baseToken: string, targetChain: string, provider: any): Promise<void> {
    console.log(`🧹 Cleaning up ${baseToken} allocation on ${targetChain}`);

    try {
      // Get aToken address and fetch current balance directly
      const aToken = toAToken(baseToken);
      const aTokenAddress = this.config.assetsHumanToChainAddress[aToken]![targetChain]!;
      const balance = await getERC20Balance(provider, aTokenAddress, this.config.addressOneBalance!);

      if (balance === '0') {
        console.log(`✅ No ${aToken} balance to clean up on ${targetChain}`);
        return;
      }

      console.log(`🔄 Withdrawing ${balance} ${aToken} from Aave on ${targetChain}`);

      // Prepare and execute withdrawal
      const withdrawRequest = await prepareCallRequestAaveWithdraw(
        this.config,
        balance,
        baseToken,
        targetChain
      );

      await executeAaveQuote(this.config, withdrawRequest, toAggregatedAssetId(baseToken));

      // Reset allocation tracking
      await this.updateAllocation(baseToken, {
        amount: '0',
        atAPY: 0,
        chain: targetChain
      });

      console.log(`✅ Cleanup complete: withdrew ${balance} ${aToken} from ${targetChain}`);
    } catch (error) {
      console.error(`❌ Error during cleanup of ${baseToken} on ${targetChain}:`, error);
      throw error;
    }
  }
}