import { IBotInterface, BotStatus, BotEvent, BotEventType } from '../types';
import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { getApys } from "lending-apy-fetcher-ts";
import { allProtocols } from './protocols';
import { getBestAPYForEachToken } from '../utils/apy';
import { executeAaveQuote, fetchAaveAllocationForToken } from './aave-allocations';
import { toAggregatedAssetId, toAToken } from '../utils/conversions';
import { prepareCallRequestAaveSupply, prepareCallRequestAaveWithdraw } from './quotes';
import { BalanceByAggregatedAsset, AggregatedBalanceParticular } from '../types/onebalance';
import { VaultManager } from '../lib/vault-manager';
import { Address } from 'viem';
import { ethers } from 'ethers';

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

export interface Allocation {
  amount: string;
  atAPY: number;
  chainId: string;
}

/**
 * Main Bot class that handles the lending vault operations
 */
export class Bot implements IBotInterface {
  protected config: Config;
  private status: BotStatus = BotStatus.IDLE;
  private intervalId: NodeJS.Timeout | null = null;
  private apiClient: AxiosInstance;
  protected existingAllocations: Record<string, Allocation> = {}; // token symbol -> current allocation
  protected vaultManager: VaultManager | null = null;

  constructor(config: Config) {
    this.config = config;
    this.apiClient = apiClient(this.config.oneBalanceApiKey);

    // Initialize vault on Arbitrum only (where vault contract lives)
    this.initializeVault({
      "USDC": this.config.arbitrumVaults["USDC"]!, // Arbitrum vault contract
    });
    
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
      this.emitEvent({ type: BotEventType.START, timestamp: new Date() });

      console.log('🔄 Starting bot operations...');
      await this.setupOneBalanceAccount();
      await this.fetchExistingAllocations();
      
      // Start vault event listening if vault is initialized
      await this.startVaultEventListening();

      await new Promise(resolve => setTimeout(resolve, 1000000));

      while(true) {
        let apyData = await getApys(allProtocols);
        let bestApyData = getBestAPYForEachToken(apyData);

        // console.log('🔍 Best APY data:', bestApyData); 

        for (const apyData of bestApyData) {
          // skip if the token is not enabled
          if (!this.vaultManager!.getVaultContracts().has(apyData.token_symbol)) {
            continue;
          }

          const apyChainId = this.config.chainsHumanToOB[apyData.network]!;
          
          // skip if the token is already at the best APY
          if (this.existingAllocations[apyData.token_symbol]!.atAPY > apyData.apy || this.existingAllocations[apyData.token_symbol]!.chainId === apyChainId) {
            continue;
          }
          const token = apyData.token_symbol;
          const aggregatedAsset = toAggregatedAssetId(token);
          const withdrawAmount = this.existingAllocations[token]!.amount;

          if (withdrawAmount !== '0') {
            const fromChain = this.existingAllocations[token]!.chainId;
            const prepareWithdrawQuoteRequest = await prepareCallRequestAaveWithdraw(this.config, withdrawAmount, token, fromChain);
            await executeAaveQuote(this.config, prepareWithdrawQuoteRequest, aggregatedAsset);
          }
          
          const aggregatedAssetBalance = await this.getAggregatedBalanceForToken(this.config.addressOneBalance!, aggregatedAsset);
          const tokenAddress = this.config.assetsHumanToChainAddress[token]![apyData.network]!;

          // reallocate the funds - iterate over each individual asset balance
          for (const individualAsset of aggregatedAssetBalance.individualAssetBalances) {
            // Skip assets with zero balance
            if (individualAsset.balance === '0') {
              continue;
            }

            const prepareSupplyQuoteRequest = await prepareCallRequestAaveSupply(
              this.config, 
              apyChainId, 
              tokenAddress,
              individualAsset.balance
            );

            await executeAaveQuote(this.config, prepareSupplyQuoteRequest, aggregatedAsset);
          }
        } 
      }

      // // quote from eth -> arbitrum aave supply
      // const prepareQuoteRequest = await prepareCallRequestAaveSupply(this.config, this.config.addressOneBalance!, '1', "USDC", "ARBITRUM", "POLYGON");
      // // console.log('🔍 Prepare quote request:', prepareQuoteRequest);

      // await executeAaveSupplyQuote(prepareQuoteRequest, this.config, this.config.addressOneBalance!);
    } catch (error) {
      this.status = BotStatus.ERROR;  
      this.emitEvent({ 
        type: BotEventType.ERROR, 
        timestamp: new Date(), 
        message: `Failed to start bot: ${error instanceof Error ? error.message : String(error)}` 
      });
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

    this.status = BotStatus.STOPPED;
    this.emitEvent({ type: BotEventType.STOP, timestamp: new Date() });
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
    
    // Listen to events for each vault contract
    for (const [token, contractAddress] of this.vaultManager.getVaultContracts()) {
      await this.startVaultEventListeningForToken(token, contractAddress);
    }
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
    this.config.arbitrumProvider!.on(depositFilter, (deposit) => {
      console.log('🔍 Deposit event:', deposit);
      
      // Decode the amount from the event data (uint256 encoded in hex)
      const decodedAmount = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], deposit.data)[0];
      const amountString = decodedAmount.toString();
      
      console.log(`💰 Decoded deposit amount: ${amountString}`);
      this.allocateVaultFundsToAave(token, amountString);
    });

    const withdrawFilter = {  
      address: contractAddress,
      topics: [
        ethers.id("Withdraw(address,uint256,uint256)")
      ]
    }

    this.config.arbitrumProvider!.on(withdrawFilter, (withdrawal) => {
      console.log('🔍 Withdrawal event:', withdrawal);
      const decodedAmount = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], withdrawal.data)[0];
      const amountString = decodedAmount.toString();

      const user = ethers.AbiCoder.defaultAbiCoder().decode(['address'], withdrawal.topics[1])[0];
      console.log(`🔍 Withdrawal amount: ${amountString} for user: ${user}`);
      this.withdrawAaveFundsToUser(token, user, amountString);
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
      const chainId = allocation.chainId;
      const chainName = this.getChainHumanName(chainId); // Convert chainId to human name
      const prepareWithdrawQuoteRequest = await prepareCallRequestAaveWithdraw(
        this.config,
        amount,
        token,
        chainName, // Use human-readable chain name instead of chainId
        userAddress // Pass user address as the 'to' parameter for Aave withdrawal
      );

      await executeAaveQuote(this.config, prepareWithdrawQuoteRequest, toAggregatedAssetId(token));

      // Update allocation tracking
      const newAmount = (BigInt(allocation.amount) - BigInt(amount)).toString();
      this.existingAllocations[token] = {
        ...allocation,
        amount: newAmount
      };

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
        throw new Error(`No allocation found for ${token}`);
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

      const chainId = allocation.chainId;
      const tokenAddress = this.config.assetsHumanToChainAddress[token]![this.getChainHumanName(chainId)]!;

      const prepareSupplyQuoteRequest = await prepareCallRequestAaveSupply(
        this.config,
        chainId,
        tokenAddress,
        amount
      );

      console.log(prepareSupplyQuoteRequest);

      await executeAaveQuote(this.config, prepareSupplyQuoteRequest, aggregatedAsset);

      // Update allocation tracking
      const newAmount = (BigInt(allocation.amount) + BigInt(amount)).toString();
      this.existingAllocations[token] = {
        ...allocation,
        amount: newAmount
      };

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

  /**
   * Get vault information for a specific token (if vault is initialized)
   */
  // public async getVaultInfo(token: string) {
  //   if (!this.vaultManager) {
  //     throw new Error('Vault not initialized. Call initializeVault() first.');
  //   }
    
  //   return {
  //     contractAddress: this.vaultManager.getVaultContract(token),
  //     metrics: await this.vaultManager.getVaultMetrics(token),
  //     token: token
  //   };
  // }

  /**
   * Get vault information for all tokens
   */
  // public async getAllVaultInfo() {
  //   if (!this.vaultManager) {
  //     throw new Error('Vault not initialized. Call initializeVault() first.');
  //   }
    
  //   const allVaultInfo: Record<string, any> = {};
    
  //   for (const [token] of this.vaultManager.getVaultContracts()) {
  //     allVaultInfo[token] = await this.getVaultInfo(token);
  //   }
    
  //   return allVaultInfo;
  // }

  /**
   * Get user balance in specific token vault
   */
  // public async getUserBalance(token: string, userAddress: string) {
  //   if (!this.vaultManager) {
  //     throw new Error('Vault not initialized. Call initializeVault() first.');
  //   }
    
  //   return this.vaultManager.getUserBalance(token, userAddress);
  // }

  /**
   * Emit bot events for monitoring and logging
   */
  private emitEvent(event: BotEvent): void {
    if (this.config.isDevelopment()) {
      console.log('📨 Bot Event:', event);
    }
    
    // You can extend this to send events to external monitoring systems
    // For example: webhook notifications, database logging, etc.
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

  async fetchExistingAllocations() {
    for (const protocol of allProtocols) {
      const network = protocol.network;
      for (const token of this.vaultManager!.getVaultContracts().keys()) {
        const aToken = toAToken(token);
        const aTokenAddress = this.config.assetsHumanToChainAddress[aToken]![network]!;
        const allocation = await fetchAaveAllocationForToken(network, aTokenAddress, this.config.addressOneBalance!);
        // console.log('🔍 Allocation:', allocation);  

        this.existingAllocations[token] = {
          amount: allocation.balance,
          atAPY: 0,
          chainId: this.config.chainsHumanToOB[network]!
        };
      }
    }
  }
}