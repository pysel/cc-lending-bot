import { Wallet } from 'ethers';
import { ChainOperation, Quote } from '../types/onebalance';

/**
 * Signs typed data using an ethers wallet (EIP-712)
 * @param wallet - The ethers wallet instance
 * @param typedData - The typed data to sign
 * @returns The signature as a hex string
 */
export const signTypedDataWithEthers = async (
  wallet: Wallet,
  typedData: any
): Promise<`0x${string}`> => {
  try {
    // Extract the domain, types, and message from the typed data
    const { domain, types, message } = typedData;
    
    // Remove the 'EIP712Domain' from types as ethers handles this internally
    const typesWithoutDomain = { ...types };
    delete typesWithoutDomain.EIP712Domain;
    
    // Sign the typed data using ethers
    const signature = await wallet.signTypedData(domain, typesWithoutDomain, message);
    
    return signature as `0x${string}`;
  } catch (error) {
    console.error('Error signing typed data:', error);
    throw error;
  }
};

/**
 * Signs a chain operation for OneBalance using ethers wallet
 * @param wallet - The ethers wallet instance
 * @returns A function that takes a ChainOperation and returns a promise of signed ChainOperation
 */
export const signOperation = (wallet: Wallet) => 
  (operation: ChainOperation) => 
  async (): Promise<ChainOperation> => {
    try {
      const signature = await signTypedDataWithEthers(wallet, operation.typedDataToSign);

      return {
        ...operation,
        userOp: { 
          ...operation.userOp, 
          signature 
        },
      };
    } catch (error) {
      console.error('Error signing operation:', error);
      throw error;
    }
  };

/**
 * Signs an entire quote (all chain operations) using ethers wallet
 * @param quote - The quote containing multiple chain operations
 * @param wallet - The ethers wallet instance
 * @returns The fully signed quote
 */
export const signQuote = async (quote: Quote, wallet: Wallet): Promise<Quote> => {
  try {
    const signWithWallet = signOperation(wallet);

    const signedQuote: Quote = {
      ...quote,
      originChainsOperations: [],
    };

    // Sign all origin chain operations sequentially
    if (quote.originChainsOperations && quote.originChainsOperations.length > 0) {
      signedQuote.originChainsOperations = await sequentialPromises(
        quote.originChainsOperations.map(signWithWallet)
      );
    }

    // Sign destination chain operation if it exists
    if (quote.destinationChainOperation) {
      signedQuote.destinationChainOperation = await signWithWallet(
        quote.destinationChainOperation
      )();
    }

    return signedQuote;
  } catch (error) {
    console.error('Error signing quote:', error);
    throw error;
  }
};

/**
 * Helper function to run an array of lazy promises in sequence
 * This ensures operations are signed in the correct order to avoid nonce conflicts
 */
export const sequentialPromises = <T>(promises: (() => Promise<T>)[]): Promise<T[]> => {
  return promises.reduce<Promise<T[]>>(
    (acc, curr) => acc.then(results => curr().then(result => [...results, result])),
    Promise.resolve([])
  );
};