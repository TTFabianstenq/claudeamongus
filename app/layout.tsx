import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HOLLOWMOOR — a survival horror story',
  description:
    'Escape Hollowmoor House. A first-person browser survival-horror game with an adaptive stalking AI, a storm-locked estate, randomised puzzles and three endings. Original, asset-free, runs entirely in your browser.',
  applicationName: 'Hollowmoor',
  keywords: ['horror game', 'survival horror', 'browser game', 'three.js', 'react three fiber'],
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#05060a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
