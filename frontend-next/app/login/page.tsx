'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function Login() {
  const [loading, setLoading] = useState<boolean>(false)

  const handleOAuthLogin = async (provider: string) => {
    setLoading(true)
    await signIn(provider, {
      callbackUrl: '/dashboard',
    })
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Left Side - Sign In Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mb-4">
              <span className="text-white text-2xl font-bold">V</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Welcome to Vector Analysis</h1>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium text-gray-700">Continue with Google</span>
            </button>

            <button
              onClick={() => handleOAuthLogin('azure-ad')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              <span className="font-medium text-gray-700">Continue with Microsoft</span>
            </button>
          </div>

          <div className="flex justify-center my-8">
            <div className="w-16 border-t border-gray-300"></div>
          </div>

          <p className="text-center text-sm text-gray-500">
            By signing in, you agree to our <span className="underline cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>

      {/* Right Side - Benefits */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-12 bg-gradient-to-br from-orange-400 via-orange-300 to-blue-400">
        <div className="max-w-lg">
          <h2 className="text-4xl font-bold text-gray-900 mb-10">
            Track Smarter, Invest Better
          </h2>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-gray-800 text-lg">
                Real-time stock tracking with instant price updates and market insights.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-gray-800 text-lg">
                Portfolio analytics with performance metrics and gain/loss tracking.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-gray-800 text-lg">
                Beautiful charts and visualizations to understand your investments.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-gray-800 text-lg">
                Free to use with no credit card required to get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
