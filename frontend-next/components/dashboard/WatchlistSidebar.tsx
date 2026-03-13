'use client';

import React, { useEffect, useRef } from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { fetcher, SWR_KEYS } from '../../lib/swr';
import StockLogo from '../shared/StockLogo';

const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface WatchlistSidebarProps {
  symbols: string[];
  onSelectStock: (symbol: string) => void;
  onRemoveStock: (symbol: string) => void;
}

interface StockSummary {
  symbol: string;
  name: string;
  latest_price: number;
  price_change: number;
  percent_change: number;
}

const MiniSparkline: React.FC<{ symbol: string; isPositive: boolean }> = ({ symbol, isPositive }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: intradayData } = useSWR(
    `${BACKEND_URL}/stocks/intraday/?symbols=${symbol}&interval=5min&days=1`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  );

  useEffect(() => {
    if (!svgRef.current || !intradayData?.data?.[symbol]) return;

    const timeSeries = intradayData.data[symbol];
    const possibleKeys = ['Time Series (5min)', 'Time Series (1min)', 'Time Series (15min)'];
    const key = possibleKeys.find(k => timeSeries[k]) || '';
    if (!key || !timeSeries[key]) return;

    const prices = Object.entries(timeSeries[key])
      .map(([date, values]: [string, any]) => ({
        date: new Date(date),
        close: parseFloat(values['4. close']),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (prices.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 60;
    const height = 24;

    const x = d3.scaleTime()
      .domain(d3.extent(prices, d => d.date) as [Date, Date])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain(d3.extent(prices, d => d.close) as [number, number])
      .range([height - 2, 2]);

    const line = d3.line<typeof prices[0]>()
      .x(d => x(d.date))
      .y(d => y(d.close))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(prices)
      .attr('fill', 'none')
      .attr('stroke', isPositive ? '#16a34a' : '#dc2626')
      .attr('stroke-width', 1.5)
      .attr('d', line);
  }, [intradayData, symbol, isPositive]);

  return <svg ref={svgRef} width={60} height={24} />;
};

const WatchlistSidebar: React.FC<WatchlistSidebarProps> = ({ symbols, onSelectStock, onRemoveStock }) => {
  const { data: summaryData } = useSWR<{ stocks: StockSummary[] }>(
    `${BACKEND_URL}/stocks/summary/`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const stockMap = new Map<string, StockSummary>();
  (summaryData?.stocks || []).forEach(s => stockMap.set(s.symbol, s));

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Watchlist</h3>
        <p className="text-xs text-gray-500 mt-0.5">{symbols.length} stocks</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {symbols.map(symbol => {
          const stock = stockMap.get(symbol);
          const price = stock?.latest_price || 0;
          const change = stock?.percent_change || 0;
          const isPositive = change >= 0;

          return (
            <div
              key={symbol}
              className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 group"
              onClick={() => onSelectStock(symbol)}
            >
              <StockLogo symbol={symbol} size={28} />
              <div className="ml-3 flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{symbol}</div>
                <div className="text-xs text-gray-500 truncate">{stock?.name || symbol}</div>
              </div>

              <div className="mx-2">
                <MiniSparkline symbol={symbol} isPositive={isPositive} />
              </div>

              <div className="text-right ml-2">
                <div className="text-sm font-medium text-gray-900">
                  {price > 0 ? `$${price.toFixed(2)}` : '—'}
                </div>
                <div className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onRemoveStock(symbol); }}
                className="ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          );
        })}

        {symbols.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Search and add stocks to your watchlist
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistSidebar;
