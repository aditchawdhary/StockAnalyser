'use client';

import { useEffect } from 'react';
import { prefetchAll } from '../lib/swr';

export default function Prefetch() {
  useEffect(() => {
    // Start prefetching all dashboard data as soon as landing page loads
    prefetchAll();
  }, []);

  return null;
}
