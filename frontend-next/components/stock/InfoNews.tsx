import React, {useState} from "react";
import { NewsSentimentResponse } from '../../types';

interface InfoNewsProps {
  news: NewsSentimentResponse | null
}

const InfoNews: React.FC<InfoNewsProps> = ({news}) => {

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
  
  return (
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
)};

export default InfoNews;