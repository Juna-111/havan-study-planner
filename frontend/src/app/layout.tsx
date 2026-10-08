import type { Metadata, Viewport } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import '../styles/havan.css'

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
    images: ['/brand/havan-logo.jpg'],
  },
  icons: {
    icon: '/icon.svg',
    apple: '/brand/havan-logo.jpg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: 'rgb(1 1 126)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  )
}
