import { custom, Address, createWalletClient, Hash, Hex } from "viem";
import { ChainOperation, Quote } from "../types/onebalance";
import { Wallet } from 'ethers';

/**
 * Signs a chain operation for OneBalance using Privy's EIP-1193 provider
 * @param chainOperation - The chain operation to sign
 * @param wallet - The Privy ConnectedWallet
 * @returns The signed chain operation
 */
export const signOperation =
  (embeddedWallet: Wallet) =>
  (operation: ChainOperation): (() => Promise<ChainOperation>) =>
  async () => {
    const signature = await signTypedDataWithPrivy(embeddedWallet)(operation.typedDataToSign);

  return {
    ...operation,
    userOp: { ...operation.userOp, signature },
  };
};

export const signQuote = async (quote: Quote, embeddedWallet: Wallet) => {
  const signWithEmbeddedWallet = signOperation(embeddedWallet);

  const signedQuote = {
    ...quote,
  };

  signedQuote.originChainsOperations = await sequentialPromises(
    quote.originChainsOperations.map(signWithEmbeddedWallet)
  );

  if (quote.destinationChainOperation) {
    signedQuote.destinationChainOperation = await signWithEmbeddedWallet(
      quote.destinationChainOperation
    )();
  }

  return signedQuote;
};

export const signTypedDataWithPrivy =
  (embeddedWallet: Wallet) =>
  async (typedData: any): Promise<Hash> => {
    const walletClient = createWalletClient({
      transport: custom(embeddedWallet.provider as any),
      account: embeddedWallet.address as Address,
    });

    return walletClient.signTypedData(typedData);
};

// Helper to run an array of lazy promises in sequence
export const sequentialPromises = (promises: (() => Promise<any>)[]): Promise<any[]> => {
  return promises.reduce<Promise<any[]>>(
    (acc, curr) => acc.then(results => curr().then(result => [...results, result])),
    Promise.resolve([])
  );
};