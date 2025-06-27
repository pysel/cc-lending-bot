import { parseAbi, Address, formatUnits, parseUnits } from 'viem';
import { Config } from '../config';
import { UserBalance, VaultMetrics } from '../types/vault';

/**
 * Simplified vault manager for Arbitrum-only token vault contracts
 */
export class VaultManager {
  private config: Config;
  private vaultContracts: Map<string, Address> = new Map(); // token -> contract address
  
  // Updated ABI to match the new TokenYieldVault contract
  private readonly VAULT_ABI = parseAbi([
    'function deposit(address user, uint256 amount) external',
    'function withdraw(address user, uint256 amount) external',
    'function getUserDepositAmount(address user) external view returns (uint256)',
    'function userInfo(address) external view returns (uint256 depositAmount, uint256 lastDepositTime, bool isActive)',
    'function totalDeposits() external view returns (uint256)',
    'function token() external view returns (address)',
    'function bot() external view returns (address)',
    'event Deposit(address indexed user, uint256 amount)',
    'event Withdraw(address indexed user, uint256 amount)'
  ]);

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Add a vault contract for a specific token (on Arbitrum)
   */
  public addVaultContract(token: string, contractAddress: Address): void {
    this.vaultContracts.set(token, contractAddress);
    console.log(`📝 Added ${token} vault contract on Arbitrum: ${contractAddress}`);
  }

  /**
   * Get all vault contracts
   */
  public getVaultContracts(): Map<string, Address> {
    return this.vaultContracts;
  }

  /**
   * Record user deposit on vault contract (bot calls this when user sent funds or approved bot)
   */
//   async handleDeposit(token: string, userAddress: string, amount: string): Promise<void> {
//     console.log(`💰 Recording deposit for user ${userAddress}: ${amount} ${token}`);
    
//     const vaultContract = this.vaultContracts.get(token);
//     if (!vaultContract) {
//       throw new Error(`No vault contract found for token: ${token}`);
//     }

//     try {
//       // Call deposit function on vault contract (onlyBot, transfers from user to bot)
//       const hash = await this.config.arbitrumProvider.writeContract({
//         address: vaultContract,
//         abi: this.VAULT_ABI,
//         functionName: 'deposit',
//         args: [userAddress as Address, parseUnits(amount, 6)] // Assuming 6 decimals for USDC
//       });

//       console.log(`📝 Deposit recorded on vault contract: ${hash}`);
      
//     } catch (error) {
//       console.error(`❌ Failed to process deposit for ${userAddress}:`, error);
//       throw error;
//     }
//   }

//   /**
//    * Record user withdrawal from vault contract (bot calls this)
//    */
//   async handleWithdrawal(token: string, userAddress: string, amount: string): Promise<void> {
//     console.log(`💸 Recording withdrawal for user ${userAddress}: ${amount} ${token}`);
    
//     const vaultContract = this.vaultContracts.get(token);
//     if (!vaultContract) {
//       throw new Error(`No vault contract found for token: ${token}`);
//     }

//     try {
//       // Record the withdrawal on the vault contract
//       const hash = await this.config.publicClient.writeContract({
//         address: vaultContract,
//         abi: this.VAULT_ABI,
//         functionName: 'withdraw',
//         args: [userAddress as Address, parseUnits(amount, 6)]
//       });

//       console.log(`📝 Withdrawal recorded on vault contract: ${hash}`);
      
//     } catch (error) {
//       console.error(`❌ Failed to process withdrawal for ${userAddress}:`, error);
//       throw error;
//     }
//   }

//   /**
//    * Get user balance for a specific token vault
//    */
//   async getUserBalance(token: string, userAddress: string): Promise<UserBalance> {
//     const vaultContract = this.vaultContracts.get(token);
//     if (!vaultContract) {
//       throw new Error(`No vault contract found for token: ${token}`);
//     }

//     try {
//       const userInfo = await this.config.publicClient.readContract({
//         address: vaultContract,
//         abi: this.VAULT_ABI,
//         functionName: 'userInfo',
//         args: [userAddress as Address]
//       }) as [bigint, bigint, boolean];

//       const depositAmount = await this.config.publicClient.readContract({
//         address: vaultContract,
//         abi: this.VAULT_ABI,
//         functionName: 'getUserDepositAmount',
//         args: [userAddress as Address]
//       }) as bigint;

//       const totalDeposits = await this.config.publicClient.readContract({
//         address: vaultContract,
//         abi: this.VAULT_ABI,
//         functionName: 'totalDeposits'
//       }) as bigint;

//       const percentageOfVault = totalDeposits > 0n ? Number(depositAmount * 10000n / totalDeposits) / 100 : 0;

//       return {
//         user: userAddress,
//         depositAmount: depositAmount.toString(),
//         percentageOfVault,
//         lastDepositTime: Number(userInfo[1]),
//         isActive: userInfo[2]
//       };
//     } catch (error) {
//       console.error(`❌ Failed to get user balance for ${userAddress} in ${token} vault:`, error);
//       throw error;
//     }
//   }

  /**
   * Get vault metrics for a specific token
   */
//   async getVaultMetrics(token: string): Promise<VaultMetrics> {
//     const vaultContract = this.vaultContracts.get(token);
//     if (!vaultContract) {
//       throw new Error(`No vault contract found for token: ${token}`);
//     }

//     try {
//       const totalDeposits = await this.config.publicClient.readContract({
//         address: vaultContract,
//         abi: this.VAULT_ABI,
//         functionName: 'totalDeposits'
//       }) as bigint;

//       return {
//         totalValueLocked: formatUnits(totalDeposits, 6),
//         vaultBalance: '0', // Vault doesn't hold funds, they go directly to bot
//         totalUsers: 0, // Could track this if needed
//         averageAPY: 0   // Could calculate this if needed
//       };
//     } catch (error) {
//       console.error(`❌ Failed to get vault metrics for ${token}:`, error);
//       throw error;
//     }
//   }

  /**
   * Get vault ABI for event listening
   */
  public getVaultABI() {
    return this.VAULT_ABI;
  }

  /**
   * Get vault contract address for a token
   */
  public getVaultContract(token: string): Address | undefined {
    return this.vaultContracts.get(token);
  }
} 