import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadTs } from './load-ts.mjs';

test('STT validates audio and respects the configured transcription endpoint', async () => {
 const { POST } = await loadTs(new URL('../src/app/api/stt/route.ts', import.meta.url));
 const oldFetch=global.fetch, oldKey=process.env.OPENAI_API_KEY, oldBase=process.env.OPENAI_BASE_URL, oldError=console.error;
 const request=(audio=true)=>{const body=new FormData();body.set('file',new Blob(['voice'],{type:audio?'audio/mp4':'text/plain'}),'voice.m4a');return new Request('https://app.test/api/stt',{method:'POST',body});};
 try {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await POST(request())).status,503);
  process.env.OPENAI_API_KEY='test-key';process.env.OPENAI_BASE_URL='https://proxy.test/v1/';
  assert.equal((await POST(request(false))).status,400);
  global.fetch=async(url,init)=>{
   assert.equal(url,'https://proxy.test/v1/audio/transcriptions');
   assert.equal(init.body.get('model'),'whisper-1');assert.equal(init.body.get('language'),'en');
   assert.ok(init.signal);return Response.json({text:'  I had a good day.  '});
  };
  assert.equal((await (await POST(request())).json()).text,'I had a good day.');
  console.error=()=>{};
  global.fetch=async()=>{throw new Error('offline');};
  assert.equal((await POST(request())).status,500);
 } finally {
  global.fetch=oldFetch;console.error=oldError;
  for(const [key,value] of [['OPENAI_API_KEY',oldKey],['OPENAI_BASE_URL',oldBase]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});

test('hold-to-talk cancels gestures and late permissions, then transcribes once and recovers from failure', async () => {
 const keys=['window','document','navigator','MediaRecorder','fetch','__voiceTest'];
 const old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const install=(k,value)=>Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
 const slots=[],cleanups=[];let cursor=0, stopped=0, pendingPermission, fail=false, calls=0, prepare=0;
 const transcript=[];
 const stream=()=>({getTracks:()=>[{stop(){stopped++;}}]});
 const tick=()=>new Promise(r=>setTimeout(r,0));
 const oldNow=Date.now;let now=1000;Date.now=()=>now;
 try {
  install('window',{addEventListener(){},removeEventListener(){}});
  install('document',{addEventListener(){},removeEventListener(){}});
  install('navigator',{mediaDevices:{getUserMedia:()=>pendingPermission||Promise.resolve(stream())},vibrate(){}});
  install('MediaRecorder',class {
   static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';
   start(){this.state='recording';}
   stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});void this.onstop?.();}
  });
  install('fetch',async(url,init)=>{calls++;assert.equal(url,'/api/stt');assert.ok(init.body.get('file'));if(fail)throw new Error('offline');return Response.json({text:'Hello Jenny!'});});
  install('__voiceTest',{
   state(initial){const at=cursor++;slots[at]??={value:initial};return [slots[at].value,v=>{slots[at].value=v;}];},
   ref(initial){const at=cursor++;slots[at]??={current:initial};return slots[at];},
   callback(fn){cursor++;return fn;},
   effect(fn){const at=cursor++;if(!slots[at]){slots[at]=true;cleanups.push(fn());}}
  });
  const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
  const react=data('const h=globalThis.__voiceTest;export const useState=h.state,useRef=h.ref,useCallback=h.callback,useEffect=h.effect;');
  let js=ts.transpileModule(readFileSync(new URL('../src/hooks/use-voice-recorder.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  js=js.replace(/from ['"]react['"]/,"from '"+react+"'");
  const {useVoiceRecorder}=await import(data(js));
  const render=()=>{cursor=0;return useVoiceRecorder(t=>transcript.push(t),()=>prepare++);};
  let h=render();await h.start(300);now+=1000;h.move(200);h.finish();await tick();
  assert.equal(calls,0);assert.equal(render().phase,'idle');assert.ok(stopped);
  let resolvePermission;pendingPermission=new Promise(r=>{resolvePermission=r;});
  const starting=h.start(300);h.finish();resolvePermission(stream());await starting;
  assert.equal(render().phase,'idle');assert.equal(calls,0);pendingPermission=null;
  h=render();await h.start(300);now+=1000;h.move(200);h.move(290);h.finish();await tick();
  assert.deepEqual(transcript,['Hello Jenny!']);assert.equal(calls,1);assert.equal(render().phase,'idle');
  fail=true;h=render();await h.start(300);now+=1000;h.finish();await tick();
  h=render();assert.equal(h.phase,'idle');assert.match(h.error,/offline/);assert.equal(transcript.length,1);
  fail=false;await h.start(300);now+=1000;h.finish();await tick();assert.equal(transcript.length,2);assert.ok(prepare>=4);
 } finally {
  cleanups.forEach(fn=>fn?.());Date.now=oldNow;
  for(const k of keys){if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}
 }
});

test('chat viewport follows keyboard height and pan, hides navigation, and cleans up', async () => {
 const keys=['window','document','requestAnimationFrame','cancelAnimationFrame','__viewportTest'];
 const old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const install=(k,value)=>Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
 const events=new Map(),docEvents=new Map(),attrs=new Set(),styles=new Map();let queued,cleanup;
 const element={contains:node=>node?.tagName==='TEXTAREA',style:{setProperty:(k,v)=>styles.set(k,v)}};
 try {
  const viewport={height:800,offsetTop:0,scale:1,addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
  install('window',{visualViewport:viewport,innerHeight:800,addEventListener(){},removeEventListener(){}});
  install('document',{activeElement:null,documentElement:{toggleAttribute(k,on){on?attrs.add(k):attrs.delete(k);},removeAttribute:k=>attrs.delete(k)},addEventListener:(k,v)=>docEvents.set(k,v),removeEventListener:k=>docEvents.delete(k)});
  install('requestAnimationFrame',fn=>{queued=fn;return 1;});install('cancelAnimationFrame',()=>{});
  install('__viewportTest',{ref:()=>({current:element}),effect:fn=>{cleanup=fn();}});
  const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
  const react=data('const h=globalThis.__viewportTest;export const useRef=h.ref,useEffect=h.effect;');
  let js=ts.transpileModule(readFileSync(new URL('../src/hooks/use-chat-viewport.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  js=js.replace(/from ['"]react['"]/,"from '"+react+"'");
  const {useChatViewport}=await import(data(js));useChatViewport();queued();
  assert.equal(styles.get('--chat-height'),'800px');assert.equal(attrs.size,0);
  document.activeElement={tagName:'TEXTAREA'};docEvents.get('focusin')();queued();
  assert.ok(attrs.has('data-chat-input-active'));
  viewport.height=450;viewport.offsetTop=20;events.get('resize')();queued();
  assert.equal(styles.get('--chat-height'),'450px');assert.equal(styles.get('--chat-top'),'20px');
  document.activeElement=null;docEvents.get('focusout')();queued();
  assert.ok(attrs.has('data-chat-input-active'),'Navigation stays hidden until keyboard finishes closing');
  viewport.height=800;viewport.offsetTop=0;events.get('resize')();queued();assert.equal(attrs.size,0);
  cleanup();assert.equal(events.size,0);assert.equal(docEvents.size,0);
 } finally {cleanup?.();for(const k of keys){if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}}
});
