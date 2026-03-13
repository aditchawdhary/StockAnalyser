'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import PerformanceAnalysis from '../../components/dashboard/PerformanceAnalysis';
import WatchlistSidebar from '../../components/dashboard/WatchlistSidebar';
import TopMovers from '../../components/dashboard/TopMovers';
import NewsFeed from '../../components/dashboard/NewsFeed';
import StockInfoModal from '../../components/stock/StockInfoModal';
import StockLogo from '../../components/shared/StockLogo';
import { Stock } from '../../types';
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [infoModalSymbol, setInfoModalSymbol] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<Array<{ symbol: string; name: string; timestamp: number }>>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;
  const HISTORY_STORAGE_KEY = 'stock_search_history';

  // Fetch stock list with SWR (benefits from prefetch cache)
  const { data: stockListData } = useSWR<{ stocks: Stock[] }>(
    SWR_KEYS.stockList,
    fetcher,
    { revalidateOnFocus: false }
  );
  const allStocks = stockListData?.stocks || [];

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

  const toggleStock = (symbol: string) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
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

  const handleSelectStock = (symbol: string) => {
    setInfoModalSymbol(symbol);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
              <TopMovers onSelectStock={handleSelectStock} />
            </div>

            {/* News Feed */}
            {selectedSymbols.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
                <NewsFeed symbols={selectedSymbols} onSelectStock={handleSelectStock} />
              </div>
            )}

            {/* Performance Analysis */}
            <div className="mb-8">
              <PerformanceAnalysis onSelectStock={handleSelectStock} />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Watchlist */}
        <div className="hidden lg:block">
          <WatchlistSidebar
            symbols={selectedSymbols}
            onSelectStock={handleSelectStock}
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
