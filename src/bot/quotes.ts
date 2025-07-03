import { Config } from "../config";
import { IndividualAssetBalance, PrepareCallRequest, TokenAllowanceRequirement, TokenRequirement } from "../types/onebalance";
import { encodeFunctionData, parseAbi } from "viem";
import { toAToken, toOneBalanceAssetId } from "../utils/conversions";


export async function prepareCallRequestAaveSupply(
    config: Config,
    targetChain: string,
    targetChainTokenAddress: string,
    amount: string
): Promise<PrepareCallRequest> {

    const supplyDefinition = parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]);
    const targetChainId = config.chainsHumanToOB[targetChain]!;
    const lendingPoolAddress = config.aaveLendingPools[targetChainId] as `0x${string}`;

    const assetType = toOneBalanceAssetId(targetChainId, targetChainTokenAddress);

    const supplyCalldata = encodeFunctionData({
        abi: supplyDefinition,
        functionName: 'supply',
        args: [targetChainTokenAddress as `0x${string}`, BigInt(amount), config.addressOneBalance as `0x${string}`, 0],
    });

    const sessionAddress = config.getWallet().address;
    const adminAddress = config.getWallet().address;

    return {
        account: {
            accountAddress: config.addressOneBalance as `0x${string}`,
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
        allowanceRequirements: [{
            assetType: assetType,
            amount: amount,
            spender: lendingPoolAddress,
        }],
        tokensRequired: [{
            assetType: assetType,
            amount: amount,
        }],
        overrides: [],
        validAfter: '0',
    };
}

export async function prepareCallRequestAaveWithdraw(
    config: Config,
    amount: string,
    fromAsset: string,
    fromChain: string,
    recipient?: string
): Promise<PrepareCallRequest> {
    const withdrawDefinition = parseAbi(["function withdraw(address asset, uint256 amount, address to)"]);
    const assetAddress: string = config.assetsHumanToChainAddress[fromAsset]![fromChain]!;

    const withdrawTo = recipient || config.addressOneBalance;
    console.log(`🔍 Withdrawing ${amount} ${fromAsset} to ${withdrawTo as `0x${string}`}`);
    console.log("From asset address:", assetAddress);
    console.log("Withdraw to address:", withdrawTo as `0x${string}`);
    console.log("Withdraw amount:", amount);
    console.log("Withdraw definition:", withdrawDefinition);
    console.log("From chain:", fromChain);

    const withdrawCalldata = encodeFunctionData({
        abi: withdrawDefinition,
        functionName: 'withdraw',
        args: [assetAddress as `0x${string}`, BigInt(amount), withdrawTo as `0x${string}`],
    });

    const sessionAddress = config.getWallet().address;
    const adminAddress = config.getWallet().address;

    const fromChainId = config.chainsHumanToOB[fromChain] || fromChain;
    const lendingPoolAddress = config.aaveLendingPools[fromChainId] as `0x${string}`;

    const aAssetSymbol = toAToken(fromAsset); 
    const aTokenAddress = config.assetsHumanToChainAddress[aAssetSymbol]![fromChain]!;
    const aAssetType = toOneBalanceAssetId(fromChainId, aTokenAddress);

    return {
        account: {
            accountAddress: config.addressOneBalance as `0x${string}`,
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
        tokensRequired: [
            {
                assetType: aAssetType,
                amount: amount,
            }
        ],
        allowanceRequirements: [],
        overrides: [],
        validAfter: '0',
    };
}