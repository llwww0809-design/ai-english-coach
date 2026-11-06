'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './global-nav.module.css';
const tabs = [
  { href: '/', label: '对话', icon: 'chat' },
  { href: '/vocab', label: '词库', icon: 'book' },
  { href: '/listen', label: '听读', icon: 'headphones' },
  { href: '/profile', label: '设置', icon: 'settings' },
];
export function GlobalNav() {
  const pathname = usePathname();
  return <nav className={styles.nav} aria-label="主导航">{tabs.map(tab => {
    const active = pathname === tab.href || (tab.href === '/' && pathname === '/teacher') || (tab.href === '/profile' && ['/records','/words'].includes(pathname));
    const icon = tab.icon === 'headphones' ? <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14v-3a9 9 0 0118 0v3"/><rect x="3" y="12" width="4" height="9" rx="2"/><rect x="17" y="12" width="4" height="9" rx="2"/></svg> : tab.icon === 'settings' ? <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V20h-2.6v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H5v-2.6h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1L8 6.6l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V5h2.6v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.1v2.6h-.1a1.7 1.7 0 00-1.5 1z"/></svg> : tab.icon === 'book' ? <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5z"/><path d="M4 5.5v13A2.5 2.5 0 016.5 21H20"/></svg> : <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h10M4 18h16"/><path d="M18 10v8m-3-3h6"/></svg>;
    return <Link key={tab.href} href={tab.href} className={active ? styles.active : ''} aria-current={active ? 'page' : undefined}><span aria-hidden="true">{icon}</span><small>{tab.label}</small></Link>;
  })}</nav>;
}
