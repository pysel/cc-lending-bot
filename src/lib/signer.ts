import { Hex } from "viem";
import { ChainOperation } from "../types/onebalance";
import { privateKeyToAccount } from "viem/accounts";


export async function signOperation(operation: ChainOperation, key: Hex): Promise<ChainOperation> {
    return {
      ...operation,
      userOp: { ...operation.userOp, signature: await privateKeyToAccount(key).signTypedData(operation.typedDataToSign) },
    };
}