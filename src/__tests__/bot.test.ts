import { Bot } from '../bot';
import { BotConfig, BotStatus } from '../types';

// Mock configuration for testing
const mockConfig: BotConfig = {
  nodeEnv: 'test',
  logLevel: 'error',
  apiKey: 'test-api-key',
  apiUrl: 'https://test-api.com',
  port: 3000,
  isValid: jest.fn(() => true),
  isDevelopment: jest.fn(() => false),
  isProduction: jest.fn(() => false),
  toObject: jest.fn(() => ({
    nodeEnv: 'test',
    logLevel: 'error',
    apiUrl: 'https://test-api.com',
    port: 3000,
  })),
};

describe('Bot', () => {
  let bot: Bot;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    bot = new Bot(mockConfig);
  });

  afterEach(async () => {
    // Ensure bot is stopped after each test
    if (bot.isRunning()) {
      await bot.stop();
    }
  });

  describe('constructor', () => {
    it('should initialize bot with provided config', () => {
      expect(bot).toBeInstanceOf(Bot);
      expect(bot.isRunning()).toBe(false);
      expect(bot.getStatus()).toBe(BotStatus.IDLE);
    });
  });

  describe('start', () => {
    it('should start the bot successfully', async () => {
      await bot.start();
      expect(bot.isRunning()).toBe(true);
      expect(bot.getStatus()).toBe(BotStatus.RUNNING);
    });

    it('should not start if already running', async () => {
      await bot.start();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await bot.start(); // Try to start again
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Bot is already running');
      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop the bot successfully', async () => {
      await bot.start();
      expect(bot.isRunning()).toBe(true);
      
      await bot.stop();
      expect(bot.isRunning()).toBe(false);
      expect(bot.getStatus()).toBe(BotStatus.STOPPED);
    });

    it('should handle stop when not running', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await bot.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Bot is not running');
      expect(bot.getStatus()).toBe(BotStatus.IDLE);
      consoleSpy.mockRestore();
    });
  });

  describe('isRunning', () => {
    it('should return false when bot is not started', () => {
      expect(bot.isRunning()).toBe(false);
    });

    it('should return true when bot is running', async () => {
      await bot.start();
      expect(bot.isRunning()).toBe(true);
    });
  });
}); 