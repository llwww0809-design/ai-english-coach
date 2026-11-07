import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GlobalNav } from '@/components/global-nav';
import { ThemeController } from '@/components/theme-controller';
export const metadata: Metadata = {
  title: 'AI English Coach',
  description: '每天一点，更自信地说英语',
  applicationName: 'AI English Coach',
  appleWebApp: { capable: true, title: 'AI Coach', statusBarStyle: 'default' },
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#f9f9f9' };
const themeScript = `(function(){try{var m=localStorage.getItem('theme_mode');document.documentElement.dataset.theme=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: themeScript}} /></head><body><ThemeController />{children}<GlobalNav /></body></html>; }
