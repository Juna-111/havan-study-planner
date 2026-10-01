import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Havan Study Planner', description: 'Academic planning for Ethiopian university freshman students.' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
