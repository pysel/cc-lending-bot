/**
 * User balance information
 */
export interface UserBalance {
  user: string;
  depositAmount: string;          // User's principal deposit amount
  percentageOfVault: number;      // User's percentage of total deposits
  lastDepositTime: number;        // Last deposit timestamp
  isActive: boolean;              // Whether user is active
}

/**
 * Vault metrics for reporting
 */
export interface VaultMetrics {
  totalValueLocked: string;       // Total deposits (principal)
  vaultBalance: string;           // Current vault balance
  totalUsers: number;             // Number of active users
  averageAPY: number;             // Current estimated APY
} 