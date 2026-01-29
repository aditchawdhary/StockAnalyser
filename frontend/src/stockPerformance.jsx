import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';


const PerformanceAnalysis = ({ onSelectStock }) => {
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  
  const BACKEND_URL = 'http://127.0.0.1:8000/api';
  
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
  
  if (loading) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '2rem' }}>
        <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading performance data...</p>
      </div>
    );
  }
  
  if (!performance) return null;
  
  const currentData = performance[selectedPeriod];
  
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        📊 Performance Analysis
      </h2>
      
      {/* Period Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        {['1M', 'YTD', '6M', '1Y'].map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: selectedPeriod === period ? '#2563eb' : 'white',
              color: selectedPeriod === period ? 'white' : '#1f2937',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: selectedPeriod === period ? '600' : '400',
              fontSize: '0.875rem'
            }}
          >
            {period}
          </button>
        ))}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Top Gainers */}
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#16a34a', display: 'flex', alignItems: 'center' }}>
            🚀 Top 10 Gainers
          </h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {currentData.top_gainers.map((stock, index) => (
              <div 
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                style={{ 
                  padding: '0.75rem', 
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: '#6b7280', fontSize: '0.875rem' }}>#{index + 1}</span>
                      <span style={{ fontWeight: '600', color: '#1f2937' }}>{stock.symbol}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {stock.name.substring(0, 40)}{stock.name.length > 40 ? '...' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '1rem' }}>
                      +{stock.percent_change}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      ${stock.start_price.toFixed(2)} → ${stock.end_price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Losers */}
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
            📉 Top 10 Losers
          </h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {currentData.top_losers.map((stock, index) => (
              <div 
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                style={{ 
                  padding: '0.75rem', 
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: '#6b7280', fontSize: '0.875rem' }}>#{index + 1}</span>
                      <span style={{ fontWeight: '600', color: '#1f2937' }}>{stock.symbol}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {stock.name.substring(0, 40)}{stock.name.length > 40 ? '...' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '1rem' }}>
                      {stock.percent_change}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      ${stock.start_price.toFixed(2)} → ${stock.end_price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalysis;