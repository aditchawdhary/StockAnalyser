import * as d3 from 'd3';
import {StockPrice, StockPriceData} from '../../types';
import React from 'react';

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
      startDate = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
      break;
    case '5Y':
      startDate = new Date(now.getTime() - 5 * 366 * 24 * 60 * 60 * 1000);
      break;
    case 'YTD':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
  }

  return data.filter((d: StockPrice) => d.date >= startDate);
};

const drawChart = (symbol: string, prices: StockPriceData, timeRange: string, svgRef: React.RefObject<SVGSVGElement | null>) => {
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
          const infoY = 20; // Position inside chart area, near top

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




export default drawChart;
