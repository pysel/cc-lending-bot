import { BotConfig } from '../types';
import { Wallet, JsonRpcProvider, ethers } from 'ethers';
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ETHEREUM, ARBITRUM, POLYGON, OPTIMISM } from 'lending-apy-fetcher-ts';

/**
 * Configuration class for managing environment variables and settings
 */
export class Config implements BotConfig {
  public readonly nodeEnv: string;
  public readonly logLevel: string;
  public readonly apiUrl: string;
  public readonly privateKey: string;
  public readonly rpcUrl: string;
  public readonly oneBalanceApiKey: string;
  public addressOneBalance: string | null = null;

  public readonly aaveLendingPools: Record<string, string> = {
    'eip155:1': '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    'eip155:42161': '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    'eip155:137': '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    'eip155:10': '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  }

  public readonly chainsHumanToOB: Record<string, string> = {
    [ETHEREUM]: 'eip155:1',
    [ARBITRUM]: 'eip155:42161',
    [POLYGON]: 'eip155:137',
    [OPTIMISM]: 'eip155:10',
  }

  public readonly assetsHumanToChainAddress: Record<string, Record<string, string>> = {
    "USDC": { 
      [ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      [ARBITRUM]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      [POLYGON]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      [OPTIMISM]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    },
    "aUSDC": {
      [ETHEREUM]: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
      [ARBITRUM]: '0x724dc807b04555b71ed48a6896b6F41593b8C637',
      [POLYGON]: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
      [OPTIMISM]: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
    },
    "USDT": { 
      [ETHEREUM]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      [ARBITRUM]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      [POLYGON]: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      [OPTIMISM]: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    },
    "aUSDT": {
      [ETHEREUM]: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
      [ARBITRUM]: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
      [POLYGON]: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
      [OPTIMISM]: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
    }
  }

  public readonly arbitrumVaults: Record<string, string> = {
    "USDC": "0xc433DC0586EA17eDFA4B9Ea2987B3eAf177B50F4", // Arbitrum USDC vault contract
    "USDT": "0x152Cf498fA14dB52D3e6797066C7D528e8023535", // Arbitrum USDT vault contract
  }

  private _wallet: Wallet | null = null;
  public arbitrumProvider: JsonRpcProvider | null = null;
  public publicClient: ReturnType<typeof createPublicClient> | null = null;
  public walletClient: ReturnType<typeof createWalletClient> | null = null;

  constructor() {
    this.nodeEnv = process.env['NODE_ENV'] ?? 'development';
    this.logLevel = process.env['LOG_LEVEL'] ?? 'info';
    this.apiUrl = process.env['API_URL'] ?? 'https://api.example.com';
    this.privateKey = process.env['PRIVATE_KEY'] ?? '';
    this.rpcUrl = process.env['ARBITRUM_RPC_URL'] ?? 'https://arb1.arbitrum.io/rpc';
    this.oneBalanceApiKey = process.env['ONE_BALANCE_API_KEY'] ?? '';
    this.arbitrumProvider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    // Initialize viem clients for Arbitrum
    this.publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(this.rpcUrl)
    });
    
    if (this.privateKey) {
      this.walletClient = createWalletClient({
        chain: arbitrum,
        transport: http(this.rpcUrl),
        account: privateKeyToAccount(this.privateKey as `0x${string}`)
      });
    }
  }

  /**
   * Gets the wallet instance (creates it lazily)
   */
  public getWallet(): Wallet {
    if (!this._wallet) {
      if (!this.privateKey) {
        throw new Error('Private key not found in environment variables');
      }
      this._wallet = new Wallet(this.privateKey, this.arbitrumProvider);
    }
    return this._wallet;
  }

  public chainsOBToHuman(chain: string): string {
    return Object.keys(this.chainsHumanToOB).find(key => this.chainsHumanToOB[key] === chain)!;
  }

  /**
   * Validates that all required configuration values are present
   */
  public isValid(): boolean {
    const requiredFields = [
      'privateKey',
    ];

    for (const field of requiredFields) {
      const value = this[field as keyof this];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        console.error(`❌ Missing required configuration: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Returns whether the application is running in development mode
   */
  public isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  /**
   * Returns whether the application is running in production mode
   */
  public isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  /**
   * Returns configuration as a plain object (useful for logging)
   */
  public toObject(): Record<string, unknown> {
    return {
      nodeEnv: this.nodeEnv,
      logLevel: this.logLevel,
      apiUrl: this.apiUrl,
      // Don't include sensitive data like API keys
    };
  }
}

export const config = new Config(); 