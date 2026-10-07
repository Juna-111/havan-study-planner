import type { Metadata, Viewport } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/base-extra-1.css'
import '../styles/journey.css'
import '../styles/utilities.css'
import '../styles/havan-plan.css'

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-havan-body' })
const displayFont = Fraunces({ subsets: ['latin'], variable: '--font-havan-display' })

export const metadata: Metadata = {
  title: {
    default: 'Havan',
    template: '%s · Havan',
  },
  description: 'Academic planning for Ethiopian university freshman students.',
  applicationName: 'Havan',
  appleWebApp: {
    title: 'Havan',
  },
  openGraph: {
    title: 'Havan',
    description: 'Academic planning for Ethiopian university freshman students.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  )
}
