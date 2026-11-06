import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const url = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022} }).outputText;
test('tap primes only media synchronously; fallback is English, cancellable and SSR-safe', async () => {
  const names = ['window','Audio','SpeechSynthesisUtterance'];
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis,name));
  const install = (name,value) => Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  const events=[]; let item; let ended=0;
  try {
    const speech = await import(url(compile('../src/lib/browser-speech.ts')));
    speech.stopBrowserSpeech();
    install('window',{speechSynthesis:{cancel(){events.push('cancel');},resume(){},getVoices:()=>[{lang:'en-US',name:'English'}],speak(value){item=value;events.push('speak');}}});
    install('SpeechSynthesisUtterance',class{constructor(text){this.text=text;}});
    install('Audio',class{setAttribute(){} play(){events.push('play');return Promise.reject(new Error('blocked'));}});
    const player = await import(url(compile('../src/lib/chat-audio.ts').replace(/from ['"]\.\/browser-speech['"]/, 'from '+JSON.stringify(url(compile('../src/lib/browser-speech.ts'))))));
    player.primeChatAudio(); assert.deepEqual(events,['play']);
    speech.speakBrowser('Hello',()=>ended++,()=>assert.fail('unexpected speech failure'));
    assert.equal(item.lang,'en-US');assert.equal(item.rate,0.9);assert.equal(item.voice.name,'English');
    const previous=item;speech.stopBrowserSpeech();previous.onend();assert.equal(ended,0);
    speech.speakBrowser('World',()=>ended++,()=>{});item.onend();assert.equal(ended,1);
    await Promise.resolve();
  } finally { names.forEach((name,i)=>{if(saved[i])Object.defineProperty(globalThis,name,saved[i]);else delete globalThis[name];}); }
});
test('shared fetch rejects invalid audio and enforces timeout without cancelling caller', async () => {
  const originalFetch=globalThis.fetch, originalTimer=globalThis.setTimeout;
  try {
    const {fetchSpeech,canFallbackSpeech}=await import(url(compile('../src/lib/browser-speech.ts')));
    const caller=new AbortController();
    globalThis.fetch=async(path,init)=>{
      assert.equal(path,'/api/tts'); assert.equal(init.method,'POST');
      assert.deepEqual(JSON.parse(init.body),{speed:0.9,text:'Hello'});
      return new Response('{}',{headers:{'Content-Type':'application/json'}});
    };
    await assert.rejects(fetchSpeech('Hello',caller.signal),/Invalid MP3/);
    for (const status of [400,401,404,500,502,503]) {
      globalThis.fetch=async()=>new Response('{}',{status});
      await assert.rejects(fetchSpeech('Hello',caller.signal),error=>canFallbackSpeech(error)===(status>=500));
    }
    assert.equal(canFallbackSpeech(new Error('NotAllowedError')),false);
    globalThis.setTimeout=fn=>originalTimer(fn,1);
    globalThis.fetch=(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));
    await assert.rejects(fetchSpeech('Hello',caller.signal),/timeout/);
    assert.equal(caller.signal.aborted,false,'timeout remains distinct from user stop');
  } finally {globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimer;}
});
