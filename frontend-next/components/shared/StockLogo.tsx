'use client';

import React, { useState } from 'react';

interface StockLogoProps {
  symbol: string;
  size?: number;
  className?: string;
}

const StockLogo: React.FC<StockLogoProps> = ({ symbol, size = 24, className = '' }) => {
  const [hasError, setHasError] = useState(false);

  const logoUrl = `https://assets.parqet.com/logos/symbol/${symbol}`;

  if (hasError) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold flex-shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {symbol.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={`rounded-full object-contain flex-shrink-0 ${className}`}
      onError={() => setHasError(true)}
    />
  );
};

export default StockLogo;
