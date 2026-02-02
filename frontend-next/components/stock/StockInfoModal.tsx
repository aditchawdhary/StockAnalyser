'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { StockInfoModalProps, StockOverviewResponse, NewsSentimentResponse, StockPriceData, StockPrice } from '../../types';

interface SearchResult {
  '1. symbol': string;
  '2. name': string;
  '3. type': string;
  '4. region': string;
  '8. currency': string;
}

const StockInfoModal: React.FC<StockInfoModalProps> = ({ symbol, isOpen, onClose, onAddToCharts }) => {
  const [overview, setOverview] = useState<StockOverviewResponse | null>(null);
  const [news, setNews] = useState<NewsSentimentResponse | null>(null);
  const [priceData, setPriceData] = useState<{ daily: StockPriceData; weekly: StockPriceData; intraday: StockPriceData | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartTimeRange, setChartTimeRange] = useState('1Y');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [searchHistory, setSearchHistory] = useState<Array<{ symbol: string; name: string; timestamp: number }>>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const BACKEND_URL = 'http://127.0.0.1:8000/api';
  const ALPHA_VANTAGE_API_KEY = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || '';
  const HISTORY_STORAGE_KEY = 'stock_search_history';

  // Fetch all data on mount or when currentSymbol changes
  useEffect(() => {
    if (!isOpen || !currentSymbol) return;

    fetchAllData();
  }, [currentSymbol, isOpen]);

  // Update currentSymbol when prop symbol changes
  useEffect(() => {
    setCurrentSymbol(symbol);
  }, [symbol]);

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

  // Debounced search-as-you-type
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      setHighlightedIndex(-1);
      return;
    }

    // Hide history when user starts typing
    setShowHistory(false);

    const debounceTimer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${searchQuery}&apikey=${ALPHA_VANTAGE_API_KEY}`
        );
        const data = await response.json();

        if (data.bestMatches) {
          setSearchResults(data.bestMatches);
          setShowResults(true);
          setHighlightedIndex(-1); // Reset highlight when new results come in
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, ALPHA_VANTAGE_API_KEY]);

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
        drawChart(currentSymbol, data, chartTimeRange);
      }
    }
  }, [priceData, chartTimeRange, currentSymbol]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch in parallel: overview, news, and price data (including intraday)
      const [overviewRes, newsRes, dailyRes, weeklyRes, intradayRes] = await Promise.all([
        fetch(`${BACKEND_URL}/stock/${currentSymbol}/overview/`),
        fetch(`${BACKEND_URL}/stock/${currentSymbol}/news/?limit=10`),
        fetch(`${BACKEND_URL}/stocks/?symbols=${currentSymbol}&type=daily`),
        fetch(`${BACKEND_URL}/stocks/?symbols=${currentSymbol}&type=weekly`),
        fetch(`${BACKEND_URL}/stock/${currentSymbol}/intraday/?interval=5min&days=7`)
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${searchQuery}&apikey=${ALPHA_VANTAGE_API_KEY}`
      );
      const data = await response.json();

      if (data.bestMatches) {
        setSearchResults(data.bestMatches);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
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
        selectStock(selected['1. symbol'], selected['2. name']);
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
        selectStock(selected.symbol, selected.name);
      } else if (e.key === 'Escape') {
        setShowHistory(false);
        setHighlightedIndex(-1);
      }
    }
  };

  const addToHistory = (stockSymbol: string, stockName: string) => {
    const newHistoryItem = {
      symbol: stockSymbol,
      name: stockName,
      timestamp: Date.now()
    };

    // Remove duplicate if it exists and add to the beginning
    const updatedHistory = [
      newHistoryItem,
      ...searchHistory.filter(item => item.symbol !== stockSymbol)
    ].slice(0, 10); // Keep only last 10 items

    setSearchHistory(updatedHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  };

  const selectStock = (stockSymbol: string, stockName?: string) => {
    setCurrentSymbol(stockSymbol);
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
    setShowHistory(false);

    // Add to history if name is provided
    if (stockName) {
      addToHistory(stockSymbol, stockName);
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

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
    // Detect the time series key based on available data
    let timeSeriesKey: string;
    if (prices['Time Series (5min)']) {
      timeSeriesKey = 'Time Series (5min)';
    } else if (prices['Time Series (1min)']) {
      timeSeriesKey = 'Time Series (1min)';
    } else if (prices['Time Series (15min)']) {
      timeSeriesKey = 'Time Series (15min)';
    } else if (prices['Time Series (30min)']) {
      timeSeriesKey = 'Time Series (30min)';
    } else if (prices['Time Series (60min)']) {
      timeSeriesKey = 'Time Series (60min)';
    } else if (prices['Time Series (Daily)']) {
      timeSeriesKey = 'Time Series (Daily)';
    } else {
      timeSeriesKey = 'Weekly Time Series';
    }

    if (!prices || !prices[timeSeriesKey]) return;

    const isIntradayData = timeSeriesKey.includes('min');

    const svgElement = svgRef.current;
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
    // Get actual SVG dimensions
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
      .domain([(d3.min(data, d => d.close) || 0) * 0.95, (d3.max(data, d => d.close) || 0) * 1.05])
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

    // Add interactive hover elements
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

    const tooltipId = `tooltip-modal-${symbol}`;
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
        .style('z-index', 10000);
    }

    // Add range selection overlay
    const rangeOverlay = svg.append('rect')
      .attr('class', 'range-overlay')
      .attr('y', 0)
      .attr('height', height)
      .style('fill', lineColor)
      .style('opacity', 0);

    // Add range info display
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

    // Drag state
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
          // Hide hover elements during drag
          verticalLine.style('opacity', 0);
          priceLabel.style('opacity', 0);
          tooltip.transition().duration(0).style('opacity', 0);

          // Show range selection
          const currentData = getClosestDataPoint(mouseX);

          if (currentData) {
            const x1 = Math.min(dragStartX, mouseX);
            const x2 = Math.max(dragStartX, mouseX);

            rangeOverlay
              .attr('x', x1)
              .attr('width', x2 - x1)
              .style('opacity', 0.15);

            // Calculate change
            const startPrice = dragStartData.close;
            const endPrice = currentData.close;
            const priceChange = endPrice - startPrice;
            const percentChange = ((priceChange / startPrice) * 100);
            const isRangePositive = priceChange >= 0;
            const rangeColor = isRangePositive ? '#16a34a' : '#dc2626';

            // Format dates
            const startDate = dragStartData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDate = currentData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Format price change with arrow
            const arrow = isRangePositive ? '↑' : '↓';
            const priceText = `${arrow} ${isRangePositive ? '+' : ''}$${priceChange.toFixed(2)} (${isRangePositive ? '+' : ''}${percentChange.toFixed(2)}%)`;
            const dateText = ` | ${startDate} → ${endDate}`;

            // Update price text (colored)
            rangeInfoPriceText
              .text(priceText)
              .attr('fill', rangeColor);

            // Get price text width to position date text
            const priceBox = (rangeInfoPriceText.node() as SVGTextElement).getBBox();

            // Update date text (neutral color)
            rangeInfoDateText
              .text(dateText)
              .attr('x', priceBox.width);

            // Get combined bounding box
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
            const infoY = -50;

            rangeInfo
              .attr('transform', `translate(${infoX - totalWidth / 2},${infoY})`)
              .style('opacity', 1);
          }
        } else {
          // Normal hover behavior
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

            let timeLabel: string;
            let dateDisplay: string;
            if (isIntradayData) {
              timeLabel = '';
              dateDisplay = d.date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            } else if (timeSeriesKey === 'Time Series (Daily)') {
              timeLabel = 'Date: ';
              dateDisplay = d.date.toLocaleDateString();
            } else {
              timeLabel = 'Week of ';
              dateDisplay = d.date.toLocaleDateString();
            }
            tooltip.transition().duration(100).style('opacity', 1);
            tooltip.html(`
              <strong>${timeLabel}${dateDisplay}</strong><br/>
              <span style="color: ${lineColor}; font-size: 18px; font-weight: bold;">$${d.close.toFixed(2)}</span><br/>
              <span style="color: #666;">Volume: ${(d.volume / 1000000).toFixed(1)}M</span>
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

  // Format large numbers (market cap, revenue, etc.)
  const formatLargeNumber = (value: string | undefined) => {
    if (!value || value === 'None') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';

    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercentage = (value: string | undefined) => {
    if (!value || value === 'None') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return `${(num * 100).toFixed(2)}%`;
  };

  // Get current price and change from price data
  const getCurrentPriceInfo = () => {
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

  const priceInfo = getCurrentPriceInfo();

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'Bullish': return 'bg-green-100 text-green-800';
      case 'Somewhat-Bullish': return 'bg-green-50 text-green-700';
      case 'Neutral': return 'bg-gray-100 text-gray-800';
      case 'Somewhat-Bearish': return 'bg-red-50 text-red-700';
      case 'Bearish': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
        onClick={(e) => {
          e.stopPropagation();
          // Close history when clicking anywhere in the modal
          if (showHistory) {
            setShowHistory(false);
          }
        }}
      >
        {/* Header */}
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

          {/* Search Bar */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  onFocus={() => { setShowHistory(true); setHighlightedIndex(-1); }}
                  placeholder="Search for stocks (e.g., AAPL, TSLA, MSFT)..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-rh-teal-500 focus:outline-none text-base"
                />
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Search History"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-6 py-3 bg-rh-teal-500 text-white rounded-lg hover:bg-rh-teal-600 transition-colors disabled:bg-gray-400 font-semibold"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={result['1. symbol']}
                    onClick={() => selectStock(result['1. symbol'], result['2. name'])}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`p-4 cursor-pointer border-b border-gray-100 transition-colors ${
                      index === highlightedIndex ? 'bg-teal-100' : 'hover:bg-teal-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">{result['1. symbol']}</div>
                        <div className="text-sm text-gray-600">{result['2. name']}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {result['3. type']} • {result['4. region']} • {result['8. currency']}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search History Dropdown */}
            {showHistory && !showResults && searchHistory.length > 0 && (
              <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">Recent Searches</span>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                {searchHistory.map((item, index) => (
                  <div
                    key={item.symbol}
                    onClick={() => selectStock(item.symbol, item.name)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`p-4 cursor-pointer border-b border-gray-100 transition-colors flex items-center gap-3 ${
                      index === highlightedIndex ? 'bg-teal-100' : 'hover:bg-teal-50'
                    }`}
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{item.symbol}</div>
                      <div className="text-sm text-gray-600">{item.name}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Info - Symbol, Name, Price */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-12 w-12 border-4 border-rh-teal-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* SECTION 1: Price Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-center gap-2 mb-4 flex-wrap">
                {['1D', '1W', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'].map(range => (
                  <button
                    key={range}
                    onClick={() => setChartTimeRange(range)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      chartTimeRange === range
                        ? 'bg-rh-teal-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <svg ref={svgRef} className="w-full" style={{ height: '350px' }}></svg>
            </div>

            {/* SECTION 2: Important Stock Metrics */}
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

            {/* SECTION 3: News Sentiment */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-4">Recent News & Sentiment</h3>
              {news?.feed && news.feed.length > 0 ? (
                <div className="space-y-4">
                  {news.feed.slice(0, 5).map((article, index) => (
                    <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rh-teal-500 hover:text-rh-teal-600 font-semibold"
                      >
                        {article.title}
                      </a>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                        <span>{article.source}</span>
                        <span>•</span>
                        <span>{new Date(article.time_published).toLocaleDateString()}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSentimentColor(article.overall_sentiment_label)}`}>
                          {article.overall_sentiment_label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{article.summary.substring(0, 200)}...</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No recent news available</p>
              )}
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-3">
    <div className="text-xs text-gray-600 mb-1">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string | undefined; fullWidth?: boolean }> = ({ label, value, fullWidth }) => (
  <div className={fullWidth ? 'col-span-full' : ''}>
    <span className="text-sm font-semibold text-gray-700">{label}: </span>
    <span className="text-sm text-gray-900">{value || 'N/A'}</span>
  </div>
);

export default StockInfoModal;
