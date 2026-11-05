'use client';
import { useCallback,useEffect,useState } from 'react';
import { emptyLearning,readLearning,writeLearning,todayKey,LEARNING_EVENT,LEARNING_KEY,type LearningData } from '@/lib/learning-storage';
export function useLearningData(){
 const [data,setData]=useState<LearningData>(emptyLearning);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');const [day,setDay]=useState('');
 const refresh=useCallback(()=>{if(typeof window==='undefined')return;try{setData(readLearning());setError('');}catch{setError('无法读取学习记录，请使用重置入口恢复；当前更改暂不保存。');}setDay(todayKey());setReady(true);},[]);
 useEffect(()=>{refresh();const storage=(event:StorageEvent)=>{if(event.key===LEARNING_KEY||event.key===null)refresh();};window.addEventListener('storage',storage);window.addEventListener(LEARNING_EVENT,refresh);window.addEventListener('focus',refresh);const timer=setInterval(()=>setDay(todayKey()),30000);return()=>{clearInterval(timer);window.removeEventListener('storage',storage);window.removeEventListener(LEARNING_EVENT,refresh);window.removeEventListener('focus',refresh);};},[refresh]);
 function update(transform:(previous:LearningData)=>LearningData){try{const next=transform(readLearning());writeLearning(next);setData(next);setError('');return true;}catch{setError('无法保存学习记录，请检查浏览器存储权限或重置后重试。');return false;}}
 function reset(){try{writeLearning(emptyLearning());setData(emptyLearning());setError('');return true;}catch{setError('重置失败，请检查浏览器存储权限。');return false;}}
 return {data,ready,error,day,todayCount:data.days[day]?.length||0,update,reset};
}
