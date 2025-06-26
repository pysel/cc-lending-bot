// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import { config } from './config';
import { Bot } from './bot';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 Starting CC Lending Vault Bot...');
    
    // Validate configuration
    if (!config.isValid()) {
      throw new Error('Invalid configuration. Please check your environment variables.');
    }

    // Initialize bot
    const bot = new Bot(config);
    
    // Start bot
    await bot.start();
    
    console.log('✅ Bot started successfully!');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  void main();
} 