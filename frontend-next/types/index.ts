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

export interface WeeklyTimeSeries {
  [date: string]: {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  };
}

export interface StockPriceData {
  'Weekly Time Series': WeeklyTimeSeries;
}

export interface StockPerformance {
  symbol: string;
  name: string;
  start_price: number;
  end_price: number;
  percent_change: string;
}

export interface PerformanceData {
  top_gainers: StockPerformance[];
  top_losers: StockPerformance[];
}

export interface PerformanceResponse {
  '1M': PerformanceData;
  'YTD': PerformanceData;
  '6M': PerformanceData;
  '1Y': PerformanceData;
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
