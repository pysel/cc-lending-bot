import { ApyData } from "lending-apy-fetcher-ts";

export function getBestAPYForEachToken(apyData: ApyData[]): ApyData[] {
    const bestApyData: ApyData[] = [];
    const bestAPYForEachToken = new Map<string, ApyData>();
    for(const apy of apyData) {
        const token = apy.token_symbol;
        if(bestAPYForEachToken.has(token)) {
            if(bestAPYForEachToken.get(token)!.apy < apy.apy) {
                bestAPYForEachToken.set(token, apy);
            }
        } else {
            bestAPYForEachToken.set(token, apy);
        }
    }

    for(const apy of bestAPYForEachToken.values()) {
        bestApyData.push(apy);
    }

    return bestApyData;
}