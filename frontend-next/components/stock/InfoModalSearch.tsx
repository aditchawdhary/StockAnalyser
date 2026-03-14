'use client';

import React, {useState, useEffect} from 'react';
import {Stock, SearchResult} from '../../types/index';
import StockLogo from '../shared/StockLogo';

interface InfoModalSearchProps {
  availableStocks?: Stock[];
  symbol: string;
  setCurrentSymbol: (symbol: string) => void;
}

const InfoModalSearch: React.FC<InfoModalSearchProps> = ({ symbol, availableStocks = [], setCurrentSymbol}) => {
  const [searching, setSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [searchHistory, setSearchHistory] = useState<Array<{ symbol: string; name: string; timestamp: number }>>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;
  const HISTORY_STORAGE_KEY = 'stock_search_history';

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to parse search history: ', error);
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
        // Use backend proxy to avoid exposing API key
        const response = await fetch(
          `${BACKEND_URL}/search/?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();

        if (data.bestMatches) {
          // Filter to only show stocks that exist in our database
          const dbSymbols = new Set(availableStocks.map(s => s.symbol));
          const filteredResults = availableStocks.length > 0
            ? data.bestMatches.filter((match: SearchResult) => dbSymbols.has(match['1. symbol']))
            : data.bestMatches;
          setSearchResults(filteredResults);
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
  }, [searchQuery, BACKEND_URL]);
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Use backend proxy to avoid exposing API key
      const response = await fetch(
        `${BACKEND_URL}/search/?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      if (data.bestMatches) {
        // Filter to only show stocks that exist in our database
        const dbSymbols = new Set(availableStocks.map(s => s.symbol));
        const filteredResults = availableStocks.length > 0
          ? data.bestMatches.filter((match: SearchResult) => dbSymbols.has(match['1. symbol']))
          : data.bestMatches;
        setSearchResults(filteredResults);
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

  const addToHistory = (stockSymbol: string, stockName: string) => {
    const newHistoryItem = {
      symbol: stockSymbol,
      name: stockName,
      timestamp: Date.now()
    }

    // Remove duplicate if it exists and add to the beginning
    const updateHistory = [
      newHistoryItem,
      ...searchHistory.filter(item => item.symbol !== stockSymbol)
    ].slice(0, 10); // Keep only last 10 items

    setSearchHistory(updateHistory);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updateHistory));
  };


  return (
    // Search Bar 
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
              <div className="flex items-center gap-3">
                <StockLogo symbol={result['1. symbol']} size={32} />
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
              <StockLogo symbol={item.symbol} size={28} />
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

  );
};

export default InfoModalSearch;