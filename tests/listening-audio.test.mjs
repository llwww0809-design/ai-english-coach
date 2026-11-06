import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Drive the real hook with a media element and delayed network, without a TTS service.
test('continuous article audio: single request, timing, debounce, lock-screen controls and cleanup', async () => {
  const keys = ['window', 'fetch', 'navigator', 'MediaMetadata', '__listenAudioTest', 'SpeechSynthesisUtterance'];
  const originals = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const slots = [], cleanups = [], actions = new Map(), requests = [];
  let cursor = 0, delayed = false, complete, failFetch = false, rejectPlay = false, hangFetch = false;
  const spoken = [];
  const media = {
    src: '', duration: 30, currentTime: 0, readyState: 1, playbackRate: 1, ended: false, paused: true,
    async play() { if (rejectPlay) { rejectPlay = false; throw new Error('NotAllowedError'); } this.paused = false; this.onplay?.(); },
    pause() { this.paused = true; this.onpause?.(); },
    removeAttribute() { this.src = ''; }, load() {},
  };
  const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  const session = { setActionHandler(action, handler) { actions.set(action, handler); }, setPositionState(value) { this.position = value; } };
  const install = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  try {
    install('window', { setTimeout, clearTimeout, speechSynthesis: { cancel() {}, resume() {}, getVoices: () => [], speak(item) { spoken.push(item); } } });
    install('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
    install('navigator', { mediaSession: session });
    install('MediaMetadata', class { constructor(value) { Object.assign(this, value); } });
    install('__listenAudioTest', {
      state(initial) { const at = cursor++; slots[at] ??= { value: initial }; return [slots[at].value, value => { slots[at].value = value; }]; },
      ref(initial) { const at = cursor++; slots[at] ??= { current: initial }; return slots[at]; },
      callback(fn) { cursor++; return fn; },
      effect(fn) { const at = cursor++; if (!slots[at]) { slots[at] = true; cleanups.push(fn()); } }, media,
    });
    const react = dataUrl('const h=globalThis.__listenAudioTest; export const useState=h.state, useRef=h.ref, useCallback=h.callback, useEffect=h.effect;');
    const audio = dataUrl('export const getChatAudio=()=>globalThis.__listenAudioTest.media; export const primeChatAudio=()=>{};');
    let js = ts.transpileModule(readFileSync(new URL('../src/hooks/use-listening-audio.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    js = js.replace(/from ['"]react['"]/, "from '" + react + "'").replace(/from ['"]@\/lib\/chat-audio['"]/, "from '" + audio + "'");
    const browserSpeech = dataUrl(ts.transpileModule(readFileSync(new URL('../src/lib/browser-speech.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
    js = js.replace(/from ['"]@\/lib\/browser-speech['"]/, "from '" + browserSpeech + "'");
    const { useListeningAudio } = await import(dataUrl(js));
    const article = { id: 'test', titleEn: 'Coffee', level: 'L1', audioSpeed: 0.8, sentences: [{ en: 'One.' }, { en: 'Two.' }, { en: 'Three.' }] };
    const render = () => { cursor = 0; return useListeningAudio(article); };
    const tick = () => new Promise(resolve => setTimeout(resolve, 5));
    install('fetch', async (_url, init) => {
      assert.equal(_url, '/api/tts'); assert.equal(init.method, 'POST');
      requests.push(JSON.parse(init.body));
      if (hangFetch) return new Promise(()=>{});
      if (failFetch) return new Response('{}', {status:500});
      const response = () => new Response(new Blob(['audio']), { headers: { 'Content-Type': 'audio/mpeg' } });
      if (delayed) { delayed = false; return new Promise(resolve => { complete = () => resolve(response()); }); }
      return response();
    });
    let hook = render();
    assert.equal(requests.length, 0);
    assert.equal(session.metadata.title, 'Coffee');
    assert.equal(session.metadata.artist, 'Jenny 美音 · L1');
    await hook.toggle(); hook = render();
    assert.equal(hook.state, 'playing');
    assert.equal(requests[0].text, 'One. Two. Three.');
    assert.equal(requests[0].voice, 'nova');
    assert.equal(requests[0].speed, 0.8);
    assert.ok(media.src.startsWith('blob:'), 'Plain MP3 without timing metadata is playable');
    assert.deepEqual(requests[0].sentences, ['One.', 'Two.', 'Three.']);
    media.currentTime = 12; media.ontimeupdate(); hook = render();
    assert.equal(hook.index, 1);
    assert.equal(requests.length, 1, 'Sentence transition needs no background network or JS scheduling');
    actions.get('pause')(); hook = render();
    assert.equal(hook.state, 'paused'); assert.equal(media.paused, true);
    actions.get('play')(); await tick(); hook = render();
    assert.equal(hook.state, 'playing'); assert.equal(media.currentTime, 12);
    assert.equal(requests.length, 1, 'Resume retains the full track');
    actions.get('nexttrack')(); hook = render();
    assert.equal(hook.index, 2); assert.equal(media.currentTime, 20);
    actions.get('previoustrack')(); hook = render();
    assert.equal(hook.index, 1); assert.equal(media.currentTime, 10);
    media.onended(); hook = render();
    assert.equal(hook.state, 'finished');
    hook.playAt(1); await tick(); hook = render();
    assert.equal(hook.index, 1); assert.equal(media.currentTime, 10, 'Seeking after completion must not restart at sentence one');
    hook.changeSpeed(1); await tick(); hook = render();
    assert.equal(hook.speed, 1); assert.equal(requests.at(-1).speed, 1);
    delayed = true;
    hook.preview('coffee'); hook = render();
    assert.equal(hook.state, 'loading');
    const count = requests.length;
    hook.preview('coffee'); await hook.toggle();
    assert.equal(requests.length, count, 'Repeated taps while loading never start another request');
    hook.pause(); hook.playAt(0); await tick();
    const activeSource = media.src;
    complete(); await tick(); hook = render();
    assert.equal(media.src, activeSource, 'Late cancelled audio cannot replace the current track');
    hook.preview('word'); await tick(); hook = render();
    assert.equal(requests.at(-1).text, 'word');
    media.onended(); hook = render();
    assert.equal(hook.state, 'paused');
    failFetch = true;
    hook.preview('fallback word'); await tick(); hook = render();
    assert.equal(spoken.at(-1).text, 'fallback word');
    assert.equal(spoken.at(-1).lang, 'en-US'); assert.equal(spoken.at(-1).rate, 0.9);
    spoken.at(-1).onend(); hook = render(); assert.equal(hook.state, 'paused');
    hook.changeSpeed(1.1); hook.playAt(1); await tick(); hook = render();
    assert.equal(spoken.at(-1).text, 'Two.');
    spoken.at(-1).onend(); hook = render(); assert.equal(hook.index, 2);
    const stale = spoken.at(-1); hook.pause(); stale.onend(); hook = render();
    assert.equal(hook.state, 'paused', 'Cancelled browser speech cannot advance playback');
    failFetch = false;
    const beforeRetry = requests.length, beforeSpeech = spoken.length;
    await hook.toggle(); hook = render();
    assert.equal(requests.length, beforeRetry + 1, 'A new tap retries TTS after service fallback');
    assert.equal(hook.state, 'playing'); assert.equal(spoken.length, beforeSpeech);
    hook.pause(); rejectPlay = true; await hook.toggle(); hook = render();
    assert.equal(spoken.length, beforeSpeech, 'Blocked Audio.play must not switch to native speech');
    assert.equal(hook.state, 'paused'); assert.ok(hook.error);
    const timer = globalThis.setTimeout;
    try {
      globalThis.setTimeout=(fn,ms,...args)=>timer(fn,ms===8000 ? 1 : ms,...args);
      hangFetch=true; hook.preview('timeout fallback'); await tick(); hook=render();
      assert.equal(spoken.at(-1).text,'timeout fallback');
      assert.notEqual(hook.state,'loading','Timeout releases the loading button');
      spoken.at(-1).onend(); hook=render(); assert.equal(hook.state,'paused');
    } finally { globalThis.setTimeout=timer; }
    for (const cleanup of cleanups) cleanup?.();
    assert.equal(media.paused, true); assert.equal(media.src, ''); assert.equal(media.ontimeupdate, null);
    for (const action of ['play', 'pause', 'previoustrack', 'nexttrack']) assert.equal(actions.get(action), null);
    assert.equal(session.metadata, null);
  } finally {
    for (const cleanup of cleanups) cleanup?.();
    for (const key of keys) { if (originals[key]) Object.defineProperty(globalThis, key, originals[key]); else delete globalThis[key]; }
  }
});
