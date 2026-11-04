import { reviewWords } from './vocabulary';
export const LEARNING_KEY='english-coach.learning.v1';
export const LEARNING_EVENT='english-coach-learning-change';
export type LearningData={version:1; mastered:string[]; days:Record<string,string[]>; queue:string[]};
const words=reviewWords.map(item=>item.word);
export function emptyLearning():LearningData{return {version:1,mastered:[],days:{},queue:[...words]};}
export function todayKey(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function readLearning():LearningData{
 const raw=localStorage.getItem(LEARNING_KEY);if(!raw)return emptyLearning();
 const value=JSON.parse(raw);
 const valid=(list:unknown):list is string[]=>Array.isArray(list)&&list.every(item=>typeof item==='string'&&words.includes(item))&&new Set(list).size===list.length;
 if(value?.version!==1||!valid(value.mastered)||!valid(value.queue)||!value.days||typeof value.days!=='object'||Array.isArray(value.days)||!Object.entries(value.days).every(([date,list])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&valid(list)))throw Error('Invalid learning data');
 return value;
}
export function writeLearning(data:LearningData){localStorage.setItem(LEARNING_KEY,JSON.stringify(data));window.dispatchEvent(new Event(LEARNING_EVENT));}
export function markWord(data:LearningData,word:string,known:boolean,date=todayKey()):LearningData{
 if(!words.includes(word)||data.queue[0]!==word)return data;
 const queue=data.queue.slice(1);
 if(!known)return {...data,queue:[...queue,word]};
 return {...data,queue,mastered:Array.from(new Set([...data.mastered,word])),days:{...data.days,[date]:Array.from(new Set([...(data.days[date]||[]),word]))}};
}
