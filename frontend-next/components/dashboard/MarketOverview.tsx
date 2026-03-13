'use client';

import React from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/swr';

const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percent_change: number;
}

const MarketOverview: React.FC = () => {
  const { data: summaryData } = useSWR<{ stocks: Array<{ symbol: string; name: string; latest_price: number; price_change: number; percent_change: number }> }>(
    `${BACKEND_URL}/stocks/summary/`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Use major ETFs/indices from our stock data as market indicators
  const indexSymbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const indexNames: Record<string, string> = {
    'SPY': 'S&P 500',
    'QQQ': 'Nasdaq',
    'DIA': 'Dow Jones',
    'IWM': 'Russell 2000',
  };

  const indices: MarketIndex[] = (summaryData?.stocks || [])
    .filter(s => indexSymbols.includes(s.symbol))
    .map(s => ({
      symbol: s.symbol,
      name: indexNames[s.symbol] || s.name,
      price: s.latest_price,
      change: s.price_change,
      percent_change: s.percent_change,
    }));

  if (!summaryData) {
    return (
      <div className="flex gap-6 px-6 py-3 bg-white border-b border-gray-200 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-8 px-6 py-3 bg-white border-b border-gray-200 overflow-x-auto">
      {indices.map(index => {
        const isPositive = index.percent_change >= 0;
        return (
          <div key={index.symbol} className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-medium text-gray-600">{index.name}</span>
            <span className="text-sm font-semibold text-gray-900">
              {index.price > 0 ? `$${index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
            <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{index.percent_change.toFixed(2)}%
            </span>
          </div>
        );
      })}
      {indices.length === 0 && (
        <span className="text-sm text-gray-500">Market data loading...</span>
      )}
    </div>
  );
};

export default MarketOverview;
