import { BotConfig } from '../types';
import { Wallet, JsonRpcProvider, ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
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
      [ARBITRUM]: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
      [POLYGON]: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
      [OPTIMISM]: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
    }
  }

  private _wallet: Wallet | null = null;
  public arbitrumProvider: JsonRpcProvider | null = null;

  constructor() {
    this.nodeEnv = process.env['NODE_ENV'] ?? 'development';
    this.logLevel = process.env['LOG_LEVEL'] ?? 'info';
    this.apiUrl = process.env['API_URL'] ?? 'https://api.example.com';
    this.privateKey = process.env['PRIVATE_KEY'] ?? '';
    this.rpcUrl = process.env['ARBITRUM_RPC_URL'] ?? 'https://arb1.arbitrum.io/rpc';
    this.oneBalanceApiKey = process.env['ONE_BALANCE_API_KEY'] ?? '';
    this.arbitrumProvider = new ethers.JsonRpcProvider(this.rpcUrl);
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