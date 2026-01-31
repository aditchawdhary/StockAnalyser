'use client'
import { SessionProvider as NextAuthProvider } from 'next-auth/react'

export function SessionProvider({ children }) {
  return <NextAuthProvider>{children}</NextAuthProvider>
}
