'use client';

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { StockPriceData, StockPrice, Stock } from '../../types';
import { fetcher, SWR_KEYS } from '../../lib/swr';

const TIME_RANGES = ['1D', '1W', '1M', '6M', '1Y', '5Y', 'MAX'] as const;

interface StockChartProps {
  symbol: string;
  onClose?: () => void;
}

const StockChart: React.FC<StockChartProps> = ({ symbol, onClose }) => {
  const [timeRange, setTimeRange] = useState('1Y');
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: stockListData } = useSWR<{ stocks: Stock[] }>(
    SWR_KEYS.stockList,
    fetcher,
    { revalidateOnFocus: false }
  );
  const allStocks = stockListData?.stocks || [];

  const { data: dailyData } = useSWR(
    SWR_KEYS.stockPrices([symbol], 'daily'),
    fetcher,
    { revalidateOnFocus: false }
  );
  const dailyPrices: Record<string, StockPriceData> = dailyData?.data || {};

  const { data: weeklyData } = useSWR(
    SWR_KEYS.stockPrices([symbol], 'weekly'),
    fetcher,
    { revalidateOnFocus: false }
  );
  const weeklyPrices: Record<string, StockPriceData> = weeklyData?.data || {};

  const { data: intradayData } = useSWR(
    SWR_KEYS.intradayPrices([symbol]),
    fetcher,
    { revalidateOnFocus: false }
  );
  const intradayPrices: Record<string, StockPriceData> = intradayData?.data || {};

  useEffect(() => {
    const useIntraday = ['1D', '1W'].includes(timeRange);
    const useDaily = ['1M', '6M', '1Y'].includes(timeRange);

    let priceData: StockPriceData | undefined;
    if (useIntraday && intradayPrices[symbol]) {
      priceData = intradayPrices[symbol];
    } else if (useDaily && dailyPrices[symbol]) {
      priceData = dailyPrices[symbol];
    } else if (weeklyPrices[symbol]) {
      priceData = weeklyPrices[symbol];
    }

    if (priceData) {
      drawChart(priceData, timeRange);
    }
  }, [dailyPrices, weeklyPrices, intradayPrices, timeRange, symbol]);

  const getFilteredData = (data: StockPrice[], range: string): StockPrice[] => {
    if (range === 'MAX') return data;

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysMap: Record<string, number> = {
      '1D': 1, '1W': 7, '1M': 30, '6M': 180, '1Y': 365, '5Y': 5 * 365,
    };
    const days = daysMap[range] || 365;
    const startDate = new Date(now.getTime() - days * msPerDay);
    return data.filter(d => d.date >= startDate);
  };

  const drawChart = (prices: StockPriceData, range: string) => {
    const possibleKeys = [
      'Time Series (5min)', 'Time Series (1min)', 'Time Series (15min)',
      'Time Series (30min)', 'Time Series (60min)',
      'Time Series (Daily)', 'Weekly Time Series'
    ];
    const timeSeriesKey = possibleKeys.find(key => prices[key]) || 'Weekly Time Series';
    if (!prices[timeSeriesKey]) return;

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

    data = getFilteredData(data, range);
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

    const line = d3.line<StockPrice>()
      .x(d => x(d.date))
      .y(d => y(d.close))
      .curve(d3.curveMonotoneX);

    const gradientId = `areaGradient-${symbol}-${range}`;
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%')
      .attr('stop-color', lineColor).attr('stop-opacity', 0.3);
    gradient.append('stop').attr('offset', '100%')
      .attr('stop-color', lineColor).attr('stop-opacity', 0);

    const area = d3.area<StockPrice>()
      .x(d => x(d.date)).y0(height).y1(d => y(d.close))
      .curve(d3.curveMonotoneX);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(8))
      .style('color', '#666')
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em').attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    svg.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `$${Number(d).toFixed(0)}`))
      .style('color', '#666');

    svg.append('g').attr('class', 'grid').attr('opacity', 0.1)
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ''));

    // Area + Line
    svg.append('path').datum(data)
      .attr('fill', `url(#${gradientId})`).attr('d', area);
    svg.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', lineColor)
      .attr('stroke-width', 3).attr('d', line);

    // Title
    const stockInfo = allStocks.find(s => s.symbol === symbol);
    const stockName = stockInfo ? stockInfo.name : symbol;
    const priceChange = endPrice - startPrice;
    const percentChange = ((priceChange / startPrice) * 100).toFixed(2);
    const sign = isPositive ? '+' : '';

    svg.append('text').attr('x', width / 2).attr('y', -40)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px').style('font-weight', 'bold').style('fill', '#333')
      .text(`${symbol} - ${stockName.substring(0, 30)}${stockName.length > 30 ? '...' : ''}`);

    svg.append('text').attr('x', width / 2).attr('y', -20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px').style('font-weight', '600').style('fill', lineColor)
      .text(`${sign}$${priceChange.toFixed(2)} (${sign}${percentChange}%)`);

    // Hover crosshair + tooltip
    const verticalLine = svg.append('line')
      .attr('y1', 0).attr('y2', height)
      .style('stroke', '#666').style('stroke-width', 1)
      .style('stroke-dasharray', '5,5').style('opacity', 0);

    const priceLabel = svg.append('text')
      .style('opacity', 0).style('font-size', '12px')
      .style('font-weight', 'bold').style('fill', '#333')
      .attr('text-anchor', 'middle');

    const tooltipId = `tooltip-${symbol}`;
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> =
      d3.select<HTMLDivElement, unknown>(`#${tooltipId}`);

    if (tooltip.empty()) {
      tooltip = d3.select('body').append('div').attr('id', tooltipId)
        .style('position', 'absolute').style('background', 'white')
        .style('padding', '12px').style('border', '1px solid #ddd')
        .style('border-radius', '6px').style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
        .style('pointer-events', 'none').style('opacity', 0)
        .style('font-size', '14px').style('z-index', '1000');
    }

    // Range selection overlay
    const rangeOverlay = svg.append('rect')
      .attr('y', 0).attr('height', height)
      .style('fill', lineColor).style('opacity', 0);

    const rangeInfo = svg.append('g').style('opacity', 0);
    const rangeInfoBg = rangeInfo.append('rect')
      .attr('fill', 'white').attr('stroke', '#ddd').attr('stroke-width', 2).attr('rx', 6);
    const rangeInfoPriceText = rangeInfo.append('text')
      .attr('font-size', '14px').attr('font-weight', 'bold');
    const rangeInfoDateText = rangeInfo.append('text')
      .attr('font-size', '14px').attr('fill', '#666');

    let isDragging = false;
    let dragStartX = 0;
    let dragStartData: StockPrice | null = null;

    const bisect = d3.bisector((d: StockPrice) => d.date).left;

    const getClosest = (mouseX: number): StockPrice | null => {
      const xDate = x.invert(mouseX);
      const i = bisect(data, xDate);
      if (i > 0 && i < data.length) {
        const d0 = data[i - 1], d1 = data[i];
        return xDate.getTime() - d0.date.getTime() > d1.date.getTime() - xDate.getTime() ? d1 : d0;
      }
      return null;
    };

    svg.append('rect')
      .attr('width', width).attr('height', height)
      .style('fill', 'none').style('pointer-events', 'all').style('cursor', 'crosshair')
      .on('mousedown', function (event) {
        const [mx] = d3.pointer(event);
        isDragging = true;
        dragStartX = mx;
        dragStartData = getClosest(mx);
      })
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);

        if (isDragging && dragStartData) {
          verticalLine.style('opacity', 0);
          priceLabel.style('opacity', 0);
          tooltip.transition().duration(0).style('opacity', 0);

          const cur = getClosest(mx);
          if (cur) {
            const x1 = Math.min(dragStartX, mx);
            const x2 = Math.max(dragStartX, mx);
            rangeOverlay.attr('x', x1).attr('width', x2 - x1).style('opacity', 0.15);

            const sp = dragStartData.close, ep = cur.close;
            const pc = ep - sp, pct = (pc / sp) * 100;
            const pos = pc >= 0;
            const rc = pos ? '#16a34a' : '#dc2626';
            const arrow = pos ? '\u2191' : '\u2193';
            const sd = dragStartData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const ed = cur.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            rangeInfoPriceText.text(`${arrow} ${pos ? '+' : ''}$${pc.toFixed(2)} (${pos ? '+' : ''}${pct.toFixed(2)}%)`).attr('fill', rc);
            const pb = (rangeInfoPriceText.node() as SVGTextElement).getBBox();
            rangeInfoDateText.text(` | ${sd} \u2192 ${ed}`).attr('x', pb.width);
            const db = (rangeInfoDateText.node() as SVGTextElement).getBBox();
            const tw = pb.width + db.width;
            rangeInfoBg.attr('x', -8).attr('y', pb.y - 4).attr('width', tw + 16).attr('height', Math.max(pb.height, db.height) + 8);
            rangeInfo.attr('transform', `translate(${(x1 + x2) / 2 - tw / 2},20)`).style('opacity', 1);
          }
        } else {
          const d = getClosest(mx);
          if (d) {
            verticalLine.attr('x1', x(d.date)).attr('x2', x(d.date)).style('opacity', 1);
            priceLabel.attr('x', x(d.date)).attr('y', y(d.close) - 10)
              .text(`$${d.close.toFixed(2)}`).style('opacity', 1);

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
        isDragging = false; dragStartData = null;
        rangeOverlay.style('opacity', 0); rangeInfo.style('opacity', 0);
      })
      .on('mouseout', () => {
        isDragging = false; dragStartData = null;
        verticalLine.style('opacity', 0); priceLabel.style('opacity', 0);
        tooltip.transition().duration(200).style('opacity', 0);
        rangeOverlay.style('opacity', 0); rangeInfo.style('opacity', 0);
      });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-1">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                timeRange === r
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Close chart"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      <svg ref={svgRef} className="w-full" style={{ height: '400px' }} />
    </div>
  );
};

export default StockChart;
