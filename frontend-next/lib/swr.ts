import { preload } from 'swr';

const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// SWR fetcher function
export const fetcher = (url: string) => fetch(url).then(res => res.json());

// Cache keys
export const SWR_KEYS = {
  performance: `${BACKEND_URL}/stocks/performance/`,
  stockList: `${BACKEND_URL}/stocks/list/`,
} as const;

// Prefetch function for performance data
export const prefetchPerformance = () => {
  preload(SWR_KEYS.performance, fetcher);
};
