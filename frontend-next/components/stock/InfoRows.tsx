import React from "react";
import {formatLargeNumber, formatPercentage} from './utils';
import {StockOverviewResponse} from '../../types';

interface InfoRowProps {
  label: string; 
  value: string | undefined; 
  fullWidth?: boolean 
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, fullWidth }) => (
  <div className={fullWidth ? 'col-span-full' : ''}>
    <span className="text-sm font-semibold text-gray-700">{label}: </span>
    <span className="text-sm text-gray-900">{value || 'N/A'}</span>
  </div>
);

const InfoRows: React.FC<{overview: StockOverviewResponse | null }> = ({overview}) => {
  return (
  <>
    {/* SECTION 4: Company Information */}
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-xl font-bold mb-4">Company Information</h3>
      <div className="space-y-3">
        <InfoRow label="Sector" value={overview?.overview?.Sector} />
        <InfoRow label="Industry" value={overview?.overview?.Industry} />
        <InfoRow label="Exchange" value={overview?.overview?.Exchange} />
        <InfoRow label="Country" value={overview?.overview?.Country} />
        <InfoRow label="Description" value={overview?.overview?.Description} fullWidth />
      </div>
    </div>

    {/* SECTION 5: Financial Highlights */}
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-xl font-bold mb-4">Financial Highlights</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow label="Revenue (TTM)" value={formatLargeNumber(overview?.overview?.RevenueTTM)} />
        <InfoRow label="EBITDA" value={formatLargeNumber(overview?.overview?.EBITDA)} />
        <InfoRow label="Profit Margin" value={formatPercentage(overview?.overview?.ProfitMargin)} />
        <InfoRow label="Operating Margin" value={formatPercentage(overview?.overview?.OperatingMarginTTM)} />
        <InfoRow label="ROA" value={formatPercentage(overview?.overview?.ReturnOnAssetsTTM)} />
        <InfoRow label="ROE" value={formatPercentage(overview?.overview?.ReturnOnEquityTTM)} />
        <InfoRow label="Quarterly Revenue Growth (YoY)" value={formatPercentage(overview?.overview?.QuarterlyRevenueGrowthYOY)} />
        <InfoRow label="Quarterly Earnings Growth (YoY)" value={formatPercentage(overview?.overview?.QuarterlyEarningsGrowthYOY)} />
      </div>
    </div>

    {/* SECTION 6: Valuation & Trading */}
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-xl font-bold mb-4">Valuation & Trading Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow label="Trailing P/E" value={overview?.overview?.TrailingPE} />
        <InfoRow label="Forward P/E" value={overview?.overview?.ForwardPE} />
        <InfoRow label="Price/Sales (TTM)" value={overview?.overview?.PriceToSalesRatioTTM} />
        <InfoRow label="Price/Book" value={overview?.overview?.PriceToBookRatio} />
        <InfoRow label="50-Day MA" value={`$${overview?.overview?.['50DayMovingAverage'] || 'N/A'}`} />
        <InfoRow label="200-Day MA" value={`$${overview?.overview?.['200DayMovingAverage'] || 'N/A'}`} />
      </div>
    </div>
  </>
  );
};

export default InfoRows;