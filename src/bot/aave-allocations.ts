import { executeQuote, fetchCallQuote, fetchTransactionHistory, prepareCallQuote } from '../lib/onebalance';
import { signOperation } from '../lib/signer';
import { CallRequest, EvmAccount, PrepareCallRequest } from '../types/onebalance';
import { Wallet } from 'ethers';

import {ethereumProvider, arbitrumProvider, polygonProvider, optimismProvider } from "lending-apy-fetcher-ts";
import { ETHEREUM, ARBITRUM, POLYGON, OPTIMISM } from "lending-apy-fetcher-ts";
import { ethers } from "ethers";

// ERC-20 ABI with essential functions
export const ERC20_ABI = [
    // Read-only functions
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    
    // State-changing functions
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    
    // Events
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export async function fetchAaveAllocationForToken(protocol: string, aToken: string, accountAddress: string): Promise<{ balance: string }> {
    let provider;
    
    // Select the appropriate provider based on protocol
    if (protocol === ETHEREUM) {
        provider = ethereumProvider;
    } else if (protocol === ARBITRUM) {
        provider = arbitrumProvider;
    } else if (protocol === POLYGON) {
        provider = polygonProvider;
    } else if (protocol === OPTIMISM) {
        provider = optimismProvider;
    } else {
        throw new Error(`Unsupported protocol: ${protocol}`);
    }

    if (!provider) {
        throw new Error(`Provider not available for protocol: ${protocol}`);
    }

    try {
        const balance = await getERC20Balance(provider, aToken, accountAddress);
        return {
            balance: balance,
        };
    } catch (error) {
        console.error(`Error fetching allocation for token ${aToken} on ${protocol}:`, error);
        throw error;
    }
}

// Helper function to format balance with decimals
export function formatTokenBalance(balance: string, decimals: number): string {
    return ethers.formatUnits(balance, decimals);
}

export async function getERC20Balance(provider: any, tokenAddress: string, accountAddress: string): Promise<string> {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract['balanceOf']!(accountAddress);
    return balance.toString();
}
/**
 * Executes the AAVE supply quote workflow
 * @param prepareQuoteRequest - The prepared quote request
 * @param evmAccount - The EVM account details
 * @param config - Bot configuration
 * @returns Promise<void>
 */
export async function executeAaveQuote(
  prepareQuoteRequest: PrepareCallRequest,
  wallet: Wallet,
  accountAddressOneBalance: string,
  aggregatedAssetId: string
): Promise<void> {

  const evmAccount: EvmAccount = {
    accountAddress: accountAddressOneBalance as `0x${string}`,
    sessionAddress: wallet.address as `0x${string}`,
    adminAddress: wallet.address as `0x${string}`,
  };

  // Prepare the quote
  const preparedQuote = await prepareCallQuote(prepareQuoteRequest);
  // console.log('🔍 Quote:', preparedQuote);

  // Sign the chain operation
  const signedChainOp = await signOperation(preparedQuote.chainOperation, wallet.privateKey as `0x${string}`);
  // console.log('🔍 Signed chain op:', signedChainOp);

  console.log('🔍 Aggregated asset id:', aggregatedAssetId);
  // Create the call request
  const callRequest: CallRequest = {
    fromAggregatedAssetId: aggregatedAssetId,
    account: evmAccount,
    tamperProofSignature: preparedQuote.tamperProofSignature,
    chainOperation: signedChainOp,
  };

  // Fetch the call quote
  const quote = await fetchCallQuote(callRequest);

  // Execute the quote
  console.log('🔍 Executing quote:', quote);
  const bundle = await executeQuote(quote);

  // Monitor transaction completion
  if (bundle.success) {
    const timeout = 60_000;
    let completed = false;
    const startTime = Date.now();

    while (!completed) {
      try {
        const transactionHistory = await fetchTransactionHistory(quote.account.accountAddress);

        if (transactionHistory.transactions.length > 0) {
          const [tx] = transactionHistory.transactions;

          if (tx?.quoteId === quote.id) {
            if (tx?.status === 'COMPLETED') {
              console.log('Transaction completed and operation executed');
              completed = true;
              break;
            }
            console.log('Transaction status: ', tx.status);
          }
        }
      } catch {}

      if (Date.now() - startTime > timeout) {
        throw new Error('Transaction not completed in time');
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  } else {
    console.log('Bundle execution failed');
  }
}


/**
 * Executes the AAVE withdraw quote workflow
 * @param prepareQuoteRequest - The prepared quote request
 * @param wallet - The wallet instance
 * @param accountAddressOneBalance - The OneBalance account address
 * @param aggregatedAssetId - The aggregated asset ID
 * @returns Promise<void>
 */
// export async function executeAaveWithdrawQuote(
//   prepareQuoteRequest: PrepareCallRequest,
//   wallet: Wallet,
//   accountAddressOneBalance: string,
//   aggregatedAssetId: string
// ): Promise<void> {

//   const evmAccount: EvmAccount = {
//     accountAddress: accountAddressOneBalance as `0x${string}`,
//     sessionAddress: wallet.address as `0x${string}`,
//     adminAddress: wallet.address as `0x${string}`,
//   };

//   // Prepare the quote
//   const preparedQuote = await prepareCallQuote(prepareQuoteRequest);
//   // console.log('🔍 Quote:', preparedQuote);

//   // Sign the chain operation
//   const signedChainOp = await signOperation(preparedQuote.chainOperation, wallet.privateKey as `0x${string}`);
//   console.log('🔍 Signed chain op:', signedChainOp);

//   // Create the call request
//   const callRequest: CallRequest = {
//     fromAggregatedAssetId: aggregatedAssetId,
//     account: evmAccount,
//     tamperProofSignature: preparedQuote.tamperProofSignature,
//     chainOperation: signedChainOp,
//   };

//   // Fetch the call quote
//   const quote = await fetchCallQuote(callRequest);

//   // Execute the quote
//   const bundle = await executeQuote(quote);

//   // Monitor transaction completion
//   if (bundle.success) {
//     const timeout = 60_000;
//     let completed = false;
//     const startTime = Date.now();

//     while (!completed) {
//       try {
//         const transactionHistory = await fetchTransactionHistory(quote.account.accountAddress);

//         if (transactionHistory.transactions.length > 0) {
//           const [tx] = transactionHistory.transactions;

//           if (tx?.quoteId === quote.id) {
//             if (tx?.status === 'COMPLETED') {
//               console.log('Withdrawal transaction completed and operation executed');
//               completed = true;
//               break;
//             }
//             console.log('Withdrawal transaction status: ', tx.status);
//           }
//         }
//       } catch {}

//       if (Date.now() - startTime > timeout) {
//         throw new Error('Withdrawal transaction not completed in time');
//       }

//       await new Promise((resolve) => setTimeout(resolve, 1_000));
//     }
//   } else {
//     console.log('Withdrawal bundle execution failed');
//   }
// } 

