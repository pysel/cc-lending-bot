import { parseAbi, Address, formatUnits, parseUnits } from 'viem';
import { Config } from '../config';
import { UserBalance, VaultMetrics } from '../types/vault';
import { ethers } from 'ethers';

/**
 * Simplified vault manager for Arbitrum-only token vault contracts
 */
export class VaultManager {
  private config: Config;
  private vaultContracts: Map<string, Address> = new Map(); // token -> contract address
  
  // Ethers ABI for contract interactions
  private readonly VAULT_ABI_ETHERS = [
    // View functions
    'function getCurrentATokenBalance() external view returns (uint256)',
    'function getSharePrice() external view returns (uint256)',
    'function calculateSharesToMint(uint256 depositAmount) external view returns (uint256)',
    'function calculateTokensForShares(uint256 shares) external view returns (uint256)',
    'function getUserWithdrawableAmount(address user) external view returns (uint256)',
    'function getUserShares(address user) external view returns (uint256)',
    'function getUserDepositAmount(address user) external view returns (uint256)',
    'function getTotalYieldEarned() external view returns (uint256)',
    'function getUserYieldAmount(address user) external view returns (uint256)',
    
    // State view functions
    'function userInfo(address) external view returns (uint256 shares, uint256 lastDepositTime, bool isActive)',
    'function totalShares() external view returns (uint256)',
    'function totalDeposits() external view returns (uint256)',
    'function currentAllocation() external view returns (string)',
    'function currentAPY() external view returns (uint256)',
    'function token() external view returns (address)',
    'function aToken() external view returns (address)',
    'function bot() external view returns (address)',
    
    // Write functions
    'function deposit(address user, uint256 amount) external',
    'function withdraw(address user, uint256 amount) external',
    'function setCurrentAllocation(string _currentAllocation, uint256 _currentAPY) external',
    
    // Events
    'event Deposit(address indexed user, uint256 amount, uint256 shares)',
    'event Withdraw(address indexed user, uint256 amount, uint256 shares)'
  ];

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
   * Get vault ABI for event listening
   */
  // public getVaultABI() {
  //   return this.VAULT_ABI;
  // }

  /**
   * Get vault contract address for a token
   */
  public getVaultContract(token: string): Address | undefined {
    return this.vaultContracts.get(token);
  }

  /**
   * Get comprehensive user information including shares and yield
   */
  async getUserInfo(token: string, userAddress: string): Promise<{
    shares: string;
    withdrawableAmount: string;
    originalDeposit: string;
    yieldEarned: string;
    lastDepositTime: number;
    isActive: boolean;
    sharePrice: string;
  }> {
    const vaultContract = this.vaultContracts.get(token);
    if (!vaultContract) {
      throw new Error(`No vault contract found for token: ${token}`);
    }

    if (!this.config.arbitrumProvider) {
      throw new Error('Arbitrum provider not initialized');
    }

    try {
      const contract = new ethers.Contract(vaultContract, this.VAULT_ABI_ETHERS, this.config.arbitrumProvider);

      const [shares, withdrawableAmount, originalDeposit, yieldEarned, userInfo, sharePrice] = await Promise.all([
        contract['getUserShares']!(userAddress),
        contract['getUserWithdrawableAmount']!(userAddress),
        contract['getUserDepositAmount']!(userAddress),
        contract['getUserYieldAmount']!(userAddress),
        contract['userInfo']!(userAddress),
        contract['getSharePrice']!()
      ]);

      // Determine decimals based on token (6 for USDC, 18 for others)
      const decimals = token.toLowerCase() === 'usdc' ? 6 : 18;

      return {
        shares: ethers.formatUnits(shares, decimals),
        withdrawableAmount: ethers.formatUnits(withdrawableAmount, decimals),
        originalDeposit: ethers.formatUnits(originalDeposit, decimals),
        yieldEarned: ethers.formatUnits(yieldEarned, decimals),
        lastDepositTime: Number(userInfo[1]),
        isActive: userInfo[2],
        sharePrice: ethers.formatUnits(sharePrice, 18) // Share price is always 18 decimals
      };
    } catch (error) {
      console.error(`❌ Failed to get user info for ${userAddress} in ${token} vault:`, error);
      throw error;
    }
  }

  /**
   * Get vault metrics including yield information
   */
  async getVaultMetrics(token: string): Promise<{
    totalShares: string;
    totalDeposits: string;
    currentATokenBalance: string;
    totalYieldEarned: string;
    sharePrice: string;
    currentAllocation: string;
    currentAPY: number;
  }> {
    const vaultContract = this.vaultContracts.get(token);
    if (!vaultContract) {
      throw new Error(`No vault contract found for token: ${token}`);
    }

    if (!this.config.arbitrumProvider) {
      throw new Error('Arbitrum provider not initialized');
    }

    try {
      const contract = new ethers.Contract(vaultContract, this.VAULT_ABI_ETHERS, this.config.arbitrumProvider);

      const [totalShares, totalDeposits, aTokenBalance, totalYield, sharePrice, allocation, apy] = await Promise.all([
        contract['totalShares']!(),
        contract['totalDeposits']!(),
        contract['getCurrentATokenBalance']!(),
        contract['getTotalYieldEarned']!(),
        contract['getSharePrice']!(),
        contract['currentAllocation']!(),
        contract['currentAPY']!()
      ]);

      // Determine decimals based on token
      const decimals = token.toLowerCase() === 'usdc' ? 6 : 18;

      return {
        totalShares: ethers.formatUnits(totalShares, decimals),
        totalDeposits: ethers.formatUnits(totalDeposits, decimals),
        currentATokenBalance: ethers.formatUnits(aTokenBalance, decimals),
        totalYieldEarned: ethers.formatUnits(totalYield, decimals),
        sharePrice: ethers.formatUnits(sharePrice, 18),
        currentAllocation: allocation,
        currentAPY: Number(apy) / 100 // Convert from basis points to percentage
      };
    } catch (error) {
      console.error(`❌ Failed to get vault metrics for ${token}:`, error);
      throw error;
    }
  }

  /**
   * Calculate how many shares would be minted for a deposit amount
   */
  async calculateSharesToMint(token: string, depositAmount: string): Promise<string> {
    const vaultContract = this.vaultContracts.get(token);
    if (!vaultContract) {
      throw new Error(`No vault contract found for token: ${token}`);
    }

    if (!this.config.arbitrumProvider) {
      throw new Error('Arbitrum provider not initialized');
    }

    const decimals = token.toLowerCase() === 'usdc' ? 6 : 18;
    const amount = ethers.parseUnits(depositAmount, decimals);

    try {
      const contract = new ethers.Contract(vaultContract, this.VAULT_ABI_ETHERS, this.config.arbitrumProvider);
      const shares = await contract['calculateSharesToMint']!(amount);

      return ethers.formatUnits(shares, decimals);
    } catch (error) {
      console.error(`❌ Failed to calculate shares for ${depositAmount} ${token}:`, error);
      throw error;
    }
  }

  /**
   * Calculate token amount for a given number of shares
   */
  async calculateTokensForShares(token: string, sharesAmount: string): Promise<string> {
    const vaultContract = this.vaultContracts.get(token);
    if (!vaultContract) {
      throw new Error(`No vault contract found for token: ${token}`);
    }

    if (!this.config.arbitrumProvider) {
      throw new Error('Arbitrum provider not initialized');
    }

    const decimals = token.toLowerCase() === 'usdc' ? 6 : 18;
    const shares = ethers.parseUnits(sharesAmount, decimals);

    try {
      const contract = new ethers.Contract(vaultContract, this.VAULT_ABI_ETHERS, this.config.arbitrumProvider);
      const tokens = await contract['calculateTokensForShares']!(shares);

      return ethers.formatUnits(tokens, decimals);
    } catch (error) {
      console.error(`❌ Failed to calculate tokens for ${sharesAmount} shares in ${token}:`, error);
      throw error;
    }
  }

  /**
   * Update vault's current allocation and APY (bot only)
   */
  async updateAllocation(token: string, allocation: string, apy: number): Promise<void> {
    const vaultContract = this.vaultContracts.get(token);
    if (!vaultContract) {
      throw new Error(`No vault contract found for token: ${token}`);
    }

    try {
      const wallet = this.config.getWallet();
      const contract = new ethers.Contract(vaultContract, this.VAULT_ABI_ETHERS, wallet);

      const tx = await contract['setCurrentAllocation']!(allocation, Math.round(apy * 100)); // Convert percentage to basis points
      const receipt = await tx.wait();

      console.log(`📝 Updated ${token} vault allocation to ${allocation} (${apy}% APY): ${receipt.hash}`);
    } catch (error) {
      console.error(`❌ Failed to update allocation for ${token} vault:`, error);
      throw error;
    }
  }
} 