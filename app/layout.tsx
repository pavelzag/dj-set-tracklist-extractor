import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DJ Set Tracklist Extractor',
  description: 'Identify tracks in DJ mixes from audio files or YouTube links',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
