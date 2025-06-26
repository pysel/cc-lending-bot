import { Config } from "../config";
import { PrepareCallRequest } from "../types/onebalance";
import { encodeFunctionData, parseAbi } from "viem";

export async function prepareCallRequestAaveSupply(
    config: Config,
    accountAddressOneBalance: string,
    amount: string,
    sourceAsset: string,
    sourceChain: string,
    targetChain: string,
): Promise<PrepareCallRequest> {

    const supplyDefinition = parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]);
    const assetAddress: string = config.assetsHumanToChainAddress[sourceAsset]![sourceChain]!;

    const supplyCalldata = encodeFunctionData({
        abi: supplyDefinition,
        functionName: 'supply',
        args: [assetAddress as `0x${string}`, BigInt(amount), accountAddressOneBalance as `0x${string}`, 0],
    });

    const sessionAddress = config.getWallet().address;
    const adminAddress = config.getWallet().address;

    const sourceChainId = config.chainsHumanToOB[sourceChain]!;
    const targetChainId = config.chainsHumanToOB[targetChain]!;
    const lendingPoolAddress = config.aaveLendingPools[targetChainId] as `0x${string}`;
    const assetAddressOneBalance = `${sourceChainId}/erc20:${assetAddress}`;

    return {
        account: {
            accountAddress: accountAddressOneBalance as `0x${string}`,
            sessionAddress: sessionAddress as `0x${string}`,
            adminAddress: adminAddress as `0x${string}`,
        },
        targetChain: targetChainId,
        calls: [
            {
                to: lendingPoolAddress,
                data: supplyCalldata as `0x${string}`,
                value: '0x0',
            },
        ],
        allowanceRequirements: [
            {
                assetType: assetAddressOneBalance,
                amount: amount,
                spender: lendingPoolAddress,
            }
        ],
        tokensRequired: [
            {
                assetType: assetAddressOneBalance,
                amount: amount,
            },
        ],
        overrides: [],
        validAfter: '0',
    };
}