'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import PerformanceAnalysis from '../../components/dashboard/PerformanceAnalysis';
import MarketOverview from '../../components/dashboard/MarketOverview';
import WatchlistSidebar from '../../components/dashboard/WatchlistSidebar';
import TopMovers from '../../components/dashboard/TopMovers';
import NewsFeed from '../../components/dashboard/NewsFeed';
import StockInfoModal from '../../components/stock/StockInfoModal';
import StockLogo from '../../components/shared/StockLogo';
import { Stock, StockPriceData, StockPrice, TimeRange } from '../../types';
import { prefetchAll, fetcher, SWR_KEYS } from '../../lib/swr';

// Prefetch all dashboard data immediately when this module loads
prefetchAll();

interface SearchResult {
  '1. symbol': string;
  '2. name': string;
  '3. type': string;
  '4. region': string;
  '8. currency': string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN']);
  const [chartTimeRanges, setChartTimeRanges] = useState<Record<string, string>>({});
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});
  const chartCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [highlightedStock, setHighlightedStock] = useState<string | null>(null);
  const [infoModalSymbol, setInfoModalSymbol] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<Array<{ symbol: string; name: string; timestamp: number }>>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;
  const HISTORY_STORAGE_KEY = 'stock_search_history';

  const timeRanges: TimeRange[] = [
    { label: '1D', weeks: 1/7 },
    { label: '1W', weeks: 1 },
    { label: '1M', weeks: 4 },
    { label: '6M', weeks: 26 },
    { label: '1Y', weeks: 52 },
    { label: '5Y', weeks: 260 },
    { label: 'MAX', weeks: 'max' as const }
  ];

  // Fetch stock list with SWR (benefits from prefetch cache)
  const { data: stockListData, isLoading: loadingList } = useSWR<{ stocks: Stock[] }>(
    SWR_KEYS.stockList,
    fetcher,
    { revalidateOnFocus: false }
  );
  const allStocks = stockListData?.stocks || [];

  // Fetch daily prices with SWR
  const { data: dailyData, isLoading: loadingDaily, error: dailyError } = useSWR(
    selectedSymbols.length > 0 ? SWR_KEYS.stockPrices(selectedSymbols, 'daily') : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const dailyPrices: Record<string, StockPriceData> = dailyData?.data || {};

  // Fetch weekly prices with SWR
  const { data: weeklyData, isLoading: loadingWeekly, error: weeklyError } = useSWR(
    selectedSymbols.length > 0 ? SWR_KEYS.stockPrices(selectedSymbols, 'weekly') : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const allPrices: Record<string, StockPriceData> = weeklyData?.data || {};

  // Fetch intraday prices with SWR (for 1D and 1W views)
  const { data: intradayData, isLoading: loadingIntraday, error: intradayError } = useSWR(
    selectedSymbols.length > 0 ? SWR_KEYS.intradayPrices(selectedSymbols) : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const intradayPrices: Record<string, StockPriceData> = intradayData?.data || {};

  const loading = loadingDaily || loadingWeekly || loadingIntraday;
  const error = dailyError || weeklyError || intradayError ? 'Failed to fetch stock data' : null;

  // Initialize time ranges for stocks when weekly data loads
  useEffect(() => {
    if (weeklyData?.data) {
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
  }, [weeklyData, selectedSymbols]);

  // Load search history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to parse search history:', error);
      }
    }
  }, []);

  useEffect(() => {
    Object.keys(allPrices).forEach(symbol => {
      if (chartTimeRanges[symbol]) {
        const range = chartTimeRanges[symbol];
        const useIntradayData = ['1D', '1W'].includes(range);
        const useDailyData = ['1M', '6M', '1Y'].includes(range);

        let priceData;
        if (useIntradayData && intradayPrices[symbol]) {
          priceData = intradayPrices[symbol];
        } else if (useDailyData) {
          priceData = dailyPrices[symbol];
        } else {
          priceData = allPrices[symbol];
        }

        if (priceData) {
          drawChart(symbol, priceData, range);
        }
      }
    });
  }, [allPrices, dailyPrices, intradayPrices, chartTimeRanges]);

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

  const addToHistory = (stockSymbol: string, stockName: string) => {
    const newHistoryItem = {
      symbol: stockSymbol,
      name: stockName,
      timestamp: Date.now()
    };

    const updatedHistory = [
      newHistoryItem,
      ...searchHistory.filter(item => item.symbol !== stockSymbol)
    ].slice(0, 10);

    setSearchHistory(updatedHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  const searchStocks = async (query: string) => {
    if (!query || query.trim().length < 1) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/search/?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data.bestMatches) {
        const dbSymbols = new Set(allStocks.map(s => s.symbol));
        const filteredResults = data.bestMatches.filter(
          (match: SearchResult) => dbSymbols.has(match['1. symbol'])
        );
        setSearchResults(filteredResults);
        setShowResults(true);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const addStockFromSearch = (symbol: string, name?: string) => {
    if (!selectedSymbols.includes(symbol)) {
      setSelectedSymbols(prev => [...prev, symbol]);
      setChartTimeRanges(prev => ({ ...prev, [symbol]: '1Y' }));
    }

    if (name) {
      addToHistory(symbol, name);
    }

    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setShowHistory(false);
    setHighlightedIndex(-1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (showResults && searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        const selected = searchResults[highlightedIndex];
        addToHistory(selected['1. symbol'], selected['2. name']);
        setInfoModalSymbol(selected['1. symbol']);
        setShowResults(false);
        setHighlightedIndex(-1);
      } else if (e.key === 'Escape') {
        setShowResults(false);
        setHighlightedIndex(-1);
      }
    } else if (showHistory && searchHistory.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < searchHistory.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : searchHistory.length - 1
        );
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        const selected = searchHistory[highlightedIndex];
        setInfoModalSymbol(selected.symbol);
        setShowHistory(false);
        setHighlightedIndex(-1);
      } else if (e.key === 'Escape') {
        setShowHistory(false);
        setHighlightedIndex(-1);
      }
    }
  };

  const setTimeRangeForChart = (symbol: string, range: string) => {
    setChartTimeRanges(prev => ({ ...prev, [symbol]: range }));
  };

  const getFilteredData = (data: StockPrice[], range: string): StockPrice[] => {
    if (range === 'MAX') {
      return data;
    }

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
      default:
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    return data.filter((d: StockPrice) => d.date >= startDate);
  };

  const drawChart = (symbol: string, prices: StockPriceData, timeRange: string) => {
    const possibleKeys = [
      'Time Series (5min)',
      'Time Series (1min)',
      'Time Series (15min)',
      'Time Series (30min)',
      'Time Series (60min)',
      'Time Series (Daily)',
      'Weekly Time Series'
    ];
    const timeSeriesKey = possibleKeys.find(key => prices[key]) || 'Weekly Time Series';
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

    const margin = { top: 60, right: 30, bottom: 50, left: 70 };
    const svgRect = svgElement.getBoundingClientRect();
    const width = svgRect.width - margin.left - margin.right;
    const height = svgRect.height - margin.top - margin.bottom;

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

    // Range selection overlay
    const rangeOverlay = svg.append('rect')
      .attr('class', 'range-overlay')
      .attr('y', 0)
      .attr('height', height)
      .style('fill', lineColor)
      .style('opacity', 0);

    const rangeInfo = svg.append('g')
      .attr('class', 'range-info')
      .style('opacity', 0);

    const rangeInfoBg = rangeInfo.append('rect')
      .attr('fill', 'white')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 2)
      .attr('rx', 6);

    const rangeInfoPriceText = rangeInfo.append('text')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('x', 0)
      .attr('y', 0);

    const rangeInfoDateText = rangeInfo.append('text')
      .attr('font-size', '14px')
      .attr('font-weight', 'normal')
      .attr('fill', '#666')
      .attr('x', 0)
      .attr('y', 0);

    let isDragging = false;
    let dragStartX = 0;
    let dragStartData: StockPrice | null = null;

    const bisect = d3.bisector((d: StockPrice) => d.date).left;

    const getClosestDataPoint = (mouseX: number): StockPrice | null => {
      const xDate = x.invert(mouseX);
      const index = bisect(data, xDate);

      if (index > 0 && index < data.length) {
        const d0 = data[index - 1];
        const d1 = data[index];
        return xDate.getTime() - d0.date.getTime() > d1.date.getTime() - xDate.getTime() ? d1 : d0;
      }
      return null;
    };

    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair')
      .on('mousedown', function (event) {
        const [mouseX] = d3.pointer(event);
        isDragging = true;
        dragStartX = mouseX;
        dragStartData = getClosestDataPoint(mouseX);
      })
      .on('mousemove', function (event) {
        const [mouseX] = d3.pointer(event);

        if (isDragging && dragStartData) {
          verticalLine.style('opacity', 0);
          priceLabel.style('opacity', 0);
          tooltip.transition().duration(0).style('opacity', 0);

          const currentData = getClosestDataPoint(mouseX);

          if (currentData) {
            const x1 = Math.min(dragStartX, mouseX);
            const x2 = Math.max(dragStartX, mouseX);

            rangeOverlay
              .attr('x', x1)
              .attr('width', x2 - x1)
              .style('opacity', 0.15);

            const startPrice = dragStartData.close;
            const endPrice = currentData.close;
            const priceChange = endPrice - startPrice;
            const percentChange = ((priceChange / startPrice) * 100);
            const isRangePositive = priceChange >= 0;
            const rangeColor = isRangePositive ? '#16a34a' : '#dc2626';

            const startDate = dragStartData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDate = currentData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            const arrow = isRangePositive ? '\u2191' : '\u2193';
            const priceText = `${arrow} ${isRangePositive ? '+' : ''}$${priceChange.toFixed(2)} (${isRangePositive ? '+' : ''}${percentChange.toFixed(2)}%)`;
            const dateText = ` | ${startDate} \u2192 ${endDate}`;

            rangeInfoPriceText
              .text(priceText)
              .attr('fill', rangeColor);

            const priceBox = (rangeInfoPriceText.node() as SVGTextElement).getBBox();

            rangeInfoDateText
              .text(dateText)
              .attr('x', priceBox.width);

            const dateBox = (rangeInfoDateText.node() as SVGTextElement).getBBox();
            const totalWidth = priceBox.width + dateBox.width;
            const totalHeight = Math.max(priceBox.height, dateBox.height);

            rangeInfoBg
              .attr('x', -8)
              .attr('y', priceBox.y - 4)
              .attr('width', totalWidth + 16)
              .attr('height', totalHeight + 8)
              .attr('stroke', '#ddd');

            const infoX = (x1 + x2) / 2;
            const infoY = 20;

            rangeInfo
              .attr('transform', `translate(${infoX - totalWidth / 2},${infoY})`)
              .style('opacity', 1);
          }
        } else {
          const d = getClosestDataPoint(mouseX);

          if (d) {
            verticalLine
              .attr('x1', x(d.date))
              .attr('x2', x(d.date))
              .style('opacity', 1);

            priceLabel
              .attr('x', x(d.date))
              .attr('y', y(d.close) - 10)
              .text(`$${d.close.toFixed(2)}`)
              .style('opacity', 1);

            const isIntraday = timeSeriesKey.includes('min');
            const timeLabel = isIntraday ? '' : (timeSeriesKey === 'Time Series (Daily)' ? 'Date' : 'Week of');
            const dateDisplay = isIntraday
              ? d.date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : d.date.toLocaleDateString();
            tooltip.transition().duration(100).style('opacity', 1);
            tooltip.html(`
              <strong>${timeLabel} ${dateDisplay}</strong><br/>
              <span style="color: ${lineColor};">\u25CF</span> Open: $${d.open.toFixed(2)}<br/>
              <span style="color: #16a34a;">\u25CF</span> High: $${d.high.toFixed(2)}<br/>
              <span style="color: #dc2626;">\u25CF</span> Low: $${d.low.toFixed(2)}<br/>
              <span style="color: ${lineColor};">\u25CF</span> Close: $${d.close.toFixed(2)}<br/>
              Volume: ${(d.volume / 1000000).toFixed(1)}M
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px');
          }
        }
      })
      .on('mouseup', function () {
        isDragging = false;
        dragStartData = null;
        rangeOverlay.style('opacity', 0);
        rangeInfo.style('opacity', 0);
      })
      .on('mouseout', () => {
        isDragging = false;
        dragStartData = null;
        verticalLine.style('opacity', 0);
        priceLabel.style('opacity', 0);
        tooltip.transition().duration(200).style('opacity', 0);
        rangeOverlay.style('opacity', 0);
        rangeInfo.style('opacity', 0);
      });
  };

  const handleSelectStockFromAnalysis = (symbol: string) => {
    const isAlreadySelected = selectedSymbols.includes(symbol);

    if (!isAlreadySelected) {
      setSelectedSymbols(prev => [...prev, symbol]);
      setChartTimeRanges(prev => ({ ...prev, [symbol]: '1Y' }));

      setTimeout(() => {
        const chartElement = chartCardRefs.current[symbol];
        if (chartElement) {
          chartElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedStock(symbol);
          setTimeout(() => { setHighlightedStock(null); }, 2000);
        }
      }, 100);
    } else {
      const chartElement = chartCardRefs.current[symbol];
      if (chartElement) {
        chartElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedStock(symbol);
        setTimeout(() => { setHighlightedStock(null); }, 2000);
      }
    }
  };

  const handleWatchlistSelect = (symbol: string) => {
    setInfoModalSymbol(symbol);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Market Overview Bar */}
      <MarketOverview />

      {/* Main Layout: Content + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <Link href="/" className="text-rh-teal-500 hover:text-rh-teal-600 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
              {session?.user && (
                <button className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(-1);
                    searchStocks(e.target.value);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => {
                    setHighlightedIndex(-1);
                    if (searchResults.length > 0) {
                      setShowResults(true);
                    } else {
                      setShowHistory(true);
                    }
                  }}
                  placeholder="Search stocks..."
                  className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 rounded-full bg-white focus:ring-2 focus:ring-rh-teal-500 focus:border-transparent text-gray-900 shadow-sm"
                />
                <svg
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {!searching && searchHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Search History"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
                {searching && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-rh-teal-500 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={result['1. symbol']}
                      onClick={() => {
                        addToHistory(result['1. symbol'], result['2. name']);
                        setInfoModalSymbol(result['1. symbol']);
                        setShowResults(false);
                        setHighlightedIndex(-1);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`p-3 cursor-pointer border-b border-gray-50 transition-colors ${
                        index === highlightedIndex ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <StockLogo symbol={result['1. symbol']} size={32} />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{result['1. symbol']}</div>
                          <div className="text-sm text-gray-500">{result['2. name']}</div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {result['3. type']} · {result['4. region']}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Search History Dropdown */}
              {showHistory && !showResults && searchHistory.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent</span>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  {searchHistory.map((item, index) => (
                    <div
                      key={item.symbol}
                      onClick={() => {
                        setInfoModalSymbol(item.symbol);
                        setShowHistory(false);
                        setHighlightedIndex(-1);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`p-3 cursor-pointer border-b border-gray-50 transition-colors flex items-center gap-3 ${
                        index === highlightedIndex ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <StockLogo symbol={item.symbol} size={28} />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.symbol}</div>
                        <div className="text-sm text-gray-500">{item.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Movers */}
            <div className="mb-6">
              <TopMovers onSelectStock={handleSelectStockFromAnalysis} />
            </div>

            {/* Charts Section */}
            {loading && (
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <p className="text-gray-500 text-center text-sm">
                  Loading charts for {selectedSymbols.length} stocks...
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-xl mb-6 text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}

            {selectedSymbols.length === 0 && !loading && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 mb-6 text-center">
                <p className="text-gray-500">Select a stock from the watchlist or search to view charts</p>
              </div>
            )}

            <div className="space-y-6 mb-8">
              {selectedSymbols.map(symbol => (
                <div
                  key={symbol}
                  ref={el => { chartCardRefs.current[symbol] = el; }}
                  className={`bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 ${
                    highlightedStock === symbol ? 'ring-2 ring-rh-teal-500 shadow-lg' : ''
                  }`}
                >
                  {/* Time Range Selector */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-1">
                      {timeRanges.map(range => (
                        <button
                          key={range.label}
                          onClick={() => setTimeRangeForChart(symbol, range.label)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartTimeRanges[symbol] === range.label
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => toggleStock(symbol)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove chart"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <svg
                    ref={el => { svgRefs.current[symbol] = el; }}
                    className="w-full"
                    style={{ height: '400px' }}
                  ></svg>
                </div>
              ))}
            </div>

            {/* News Feed */}
            {selectedSymbols.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
                <NewsFeed symbols={selectedSymbols} onSelectStock={handleSelectStockFromAnalysis} />
              </div>
            )}

            {/* Performance Analysis */}
            <div className="mb-8">
              <PerformanceAnalysis onSelectStock={handleSelectStockFromAnalysis} />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Watchlist */}
        <div className="hidden lg:block">
          <WatchlistSidebar
            symbols={selectedSymbols}
            onSelectStock={handleWatchlistSelect}
            onRemoveStock={toggleStock}
          />
        </div>
      </div>

      {/* Stock Info Modal */}
      {infoModalSymbol && (
        <StockInfoModal
          symbol={infoModalSymbol}
          isOpen={true}
          onClose={() => setInfoModalSymbol(null)}
          onAddToCharts={(symbol) => {
            addStockFromSearch(symbol);
            setInfoModalSymbol(null);
          }}
          availableStocks={allStocks}
        />
      )}
    </div>
  );
}
