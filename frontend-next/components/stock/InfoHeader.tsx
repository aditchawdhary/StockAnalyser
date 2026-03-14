import React from "react"
import StockLogo from '../shared/StockLogo';
import InfoModalSearch from './InfoModalSearch';
import { StockPriceData, StockOverviewResponse, Stock } from '../../types';


interface InfoHeaderProps {
  symbol: string, 
  overview: StockOverviewResponse | null, 
  currentSymbol: string, 
  priceData: {
    daily: StockPriceData | null,
    weekly: StockPriceData | null,
    intraday: StockPriceData | null
  } | null, 
  availableStocks?: Stock[], 
  onClose: () => void, 
  onAddToCharts: (symbol: string) => void,
  setCurrentSymbol: (symbol: string) => void,
}

const InfoHeader: React.FC<InfoHeaderProps> = ({
  symbol, 
  overview, 
  currentSymbol, 
  priceData, 
  availableStocks, 
  onClose, 
  onAddToCharts,
  setCurrentSymbol
}) => {
  // Get current price and change from price data
  const getCurrentPriceInfo = (priceData: InfoHeaderProps["priceData"]) => {
    if (!priceData) return null;

    // Prefer intraday data for most recent price, fall back to daily, then weekly
    let data: StockPriceData | null = null;
    let timeSeriesKey: string = '';

    if (priceData.intraday && priceData.intraday['Time Series (5min)']) {
      data = priceData.intraday;
      timeSeriesKey = 'Time Series (5min)';
    } else if (priceData.intraday && priceData.intraday['Time Series (1min)']) {
      data = priceData.intraday;
      timeSeriesKey = 'Time Series (1min)';
    } else if (priceData.daily && priceData.daily['Time Series (Daily)']) {
      data = priceData.daily;
      timeSeriesKey = 'Time Series (Daily)';
    } else if (priceData.weekly && priceData.weekly['Weekly Time Series']) {
      data = priceData.weekly;
      timeSeriesKey = 'Weekly Time Series';
    }

    if (!data || !timeSeriesKey) return null;

    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) return null;

    const dates = Object.keys(timeSeries).sort().reverse();
    if (dates.length < 2) return null;

    const latestDate = dates[0];
    const previousDate = dates[1];
    const latestClose = parseFloat(timeSeries[latestDate]['4. close']);
    const previousClose = parseFloat(timeSeries[previousDate]['4. close']);

    const change = latestClose - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      price: latestClose,
      change,
      changePercent,
      date: latestDate
    };
  };

  const priceInfo = getCurrentPriceInfo(priceData);

  return (
    // Header
    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
      {/* Top Row: Back and Add to Charts buttons */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-rh-teal-500 hover:text-rh-teal-600 font-semibold transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
        <button
          onClick={() => onAddToCharts(currentSymbol)}
          className="px-4 py-2 bg-rh-teal-500 text-white rounded-md hover:bg-rh-teal-600 transition-colors"
        >
          Add to Charts
        </button>
      </div>

      <InfoModalSearch symbol={symbol} availableStocks={availableStocks} setCurrentSymbol={setCurrentSymbol} />

      {/* Stock Info - Symbol, Name, Price */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <StockLogo symbol={currentSymbol} size={32} />
          <h2 className="text-2xl font-bold text-gray-900">{currentSymbol}</h2>
          <span className="text-gray-400">•</span>
          <p className="text-gray-600">{overview?.name || 'Loading...'}</p>
        </div>
        {priceInfo && (
          <div className="flex items-center gap-3 border-l border-gray-300 pl-4">
            <span className="text-2xl font-bold text-gray-900">
              ${priceInfo.price.toFixed(2)}
            </span>
            <span className={`text-lg font-semibold ${priceInfo.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {priceInfo.change >= 0 ? '+' : ''}{priceInfo.change.toFixed(2)} ({priceInfo.change >= 0 ? '+' : ''}{priceInfo.changePercent.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default InfoHeader;