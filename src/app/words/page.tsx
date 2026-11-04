'use client';
import Link from 'next/link';
import { useState } from 'react';
import { reviewWords } from '@/lib/vocabulary';
import { useLearningData } from '@/hooks/use-learning-data';
import { markWord } from '@/lib/learning-storage';
import { useEnglishSpeech } from '@/hooks/use-english-speech';
import styles from './words.module.css';
export default function WordsPage(){
 const {data,ready,error,todayCount,update,reset}=useLearningData();
 const queue=data.queue;
 const mastered=reviewWords.length-queue.length;
 const [flipped,setFlipped]=useState(false);
 const [feedback,setFeedback]=useState('先读一读单词，再翻卡看看释义。');
 const {supported,playing,notice,speak,stop}=useEnglishSpeech();
 const done=ready&&queue.length===0;
 const word=reviewWords.find(item=>item.word===queue[0]) || reviewWords[0];
 function answer(known:boolean){if(!ready||done)return;stop();if(update(previous=>markWord(previous,word.word,known))){setFlipped(false);setFeedback(known?'已保存掌握状态，继续加油！':'已放到本轮末尾，稍后再见一次。');}}
 function restart(){stop();if(update(previous=>({...previous,queue:reviewWords.map(item=>item.word)}))){setFlipped(false);setFeedback('再练同组；累计词汇和今日数量不会重复计算。');}}
 function resetProgress(){if(!window.confirm('重置所有单词学习数据？掌握状态、每日记录和复习进度都会清空。AI 对话记录不受影响。'))return;stop();if(reset()){setFlipped(false);setFeedback('单词学习数据已重置。');}}
 function sound(key:string,text:string){return <button type="button" className={styles.sound} disabled={!supported} onClick={()=>speak(key,text)} aria-label={playing===key?'停止发音':'朗读'+(key==='word'?'单词':'例句')} aria-pressed={playing===key}>{playing===key?'■ 停止':'🔊 发音'}</button>}
 return <div className={styles.page}><nav className={styles.nav}><Link href="/">← 返回首页</Link><span>DAILY WORDS · 单词复习</span></nav><main className={styles.main}><div className={styles.heading}><div><span className={styles.eyebrow}>A FEW WORDS, EVERY DAY</span><h1>把生活里的词，记在心里。</h1></div><span className={styles.count}>已掌握 <b>{mastered}</b> / {reviewWords.length}</span></div><div className={styles.progress} role="progressbar" aria-label="今日单词复习进度" aria-valuenow={mastered} aria-valuemin={0} aria-valuemax={reviewWords.length}><div style={{width:mastered/reviewWords.length*100+'%'}}/></div>
 {!ready?<p role="status">正在恢复学习进度…</p>:done?<section className={styles.complete}><div className={styles.medal}>✧</div><span className={styles.eyebrow}>WELL DONE!</span><h2>今天，又多了一点积累。</h2><p>本轮已掌握 <strong>{mastered}</strong> 个生活实用词汇</p><div className={styles.summary}>慢慢记，常常用。每一次复习都算数。</div><button className={styles.primary} onClick={restart}>再练一组 ↻</button><Link className={styles.home} href="/">返回首页 →</Link></section>:<><div className={styles.cardArea} key={word.word}><div className={styles.card+' '+(flipped?styles.flipped:'')}><section className={styles.front} aria-hidden={flipped}><button type="button" className={styles.flipSurface} tabIndex={flipped?-1:0} onClick={()=>setFlipped(true)} aria-label={'翻到背面，查看'+word.word+'的释义'}><span className={styles.eyebrow}>WORD OF THE MOMENT</span><strong lang="en">{word.word}</strong><span className={styles.phonetic}>{word.phonetic}</span><span className={styles.part}>{word.part}</span><span className={styles.flipHint}>轻点卡片，揭晓释义 ↻</span></button><div className={styles.audio} inert={flipped}>{sound('word',word.word)}</div></section><section className={styles.back} aria-hidden={!flipped}><button type="button" className={styles.flipSurface} tabIndex={flipped?0:-1} onClick={()=>setFlipped(false)} aria-label="翻回单词正面"><span className={styles.eyebrow}>{word.word} · {word.part}</span><strong>{word.meaning}</strong><span className={styles.example} lang="en">{word.example}</span><span className={styles.translation}>{word.translation}</span><span className={styles.flipHint}>轻点卡片，返回单词 ↻</span></button><div className={styles.audio} inert={!flipped}>{sound('example',word.example)}</div></section></div></div><div className={styles.feedback} role="status">{error || notice || feedback}</div>{!supported&&<p className={styles.unsupported}>此浏览器暂不支持发音，仍可正常复习。</p>}<div className={styles.actions}><button className={styles.again} onClick={()=>answer(false)}>↻ 没记住<small>再来一次</small></button><button className={styles.primary} onClick={()=>answer(true)}>✓ 已掌握<small>下一个</small></button></div><p className={styles.note}>本轮还有 {queue.length} 个待掌握 · 翻卡后选择记忆状态</p></>}
<p className={styles.note}>今日已掌握 {todayCount} 个 · 累计掌握 {data.mastered.length} 个</p><div style={{textAlign:"center"}}><button type="button" className="text-btn" onClick={resetProgress} disabled={!ready}>重置学习数据</button></div>{error&&<p role="alert" className={styles.note}>{error}</p>} </main></div>;
}
