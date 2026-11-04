import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'AI English Coach',
  description: '每天一点，更自信地说英语',
  applicationName: 'AI English Coach',
  appleWebApp: { capable: true, title: 'AI Coach', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#f5f6f1' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="zh-CN"><body>{children}</body></html>; }
