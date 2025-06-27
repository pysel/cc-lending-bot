import { Wallet } from "ethers";

/**
 * Configuration interface for the bot
 */
export interface BotConfig {
  nodeEnv: string;
  logLevel: string;
  apiUrl: string;
  privateKey: string;
  oneBalanceApiKey: string;
  aaveLendingPools: Record<string, string>;
  chainsHumanToOB: Record<string, string>;
  // assetsHumanToOB: Record<string, string>;
  getWallet(): Wallet;
  isValid(): boolean;
  isDevelopment(): boolean;
  isProduction(): boolean;
  toObject(): Record<string, unknown>;
}

/**
 * Bot interface defining the main bot functionality
 */
export interface IBotInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * Generic API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Bot status enumeration
 */
export enum BotStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Bot event types
 */
export enum BotEventType {
  START = 'start',
  STOP = 'stop',
  ERROR = 'error',
  MESSAGE = 'message',
}

/**
 * Bot event interface
 */
export interface BotEvent {
  type: BotEventType;
  timestamp: Date;
  data?: unknown;
  message?: string;
} 