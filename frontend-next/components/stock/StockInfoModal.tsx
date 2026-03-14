'use client';

import React, { useState, useEffect, useRef } from 'react';

import { StockInfoModalProps, StockOverviewResponse, NewsSentimentResponse, StockPriceData } from '../../types';
import drawChart from './InfoGraph';
import InfoHeader from './InfoHeader';
import InfoRows from './InfoRows';
import InfoNews from './InfoNews';
import StockMetrics from './StockMetrics';
import InfoPriceChart from './InfoPriceChart';

const StockInfoModal: React.FC<StockInfoModalProps> = ({ symbol, isOpen, onClose, onAddToCharts, availableStocks = [] }) => {
  const [overview, setOverview] = useState<StockOverviewResponse | null>(null);
  const [news, setNews] = useState<NewsSentimentResponse | null>(null);
  const [priceData, setPriceData] = useState<{ daily: StockPriceData; weekly: StockPriceData; intraday: StockPriceData | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartTimeRange, setChartTimeRange] = useState('1Y');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
 
  const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;
  // Fetch all data on mount or when currentSymbol changes
  useEffect(() => {
    if (!isOpen || !currentSymbol) return;

    fetchAllData();
  }, [currentSymbol, isOpen]);

  // Update currentSymbol when prop symbol changes
  useEffect(() => {
    setCurrentSymbol(symbol);
  }, [symbol]);

  // Redraw chart when time range changes
  useEffect(() => {
    if (priceData && svgRef.current) {
      // Use intraday data for 1D and 1W, daily data for 1M-1Y, weekly for 5Y and MAX
      const useIntradayData = ['1D', '1W'].includes(chartTimeRange);
      const useDailyData = ['1M', '6M', '1Y'].includes(chartTimeRange);

      let data;
      if (useIntradayData && priceData.intraday) {
        data = priceData.intraday;
      } else if (useDailyData) {
        data = priceData.daily;
      } else {
        data = priceData.weekly;
      }

      if (data) {
        drawChart(currentSymbol, data, chartTimeRange, svgRef);
      }
    }
  }, [loading, priceData, chartTimeRange, currentSymbol]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch in parallel: overview, news, and price data (including intraday)
      const [overviewRes, newsRes, dailyRes, weeklyRes, intradayRes] = await Promise.all([
        fetch(`${BACKEND_URL}/stock/${currentSymbol}/overview/`),
        fetch(`${BACKEND_URL}/stock/${currentSymbol}/news/?limit=10`),
        fetch(`${BACKEND_URL}/stocks/?symbols=${currentSymbol}&type=daily`),
        fetch(`${BACKEND_URL}/stocks/?symbols=${currentSymbol}&type=weekly`),
        fetch(`${BACKEND_URL}/stock/${currentSymbol}/intraday/?interval=1min&days=7`)
      ]);

      const [overviewData, newsData, dailyData, weeklyData, intradayData] = await Promise.all([
        overviewRes.json(),
        newsRes.json(),
        dailyRes.json(),
        weeklyRes.json(),
        intradayRes.json()
      ]);

      setOverview(overviewData);
      setNews(newsData);
      setPriceData({
        daily: dailyData.data[currentSymbol],
        weekly: weeklyData.data[currentSymbol],
        intraday: intradayData
      });

      // Add to search history when data is successfully loaded
      if (overviewData?.name) {
        addToHistory(currentSymbol, overviewData.name);
      }
    } catch (error) {
      console.error('Failed to fetch stock info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full h-full overflow-y-auto" 
        onClick={(event) => event.stopPropagation()}
      >
        <InfoHeader 
          symbol={symbol}  
          overview={overview} 
          currentSymbol={currentSymbol} 
          priceData={priceData} 
          availableStocks={availableStocks} 
          onClose={onClose} 
          onAddToCharts={onAddToCharts}
          setCurrentSymbol={setCurrentSymbol}
        /> 
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-12 w-12 border-4 border-rh-teal-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* SECTION 1: Price Chart */}
            <InfoPriceChart 
              chartTimeRange={chartTimeRange} 
              setChartTimeRange={setChartTimeRange} 
              svgRef={svgRef} 
            />

            {/* SECTION 2: Important Stock Metrics */}
            <StockMetrics overview={overview} />

            {/* SECTION 3: News Sentiment */}
            <InfoNews news={news} />

            {/* SECTION 4: Company Info */}
            {/* SECTION 5: Financial Highlights */}
            {/* SECTION 6: Valuation & Trading */}
            <InfoRows overview={overview} />

          </div>
        )}
      </div>
    </div>
  );
};

export default StockInfoModal;
