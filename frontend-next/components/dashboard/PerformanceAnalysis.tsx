'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceAnalysisProps, PerformanceResponse } from '../../types';

const PerformanceAnalysis: React.FC<PerformanceAnalysisProps> = ({ onSelectStock }) => {
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | 'YTD' | '6M' | '1Y'>('1M');

  const BACKEND_URL = 'http://127.0.0.1:8000/api';

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/stocks/performance/`);
      const data = await response.json();
      setPerformance(data);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <p className="text-center text-gray-500">Loading performance data...</p>
      </div>
    );
  }

  if (!performance) return null;

  const currentData = performance[selectedPeriod];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">
        📊 Performance Analysis
      </h2>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6 justify-center">
        {(['1M', 'YTD', '6M', '1Y'] as const).map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              selectedPeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-900 border border-gray-300'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Top Gainers */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-green-600 flex items-center">
            🚀 Top 10 Gainers
          </h3>
          <div className="max-h-96 overflow-y-auto">
            {currentData.top_gainers.map((stock, index) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                className="p-3 border-b border-gray-200 cursor-pointer transition-colors hover:bg-green-50"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-500 text-sm">#{index + 1}</span>
                      <span className="font-semibold text-gray-900">{stock.symbol}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {stock.name.substring(0, 40)}{stock.name.length > 40 ? '...' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600 text-base">
                      +{stock.percent_change}%
                    </div>
                    <div className="text-xs text-gray-600">
                      ${stock.start_price.toFixed(2)} → ${stock.end_price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-red-600 flex items-center">
            📉 Top 10 Losers
          </h3>
          <div className="max-h-96 overflow-y-auto">
            {currentData.top_losers.map((stock, index) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                className="p-3 border-b border-gray-200 cursor-pointer transition-colors hover:bg-red-50"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-500 text-sm">#{index + 1}</span>
                      <span className="font-semibold text-gray-900">{stock.symbol}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {stock.name.substring(0, 40)}{stock.name.length > 40 ? '...' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600 text-base">
                      {stock.percent_change}%
                    </div>
                    <div className="text-xs text-gray-600">
                      ${stock.start_price.toFixed(2)} → ${stock.end_price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalysis;
