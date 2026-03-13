'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { PerformanceResponse, StockPerformance } from '../../types';
import { fetcher } from '../../lib/swr';
import StockLogo from '../shared/StockLogo';

const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface TopMoversProps {
  onSelectStock: (symbol: string) => void;
}

const TopMovers: React.FC<TopMoversProps> = ({ onSelectStock }) => {
  const [period, setPeriod] = useState<'1D' | '1W' | '1M'>('1D');

  const { data: performance } = useSWR<PerformanceResponse>(
    `${BACKEND_URL}/stocks/performance/`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const periodData = performance?.[period];
  const gainers = periodData?.top_gainers?.slice(0, 5) || [];
  const losers = periodData?.top_losers?.slice(0, 5) || [];

  const StockPill: React.FC<{ stock: StockPerformance }> = ({ stock }) => {
    const isPositive = stock.percent_change >= 0;
    return (
      <button
        onClick={() => onSelectStock(stock.symbol)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all bg-white min-w-0 shrink-0"
      >
        <StockLogo symbol={stock.symbol} size={24} />
        <div className="text-left min-w-0">
          <div className="text-sm font-semibold text-gray-900">{stock.symbol}</div>
          <div className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{stock.percent_change.toFixed(2)}%
          </div>
        </div>
      </button>
    );
  };

  if (!performance) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Top Movers</h3>
        <div className="flex gap-1">
          {(['1D', '1W', '1M'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {gainers.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Gainers</div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {gainers.map(stock => (
              <StockPill key={stock.symbol} stock={stock} />
            ))}
          </div>
        </div>
      )}

      {losers.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Losers</div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {losers.map(stock => (
              <StockPill key={stock.symbol} stock={stock} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopMovers;
