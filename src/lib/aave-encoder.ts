import { encodeFunctionData, parseUnits, type Address, type Hex } from 'viem';

// Aave Pool contract ABI - essential functions
const AAVE_POOL_ABI = [
  {
    name: 'supply',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' }
    ]
  },
  {
    name: 'borrow',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' }
    ]
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'repay',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'setUserUseReserveAsCollateral',
    type: 'function',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'useAsCollateral', type: 'bool' }
    ]
  }
] as const;

// Aave Pool addresses by chain
export const AAVE_POOL_ADDRESSES = {
  // Ethereum Mainnet
  '1': '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  // Arbitrum
  '42161': '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  // Polygon
  '137': '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  // Optimism  
  '10': '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
} as const;

// Common token addresses by chain
export const TOKEN_ADDRESSES = {
  USDC: {
    '1': '0xA0b86a33E6441e06Db6E0d1A2Bb8040A7e2c8B1a',
    '42161': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    '137': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  },
  USDT: {
    '1': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    '42161': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    '137': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  WETH: {
    '1': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    '42161': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    '137': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  }
} as const;

export interface AaveCallParams {
  asset: Address;
  amount: string;
  userAddress: Address;
  referralCode?: number;
}

export interface OneBalanceCall {
  to: Address;
  data: Hex;
  value: string;
}

export class AaveEncoder {
  constructor() {
    // No need for interface initialization with viem
  }

  /**
   * Encode Aave supply function call
   */
  encodeSupply(params: AaveCallParams, chainId: string): OneBalanceCall {
    const poolAddress = AAVE_POOL_ADDRESSES[chainId as keyof typeof AAVE_POOL_ADDRESSES];
    if (!poolAddress) {
      throw new Error(`Aave not supported on chain ${chainId}`);
    }

    const data = encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: 'supply',
      args: [
        params.asset,
        BigInt(params.amount),
        params.userAddress,
        params.referralCode || 0
      ]
    });

    return {
      to: poolAddress as Address,
      data,
      value: '0x0'
    };
  }

  /**
   * Encode Aave borrow function call
   */
  encodeBorrow(
    params: AaveCallParams & { interestRateMode: 1 | 2 }, // 1 = stable, 2 = variable
    chainId: string
  ): OneBalanceCall {
    const poolAddress = AAVE_POOL_ADDRESSES[chainId as keyof typeof AAVE_POOL_ADDRESSES];
    if (!poolAddress) {
      throw new Error(`Aave not supported on chain ${chainId}`);
    }

    const data = encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: 'borrow',
      args: [
        params.asset,
        BigInt(params.amount),
        BigInt(params.interestRateMode),
        params.referralCode || 0,
        params.userAddress
      ]
    });

    return {
      to: poolAddress as Address,
      data,
      value: '0x0'
    };
  }

  /**
   * Encode Aave withdraw function call
   */
  encodeWithdraw(params: AaveCallParams, chainId: string): OneBalanceCall {
    const poolAddress = AAVE_POOL_ADDRESSES[chainId as keyof typeof AAVE_POOL_ADDRESSES];
    if (!poolAddress) {
      throw new Error(`Aave not supported on chain ${chainId}`);
    }

    const data = encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: 'withdraw',
      args: [
        params.asset,
        BigInt(params.amount),
        params.userAddress
      ]
    });

    return {
      to: poolAddress as Address,
      data,
      value: '0x0'
    };
  }

  /**
   * Encode Aave repay function call
   */
  encodeRepay(
    params: AaveCallParams & { interestRateMode: 1 | 2 },
    chainId: string
  ): OneBalanceCall {
    const poolAddress = AAVE_POOL_ADDRESSES[chainId as keyof typeof AAVE_POOL_ADDRESSES];
    if (!poolAddress) {
      throw new Error(`Aave not supported on chain ${chainId}`);
    }

    const data = encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: 'repay',
      args: [
        params.asset,
        BigInt(params.amount),
        BigInt(params.interestRateMode),
        params.userAddress
      ]
    });

    return {
      to: poolAddress as Address,
      data,
      value: '0x0'
    };
  }

  /**
   * Helper to format amounts with proper decimals
   */
  formatAmount(amount: string, decimals: number): string {
    return parseUnits(amount, decimals).toString();
  }

  /**
   * Get chain ID from EIP-155 format
   */
  getChainIdFromEIP155(eip155ChainId: string): string {
    const parts = eip155ChainId.split(':');
    if (parts.length !== 2 || !parts[1]) {
      throw new Error(`Invalid EIP-155 chain ID format: ${eip155ChainId}`);
    }
    return parts[1];
  }
}

// Export singleton instance
export const aaveEncoder = new AaveEncoder(); 