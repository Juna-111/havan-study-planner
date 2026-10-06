import type { Metadata, Viewport } from 'next'
import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/utilities.css'

export const metadata: Metadata = {
  title: 'Havan',
  description: 'Academic planning for Ethiopian university freshman students.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
