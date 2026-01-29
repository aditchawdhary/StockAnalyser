import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import PerformanceAnalysis from './stockPerformance';

const App = () => {
  const [allStocks, setAllStocks] = useState([]);
  const [selectedSymbols, setSelectedSymbols] = useState(['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN']);
  const [allPrices, setAllPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(null);
  const [chartTimeRanges, setChartTimeRanges] = useState({}); // Store time range per chart
  const svgRefs = useRef({});

  const BACKEND_URL = 'http://127.0.0.1:8000/api';

  const timeRanges = [
    { label: '1M', weeks: 4 },
    { label: '6M', weeks: 26 },
    { label: 'YTD', weeks: 'ytd' },
    { label: '1Y', weeks: 52 },
    { label: '5Y', weeks: 260 },
    { label: 'MAX', weeks: 'max' }
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
      setError('Failed to load stocks list: ' + err.message);
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
        const newRanges = {};
        selectedSymbols.forEach(symbol => {
          if (!chartTimeRanges[symbol]) {
            newRanges[symbol] = '1Y'; // Default to 1 year
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
      setError('Failed to fetch data from backend: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load stocks list on mount
  useEffect(() => {
    fetchStocksList();
  }, []);

  // Fetch data when selected stocks change
  useEffect(() => {
    if (selectedSymbols.length > 0) {
      fetchStockData();
    }
  }, [selectedSymbols]);

  // Redraw chart when data or its specific time range changes
  useEffect(() => {
    Object.keys(allPrices).forEach(symbol => {
      if (chartTimeRanges[symbol]) {
        drawChart(symbol, allPrices[symbol], chartTimeRanges[symbol]);
      }
    });
  }, [allPrices, chartTimeRanges]);

  const toggleStock = (symbol) => {
    setSelectedSymbols(prev => {
      if (prev.includes(symbol)) {
        // Remove time range when stock is deselected
        const newRanges = { ...chartTimeRanges };
        delete newRanges[symbol];
        setChartTimeRanges(newRanges);
        return prev.filter(s => s !== symbol);
      } else {
        // Add default time range for new stock
        setChartTimeRanges(prev => ({ ...prev, [symbol]: '1Y' }));
        return [...prev, symbol];
      }
    });
  };

  const setTimeRangeForChart = (symbol, range) => {
    setChartTimeRanges(prev => ({ ...prev, [symbol]: range }));
  };

  const getFilteredData = (data, range) => {
    if (range === 'max') {
      return data;
    }
    
    if (range === 'ytd') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return data.filter(d => d.date >= startOfYear);
    }
    
    // For specific week counts
    const rangeConfig = timeRanges.find(r => r.label === range);
    if (rangeConfig && typeof rangeConfig.weeks === 'number') {
      return data.slice(-rangeConfig.weeks);
    }
    
    return data.slice(-52); // Default to 1 year
  };

  const drawChart = (symbol, prices, timeRange) => {
    if (!prices || !prices['Weekly Time Series']) return;

    const svgElement = svgRefs.current[symbol];
    if (!svgElement) return;

    const timeSeries = prices['Weekly Time Series'];
    let data = Object.entries(timeSeries)
      .map(([date, values]) => ({
        date: new Date(date),
        close: parseFloat(values['4. close']),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        volume: parseFloat(values['5. volume'])
      }))
      .sort((a, b) => a.date - b.date);

    // Filter data based on selected time range for this chart
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
      .domain(d3.extent(data, d => d.date))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([d3.min(data, d => d.low) * 0.95, d3.max(data, d => d.high) * 1.05])
      .range([height, 0]);

    // Determine if stock is up or down
    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;
    const isPositive = endPrice >= startPrice;
    const lineColor = isPositive ? '#16a34a' : '#dc2626';
    const areaColor = isPositive ? '#16a34a' : '#dc2626';

    const line = d3.line()
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

    const area = d3.area()
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
      .call(d3.axisLeft(y).tickFormat(d => `$${d.toFixed(0)}`))
      .style('color', '#666');

    svg.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(y)
        .tickSize(-width)
        .tickFormat('')
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
    let tooltip = d3.select(`#${tooltipId}`);
    
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
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event);
        const xDate = x.invert(mouseX);
        
        const bisect = d3.bisector(d => d.date).left;
        const index = bisect(data, xDate);
        
        if (index > 0 && index < data.length) {
          const d0 = data[index - 1];
          const d1 = data[index];
          const d = xDate - d0.date > d1.date - xDate ? d1 : d0;
          
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

  const handleSelectStockFromAnalysis = (symbol) => {
    if (!selectedSymbols.includes(symbol)) {
      setSelectedSymbols(prev => [...prev, symbol]);
      setChartTimeRanges(prev => ({ ...prev, [symbol]: '1Y' }));
    }
    // Scroll to charts section
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', color: '#1f2937', textAlign: 'center' }}>
          Stock Tracker - {selectedSymbols.length} stocks selected
        </h1>

        {/* Stock Selector */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              Select Stocks ({allStocks.length} available)
            </h2>
            <div>
              <button 
                onClick={() => setSelectedSymbols(allStocks.slice(0, 10).map(s => s.symbol))}
                style={{ padding: '0.5rem 1rem', marginRight: '0.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
              >
                Top 10
              </button>
              <button 
                onClick={() => setSelectedSymbols([])}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
              >
                Clear All
              </button>
            </div>
          </div>
          
          {loadingList ? (
            <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading stocks...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
              {allStocks.map(stock => (
                <label 
                  key={stock.symbol} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '0.5rem', 
                    cursor: 'pointer', 
                    backgroundColor: selectedSymbols.includes(stock.symbol) ? '#eff6ff' : 'transparent', 
                    borderRadius: '0.25rem',
                    border: selectedSymbols.includes(stock.symbol) ? '2px solid #2563eb' : '1px solid #e5e7eb'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(stock.symbol)}
                    onChange={() => toggleStock(stock.symbol)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '600', color: '#1f2937' }}>{stock.symbol}</span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
                      {stock.name.substring(0, 35)}{stock.name.length > 35 ? '...' : ''}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        
        {loading && (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#1e40af', textAlign: 'center' }}>
              Loading stock data for {selectedSymbols.length} stocks...
            </p>
          </div>
        )}
        
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            <strong>Errors:</strong>
            <pre style={{ marginTop: '0.5rem', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{error}</pre>
          </div>
        )}

        <PerformanceAnalysis onSelectStock={handleSelectStockFromAnalysis} />

        
        {selectedSymbols.length === 0 && !loading && (
          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: '#92400e' }}>
              Please select at least one stock to view charts
            </p>
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          {selectedSymbols.map(symbol => (
            <div key={symbol} style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
              {/* Time Range Selector for this chart */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                {timeRanges.map(range => (
                  <button
                    key={range.label}
                    onClick={() => setTimeRangeForChart(symbol, range.label)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      backgroundColor: chartTimeRanges[symbol] === range.label ? '#2563eb' : 'white',
                      color: chartTimeRanges[symbol] === range.label ? 'white' : '#1f2937',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: chartTimeRanges[symbol] === range.label ? '600' : '400',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              
              <svg 
                ref={el => svgRefs.current[symbol] = el}
                style={{ width: '100%', height: '500px' }}
              ></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;