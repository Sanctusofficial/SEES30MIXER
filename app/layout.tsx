import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "SEES '30 MIXER",
  description: "Reserve your spot at the SEES '30 Mixer — 29th August, 12PM.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

