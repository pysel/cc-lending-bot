import { Config } from "../config";
import { AggregatedAssetBalance, PrepareCallRequest, TokenAllowanceRequirement, TokenRequirement } from "../types/onebalance";
import { encodeFunctionData, parseAbi } from "viem";


export async function prepareCallRequestAaveSupply(
    config: Config,
    accountAddressOneBalance: string,
    aggregatedAssetBalance: AggregatedAssetBalance,
    targetChainId: string,
    targetChainTokenAddress: string
): Promise<PrepareCallRequest> {

    const supplyDefinition = parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]);

    const assetRequirements: TokenRequirement[] = aggregatedAssetBalance.individualAssetBalances.map(asset => ({
        assetType: asset.assetType,
        amount: asset.balance,
    }));

    const lendingPoolAddress = config.aaveLendingPools[targetChainId] as `0x${string}`;

    const assetApprovals: TokenAllowanceRequirement[] = aggregatedAssetBalance.individualAssetBalances.map(asset => {
        return {
            assetType: asset.assetType,
            amount: asset.balance,
            spender: lendingPoolAddress,
        };
    });

    const supplyCalldata = encodeFunctionData({
        abi: supplyDefinition,
        functionName: 'supply',
        args: [targetChainTokenAddress as `0x${string}`, BigInt(aggregatedAssetBalance.balance), accountAddressOneBalance as `0x${string}`, 0],
    });

    const sessionAddress = config.getWallet().address;
    const adminAddress = config.getWallet().address;

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
        allowanceRequirements: assetApprovals,
        tokensRequired: assetRequirements,
        overrides: [],
        validAfter: '0',
    };
}

export async function prepareCallRequestAaveWithdraw(
    config: Config,
    accountAddressOneBalance: string,
    amount: string,
    fromAsset: string,
    fromChain: string
): Promise<PrepareCallRequest> {

    const withdrawDefinition = parseAbi(["function withdraw(address asset, uint256 amount, address to)"]);
    const assetAddress: string = config.assetsHumanToChainAddress[fromAsset]![fromChain]!;

    const withdrawCalldata = encodeFunctionData({
        abi: withdrawDefinition,
        functionName: 'withdraw',
        args: [assetAddress as `0x${string}`, BigInt(amount), accountAddressOneBalance as `0x${string}`],
    });

    const sessionAddress = config.getWallet().address;
    const adminAddress = config.getWallet().address;

    const fromChainId = config.chainsHumanToOB[fromChain]!;
    const lendingPoolAddress = config.aaveLendingPools[fromChainId] as `0x${string}`;

    return {
        account: {
            accountAddress: accountAddressOneBalance as `0x${string}`,
            sessionAddress: sessionAddress as `0x${string}`,
            adminAddress: adminAddress as `0x${string}`,
        },
        targetChain: fromChainId,
        calls: [
            {
                to: lendingPoolAddress,
                data: withdrawCalldata as `0x${string}`,
                value: '0x0',
            },
        ],
        allowanceRequirements: [],
        tokensRequired: [],
        overrides: [],
        validAfter: '0',
    };
}