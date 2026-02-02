'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { PerformanceAnalysisProps, PerformanceResponse, StockPriceData, StockPrice } from '../../types';

const PerformanceAnalysis: React.FC<PerformanceAnalysisProps> = ({ onSelectStock }) => {
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | 'YTD' | '6M' | '1Y' | '5Y'>('1M');
  const [expandedStock, setExpandedStock] = useState<string | null>(null);
  const [stockData, setStockData] = useState<Record<string, { daily: StockPriceData; weekly: StockPriceData }>>({});
  const [loadingStock, setLoadingStock] = useState<string | null>(null);
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

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

  const fetchStockData = async (symbol: string) => {
    if (stockData[symbol]) {
      return; // Already fetched
    }

    setLoadingStock(symbol);
    try {
      const [dailyResponse, weeklyResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/stocks/?symbols=${symbol}&type=daily`),
        fetch(`${BACKEND_URL}/stocks/?symbols=${symbol}&type=weekly`)
      ]);

      const dailyResult = await dailyResponse.json();
      const weeklyResult = await weeklyResponse.json();

      setStockData(prev => ({
        ...prev,
        [symbol]: {
          daily: dailyResult.data[symbol],
          weekly: weeklyResult.data[symbol]
        }
      }));
    } catch (err) {
      console.error('Failed to fetch stock data:', err);
    } finally {
      setLoadingStock(null);
    }
  };

  const handleStockClick = async (symbol: string) => {
    if (expandedStock === symbol) {
      setExpandedStock(null);
    } else {
      setExpandedStock(symbol);
      await fetchStockData(symbol);
    }
  };

  useEffect(() => {
    if (expandedStock && stockData[expandedStock]) {
      const data = stockData[expandedStock];
      const priceData = ['1D', '1W', '1M', '6M', '1Y'].includes(selectedPeriod)
        ? data.daily
        : data.weekly;
      if (priceData) {
        drawChart(expandedStock, priceData, selectedPeriod);
      }
    }
  }, [expandedStock, stockData, selectedPeriod]);

  const getFilteredData = (data: StockPrice[], range: string): StockPrice[] => {
    if (range === 'MAX') return data;

    const now = new Date();
    let startDate: Date;

    switch (range) {
      case '1D':
        startDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case '1W':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case '5Y':
        startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    return data.filter((d: StockPrice) => d.date >= startDate);
  };

  const drawChart = (symbol: string, prices: StockPriceData, timeRange: string) => {
    const timeSeriesKey = prices['Time Series (Daily)'] ? 'Time Series (Daily)' : 'Weekly Time Series';
    if (!prices || !prices[timeSeriesKey]) return;

    const svgElement = svgRefs.current[symbol];
    if (!svgElement) return;

    const timeSeries = prices[timeSeriesKey];
    let data: StockPrice[] = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({
        date: new Date(date),
        close: parseFloat(values['4. close']),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        volume: parseFloat(values['5. volume'])
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    data = getFilteredData(data, timeRange);

    if (data.length === 0) return;

    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([(d3.min(data, d => d.low) || 0) * 0.95, (d3.max(data, d => d.high) || 0) * 1.05])
      .range([height, 0]);

    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;
    const isPositive = endPrice >= startPrice;
    const lineColor = isPositive ? '#16a34a' : '#dc2626';

    const line = d3.line<StockPrice>()
      .x(d => x(d.date))
      .y(d => y(d.close))
      .curve(d3.curveMonotoneX);

    const area = d3.area<StockPrice>()
      .x(d => x(d.date))
      .y0(height)
      .y1(d => y(d.close))
      .curve(d3.curveMonotoneX);

    const gradientId = `gradient-${symbol}`;
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', lineColor)
      .attr('stop-opacity', 0.3);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', lineColor)
      .attr('stop-opacity', 0);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(6))
      .style('color', '#666')
      .selectAll('text')
      .style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `$${Number(d).toFixed(0)}`).ticks(5))
      .style('color', '#666')
      .selectAll('text')
      .style('font-size', '11px');

    svg.append('path')
      .datum(data)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', area);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2)
      .attr('d', line);

    const priceChange = endPrice - startPrice;
    const percentChange = ((priceChange / startPrice) * 100).toFixed(2);
    const changeSymbol = isPositive ? '+' : '';

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', lineColor)
      .text(`${changeSymbol}$${priceChange.toFixed(2)} (${changeSymbol}${percentChange}%)`);
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
        📊 Performance Analysis for S&P 500
      </h2>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6 justify-center flex-wrap">
        {(['1D', '1W', '1M', 'YTD', '6M', '1Y', '5Y'] as const).map(period => (
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
          <div className="max-h-[600px] overflow-y-auto">
            {currentData.top_gainers.map((stock, index) => (
              <div key={stock.symbol} className="border-b border-gray-200">
                <div
                  onClick={() => handleStockClick(stock.symbol)}
                  className="p-3 cursor-pointer transition-colors hover:bg-green-50"
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

                {expandedStock === stock.symbol && (
                  <div className="px-3 pb-4 bg-gray-50">
                    {loadingStock === stock.symbol ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      <svg
                        ref={el => { svgRefs.current[stock.symbol] = el; }}
                        className="w-full"
                      ></svg>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-red-600 flex items-center">
            📉 Top 10 Losers
          </h3>
          <div className="max-h-[600px] overflow-y-auto">
            {currentData.top_losers.map((stock, index) => (
              <div key={stock.symbol} className="border-b border-gray-200">
                <div
                  onClick={() => handleStockClick(stock.symbol)}
                  className="p-3 cursor-pointer transition-colors hover:bg-red-50"
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

                {expandedStock === stock.symbol && (
                  <div className="px-3 pb-4 bg-gray-50">
                    {loadingStock === stock.symbol ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      <svg
                        ref={el => { svgRefs.current[stock.symbol] = el; }}
                        className="w-full"
                      ></svg>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalysis;
