import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('idle prefetch deduplicates, bounds concurrency, persists and plays cached audio synchronously', async () => {
 const keys=['window','document','navigator','fetch','caches'];
 const originals=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const install=(k,value)=>Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
 const idle=[];const stored=new Map();const releases=[];let calls=0,active=0,peak=0,denied=false;
 const tick=()=>new Promise(r=>setTimeout(r,5));
 const js=ts.transpileModule(readFileSync(new URL('../src/lib/browser-speech.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const load=tag=>import('data:text/javascript;base64,'+Buffer.from(js+'\n//'+tag).toString('base64'));
 try {
  install('window',{requestIdleCallback(fn){idle.push(fn);return idle.length;},cancelIdleCallback(){}});
  install('document',{visibilityState:'visible'});install('navigator',{onLine:true});
  install('caches',{async open(){if(denied)throw new Error('denied');return {
   match:async key=>stored.get(key)?.clone(),
   put:async(key,value)=>{stored.set(key,value.clone());},
   keys:async()=>[...stored.keys()],
   delete:async key=>stored.delete(key)
  };}});
  install('fetch',async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(r=>releases.push(r));active--;return new Response(new Uint8Array([73,68,51,1]),{headers:{'Content-Type':'audio/mpeg'}});});
  const speech=await load('first');
  speech.prefetchSpeech(['borrow','borrow','arrive','decide']);speech.prefetchSpeech(['borrow']);
  assert.equal(calls,0,'No requests during render or before idle');
  idle.splice(0).forEach(fn=>fn());await tick();assert.equal(calls,2);assert.equal(peak,2);
  releases.splice(0).forEach(fn=>fn());await tick();releases.splice(0).forEach(fn=>fn());await tick();
  assert.equal(calls,3,'Concurrent requests for the same text are merged');assert.equal(stored.size,3);
  let tapping=true;
  const audio={src:'',play(){assert.ok(tapping);return Promise.resolve();},pause(){}};
  const playing=speech.playSpeechSource(audio,'borrow',new AbortController().signal);
  assert.ok(audio.src.startsWith('blob:'),'Hot cache is selected before leaving the tap stack');tapping=false;await playing;
  assert.equal(calls,3);
  const reloaded=await load('reload');
  reloaded.prefetchSpeech(['borrow']);idle.splice(0).forEach(fn=>fn());await tick();
  tapping=true;await reloaded.playSpeechSource(audio,'borrow',new AbortController().signal);
  assert.ok(audio.src.startsWith('blob:'));assert.equal(calls,3,'Disk cache survives a new module lifetime');
  tapping=true;await reloaded.playSpeechSource(audio,'borrow',new AbortController().signal,0.8);
  assert.ok(audio.src.startsWith('/api/tts?'),'Different speeds do not collide in cache');
  const cancel=reloaded.prefetchSpeech(['cancelled']);cancel();idle.splice(0).forEach(fn=>fn());await tick();assert.equal(calls,3);
  denied=true;reloaded.prefetchSpeech(['offline-storage']);idle.splice(0).forEach(fn=>fn());await tick();
  releases.splice(0).forEach(fn=>fn());await tick();tapping=true;
  await reloaded.playSpeechSource(audio,'offline-storage',new AbortController().signal);assert.ok(audio.src.startsWith('blob:'),'Storage denial retains memory caching');
 } finally {
  releases.splice(0).forEach(fn=>fn());
  for(const k of keys){if(originals[k])Object.defineProperty(globalThis,k,originals[k]);else delete globalThis[k];}
 }
});
