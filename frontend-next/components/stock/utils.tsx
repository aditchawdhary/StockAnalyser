  
  
// Format large numbers (market cap, revenue, etc.)
export const formatLargeNumber = (value: string | undefined) => {
  if (!value || value === 'None') return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';

  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toFixed(2)}`;
};

export const formatPercentage = (value: string | undefined) => {
    if (!value || value === 'None') return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return `${(num * 100).toFixed(2)}%`;
  };
