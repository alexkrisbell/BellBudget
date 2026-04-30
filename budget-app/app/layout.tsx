import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Bell Bucks',
  description: 'Household budgeting dashboard',
  // app/manifest.ts is auto-detected by Next.js — do not also set manifest here
  // or Chrome gets two <link rel="manifest"> tags and may ignore both.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bell Bucks',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-slate-50 antialiased">
        <ServiceWorkerRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
