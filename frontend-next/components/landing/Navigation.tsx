'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import Button from '../shared/Button';

const Navigation = () => {
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-300 px-4 sm:px-6 lg:px-8 pt-4">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 rounded-full transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-lg' : 'bg-white/70 backdrop-blur-sm shadow-md'
      }`}>
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-green rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">V</span>
            </div>
            <span className="text-xl md:text-2xl font-bold text-gray-900">Vector Tracker</span>
          </Link>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            {status === 'authenticated' ? (
              <>
                <span className="text-gray-700 font-medium">
                  Hello, {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'User'}
                </span>
                <Link href="/dashboard">
                  <Button variant="primary">Dashboard</Button>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-gray-700 hover:text-gray-900 font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <button className="text-gray-700 hover:text-gray-900 font-medium">
                    Sign In
                  </button>
                </Link>
                <Link href="/login">
                  <Button variant="primary">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-900"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 space-y-2">
            {status === 'authenticated' ? (
              <>
                <div className="text-center py-2 text-gray-700 font-medium">
                  Hello, {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'User'}
                </div>
                <Link href="/dashboard" className="block">
                  <Button variant="primary" className="w-full">
                    Dashboard
                  </Button>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full text-center py-2 text-gray-700 hover:text-gray-900 font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="block">
                  <button className="w-full text-center py-2 text-gray-700 hover:text-gray-900 font-medium border border-gray-300 rounded-lg">
                    Sign In
                  </button>
                </Link>
                <Link href="/login" className="block">
                  <Button variant="primary" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
