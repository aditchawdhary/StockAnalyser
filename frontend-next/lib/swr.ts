import { preload } from 'swr';

const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// Default stocks shown on dashboard
const DEFAULT_SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN'];

// SWR fetcher function
export const fetcher = (url: string) => fetch(url).then(res => res.json());

// Cache keys
export const SWR_KEYS = {
  performance: `${BACKEND_URL}/stocks/performance/`,
  stockList: `${BACKEND_URL}/stocks/list/`,
  stockPrices: (symbols: string[], type: 'daily' | 'weekly') =>
    `${BACKEND_URL}/stocks/?symbols=${symbols.join(',')}&type=${type}`,
  intradayPrices: (symbols: string[]) =>
    `${BACKEND_URL}/stocks/intraday/?symbols=${symbols.join(',')}&interval=5min&days=7`,
} as const;

// Prefetch function for performance data
export const prefetchPerformance = () => {
  preload(SWR_KEYS.performance, fetcher);
};

// Prefetch function for stock list
export const prefetchStockList = () => {
  preload(SWR_KEYS.stockList, fetcher);
};

// Prefetch function for default dashboard stocks
export const prefetchDashboardStocks = () => {
  preload(SWR_KEYS.stockPrices(DEFAULT_SYMBOLS, 'daily'), fetcher);
  preload(SWR_KEYS.stockPrices(DEFAULT_SYMBOLS, 'weekly'), fetcher);
  preload(SWR_KEYS.intradayPrices(DEFAULT_SYMBOLS), fetcher);
};

// Prefetch all dashboard data
export const prefetchAll = () => {
  prefetchPerformance();
  prefetchStockList();
  prefetchDashboardStocks();
};
