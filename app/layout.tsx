import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'FocusCurve',
  description: '복용 기록과 예상 약물·카페인 수준',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'FocusCurve', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0d12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main>{children}</main>
        <Nav />
      </body>
    </html>
  );
}
