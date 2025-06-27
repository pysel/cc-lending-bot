export function toAToken(token: string) {
    return "a" + token;
}

export function toOneBalanceAssetId(chainId: string, token: string) {
    return `${chainId}/erc20:${token}`;
}

export function toAggregatedAssetId(token: string) {
    return `ds:${token.toLowerCase()}`;
}