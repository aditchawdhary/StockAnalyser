// Stock data types
export interface Stock {
  symbol: string;
  name: string;
  industry: string;
  sector: string;
  is_sp500: boolean;
  last_updated: string;
}

export interface StockPrice {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeSeries {
  [date: string]: {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  };
}

export interface WeeklyTimeSeries extends TimeSeries {}

export interface StockPriceData {
  'Weekly Time Series'?: WeeklyTimeSeries;
  'Time Series (Daily)'?: TimeSeries;
  'Time Series (1min)'?: TimeSeries;
  'Time Series (5min)'?: TimeSeries;
  'Time Series (15min)'?: TimeSeries;
  'Time Series (30min)'?: TimeSeries;
  'Time Series (60min)'?: TimeSeries;
  'Meta Data'?: {
    '1. Information'?: string;
    '2. Symbol'?: string;
    '3. Last Refreshed'?: string;
    '4. Interval'?: string;
    '5. Output Size'?: string;
    '6. Time Zone'?: string;
  };
  [key: string]: any; // Allow dynamic access for time series keys
}

export interface StockPerformance {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  start_price: number;
  end_price: number;
  percent_change: number;
  price_change: number;
  start_date: string;
  end_date: string;
}

export interface PerformanceData {
  top_gainers: StockPerformance[];
  top_losers: StockPerformance[];
}

export interface PerformanceFilters {
  available_sectors: string[];
  available_industries: string[];
  applied: {
    sector: string | null;
    industry: string | null;
  };
}

export interface PerformanceResponse {
  '1D': PerformanceData;
  '1W': PerformanceData;
  '1M': PerformanceData;
  'YTD': PerformanceData;
  '6M': PerformanceData;
  '1Y': PerformanceData;
  '5Y': PerformanceData;
  filters: PerformanceFilters;
}

// Component prop types
export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  href?: string;
  className?: string;
  icon?: React.ReactNode;
  [key: string]: any;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export interface PerformanceAnalysisProps {
  onSelectStock: (symbol: string) => void;
}

// Form types
export interface LoginCredentials {
  email: string;
  password: string;
}

// API response types
export interface StocksListResponse {
  stocks: Stock[];
}

export interface MultipleStocksResponse {
  data: Record<string, StockPriceData>;
  errors?: string[];
}

// Time range types
export interface TimeRange {
  label: string;
  weeks: number | 'ytd' | 'max';
}

// NextAuth extended types
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
  }

  interface User {
    access_token?: string;
    refresh_token?: string;
    email?: string | null;
    name?: string | null;
  }
}

// Stock Overview Types
export interface StockOverview {
  Symbol: string;
  AssetType: string;
  Name: string;
  Description: string;
  Exchange: string;
  Currency: string;
  Country: string;
  Sector: string;
  Industry: string;
  Address: string;
  FiscalYearEnd: string;
  MarketCapitalization: string;
  EBITDA: string;
  PERatio: string;
  PEGRatio: string;
  BookValue: string;
  DividendPerShare: string;
  DividendYield: string;
  EPS: string;
  RevenuePerShareTTM: string;
  ProfitMargin: string;
  OperatingMarginTTM: string;
  ReturnOnAssetsTTM: string;
  ReturnOnEquityTTM: string;
  RevenueTTM: string;
  GrossProfitTTM: string;
  QuarterlyEarningsGrowthYOY: string;
  QuarterlyRevenueGrowthYOY: string;
  AnalystTargetPrice: string;
  TrailingPE: string;
  ForwardPE: string;
  PriceToSalesRatioTTM: string;
  PriceToBookRatio: string;
  Beta: string;
  '52WeekHigh': string;
  '52WeekLow': string;
  '50DayMovingAverage': string;
  '200DayMovingAverage': string;
  SharesOutstanding: string;
  SharesFloat: string;
  PercentInsiders: string;
  PercentInstitutions: string;
}

export interface StockOverviewResponse {
  symbol: string;
  name: string;
  overview: StockOverview;
  cached: boolean;
}

// News Sentiment Types
export interface NewsArticle {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  banner_image?: string;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Array<{
    topic: string;
    relevance_score: string;
  }>;
  overall_sentiment_score: number;
  overall_sentiment_label: 'Bearish' | 'Somewhat-Bearish' | 'Neutral' | 'Somewhat-Bullish' | 'Bullish';
  ticker_sentiment: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
    ticker_sentiment_label: string;
  }>;
}

export interface NewsSentimentResponse {
  items: string;
  sentiment_score_definition: string;
  relevance_score_definition: string;
  feed: NewsArticle[];
}

// Component Props
export interface StockInfoModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  onAddToCharts: (symbol: string) => void;
  availableStocks?: Stock[];
}
