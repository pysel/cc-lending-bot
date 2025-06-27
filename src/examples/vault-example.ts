// import { Config } from '../config';
// import { Bot } from '../bot';

// async function main() {
//   // Simple Arbitrum-focused configuration
//   const config = new Config();
  
//   // Bot automatically initializes with vault contracts on Arbitrum
//   const bot = new Bot(config);
  
//   console.log('🏦 Vault system ready on Arbitrum');
//   console.log('🔍 Bot will listen for events on vault contracts');
  
//   // Start the bot:
//   // 1. Starts yield farming operations across all chains
//   // 2. Listens for vault deposit/withdrawal events on Arbitrum only
//   // 3. Automatically processes events and optimizes yields
//   await bot.start();
  
//   console.log('✅ Bot started - listening for vault events on Arbitrum');
//   console.log('💡 Add more token vaults by updating initializeVault() in Bot constructor');
  
//   // Example: Check vault information after some time
//   setTimeout(async () => {
//     try {
//       const vaultInfo = await bot.getAllVaultInfo();
//       console.log('📊 Current vault information:', vaultInfo);
      
//       // Check specific user balance
//       const userBalance = await bot.getUserBalance('USDC', '0x...user-address');
//       console.log('👤 User balance:', userBalance);
//     } catch (error) {
//       console.error('Error getting vault info:', error);
//     }
//   }, 10000);
// }

// // Simple contract interaction pattern:

// /* 
// SIMPLIFIED ARBITRUM VAULT EVENT LISTENING:

// SETUP:
// - All vault contracts live on Arbitrum only
// - Bot listens to contract events using config.publicClient
// - Each token (USDC, USDT, etc.) has its own vault contract
// - Only bot can call deposit function, users send/approve tokens

// DEPOSIT FLOW:
// 1. User sends tokens to bot's OneBalance address OR approves bot for spending
// 2. Bot calls vault.deposit(user, amount) → Transfers tokens from user to bot directly
// 3. Contract emits Deposit(user, amount) event 
// 4. Bot detects event → Funds already in bot's OneBalance account
// 5. Bot immediately supplies funds to best Aave pool across any chain

// WITHDRAWAL FLOW (Bot processes user withdrawal):  
// 1. Bot withdraws from Aave → Sends to user → Calls vault.withdraw(user, amount)
// 2. Contract emits Withdraw(user, amount) event
// 3. Bot detects event for tracking/logging

// ADDING NEW TOKENS:
// Just add to the initializeVault() call in Bot constructor:
// ```
// this.initializeVault({
//   "USDC": "0x705ff894d65cD40A4cc3074fC9a73a9bEe5ef43D",
//   "USDT": "0x...new-usdt-vault-address",
//   "DAI":  "0x...new-dai-vault-address"
// });
// ```

// KEY BENEFITS:
// - Bot-controlled deposits: only bot can initiate deposits
// - Direct fund flow: tokens go from user to bot during deposit
// - No intermediate vault balance to manage
// - Immediate Aave allocation possible
// - Secure: user approvals or direct sends to bot

// ENVIRONMENT:
// ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
// PRIVATE_KEY=0x...
// ONE_BALANCE_API_KEY=...
// */

// if (require.main === module) {
//   main().catch(console.error);
// }

// export { main }; 