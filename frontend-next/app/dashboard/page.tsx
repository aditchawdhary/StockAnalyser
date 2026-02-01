'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import PerformanceAnalysis from '../../components/dashboard/PerformanceAnalysis';
import { Stock, StockPriceData, StockPrice, TimeRange } from '../../types';

export default function Dashboard() {
  const { data: session } = useSession();
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN']);
  const [allPrices, setAllPrices] = useState<Record<string, StockPriceData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartTimeRanges, setChartTimeRanges] = useState<Record<string, string>>({});
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  const BACKEND_URL = 'http://127.0.0.1:8000/api';

  const timeRanges: TimeRange[] = [
    { label: '1M', weeks: 4 },
    { label: '6M', weeks: 26 },
    { label: 'YTD', weeks: 'ytd' as const },
    { label: '1Y', weeks: 52 },
    { label: '5Y', weeks: 260 },
    { label: 'MAX', weeks: 'max' as const }
  ];

  // Fetch list of all available stocks
  const fetchStocksList = async () => {
    setLoadingList(true);
    try {
      const response = await fetch(`${BACKEND_URL}/stocks/list/`);
      const data = await response.json();
      setAllStocks(data.stocks || []);
    } catch (err) {
      console.error('Failed to fetch stocks list:', err);
      setError('Failed to load stocks list: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch price data for selected stocks
  const fetchStockData = async () => {
    if (selectedSymbols.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const symbols = selectedSymbols.join(',');
      const response = await fetch(`${BACKEND_URL}/stocks/?symbols=${symbols}`);
      const result = await response.json();

      if (result.data) {
        setAllPrices(result.data);

        // Initialize time ranges for new stocks
        const newRanges: Record<string, string> = {};
        selectedSymbols.forEach(symbol => {
          if (!chartTimeRanges[symbol]) {
            newRanges[symbol] = '1Y';
          }
        });
        if (Object.keys(newRanges).length > 0) {
          setChartTimeRanges(prev => ({ ...prev, ...newRanges }));
        }
      }

      if (result.errors && result.errors.length > 0) {
        setError(result.errors.join('\n'));
      }

    } catch (err) {
      setError('Failed to fetch data from backend: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocksList();
  }, []);

  useEffect(() => {
    if (selectedSymbols.length > 0) {
      fetchStockData();
    }
  }, [selectedSymbols]);

  useEffect(() => {
    Object.keys(allPrices).forEach(symbol => {
      if (chartTimeRanges[symbol]) {
        drawChart(symbol, allPrices[symbol], chartTimeRanges[symbol]);
      }
    });
  }, [allPrices, chartTimeRanges]);

  const toggleStock = (symbol: string) => {
    setSelectedSymbols(prev => {
      if (prev.includes(symbol)) {
        const newRanges = { ...chartTimeRanges };
        delete newRanges[symbol];
        setChartTimeRanges(newRanges);
        return prev.filter(s => s !== symbol);
      } else {
        setChartTimeRanges(prev => ({ ...prev, [symbol]: '1Y' }));
        return [...prev, symbol];
      }
    });
  };

  const setTimeRangeForChart = (symbol: string, range: string) => {
    setChartTimeRanges(prev => ({ ...prev, [symbol]: range }));
  };

  const getFilteredData = (data: StockPrice[], range: string): StockPrice[] => {
    if (range === 'max') {
      return data;
    }

    if (range === 'ytd') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return data.filter((d: StockPrice) => d.date >= startOfYear);
    }

    const rangeConfig = timeRanges.find(r => r.label === range);
    if (rangeConfig && typeof rangeConfig.weeks === 'number') {
      return data.slice(-rangeConfig.weeks);
    }

    return data.slice(-52);
  };

  const drawChart = (symbol: string, prices: StockPriceData, timeRange: string) => {
    if (!prices || !prices['Weekly Time Series']) return;

    const svgElement = svgRefs.current[symbol];
    if (!svgElement) return;

    const timeSeries = prices['Weekly Time Series'];
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

    const margin = { top: 60, right: 30, bottom: 50, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

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
    const areaColor = isPositive ? '#16a34a' : '#dc2626';

    const line = d3.line<StockPrice>()
      .x(d => x(d.date))
      .y(d => y(d.close))
      .curve(d3.curveMonotoneX);

    const gradientId = `areaGradient-${symbol}`;
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', areaColor)
      .attr('stop-opacity', 0.3);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', areaColor)
      .attr('stop-opacity', 0);

    const area = d3.area<StockPrice>()
      .x(d => x(d.date))
      .y0(height)
      .y1(d => y(d.close))
      .curve(d3.curveMonotoneX);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(8))
      .style('color', '#666')
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    svg.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `$${Number(d).toFixed(0)}`))
      .style('color', '#666');

    svg.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(y)
        .tickSize(-width)
        .tickFormat(() => '')
      );

    svg.append('path')
      .datum(data)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', area);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 3)
      .attr('d', line);

    svg.selectAll('dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.close))
      .attr('r', 3)
      .attr('fill', lineColor)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    const stockInfo = allStocks.find(s => s.symbol === symbol);
    const stockName = stockInfo ? stockInfo.name : symbol;

    const priceChange = endPrice - startPrice;
    const percentChange = ((priceChange / startPrice) * 100).toFixed(2);
    const changeSymbol = isPositive ? '+' : '';

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(`${symbol} - ${stockName.substring(0, 30)}${stockName.length > 30 ? '...' : ''}`);

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .style('fill', lineColor)
      .text(`${changeSymbol}$${priceChange.toFixed(2)} (${changeSymbol}${percentChange}%)`);

    const verticalLine = svg.append('line')
      .attr('class', 'hover-line')
      .attr('y1', 0)
      .attr('y2', height)
      .style('stroke', '#666')
      .style('stroke-width', 1)
      .style('stroke-dasharray', '5,5')
      .style('opacity', 0);

    const priceLabel = svg.append('text')
      .attr('class', 'price-label')
      .style('opacity', 0)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .attr('text-anchor', 'middle');

    const tooltipId = `tooltip-${symbol}`;
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> = d3.select<HTMLDivElement, unknown>(`#${tooltipId}`);

    if (tooltip.empty()) {
      tooltip = d3.select('body')
        .append('div')
        .attr('id', tooltipId)
        .style('position', 'absolute')
        .style('background', 'white')
        .style('padding', '12px')
        .style('border', '1px solid #ddd')
        .style('border-radius', '6px')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('font-size', '14px')
        .style('z-index', 1000);
    }

    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mousemove', function (event) {
        const [mouseX] = d3.pointer(event);
        const xDate = x.invert(mouseX);

        const bisect = d3.bisector((d: StockPrice) => d.date).left;
        const index = bisect(data, xDate);

        if (index > 0 && index < data.length) {
          const d0 = data[index - 1];
          const d1 = data[index];
          const d = xDate.getTime() - d0.date.getTime() > d1.date.getTime() - xDate.getTime() ? d1 : d0;

          verticalLine
            .attr('x1', x(d.date))
            .attr('x2', x(d.date))
            .style('opacity', 1);

          priceLabel
            .attr('x', x(d.date))
            .attr('y', y(d.close) - 10)
            .text(`$${d.close.toFixed(2)}`)
            .style('opacity', 1);

          tooltip.transition().duration(100).style('opacity', 1);
          tooltip.html(`
            <strong>Week of ${d.date.toLocaleDateString()}</strong><br/>
            <span style="color: ${lineColor};">●</span> Open: $${d.open.toFixed(2)}<br/>
            <span style="color: #16a34a;">●</span> High: $${d.high.toFixed(2)}<br/>
            <span style="color: #dc2626;">●</span> Low: $${d.low.toFixed(2)}<br/>
            <span style="color: ${lineColor};">●</span> Close: $${d.close.toFixed(2)}<br/>
            📊 Volume: ${(d.volume / 1000000).toFixed(1)}M
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');

          svg.selectAll('circle')
            .attr('r', circle => circle === d ? 6 : 3)
            .attr('opacity', circle => circle === d ? 1 : 0.6);
        }
      })
      .on('mouseout', () => {
        verticalLine.style('opacity', 0);
        priceLabel.style('opacity', 0);
        tooltip.transition().duration(200).style('opacity', 0);
        svg.selectAll('circle')
          .attr('r', 3)
          .attr('opacity', 1);
      });
  };

  const handleSelectStockFromAnalysis = (symbol: string) => {
    if (!selectedSymbols.includes(symbol)) {
      setSelectedSymbols(prev => [...prev, symbol]);
      setChartTimeRanges(prev => ({ ...prev, [symbol]: '1Y' }));
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-rh-teal-500 hover:text-rh-teal-600 font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          {session?.user?.email && (
            <div className="text-sm text-gray-600">
              Logged in as: <span className="font-semibold text-gray-900">{session.user.email}</span>
            </div>
          )}
        </div>

        <h1 className="text-4xl font-bold mb-8 text-gray-900 text-center">
          Vector Tracker - {selectedSymbols.length} stocks selected
        </h1>

        {/* Stock Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">
              Select Stocks ({allStocks.length} available)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedSymbols(allStocks.slice(0, 10).map(s => s.symbol))}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Top 10
              </button>
              <button
                onClick={() => setSelectedSymbols([])}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {loadingList ? (
            <p className="text-center text-gray-500">Loading stocks...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2">
              {allStocks.map(stock => (
                <label
                  key={stock.symbol}
                  className={`flex items-center p-2 cursor-pointer rounded transition-all ${selectedSymbols.includes(stock.symbol)
                      ? 'bg-blue-50 border-2 border-blue-600'
                      : 'bg-transparent border border-gray-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(stock.symbol)}
                    onChange={() => toggleStock(stock.symbol)}
                    className="mr-2"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 block">{stock.symbol}</span>
                    <span className="text-xs text-gray-600 truncate block">
                      {stock.name.substring(0, 35)}{stock.name.length > 35 ? '...' : ''}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <p className="text-blue-900 text-center">
              Loading stock data for {selectedSymbols.length} stocks...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-lg mb-6">
            <strong>Errors:</strong>
            <pre className="mt-2 text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        <PerformanceAnalysis onSelectStock={handleSelectStockFromAnalysis} />

        {selectedSymbols.length === 0 && !loading && (
          <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-6 mb-6 text-center">
            <p className="text-yellow-900">
              Please select at least one stock to view charts
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {selectedSymbols.map(symbol => (
            <div key={symbol} className="bg-white rounded-lg shadow-md p-6">
              {/* Time Range Selector */}
              <div className="flex justify-center gap-2 mb-4 flex-wrap">
                {timeRanges.map(range => (
                  <button
                    key={range.label}
                    onClick={() => setTimeRangeForChart(symbol, range.label)}
                    className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${chartTimeRanges[symbol] === range.label
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-300 hover:border-gray-400'
                      }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              <svg
                ref={el => { svgRefs.current[symbol] = el; }}
                className="w-full"
                style={{ height: '500px' }}
              ></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
