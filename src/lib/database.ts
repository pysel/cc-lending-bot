import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

export interface Allocation {
  amount: string;
  atAPY: number;
  chain: string;
}

export interface BotData {
  lastKnownBlock: number;
  allocations: Record<string, Allocation>;
}

let defaultData: BotData = {
  lastKnownBlock: 353872007, // Start from recent block
  allocations: {}
};

export class DatabaseManager {
  private db: Low<BotData>;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'bot-state.json');
    const adapter = new JSONFile<BotData>(this.dbPath);
    this.db = new Low(adapter, defaultData);
  }

  /**
   * Initialize the database
   */
  async initialize(initializedVaults: Record<string, string>): Promise<void> {
    await this.db.read();

    for (const [token, _] of Object.entries(initializedVaults)) {
      defaultData.allocations[token] = {
        amount: '0',
        atAPY: 0,
        chain: "ARBITRUM"
      };
    }
    this.db.data ||= defaultData;

    await this.db.write();
    console.log('📂 Database initialized at:', this.dbPath);
  }

  /**
   * Get last known block number
   */
  async getLastKnownBlock(): Promise<number> {
    await this.db.read();
    return this.db.data.lastKnownBlock;
  }

  /**
   * Set last known block number
   */
  async setLastKnownBlock(blockNumber: number): Promise<void> {
    await this.db.read();
    this.db.data.lastKnownBlock = blockNumber;
    await this.db.write();
  }

  /**
   * Get allocation for a specific token
   */
  async getAllocation(token: string): Promise<Allocation | null> {
    await this.db.read();
    return this.db.data.allocations[token] || null;
  }

  /**
   * Set allocation for a specific token
   */
  async setAllocation(token: string, allocation: Allocation): Promise<void> {
    await this.db.read();
    this.db.data.allocations[token] = allocation;
    await this.db.write();
  }

  /**
   * Get complete bot state
   */
  async getBotState(): Promise<BotData> {
    await this.db.read();
    return {
      lastKnownBlock: this.db.data.lastKnownBlock,
      allocations: { ...this.db.data.allocations }
    };
  }

  /**
   * Set complete bot state
   */
  async setBotState(state: Partial<BotData>): Promise<void> {
    await this.db.read();
    if (state.lastKnownBlock !== undefined) {
      this.db.data.lastKnownBlock = state.lastKnownBlock;
    }
    if (state.allocations !== undefined) {
      this.db.data.allocations = state.allocations;
    }
    await this.db.write();
  }

  /**
   * Check if database is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.db.read();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
} 