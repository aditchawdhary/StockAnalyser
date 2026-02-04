'use client';

import { useEffect } from 'react';
import { prefetchPerformance } from '../lib/swr';

export default function Prefetch() {
  useEffect(() => {
    // Start prefetching performance data as soon as landing page loads
    prefetchPerformance();
  }, []);

  return null;
}
