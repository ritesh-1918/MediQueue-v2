import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Topbar } from '@/components/layout/Topbar'
import './globals.css'

// ── Fonts ─────────────────────────────────────────────────────────────────────
// next/font automatically self-hosts — no external requests at runtime.
// Variables are injected into <html> and consumed in globals.css via
// var(--font-inter) / var(--font-jetbrains-mono).

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
})

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default:  'MediQueue — Clinic Queue System',
    template: '%s | MediQueue',
  },
  description:
    'Smart clinic queue management with AI symptom triage, real-time token tracking, and doctor dashboards.',
  keywords: ['clinic', 'queue', 'token', 'hospital', 'doctor', 'patient', 'triage'],
  authors: [{ name: 'Gratian Technologies' }],
  robots: 'noindex, nofollow',   // private clinic tool — no public indexing
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-mq-bg text-mq-text-1 antialiased">
        {/*
          Topbar is rendered here without tab navigation props so it shows
          only the logo + clock. Role-specific navbars (PatientNav, DoctorNav,
          AdminNav) within their route groups will replace or extend this
          with their own navigation once auth is wired up.
        */}
        <Topbar />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  )
}
