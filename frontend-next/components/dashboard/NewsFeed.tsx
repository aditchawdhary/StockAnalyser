'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { NewsArticle } from '../../types';
import { fetcher } from '../../lib/swr';
import StockLogo from '../shared/StockLogo';

const BACKEND_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

interface NewsFeedProps {
  symbols: string[];
  onSelectStock: (symbol: string) => void;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ symbols, onSelectStock }) => {
  const [expanded, setExpanded] = useState(false);

  // Fetch news for the first few watched symbols
  const newsSymbols = symbols.slice(0, 3).join(',');
  const { data: newsData } = useSWR<{ feed: NewsArticle[] }>(
    newsSymbols ? `${BACKEND_URL}/stock/${symbols[0]}/news/?limit=20` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const articles = newsData?.feed || [];
  const displayArticles = expanded ? articles : articles.slice(0, 5);

  const formatTimeAgo = (dateStr: string) => {
    // Format: 20240115T120000
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const hour = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    const date = new Date(`${year}-${month}-${day}T${hour}:${min}:00`);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'Bullish':
      case 'Somewhat-Bullish':
        return 'text-green-600';
      case 'Bearish':
      case 'Somewhat-Bearish':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  if (!newsData) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">News</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-20 h-16 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">News</h3>
        <p className="text-sm text-gray-500">No recent news available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">News</h3>

      <div className="space-y-1">
        {displayArticles.map((article, idx) => (
          <a
            key={idx}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            {article.banner_image && (
              <img
                src={article.banner_image}
                alt=""
                className="w-20 h-16 object-cover rounded-lg shrink-0 bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1">
                {article.source} · {formatTimeAgo(article.time_published)}
                <span className={`ml-2 ${getSentimentColor(article.overall_sentiment_label)}`}>
                  {article.overall_sentiment_label}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-gray-700">
                {article.title}
              </div>
              {article.ticker_sentiment && article.ticker_sentiment.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {article.ticker_sentiment.slice(0, 4).map((ts, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectStock(ts.ticker);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition-colors"
                    >
                      <StockLogo symbol={ts.ticker} size={14} />
                      {ts.ticker}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>

      {articles.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${articles.length - 5} more articles`}
        </button>
      )}
    </div>
  );
};

export default NewsFeed;
