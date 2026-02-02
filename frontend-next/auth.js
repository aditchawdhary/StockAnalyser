import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import CredentialsProvider from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (res.ok) {
            const user = await res.json()
            return user
          }
          return null
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account) {
        if (account.provider === 'google' || account.provider === 'microsoft-entra-id') {
          // Exchange OAuth token for Django JWT
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/social/login/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                access_token: account.access_token,
                provider: account.provider === 'microsoft-entra-id' ? 'microsoft' : account.provider,
              }),
            })

            if (res.ok) {
              const data = await res.json()
              token.accessToken = data.access_token
              token.refreshToken = data.refresh_token
            }
          } catch (error) {
            console.error('OAuth exchange error:', error)
          }
        }
      }

      // Handle credentials login
      if (user?.access_token) {
        token.accessToken = user.access_token
        token.refreshToken = user.refresh_token
      }

      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
})
