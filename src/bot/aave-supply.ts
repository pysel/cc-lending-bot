import { executeQuote, fetchCallQuote, fetchTransactionHistory, prepareCallQuote } from '../lib/onebalance';
import { signOperation } from '../lib/signer';
import { CallRequest, EvmAccount, PrepareCallRequest } from '../types/onebalance';
import { Config } from '../config';

/**
 * Executes the AAVE supply quote workflow
 * @param prepareQuoteRequest - The prepared quote request
 * @param evmAccount - The EVM account details
 * @param config - Bot configuration
 * @returns Promise<void>
 */
export async function executeAaveSupplyQuote(
  prepareQuoteRequest: PrepareCallRequest,
  config: Config,
  accountAddressOneBalance: string
): Promise<void> {

  const evmAccount: EvmAccount = {
    accountAddress: accountAddressOneBalance as `0x${string}`,
    sessionAddress: config.getWallet().address as `0x${string}`,
    adminAddress: config.getWallet().address as `0x${string}`,
  };

  // Prepare the quote
  const preparedQuote = await prepareCallQuote(prepareQuoteRequest);
  // console.log('🔍 Quote:', preparedQuote);

  // Sign the chain operation
  const signedChainOp = await signOperation(preparedQuote.chainOperation, config.privateKey as `0x${string}`);
  console.log('🔍 Signed chain op:', signedChainOp);

  // Create the call request
  const callRequest: CallRequest = {
    fromAggregatedAssetId: 'ds:usdc',
    account: evmAccount,
    tamperProofSignature: preparedQuote.tamperProofSignature,
    chainOperation: signedChainOp,
  };

  // Fetch the call quote
  const quote = await fetchCallQuote(callRequest);
  console.log('🔍 Call quote:', quote);

  // Execute the quote
  const bundle = await executeQuote(quote);
  console.log('🔍 Execute quote:', bundle);

  // Get transaction history
  const history = await fetchTransactionHistory(evmAccount.accountAddress);
  console.log('🔍 Transaction history:', history);

  // Monitor transaction completion
  if (bundle.success) {
    console.log('Bundle executed');

    const timeout = 60_000;
    let completed = false;
    const startTime = Date.now();

    while (!completed) {
      try {
        console.log('fetching transaction history...');
        const transactionHistory = await fetchTransactionHistory(quote.account.accountAddress);

        console.log('transactionHistory', transactionHistory);

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