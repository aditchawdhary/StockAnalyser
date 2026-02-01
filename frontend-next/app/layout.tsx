import './globals.css'
import { Inter } from 'next/font/google'
import { SessionProvider } from './components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Vector Tracker - Invest Smarter with Real-Time Insights',
  description: 'Track performance, analyze trends, and discover top-performing stocks with our powerful stock tracking platform.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
