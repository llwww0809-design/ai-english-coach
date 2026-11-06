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
test('remote media starts inside the tap stack and old cancellation cannot pause a replacement', async () => {
  const {playSpeechSource}=await import(url(compile('../src/lib/browser-speech.ts')));
  let tapping=true, calls=0, paused=0;
  const audio={ src:'', play(){ assert.equal(tapping,true); calls++; return Promise.resolve(); }, pause(){paused++;} };
  const ready=playSpeechSource(audio, 'Hello & goodbye?', new AbortController().signal, 0.8);
  assert.equal(calls,1,'play runs before returning to the event loop');
  const source=new URL(audio.src,'https://example.test');
  assert.equal(source.pathname,'/api/tts'); assert.equal(source.searchParams.get('text'),'Hello & goodbye?');
  assert.equal(source.searchParams.get('speed'),'0.8'); assert.equal(audio.playbackRate,0.8);
  tapping=false; await ready;
  let first=true;
  audio.play=()=>{ if(first){first=false;return new Promise(()=>{});} return Promise.resolve(); };
  const stop=new AbortController();
  const old=playSpeechSource(audio,'Old',stop.signal);
  stop.abort();
  const next=playSpeechSource(audio,'New',new AbortController().signal);
  await assert.rejects(old,{name:'AbortError'}); await next;
  assert.equal(paused,0,'Cancelled startup must not pause the next playback');
});

test('MP3 startup deadline releases a stalled play promise and respects cancellation', async()=>{
  const {startSpeechPlayback}=await import(url(compile('../src/lib/browser-speech.ts')));
  const timer=globalThis.setTimeout;let paused=0;
  const audio={play:()=>new Promise(()=>{}),pause(){paused++;}};
  try {
    globalThis.setTimeout=(fn,ms)=>{assert.ok(ms<=5000);return timer(fn,1);};
    await assert.rejects(startSpeechPlayback(audio,new AbortController().signal),/5000ms/);
    assert.equal(paused,1);
    const controller=new AbortController();controller.abort();
    await assert.rejects(startSpeechPlayback(audio,controller.signal),{name:'AbortError'});
    assert.equal(paused,2);
  }finally{globalThis.setTimeout=timer;}
});
