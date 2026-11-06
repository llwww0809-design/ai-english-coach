import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
test('ElevenLabs TTS: Sarah, MP3, validation, upstream errors and streaming deadlines', async () => {
  const oldKey=process.env.ELEVENLABS_API_KEY, oldFetch=globalThis.fetch, oldTimer=globalThis.setTimeout;
  const oldError=console.error, oldLog=console.log;
  const calls=[], errors=[]; let mode='success';
  const js=ts.transpileModule(readFileSync(new URL('../src/app/api/tts/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {POST,GET}=await import(dataUrl(js));
  const post=body=>POST(new Request('http://localhost/api/tts',{method:'POST',body:JSON.stringify(body)}));
  try {
    console.log=()=>{};console.error=(...args)=>errors.push(args);
    process.env.ELEVENLABS_API_KEY='test-only';
    globalThis.fetch=async(url,init)=>{
      calls.push({url,init,body:JSON.parse(init.body)});
      if(mode==='headers')return new Promise(()=>{});
      if(mode==='body')return new Response(new ReadableStream({ start(output) { output.enqueue(new Uint8Array([73])); } }),{headers:{'Content-Type':'audio/mpeg'}});
      if(mode==='upstream')return new Response('private upstream details',{status:401});
      if(mode==='network')throw new TypeError('network disconnected');
      if(mode==='invalid')return new Response('{}',{headers:{'Content-Type':'application/json'}});
      return new Response(new Uint8Array([73,68,51,1,2]),{headers:{'Content-Type':'audio/mpeg'}});
    };
    let response=await post({text:' Hello! ',speed:.8});
    assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'audio/mpeg');
    assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, s-maxage=31536000, immutable');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[73,68,51,1,2]);
    assert.equal(calls[0].url,'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream?output_format=mp3_22050_32&optimize_streaming_latency=4');
    assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.headers['xi-api-key'],'test-only');
    assert.equal(calls[0].init.headers['Content-Type'],'application/json');
    assert.deepEqual(calls[0].body,{text:'Hello!',model_id:'eleven_flash_v2_5',voice_settings:{stability:.5,similarity_boost:.75}});
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    const getResponse=await GET(new Request('http://localhost/api/tts?text=Hello&speed=0.8')); assert.equal(getResponse.status,200); await getResponse.arrayBuffer();
    for(const speed of [0,4.1,'0.8',null])assert.equal((await post({text:'Hello',speed})).status,400);
    for(const text of ['', 'a'.repeat(4001)])assert.equal((await post({text})).status,400);
    assert.equal((await POST(new Request('http://localhost/api/tts',{method:'POST',body:'{'}))).status,400);
    delete process.env.ELEVENLABS_API_KEY;const count=calls.length;
    assert.equal((await post({text:'Hello'})).status,500);assert.equal(calls.length,count);
    process.env.ELEVENLABS_API_KEY='test-only';
    for(mode of ['upstream','network','invalid']){
      response=await post({text:'Hello'});assert.equal(response.status,500);
      assert.ok(!(await response.text()).includes('private upstream'));
      assert.ok(errors.at(-1)[1] instanceof Error);assert.ok(errors.at(-1)[1].stack);
    }
    globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,8000);return oldTimer(fn,1);};
    for(mode of ['headers','body']){
      response=await post({text:'Timeout test'});
      if(mode==='body') {
        assert.equal(response.status,200);
        const reader=response.body.getReader();
        assert.deepEqual([...((await reader.read()).value)],[73], 'The first chunk arrives before synthesis finishes');
        await assert.rejects(reader.read(), /8000ms deadline/);
      } else assert.equal(response.status,500);
      assert.equal(calls.at(-1).init.signal.aborted,true);
      assert.match(errors.at(-1)[1].stack,/8000ms deadline/);
    }
  }finally{
    globalThis.fetch=oldFetch;globalThis.setTimeout=oldTimer;console.error=oldError;console.log=oldLog;
    if(oldKey===undefined)delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=oldKey;
  }
});
