import { IBotInterface, BotStatus, BotEvent, BotEventType } from '../types';
import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { getApys } from "lending-apy-fetcher-ts";
import { allProtocols } from './protocols';
import { getBestAPYForEachToken } from '../utils/apy';

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

/**
 * Main Bot class that handles the lending vault operations
 */
export class Bot implements IBotInterface {
  private config: Config;
  private status: BotStatus = BotStatus.IDLE;
  private intervalId: NodeJS.Timeout | null = null;
  private apiClient: AxiosInstance;
  private accountAddressOneBalance: string | null = null;

  constructor(config: Config) {
    this.config = config;
    this.apiClient = apiClient(this.config.oneBalanceApiKey);
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

      while(true) {
        let apyData = await getApys(allProtocols);
        let bestApyData = getBestAPYForEachToken(apyData);
        console.log('🔍 Best APY data:', bestApyData); 
        await new Promise(resolve => setTimeout(resolve,  1000)); // 1 second
      }

      // // quote from eth -> arbitrum aave supply
      // const prepareQuoteRequest = await prepareCallRequestAaveSupply(this.config, this.accountAddressOneBalance!, '1', "USDC", "ARBITRUM", "POLYGON");
      // // console.log('🔍 Prepare quote request:', prepareQuoteRequest);

      // await executeAaveSupplyQuote(prepareQuoteRequest, this.config, this.accountAddressOneBalance!);
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
    const predictedAddress = await this.predictAccountAddress(wallet.address, wallet.address);
    this.accountAddressOneBalance = predictedAddress;
    console.log('🔍 Account address:', this.accountAddressOneBalance);
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
}