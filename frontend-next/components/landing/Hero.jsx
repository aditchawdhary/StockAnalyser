'use client';

import React from 'react';
import Link from 'next/link';
import Button from '../shared/Button';

const Hero = () => {
  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    featuresSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="h-screen flex items-center pt-20 bg-gradient-to-b from-orange-400 via-orange-600 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Invest Smarter with{' '}
              <span className="text-green-400">
                Real-Time Insights
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-100 mb-8 max-w-2xl mx-auto lg:mx-0">
              Track performance, analyze trends, and discover top-performing stocks with our
              powerful analytics platform. Make informed investment decisions with real-time data.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/dashboard">
                <Button variant="primary" className="w-full sm:w-auto">
                  Start Tracking Free
                </Button>
              </Link>
              <Button variant="secondary" onClick={scrollToFeatures} className="w-full sm:w-auto">
                Explore Features
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex flex-wrap gap-8 justify-center lg:justify-start text-sm text-gray-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-rh-teal-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Real-time data</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-rh-teal-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>5 years of history</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-rh-teal-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Free to use</span>
              </div>
            </div>
          </div>

          {/* Right Visual */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Chart Mockup */}
              <div className="bg-white rounded-2xl shadow-rh-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Market Overview</h3>
                  <span className="text-sm text-rh-teal-500 font-semibold">+12.5%</span>
                </div>

                {/* Simple Chart Visualization */}
                <div className="h-64 flex items-end justify-between gap-2">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 95, 75, 88, 100].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-green rounded-t-lg transition-all hover:opacity-80"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                {/* Vector Ticker */}
                <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">AAPL</p>
                    <p className="font-semibold text-rh-teal-500">+2.4%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">NVDA</p>
                    <p className="font-semibold text-rh-teal-500">+5.2%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">MSFT</p>
                    <p className="font-semibold text-rh-teal-500">+1.8%</p>
                  </div>
                </div>
              </div>

              {/* Floating Card */}
              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-rh p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rh-teal-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Portfolio Growth</p>
                    <p className="text-sm font-bold text-gray-900">+$12,450</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
