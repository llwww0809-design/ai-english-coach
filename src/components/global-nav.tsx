'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './global-nav.module.css';
const tabs = [
  { href: '/teacher', label: '对话', icon: '✦' },
  { href: '/vocab', label: '词库', icon: '▤' },
  { href: '/profile', label: '我的', icon: '◎' },
];
export function GlobalNav() {
  const pathname = usePathname();
  return <nav className={styles.nav} aria-label="主导航">{tabs.map(tab => <Link key={tab.href} href={tab.href} className={pathname === tab.href || (tab.href === '/profile' && ['/records','/words'].includes(pathname)) ? styles.active : ''} aria-current={pathname === tab.href ? 'page' : undefined}><span aria-hidden="true">{tab.icon}</span><small>{tab.label}</small></Link>)}</nav>;
}
