import React from 'react';
import {formatLargeNumber, formatPercentage} from './utils';
import { StockOverviewResponse } from '../../types';

// Helper Components
const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <div className="text-xs text-gray-600 mb-1">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);


const StockMetrics: React.FC<{overview: StockOverviewResponse | null}> = ({overview}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-xl font-bold mb-4">Key Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Market Cap" value={formatLargeNumber(overview?.overview?.MarketCapitalization)} />
        <MetricCard label="P/E Ratio" value={overview?.overview?.PERatio || 'N/A'} />
        <MetricCard label="EPS" value={overview?.overview?.EPS || 'N/A'} />
        <MetricCard label="Dividend Yield" value={formatPercentage(overview?.overview?.DividendYield)} />
        <MetricCard label="52-Week High" value={`$${overview?.overview?.['52WeekHigh'] || 'N/A'}`} />
        <MetricCard label="52-Week Low" value={`$${overview?.overview?.['52WeekLow'] || 'N/A'}`} />
        <MetricCard label="Beta" value={overview?.overview?.Beta || 'N/A'} />
        <MetricCard label="Shares Outstanding" value={formatLargeNumber(overview?.overview?.SharesOutstanding)} />
      </div>
    </div>
)};

export default StockMetrics;

