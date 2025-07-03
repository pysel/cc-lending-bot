import axios, { AxiosResponse } from 'axios';
import { PrepareCallRequest, TargetCallQuote, CallRequest, Quote, BundleResponse, HistoryResponse, QuoteStatus } from '../types/onebalance';

export const BASE_URL = 'https://be.onebalance.io';
export const API_KEY = process.env['ONE_BALANCE_API_KEY'];

// Helper function to create authenticated headers
export function createAuthHeaders(): Record<string, string> {
    return {
      'x-api-key': API_KEY ?? ''
      ,
    };
  }

export async function apiRequest<RequestData, ResponseData>(
    method: 'get' | 'post',
    endpoint: string,
    data: RequestData,
    isParams = false,
): Promise<ResponseData> {
try {
    const config = {
    headers: createAuthHeaders(),
    ...(isParams ? { params: data } : {}),
    };

    const url = `${BASE_URL}${endpoint}`;

    const response: AxiosResponse<ResponseData> =
    method === 'post' ? await axios.post(url, data, config) : await axios.get(url, { ...config, params: data });

    return response.data;
} catch (error) {
    if (axios.isAxiosError(error) && error.response) {
    throw new Error(JSON.stringify(error.response.data));
    }
    throw error;
}
}

// API methods
export async function apiPost<RequestData, ResponseData>(endpoint: string, data: RequestData): Promise<ResponseData> {
    return apiRequest<RequestData, ResponseData>('post', endpoint, data);
}

export async function apiGet<RequestData, ResponseData>(endpoint: string, params: RequestData): Promise<ResponseData> {
    return apiRequest<RequestData, ResponseData>('get', endpoint, params, true);
}

export async function fetchBalances(address: string) {
    const response = await apiGet<
      { address: string },
      {
        balanceByAggregatedAsset: {
          aggregatedAssetId: string;
          balance: string;
          individualAssetBalances: { 
            assetType: string; 
            balance: string; 
            fiatValue: number 
          }[];
          fiatValue: number;
        }[];
        balanceBySpecificAsset: {
          assetType: string;
          balance: string;
          fiatValue: number;
        }[];
        totalBalance: {
          fiatValue: number;
        };
      }
    >('/api/v2/balances/aggregated-balance', { address });
    return response;
  }
  
export async function fetchUSDCBalance(address: string) {
    const response = await fetchBalances(address);
    return response.balanceByAggregatedAsset.find((asset) => asset.aggregatedAssetId === 'ds:usdc');
}

export async function prepareCallQuote(quoteRequest: PrepareCallRequest): Promise<TargetCallQuote> {
    return apiPost<PrepareCallRequest, TargetCallQuote>('/api/quotes/prepare-call-quote', quoteRequest);
}
  
export async function fetchCallQuote(callRequest: CallRequest): Promise<Quote> {
    return apiPost<CallRequest, Quote>('/api/quotes/call-quote', callRequest);
}

export async function executeQuote(quote: Quote): Promise<BundleResponse> {
    return apiPost<Quote, BundleResponse>('/api/quotes/execute-quote', quote);
}

export async function fetchTransactionHistory(address: string): Promise<HistoryResponse> {
    return apiGet<{ user: string; limit: number; sortBy: string }, HistoryResponse>('/api/status/get-tx-history', {
      user: address,
      limit: 1,
      sortBy: 'createdAt',
    });
}

export async function getQuoteStatus(quoteId: string): Promise<QuoteStatus> {
    return apiGet<{ quoteId: string }, QuoteStatus>('/api/status/get-execution-status', { quoteId });
}   