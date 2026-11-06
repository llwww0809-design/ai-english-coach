'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUserLevel } from '@/hooks/use-user-level';
import { learningLevels } from '@/lib/level-config';
import { AUTO_TTS_EVENT, getAutoTtsEnabled, setAutoTtsEnabled } from '@/lib/speech-preferences';
import styles from './profile.module.css';

const SPEED_KEY = 'listen_speed';
const TRANSLATION_KEY = 'show_translation_default';
const ACCOUNT_KEY = 'ai_coach_account';
type Account = { name: string; phone: string };

function storageSize() { if (typeof window === 'undefined') return '0 KB'; const bytes = Object.keys(localStorage).reduce((n, key) => n + key.length + (localStorage.getItem(key)?.length || 0), 0) * 2; return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB'; }

export default function ProfilePage() {
  const { level, setLevel, ready } = useUserLevel();
  const [levelOpen, setLevelOpen] = useState(false); const [loginOpen, setLoginOpen] = useState(false);
  const [autoTts, setAutoTts] = useState(true); const [translation, setTranslation] = useState(false); const [speed, setSpeed] = useState<'0.8'|'1.0'>('0.8');
  const [account, setAccount] = useState<Account | null>(null); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [cache, setCache] = useState('0 KB');
  useEffect(() => { setAutoTts(getAutoTtsEnabled()); setTranslation(localStorage.getItem(TRANSLATION_KEY) === 'true'); setSpeed(localStorage.getItem(SPEED_KEY) === '1.0' ? '1.0' : '0.8'); setCache(storageSize()); const raw = localStorage.getItem(ACCOUNT_KEY); if (raw) try { setAccount(JSON.parse(raw)); } catch {} const sync = () => setAutoTts(getAutoTtsEnabled()); window.addEventListener(AUTO_TTS_EVENT, sync); return () => window.removeEventListener(AUTO_TTS_EVENT, sync); }, []);
  const selectedLevel = learningLevels.find(item => item.id === level);
  const login = () => { const cleanName = name.trim() || '口语学习者'; const data = { name: cleanName, phone: phone.trim() }; localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data)); setAccount(data); setLoginOpen(false); setName(''); setPhone(''); };
  const logout = () => { localStorage.removeItem(ACCOUNT_KEY); setAccount(null); };
  const resetData = () => { if (!window.confirm('确定清空本地学习进度吗？此操作不可撤销。')) return; ['custom_listen_articles','deleted_listen_article_ids','custom_vocab_items','vocab_items','chat_sessions','current_chat_session_id','learning_activities'].forEach(key => localStorage.removeItem(key)); window.location.reload(); };
  const clearCache = () => { if (!window.confirm('清理本地缓存后，已保存的自定义篇章可能被移除。继续吗？')) return; ['custom_listen_articles','deleted_listen_article_ids'].forEach(key => localStorage.removeItem(key)); setCache(storageSize()); };
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.back}>‹</Link><div><span className={styles.eyebrow}>PREFERENCES</span><h1>设置</h1></div><span className={styles.avatar}>{account ? account.name.slice(0,1).toUpperCase() : 'N'}</span></header>
    <section className={styles.accountCard}><div className={styles.accountAvatar}>{account ? account.name.slice(0,1).toUpperCase() : 'N'}</div><div className={styles.accountCopy}><b>{account ? account.name : '未登录'}</b><small>{account ? <>已绑定 {account.phone || '本地账户'} · {level}</> : '登录后同步词库与学习数据'}</small></div>{account ? <button type="button" className={styles.accountButton} onClick={logout}>退出登录</button> : <button type="button" className={styles.accountButton} onClick={() => setLoginOpen(true)}>登录 / 注册</button>}</section>
    <section className={styles.group} aria-labelledby="learning-heading"><h2 id="learning-heading">学习偏好</h2><div className={styles.list}><button type="button" className={styles.row} onClick={() => setLevelOpen(true)}><span><b>口语等级</b><small>当前 {level} · {selectedLevel?.cefr} {selectedLevel?.name}</small></span><i>›</i></button><div className={styles.row}><span><b>朗读音色</b><small>Jenny (美音)</small></span><i>›</i></div><div className={styles.row}><span><b>默认语速</b><small>影响听读与语音播放</small></span><div className={styles.segment}><button type="button" className={speed === '0.8' ? styles.segmentActive : ''} onClick={() => { setSpeed('0.8'); localStorage.setItem(SPEED_KEY,'0.8'); }}>0.8x 慢速</button><button type="button" className={speed === '1.0' ? styles.segmentActive : ''} onClick={() => { setSpeed('1.0'); localStorage.setItem(SPEED_KEY,'1.0'); }}>1.0x 原速</button></div></div></div></section>
    <section className={styles.group}><h2>交互与播放</h2><div className={styles.list}><label className={styles.switchRow}><span><b>自动发音</b><small>Jenny 回复后自动播放英语语音</small></span><input type="checkbox" role="switch" checked={autoTts} onChange={e => { setAutoTtsEnabled(e.target.checked); setAutoTts(e.target.checked); }} /></label><label className={styles.switchRow}><span><b>双语对照</b><small>对话时默认展示中文翻译</small></span><input type="checkbox" role="switch" checked={translation} onChange={e => { setTranslation(e.target.checked); localStorage.setItem(TRANSLATION_KEY,String(e.target.checked)); }} /></label></div></section>
    <section className={styles.group}><h2>系统与存储</h2><div className={styles.list}><div className={styles.storageRow}><span><b>本地缓存管理</b><small>当前占用 {cache}</small></span><button type="button" onClick={clearCache}>清理缓存</button></div><button type="button" className={styles.reset} onClick={resetData}>重置数据</button></div></section>
    <p className={styles.footer}>AI English Coach · v1.0.0<br /><span><a href="#">用户协议</a> · <a href="#">隐私政策</a></span></p>
    {levelOpen && <div className={styles.backdrop} onClick={() => setLevelOpen(false)}><section className={styles.sheet} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}><header><h2>口语等级</h2><button type="button" onClick={() => setLevelOpen(false)}>×</button></header><div className={styles.levelOptions}>{learningLevels.map(item => <button type="button" key={item.id} className={level === item.id ? styles.levelOptionActive : styles.levelOption} onClick={() => { setLevel(item.id); setLevelOpen(false); }}><span><b>{item.id} · {item.cefr}</b><small>{item.name}</small></span>{level === item.id && <strong>✓</strong>}</button>)}</div></section></div>}
    {loginOpen && <div className={styles.backdrop} onClick={() => setLoginOpen(false)}><section className={styles.sheet} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}><header><h2>登录 / 注册</h2><button type="button" onClick={() => setLoginOpen(false)}>×</button></header><p className={styles.sheetHint}>本地登录即可保存你的学习偏好。</p><label className={styles.field}>昵称<input value={name} onChange={e => setName(e.target.value)} maxLength={30} placeholder="输入昵称" autoFocus /></label><label className={styles.field}>手机号（可选）<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} placeholder="输入手机号" /></label><button type="button" className={styles.primary} onClick={login}>立即登录</button></section></div>}
  </main>;
}
