import React from 'react';

interface InfoPriceChartProps {
  chartTimeRange: string;
  setChartTimeRange: (range: string) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const InfoPriceChart: React.FC<InfoPriceChartProps> = ({setChartTimeRange, chartTimeRange, svgRef}) => {

  return (
  <div className="bg-gray-50 rounded-lg p-4">
    <div className="flex justify-center gap-2 mb-4 flex-wrap">
      {['1D', '1W', '1M', '6M', 'YTD', '1Y', '5Y', 'MAX'].map(range => (
        <button
          key={range}
          onClick={() => setChartTimeRange(range)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            chartTimeRange === range
              ? 'bg-rh-teal-500 text-white'
              : 'bg-white text-gray-900 border border-gray-300 hover:border-gray-400'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
    <svg ref={svgRef} className="w-full" style={{ height: '350px' }}></svg>
  </div>
  );
  
}

export default InfoPriceChart;

