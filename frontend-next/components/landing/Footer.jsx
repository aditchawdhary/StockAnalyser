import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-rh-teal-500 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Logo and Tagline */}
          <div className="mb-6 md:mb-0">
            <div className="flex items-center space-x-2 justify-center md:justify-start mb-2">
              <div className="w-8 h-8 bg-gradient-green rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <span className="text-xl font-bold">Vector Tracker</span>
            </div>
            <p className="text-white/80 text-sm text-center md:text-left">
              Built for investors, by investors
            </p>
          </div>

          {/* Copyright */}
          <div className="text-white/80 text-sm text-center md:text-right">
            <p>&copy; {new Date().getFullYear()} Vector Tracker. All rights reserved.</p>
            <p className="mt-1">Powered by real-time market data</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-8 border-t border-white/20 text-center text-xs text-white/70">
          <p>
            Disclaimer: This platform is for informational purposes only and does not constitute
            financial advice. Always do your own research and consult with a financial advisor
            before making investment decisions.
          </p>
        </div>

      </div>

      {/* Large SVG Text - At the very bottom */}
      <div className="w-full overflow-hidden -mb-2 py-8">
        <svg viewBox="0 0 1400 200" className="w-full" preserveAspectRatio="xMidYMid meet">
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="white"
            fontSize="160"
            fontWeight="900"
            fontFamily="Inter, system-ui, sans-serif"
            opacity="1"
            letterSpacing="-0.02em"
          >
            Vector Tracker
          </text>
        </svg>
      </div>
    </footer>
  );
};

export default Footer;
