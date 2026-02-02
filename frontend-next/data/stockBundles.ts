export interface StockBundle {
  id: string;
  name: string;
  description: string;
  icon: string;
  stocks: string[];
}

export interface BundleCategory {
  id: string;
  name: string;
  bundles: StockBundle[];
}

export const stockBundles: BundleCategory[] = [
  {
    id: 'sector',
    name: 'By Sector',
    bundles: [
      {
        id: 'tech-giants',
        name: 'Tech Giants',
        description: 'Leading technology companies',
        icon: '💻',
        stocks: ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA']
      },
      {
        id: 'healthcare',
        name: 'Healthcare & Pharma',
        description: 'Healthcare and pharmaceutical leaders',
        icon: '🏥',
        stocks: ['JNJ', 'PFE', 'UNH', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT']
      },
      {
        id: 'financials',
        name: 'Financials',
        description: 'Banks and financial services',
        icon: '🏦',
        stocks: ['JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP', 'BLK']
      },
      {
        id: 'energy',
        name: 'Energy',
        description: 'Oil, gas, and energy companies',
        icon: '⛽',
        stocks: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PXD', 'OXY']
      },
      {
        id: 'consumer-staples',
        name: 'Consumer Staples',
        description: 'Essential consumer goods',
        icon: '🛒',
        stocks: ['PG', 'KO', 'PEP', 'WMT', 'COST', 'CL', 'MDLZ']
      },
      {
        id: 'consumer-discretionary',
        name: 'Consumer Discretionary',
        description: 'Non-essential consumer goods',
        icon: '🛍️',
        stocks: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW']
      },
      {
        id: 'industrials',
        name: 'Industrials',
        description: 'Industrial and manufacturing',
        icon: '🏭',
        stocks: ['CAT', 'DE', 'UPS', 'HON', 'BA', 'GE', 'LMT', 'RTX']
      },
      {
        id: 'real-estate',
        name: 'Real Estate',
        description: 'REITs and real estate companies',
        icon: '🏢',
        stocks: ['AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'O', 'WELL']
      }
    ]
  },
  {
    id: 'theme',
    name: 'By Theme',
    bundles: [
      {
        id: 'ai-ml',
        name: 'AI & Machine Learning',
        description: 'Artificial intelligence leaders',
        icon: '🤖',
        stocks: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMD', 'PLTR', 'AI', 'PATH']
      },
      {
        id: 'ev',
        name: 'Electric Vehicles',
        description: 'EV manufacturers and suppliers',
        icon: '🚗',
        stocks: ['TSLA', 'RIVN', 'LCID', 'F', 'GM', 'NIO', 'LI', 'XPEV']
      },
      {
        id: 'semiconductor',
        name: 'Semiconductors',
        description: 'Chip makers and equipment',
        icon: '🔌',
        stocks: ['NVDA', 'AMD', 'INTC', 'TSM', 'AVGO', 'QCOM', 'MU', 'ASML']
      },
      {
        id: 'cloud',
        name: 'Cloud Computing',
        description: 'Cloud infrastructure and services',
        icon: '☁️',
        stocks: ['AMZN', 'MSFT', 'GOOGL', 'CRM', 'SNOW', 'NET', 'DDOG', 'MDB']
      },
      {
        id: 'cybersecurity',
        name: 'Cybersecurity',
        description: 'Security software and services',
        icon: '🔒',
        stocks: ['CRWD', 'PANW', 'ZS', 'FTNT', 'OKTA', 'S', 'CYBR']
      },
      {
        id: 'fintech',
        name: 'Fintech',
        description: 'Financial technology disruptors',
        icon: '💳',
        stocks: ['SQ', 'PYPL', 'COIN', 'AFRM', 'SOFI', 'HOOD', 'NU']
      },
      {
        id: 'clean-energy',
        name: 'Clean Energy',
        description: 'Renewable and clean energy',
        icon: '🌱',
        stocks: ['ENPH', 'SEDG', 'FSLR', 'RUN', 'PLUG', 'NEE', 'BEP']
      },
      {
        id: 'streaming',
        name: 'Streaming & Entertainment',
        description: 'Media and entertainment',
        icon: '🎬',
        stocks: ['NFLX', 'DIS', 'WBD', 'PARA', 'SPOT', 'ROKU']
      },
      {
        id: 'gaming',
        name: 'Gaming',
        description: 'Video game companies',
        icon: '🎮',
        stocks: ['NVDA', 'AMD', 'MSFT', 'SONY', 'EA', 'TTWO', 'RBLX', 'U']
      },
      {
        id: 'space',
        name: 'Space & Aerospace',
        description: 'Space exploration and defense',
        icon: '🚀',
        stocks: ['BA', 'LMT', 'RTX', 'NOC', 'GD', 'RKLB', 'SPCE']
      }
    ]
  },
  {
    id: 'index',
    name: 'By Index',
    bundles: [
      {
        id: 'magnificent-7',
        name: 'Magnificent 7',
        description: 'The mega-cap tech leaders',
        icon: '⭐',
        stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']
      },
      {
        id: 'faang',
        name: 'FAANG+',
        description: 'Original tech giants plus',
        icon: '🔥',
        stocks: ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL', 'MSFT', 'NVDA']
      },
      {
        id: 'dow-30',
        name: 'Dow Jones 30',
        description: 'Dow Jones Industrial Average',
        icon: '📊',
        stocks: ['AAPL', 'MSFT', 'UNH', 'GS', 'HD', 'CAT', 'AMGN', 'V', 'BA', 'HON', 'CRM', 'MCD', 'JPM', 'IBM', 'AXP', 'TRV', 'JNJ', 'WMT', 'DIS', 'NKE', 'MRK', 'PG', 'CVX', 'KO', 'CSCO', 'VZ', 'INTC', 'WBA', 'DOW', 'MMM']
      },
      {
        id: 'sp500-top10',
        name: 'S&P 500 Top 10',
        description: 'Largest S&P 500 companies by market cap',
        icon: '🏆',
        stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'JNJ']
      },
      {
        id: 'nasdaq-100',
        name: 'NASDAQ Top 10',
        description: 'Top NASDAQ-100 companies',
        icon: '📈',
        stocks: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA', 'AVGO', 'COST']
      }
    ]
  },
  {
    id: 'strategy',
    name: 'By Strategy',
    bundles: [
      {
        id: 'dividend-kings',
        name: 'Dividend Kings',
        description: '50+ years of dividend increases',
        icon: '👑',
        stocks: ['KO', 'JNJ', 'PG', 'MMM', 'EMR', 'LOW', 'CL', 'DOV', 'ITW', 'PH']
      },
      {
        id: 'dividend-aristocrats',
        name: 'Dividend Aristocrats',
        description: '25+ years of dividend increases',
        icon: '💰',
        stocks: ['ABBV', 'T', 'XOM', 'CVX', 'IBM', 'O', 'MO', 'VZ', 'KMB', 'PEP']
      },
      {
        id: 'high-growth',
        name: 'High Growth',
        description: 'Fast-growing companies',
        icon: '📈',
        stocks: ['NVDA', 'TSLA', 'AMD', 'CRWD', 'SNOW', 'NET', 'DDOG', 'ZS', 'PLTR']
      },
      {
        id: 'value-picks',
        name: 'Value Picks',
        description: 'Undervalued quality companies',
        icon: '💎',
        stocks: ['BRK.B', 'JPM', 'BAC', 'WFC', 'INTC', 'VZ', 'T', 'PARA', 'WBD']
      },
      {
        id: 'blue-chips',
        name: 'Blue Chips',
        description: 'Established, stable companies',
        icon: '🔵',
        stocks: ['AAPL', 'MSFT', 'JNJ', 'PG', 'KO', 'WMT', 'JPM', 'V', 'UNH', 'HD']
      },
      {
        id: 'small-cap-growth',
        name: 'Small Cap Growth',
        description: 'High-potential small caps',
        icon: '🌱',
        stocks: ['UPST', 'AFRM', 'RKLB', 'IONQ', 'SOFI', 'HOOD', 'DNA', 'OPEN']
      }
    ]
  },
  {
    id: 'geography',
    name: 'By Geography',
    bundles: [
      {
        id: 'china-tech',
        name: 'China Tech',
        description: 'Chinese technology giants',
        icon: '🇨🇳',
        stocks: ['BABA', 'JD', 'PDD', 'BIDU', 'NIO', 'LI', 'XPEV', 'NTES']
      },
      {
        id: 'europe',
        name: 'European Leaders',
        description: 'Top European companies (ADRs)',
        icon: '🇪🇺',
        stocks: ['ASML', 'NVO', 'SAP', 'TM', 'SHEL', 'UL', 'AZN', 'NVS']
      },
      {
        id: 'japan',
        name: 'Japan',
        description: 'Japanese market leaders (ADRs)',
        icon: '🇯🇵',
        stocks: ['TM', 'SONY', 'MUFG', 'HMC', 'NMR', 'SMFG', 'MFG']
      }
    ]
  }
];

// Flatten all bundles for easy searching
export const getAllBundles = (): StockBundle[] => {
  return stockBundles.flatMap(category => category.bundles);
};

// Get a specific bundle by ID
export const getBundleById = (id: string): StockBundle | undefined => {
  return getAllBundles().find(bundle => bundle.id === id);
};

// Get all unique stocks from all bundles
export const getAllStocksFromBundles = (): string[] => {
  const allStocks = new Set<string>();
  getAllBundles().forEach(bundle => {
    bundle.stocks.forEach(stock => allStocks.add(stock));
  });
  return Array.from(allStocks);
};
