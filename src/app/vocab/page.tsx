'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLearningLevel } from '@/hooks/use-learning-level';
import {
  addToBank,
  appendTopicWords,
  getBankList,
  getDailyRecommendState,
  getDailyRecommendations,
  getTopicPackProgress,
  getTopicPacks,
  getVocabList,
  markDailyHandled,
  markTopicWordMastered,
  removeFromBank,
  VOCAB_UPDATED_EVENT,
  type DailyRecommendState,
  type TopicPack,
  type VocabItem,
} from '@/lib/vocab-storage';
import { parseTopicGeneration } from '@/lib/topic-generation';
import { DEFAULT_LEVEL, getUserLevel } from '@/lib/level-config';
import { getChatAudio, primeChatAudio } from '@/lib/chat-audio';
import styles from './vocab.module.css';
import drawer from './vocab-drawer.module.css';

type View = 'daily' | 'topics' | 'bank';
type TopicCategory = 'all' | TopicPack['category'];

const categories: Array<{ id: TopicCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'travel', label: '旅行出行' },
  { id: 'work', label: '职场商务' },
  { id: 'exam', label: '核心考试' },
  { id: 'daily', label: '生活碎片' },
];

export default function VocabPage() {
  const { level, ready } = useLearningLevel();
  const [view, setView] = useState<View>('daily');
  const [bank, setBank] = useState<VocabItem[]>([]);
  const [recommendations, setRecommendations] = useState<VocabItem[]>([]);
  const [dailyState, setDailyState] = useState<DailyRecommendState>({ date: '', level: DEFAULT_LEVEL, wordIds: [], currentIndex: 0, handled: {} });
  const [packs, setPacks] = useState<TopicPack[]>([]);
  const [expanding, setExpanding] = useState(false);
  const [expansionStatus, setExpansionStatus] = useState('');
  const expansionController = useRef<AbortController | null>(null);
  const [topicProgress, setTopicProgress] = useState<Record<string, string[]>>({});
  const [category, setCategory] = useState<TopicCategory>('all');
  const [activePack, setActivePack] = useState<TopicPack | null>(null);
  const [topicMode, setTopicMode] = useState<'overview' | 'practice'>('overview');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicIndex, setTopicIndex] = useState(0);
  const [repeatPack, setRepeatPack] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VocabItem | null>(null);
  const [notice, setNotice] = useState('');
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [mastered, setMastered] = useState(0);
  const sheetRef = useRef<HTMLElement | null>(null);
  const speechRequest = useRef(0);
  const speechController = useRef<AbortController | null>(null);
  const audioUrl = useRef<string | null>(null);

  const stopSpeech = useCallback(() => {
    speechRequest.current += 1;
    speechController.current?.abort();
    const audio = getChatAudio();
    audio.pause();
    audio.removeAttribute('src');
    audio.onended = null;
    audio.onerror = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
    setSpeaking(null);
  }, []);

  const refresh = useCallback(() => {
    if (!ready) return;
    const nextState = getDailyRecommendState(level);
    setRecommendations(getDailyRecommendations(level));
    setDailyState(nextState);
    setBank(getBankList());
    const nextPacks = getTopicPacks(level);
    setPacks(nextPacks);
    setActivePack(current => current ? nextPacks.find(pack => pack.id === current.id) || null : null);
    setTopicProgress(getTopicPackProgress());
    setMastered(getVocabList().filter(item => item.status === 'mastered').length);
  }, [level, ready]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    window.addEventListener(VOCAB_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(VOCAB_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);
  useEffect(() => {
    stopSpeech();
    setActivePack(null);
    setSelectedItem(null);
    setSelectedTopicId(null);
    setNotice('');
  }, [level, stopSpeech]);
  useEffect(() => () => stopSpeech(), [stopSpeech]);

  useEffect(() => {
    if (!selectedItem) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stopSpeech();
        setSelectedItem(null);
        setSelectedTopicId(null);
      }
      if (event.key !== 'Tab') return;
      const buttons = sheetRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sheetRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [selectedItem, stopSpeech]);

  useEffect(() => {
    setExpanding(false);
    setExpansionStatus('');
    return () => {
      expansionController.current?.abort();
      expansionController.current = null;
    };
  }, [level, activePack?.id, view, topicMode]);

  async function expandPack() {
    if (!activePack || expansionController.current) return;
    const currentLevel = getUserLevel();
    if (currentLevel !== level) return;
    const controller = new AbortController();
    expansionController.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 65000);
    setExpanding(true);
    setExpansionStatus('正在生成场景新词…');
    try {
      const excludeWords = getTopicPacks(currentLevel).find(pack => pack.id === activePack.id)?.words.map(word => word.word) || [];
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ task: 'expand-topic-vocab', topicId: activePack.id, level: currentLevel, excludeWords }),
      });
      const data = await response.json();
      if (controller.signal.aborted || getUserLevel() !== currentLevel) return;
      if (!response.ok) throw new Error(response.status === 503 ? '请先在服务端 .env.local 配置 AI_API_KEY，再尝试扩充新词。' : data.error || '生成失败，请稍后重试。');
      if (data.topicId !== activePack.id || data.level !== currentLevel) throw new Error('返回的场景或等级不匹配，请重试。');
      const words = parseTopicGeneration(JSON.stringify({ words: data.words }), currentLevel, excludeWords);
      const count = appendTopicWords(activePack.id, currentLevel, words);
      refresh();
      setExpansionStatus(count ? '已新增 ' + count + ' 词并保存，刷新后仍可学习。' : '这些词已由其他页面加入，本地列表已同步。');
    } catch (error) {
      if (expansionController.current !== controller) return;
      setExpansionStatus(controller.signal.aborted ? '生成超时，请重试。原词包保持不变。' : error instanceof Error ? error.message : '暂时无法生成新词，请重试。');
    } finally {
      window.clearTimeout(timeout);
      if (expansionController.current === controller) {
        expansionController.current = null;
        setExpanding(false);
      }
    }
  }

  const dailyReady = ready && dailyState.level === level && dailyState.wordIds.length > 0;
  const current = dailyReady ? recommendations[dailyState.currentIndex] : undefined;
  const completed = dailyState.currentIndex;

  const visiblePacks = useMemo(() => packs.filter(pack => category === 'all' || pack.category === category), [category, packs]);
  const knownCount = (pack: TopicPack) => pack.words.filter(word => topicProgress[pack.id]?.includes(word.id)).length;
  const topicCurrent = activePack?.words[topicIndex];

  const speak = useCallback(async (key: string, text: string) => {
    const audio = getChatAudio();
    const wasSpeaking = speaking === key;
    stopSpeech();
    if (wasSpeaking) { setNotice(''); return; }
    primeChatAudio();
    const requestId = speechRequest.current;
    const controller = new AbortController();
    speechController.current = controller;
    setSpeaking(key); setNotice('正在准备 Jenny 的美音…');
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ text, voice: 'en-US-JennyNeural', level: getUserLevel() }),
      });
      if (!response.ok) throw new Error('语音服务暂不可用');
      const blob = await response.blob();
      if (requestId !== speechRequest.current) return;
      if (!blob.size) throw new Error('语音服务返回为空');
      audioUrl.current = URL.createObjectURL(blob);
      audio.src = audioUrl.current;
      audio.onended = () => { stopSpeech(); setNotice(''); };
      audio.onerror = () => { stopSpeech(); setNotice('语音播放失败，请再试一次。'); };
      await audio.play();
      if (requestId !== speechRequest.current) return;
      setNotice('');
    } catch (error) {
      if (requestId !== speechRequest.current) return;
      setSpeaking(null);
      setNotice(error instanceof Error ? error.message : '语音暂不可用。');
    }
  }, [speaking, stopSpeech]);

  function nextDaily(status: 'passed' | 'added') {
    if (!current) return;
    stopSpeech();
    setDailyState(markDailyHandled(current.id, status, level));
  }

  function addCurrent() {
    if (!current) return;
    addToBank({ ...current, source: 'daily_recommend', status: 'in_bank' });
    nextDaily('added');
    setBank(getBankList());
    setNotice('');
  }

  function startPack(pack: TopicPack, repeat = false) {
    stopSpeech();
    setTopicMode('practice');
    setRepeatPack(repeat);
    const known = topicProgress[pack.id] || [];
    setActivePack(pack);
    const firstUnknown = pack.words.findIndex(word => !known.includes(word.id));
    setTopicIndex(repeat ? 0 : firstUnknown < 0 ? pack.words.length : firstUnknown);
    setNotice('');
  }

  function openPack(pack: TopicPack) {
    stopSpeech();
    setActivePack(pack);
    setTopicMode('overview');
    setNotice('');
  }

  function closeDetail() {
    stopSpeech();
    setSelectedItem(null);
    setSelectedTopicId(null);
  }

  function addDetailToBank() {
    if (!selectedItem) return;
    addToBank({ ...selectedItem, status: 'in_bank' });
    setNotice('已加入我的词库');
  }

  function masterDetail() {
    if (!selectedItem || !selectedTopicId) return;
    setTopicProgress(markTopicWordMastered(selectedTopicId, selectedItem.id));
    closeDetail();
    setNotice('已标记为掌握，进度已保存');
  }

  function advancePack() {
    if (!activePack) return;
    const known = topicProgress[activePack.id] || [];
    const nextIndex = activePack.words.findIndex((word, index) => index > topicIndex && (repeatPack || !known.includes(word.id)));
    setTopicIndex(nextIndex < 0 ? activePack.words.length : nextIndex);
  }

  function passTopicWord() {
    if (!activePack || !topicCurrent) return;
    stopSpeech();
    const next = markTopicWordMastered(activePack.id, topicCurrent.id);
    setTopicProgress(next);
    const nextIndex = activePack.words.findIndex((word, index) => index > topicIndex && (repeatPack || !next[activePack.id]?.includes(word.id)));
    setTopicIndex(nextIndex < 0 ? activePack.words.length : nextIndex);
  }

  function addTopicWord() {
    if (!activePack || !topicCurrent) return;
    stopSpeech();
    addToBank({ ...topicCurrent, source: 'daily_recommend', status: 'in_bank' });
    setBank(getBankList());
    advancePack();
    setNotice('已加入待攻克词库');
  }

  function remove(id: string) {
    setBank(removeFromBank(id).filter(item => item.status === 'in_bank'));
    setSelectedItem(null);
  }

  function switchView(next: View) {
    stopSpeech();
    setNotice('');
    setActivePack(null);
    setView(next);
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/teacher" aria-label="返回对话">←</Link>
      <div><span>EVERYDAY ENGLISH · {level}</span><h1>口语词库</h1></div>
      <div className={styles.headerActions}>
        <button type="button" className={styles.addButton} onClick={() => switchView('bank')} aria-label="查看我的词库">▤</button>
      </div>
    </header>

    <nav className={styles.tabs} aria-label="词库视图">
      <button type="button" aria-pressed={view === 'daily'} className={view === 'daily' ? styles.tabActive : ''} onClick={() => switchView('daily')}>今日推荐<small>每日 10 词</small></button>
      <button type="button" aria-pressed={view === 'topics'} className={view === 'topics' ? styles.tabActive : ''} onClick={() => switchView('topics')}>主题词包<small>分类自由练</small></button>
      <button type="button" aria-pressed={view === 'bank'} className={view === 'bank' ? styles.tabActive : ''} onClick={() => switchView('bank')}>我的词库<small>{bank.length} 个待攻克</small></button>
    </nav>

    {(!ready || (view === 'daily' && !dailyReady)) && <p className={styles.loading} role="status">正在恢复学习进度…</p>}
    {dailyReady && view === 'daily' && <section className={styles.daily}>
      <div className={styles.dailyHeading}><div><span className={styles.eyebrow}>DAILY RECOMMENDATION</span><h2>今日推荐 · {level} 等级</h2></div><strong>{Math.min(completed, 10)}<small>/10</small></strong></div>
      <div className={styles.progress}><i style={{ width: `${Math.min(completed, 10) * 10}%` }} /></div>
      {completed >= 10 || !current ? <div className={styles.complete}><span>✓</span><h2>今日推荐已完成</h2><p>认识的词已跳过，生词已归入待攻克词库。</p><button type="button" onClick={() => setView('bank')}>查看我的词库 ↗</button></div> : <div className={styles.dailyCard}>
        <small>第 {Math.min(completed + 1, 10)} / 10 个</small><h2>{current.word}</h2><p>{current.phonetic}</p><strong>{current.translation}</strong>
        <section className={styles.dailyDetails} aria-label="词汇用法">
          <div className={styles.collocationBlock}><span className={styles.detailLabel}>常用搭配</span><div className={styles.dailyTags}>{current.collocations.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div></div>
          <div className={styles.exampleBlock}><div className={styles.exampleHeading}><span className={styles.detailLabel}>地道例句</span><button type="button" className={styles.exampleSound} onClick={() => void speak(`example-${current.id}`, current.exampleEn)} aria-label={`朗读例句：${current.exampleEn}`}>{speaking === `example-${current.id}` ? '■' : '🔊'}</button></div><p lang="en">{current.exampleEn}</p><small>{current.exampleZh}</small></div>
        </section>
        <button type="button" className={styles.dailySound} onClick={() => void speak(`daily-${current.id}`, current.word)}>{speaking === `daily-${current.id}` ? '■ 停止' : '🔊 朗读单词'}</button>
        <div className={styles.dailyActions}><button type="button" onClick={addCurrent}>😵 不认识<br /><small>加入词库</small></button><button type="button" onClick={() => nextDaily('passed')}>😎 认识<br /><small>Pass</small></button></div>
      </div>}
    </section>}

    {ready && view === 'topics' && <section className={styles.topics}>
      {activePack && activePack.words.every(word => word.level === level) ? topicMode === 'overview' ? <div className={styles.topicOverview}>
        <div className={styles.overviewHeading}>
          <button type="button" className={styles.packBack} onClick={() => switchView('topics')} aria-label="返回主题词包">←</button>
          <div><h2>{activePack.title} · {level}</h2><p>已掌握 {knownCount(activePack)} / {activePack.words.length}</p></div>
          <button type="button" className={styles.continueButton} onClick={() => startPack(activePack, knownCount(activePack) === activePack.words.length)}>▶ 连续刷词</button>
        </div>
        <div className={styles.topicProgress} role="progressbar" aria-label="场景掌握进度" aria-valuemin={0} aria-valuemax={activePack.words.length} aria-valuenow={knownCount(activePack)}><i style={{ width: `${knownCount(activePack) / activePack.words.length * 100}%` }} /></div>
        <div className={styles.expansionBar}>
          <button type="button" className={styles.expandButton} disabled={expanding} aria-busy={expanding} onClick={() => void expandPack()}>{expanding ? '正在生成场景新词…' : '✨ 换一批 / 扩充新词'}</button>
          <small>保留已有词汇，每次追加 10 个 · 使用已配置 AI</small>
        </div>
        {expansionStatus && <p className={styles.expansionStatus} role="status">{expansionStatus}</p>}
        <div className={styles.overviewGrid}>{activePack.words.map(word => {
          const known = topicProgress[activePack.id]?.includes(word.id);
          return <article key={word.id} className={`${styles.overviewCard} ${known ? styles.wordKnown : ''}`}>
            <button type="button" className={styles.overviewWord} onClick={() => { setSelectedTopicId(activePack.id); setSelectedItem(word); }} aria-label={`查看 ${word.word} 详情`}><strong lang="en">{word.word}</strong><small>{word.translation}</small>{known && <span className={styles.knownMark}>✓ 已掌握</span>}</button>
            <button type="button" className={styles.overviewSound} onClick={() => void speak(`list-${word.id}`, word.word)} aria-label={`朗读 ${word.word}`}>{speaking === `list-${word.id}` ? '■' : '🔊'}</button>
          </article>;
        })}</div>
      </div> : <div className={styles.topicPractice}>
        <div className={styles.topicPracticeHeader}><button type="button" onClick={() => openPack(activePack)} aria-label="返回场景清单">←</button><div><span>{level} · {activePack.title}</span><strong>{knownCount(activePack)} / {activePack.words.length} 已掌握 · 语速跟随当前 {level}</strong></div></div>
        <div className={styles.topicProgress}><i style={{ width: `${(knownCount(activePack) / activePack.words.length) * 100}%` }} /></div>
        {topicIndex >= activePack.words.length || !topicCurrent ? <div className={styles.complete}><span>✓</span><h2>这组词练完了</h2><p>已掌握进度已保存，未掌握的词可以再次练习。</p><div className={styles.completeActions}><button type="button" onClick={() => startPack(activePack, true)}>再练一遍</button><button type="button" onClick={() => openPack(activePack)}>返回场景清单</button></div></div> : <article className={styles.topicWordCard} key={`${activePack.id}-${topicIndex}`}>
          <div className={styles.topicWordHeading}><div><h2>{topicCurrent.word}</h2><span>{topicCurrent.phonetic}</span></div><button type="button" className={styles.topicSound} onClick={() => void speak(`topic-${topicCurrent.id}`, topicCurrent.word)} aria-label={`朗读 ${topicCurrent.word}`}>{speaking === `topic-${topicCurrent.id}` ? '■' : '🔊'}</button></div>
          <p className={styles.topicTranslation}>{topicCurrent.translation}</p>
          <div className={styles.topicCollocations}><span className={styles.detailLabel}>常用搭配</span><div className={styles.dailyTags}>{topicCurrent.collocations.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div></div>
          <div className={styles.topicExample}><div className={styles.exampleHeading}><span className={styles.detailLabel}>地道例句</span><button type="button" className={styles.exampleSound} onClick={() => void speak(`topic-example-${topicCurrent.id}`, topicCurrent.exampleEn)} aria-label="朗读例句">{speaking === `topic-example-${topicCurrent.id}` ? '■' : '🔊'}</button></div><p lang="en">{topicCurrent.exampleEn}</p><small>{topicCurrent.exampleZh}</small></div>
          <div className={styles.topicActions}><button type="button" onClick={addTopicWord}>😵 不认识<small>加入待攻克</small></button><button type="button" onClick={passTopicWord}>😎 认识<small>Pass 并记住</small></button></div>
        </article>}
      </div> : <>
        <div className={styles.topicIntro}><span className={styles.eyebrow}>PICK A TOPIC</span><h2>按场景自由练词</h2><p>每个场景都提供五档内容，随你的难度目标切换。</p></div>
        <div className={styles.topicFilters} aria-label="按分类筛选">{categories.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} className={category === item.id ? styles.topicFilterActive : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div>
        <p className={styles.levelHint}>当前难度：{level} · 场景内容已自适应匹配</p>
        <div className={styles.topicGrid}>{visiblePacks.map(pack => {
          const count = knownCount(pack);
          return <button type="button" className={styles.topicPack} key={pack.id} onClick={() => openPack(pack)}>
            <div className={styles.topicPackTop}><strong>{pack.title}</strong></div>
            <p>{pack.subtitle}</p>
            <small>共 {pack.words.length} 词 · 已掌握 {count}</small>
            <div className={styles.topicPackProgress}><i style={{ width: `${(count / pack.words.length) * 100}%` }} /></div>
          </button>;
        })}</div>
      </>}
    </section>}

    {view === 'bank' && <section className={styles.bank}><div className={styles.bankHeading}><div><span className={styles.eyebrow}>MY VOCABULARY</span><h2>待攻克词库</h2></div><span>{bank.length} 个待攻克 · {mastered} 个已掌握</span></div>{bank.length ? <div className={drawer.wordGrid}>{bank.map(item => <button type="button" className={drawer.wordCard} key={item.id} onClick={() => { setSelectedTopicId(null); setSelectedItem(item); }}><b>{item.word}</b><small>{item.translation}</small></button>)}</div> : <div className={styles.empty}>词库空空如也，在今日推荐或对话中收集生词吧</div>}</section>}

    {selectedItem && <div className={drawer.sheetBackdrop} role="presentation" onClick={closeDetail}>
      <section ref={sheetRef} tabIndex={-1} className={drawer.bottomSheet} role="dialog" aria-modal="true" aria-labelledby="vocab-detail-title" onClick={event => event.stopPropagation()}>
        <div className={drawer.sheetHandle} />
        <header className={drawer.sheetHeader}>
          <div><h2 id="vocab-detail-title">{selectedItem.word}</h2><span>{selectedItem.phonetic || '美音音标待补充'}</span></div>
          <button type="button" className={drawer.sheetSpeak} onClick={() => void speak(`detail-${selectedItem.id}`, selectedItem.word)} aria-label={`朗读 ${selectedItem.word}`}>{speaking === `detail-${selectedItem.id}` ? '■' : '🔊'}</button>
          <button type="button" className={drawer.sheetClose} onClick={closeDetail} aria-label="关闭详情">×</button>
        </header>
        <div className={drawer.sheetContent}>
          <section><h3>中文释义</h3><p className={styles.translation}>{selectedItem.translation}</p></section>
          <section><h3>常用搭配</h3><div className={styles.tags}>{selectedItem.collocations.map(tag => <span key={tag}>{tag}</span>)}</div></section>
          <section><div className={styles.exampleHeading}><h3>口语例句 · {selectedItem.level}</h3><button type="button" className={styles.exampleSound} onClick={() => void speak(`detail-example-${selectedItem.id}`, selectedItem.exampleEn)} aria-label="朗读详情例句">{speaking === `detail-example-${selectedItem.id}` ? '■' : '🔊'}</button></div><p className={styles.example} lang="en">{selectedItem.exampleEn}</p><p className={styles.exampleZh}>{selectedItem.exampleZh}</p></section>
        </div>
        <footer className={`${drawer.sheetFooter} ${selectedTopicId ? drawer.sheetActions : ''}`}>
          {selectedTopicId ? <>
            <button type="button" className={drawer.secondaryAction} disabled={bank.some(item => item.level === selectedItem.level && item.word.trim().toLowerCase() === selectedItem.word.trim().toLowerCase())} onClick={addDetailToBank}>{bank.some(item => item.level === selectedItem.level && item.word.trim().toLowerCase() === selectedItem.word.trim().toLowerCase()) ? '✓ 已在我的词库' : '+ 加入我的词库'}</button>
            <button type="button" className={styles.masterButton} disabled={topicProgress[selectedTopicId]?.includes(selectedItem.id)} onClick={masterDetail}>{topicProgress[selectedTopicId]?.includes(selectedItem.id) ? '✓ 已掌握' : '✓ 标记为已掌握'}</button>
          </> : <button type="button" className={styles.masterButton} onClick={() => { stopSpeech(); remove(selectedItem.id); }}>✓ 已掌握（移出词库）</button>}
        </footer>
      </section>
    </div>}
    <p className={styles.notice} role="status">{notice}</p>
  </main>;
}
