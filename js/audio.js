/* Sound + voice. Recorded SFX come from js/sfx-data.js (base64, so they load from file:// without fetch);
   any sound without a clip falls back to the synth below. Narration uses the browser voice. */
(function (SB) {
  'use strict';
  let ctx = null, on = true, unlocked = false;
  function ac() { if (!unlocked) return null; if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); decodeClips(); } catch (e) {} } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }

  /* ---------- recorded clips ---------- */
  const CLIPS = window.SFX_DATA || {}, buffers = {};
  const LEVEL = { click: 0.35, inflate: 0.7, hook: 0.7, release: 0.6, drop: 0.7, splash: 0.75, bump: 0.6, gull: 0.5, whoosh: 0.5,
    pair: 0.6, gate: 0.7, coin: 0.5, star: 0.7, win: 0.8 };
  const VARY = { click: 0.06, inflate: 0.08, hook: 0.06, release: 0.06, drop: 0.06, pair: 0.03, coin: 0.04, bump: 0.05 };   // pitch jitter so repeats don't sound robotic
  function decodeClips() {
    Object.entries(CLIPS).forEach(([name, uri]) => {
      try {
        const bin = atob(uri.slice(uri.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const done = b => { buffers[name] = b; }, fail = () => {};
        const p = ctx.decodeAudioData(bytes.buffer, done, fail);
        if (p && p.catch) p.catch(fail);
      } catch (e) {}
    });
  }
  function clip(name) {
    const b = buffers[name], c = ac(); if (!b || !c) return false;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; s.playbackRate.value = 1 + (Math.random() * 2 - 1) * (VARY[name] || 0);
    g.gain.value = LEVEL[name] ?? 0.7;
    s.connect(g).connect(c.destination); s.start();
    return true;
  }
  function tone(f, d, type = 'sine', v = 0.12, w = 0, f2 = null) {
    const c = ac(); if (!c || !on) return; const t = c.currentTime + w;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, v = 0.12, w = 0, hp = 600) {
    const c = ac(); if (!c || !on) return; const t = c.currentTime + w;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = v; s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  const SFX = {
    click: () => tone(660, 0.06, 'triangle', 0.1),
    inflate: () => tone(300, 0.25, 'sine', 0.12, 0, 900),
    hook: () => { tone(220, 0.1, 'triangle', 0.12); noise(0.05, 0.08, 0, 2000); },
    cut: () => { noise(0.08, 0.14, 0, 3000); tone(900, 0.08, 'square', 0.04); },
    drop: () => tone(500, 0.35, 'sine', 0.08, 0, 150),
    splash: () => { noise(0.4, 0.16, 0, 500); },
    pair: () => { tone(523, 0.12, 'triangle', 0.1); tone(784, 0.18, 'triangle', 0.1, 0.08); },
    gate: () => [659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.11, i * 0.08)),
    bump: () => tone(160, 0.2, 'square', 0.06, 0, 90),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, i * 0.11)),
    gull: () => tone(1400, 0.12, 'sawtooth', 0.04, 0, 900),
    pop: () => { noise(0.06, 0.18, 0, 1500); tone(900, 0.08, 'triangle', 0.08, 0, 300); },
    release: () => tone(400, 0.5, 'sine', 0.08, 0, 1200),
    coin: () => { tone(1318, 0.08, 'square', 0.05); tone(1760, 0.14, 'square', 0.05, 0.07); },
    whoosh: () => noise(0.35, 0.08, 0, 900),
    star: () => tone(880, 0.25, 'triangle', 0.1, 0, 1760)
  };
  /* ---------- voice: recorded Gemini lines, browser voice for anything not recorded (or not loaded yet) ----------
     js/voice-lines.js maps each line to a clip id; the clips themselves sit in 16 packs
     (assets/audio/voice-pack/vo-<first hex digit of id>.js) loaded with <script> tags, so they work from file:// too. */
  const LINES = window.VOICE_LINES || {}, voData = {}, packs = {};
  window.SB_VOICE_PACK = (k, map) => { Object.assign(voData, map); packs[k] = 'ready'; };
  function loadPack(k) {
    if (packs[k]) return;
    packs[k] = 'loading';
    const s = document.createElement('script'); s.src = 'assets/audio/voice-pack/vo-' + k + '.js'; s.async = true;
    s.onerror = () => { packs[k] = 'missing'; };
    document.head.appendChild(s);
  }
  function loadAllPacks() { new Set(Object.values(LINES).map(id => id[0])).forEach(loadPack); }
  let clipVo = null;
  function stopClip() { if (clipVo) { clipVo.onerror = null; clipVo.pause(); clipVo = null; } }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    voice = voice || pickVoice();
    const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.rate = 1; u.pitch = 1.08;
    speechSynthesis.speak(u);
  }
  let voice = null;
  function pickVoice() {
    const vs = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
    for (const p of ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Google UK English Female']) { const v = vs.find(v => v.name.includes(p)); if (v) return v; }
    return vs.find(v => /^en[-_]/i.test(v.lang)) || null;
  }
  SB.audio = {
    unlock() { unlocked = true; ac(); loadAllPacks(); },
    play(n) { if (!on) return; if (!clip(n) && SFX[n]) SFX[n](); },
    toggle() { on = !on; if (!on) SB.audio.stopVoice(); return on; },
    get on() { return on; },
    say(text, { interrupt = true } = {}) {
      if (!on || !text) return;
      if (interrupt) SB.audio.stopVoice();
      const id = LINES[text], uri = id && voData[id];
      if (!uri) { if (id) loadPack(id[0]); return speak(text); }
      const a = clipVo = new Audio(uri);
      a.onerror = () => { if (clipVo === a) { clipVo = null; speak(text); } };   // missing file: fall back to the browser voice
      a.play().catch(() => {});
    },
    stopVoice() { stopClip(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  };
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
})(window.SB);
