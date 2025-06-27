import { Config } from "../config";
import { IndividualAssetBalance, PrepareCallRequest, TokenAllowanceRequirement, TokenRequirement } from "../types/onebalance";
import { encodeFunctionData, parseAbi } from "viem";


export async function prepareCallRequestAaveSupply(
    config: Config,
    accountAddressOneBalance: string,
    individualAssetBalance: IndividualAssetBalance,
    targetChainId: string,
    targetChainTokenAddress: string
): Promise<PrepareCallRequest> {

    const supplyDefinition = parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]);

    const assetRequirements: TokenRequirement[] = [{
        assetType: individualAssetBalance.assetType,
        amount: individualAssetBalance.balance,
    }];

    const lendingPoolAddress = config.aaveLendingPools[targetChainId] as `0x${string}`;

    const assetApprovals: TokenAllowanceRequirement[] = [{
        assetType: individualAssetBalance.assetType,
        amount: individualAssetBalance.balance,
        spender: lendingPoolAddress,
    }];

    const supplyCalldata = encodeFunctionData({
        abi: supplyDefinition,
        functionName: 'supply',
        args: [targetChainTokenAddress as `0x${string}`, BigInt(individualAssetBalance.balance), accountAddressOneBalance as `0x${string}`, 0],
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
    fromChain: string,
    recipient?: string
): Promise<PrepareCallRequest> {

    const withdrawDefinition = parseAbi(["function withdraw(address asset, uint256 amount, address to)"]);
    const assetAddress: string = config.assetsHumanToChainAddress[fromAsset]![fromChain]!;

    const withdrawTo = recipient || accountAddressOneBalance;
    console.log(`🔍 Withdrawing ${amount} ${fromAsset} to ${withdrawTo as `0x${string}`}`);

    const withdrawCalldata = encodeFunctionData({
        abi: withdrawDefinition,
        functionName: 'withdraw',
        args: [assetAddress as `0x${string}`, BigInt(amount), withdrawTo as `0x${string}`],
    });

    const sessionAddress = config.getWallet().address;
    const adminAddress = config.getWallet().address;

    const fromChainId = config.chainsHumanToOB[fromChain] || fromChain;
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