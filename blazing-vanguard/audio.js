'use strict';
/* audio.js — everything synthesized live with WebAudio (no audio files):
   BGM: a 3/4 medieval-fantasy waltz in A minor in the old-school JRPG manner (ocarina lead, harp arpeggios, string pad, bass),
   SFX: swings, hits, crits, kills, coins, level-up fanfare, potions, tag, loot,
   VO: short Japanese battle shouts for Lyn and Hector through the browser's Japanese speech voice (when the device has one). */
const AUDIO = (() => {
  let ctx = null, master, musicBus, sfxBus, verb, started = false, muted = false, nextT = 0, step = 0, loop = 0, timer = null;
  try { muted = localStorage.getItem('bv-muted') === '1'; } catch (e) { }
  const N = (name) => { // 'A4', 'G#5' → Hz
    const m = /^([A-G])(#|b)?(\d)$/.exec(name); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (base + (+m[3] - 4) * 12 - 9) / 12);
  };
  /* ---------- score: 16 bars of 3/4, 92 bpm ---------- */
  const BPM = 92, BEAT = 60 / BPM;
  const CH = { Am: ['A2', 'A3', 'C4', 'E4'], F: ['F2', 'F3', 'A3', 'C4'], G: ['G2', 'G3', 'B3', 'D4'], Em: ['E2', 'E3', 'G3', 'B3'], Dm: ['D2', 'D3', 'F3', 'A3'], E: ['E2', 'E3', 'G#3', 'B3'], C: ['C2', 'C3', 'E3', 'G3'] };
  const PROG = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'Dm', 'E', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E'];
  const MEL = [
    [['E5', 2], ['D5', .5], ['C5', .5]], [['C5', 1], ['A4', 1], ['C5', 1]], [['D5', 1.5], ['E5', .5], ['D5', 1]], [['B4', 3]],
    [['E5', 1], ['A5', 1.5], ['G5', .5]], [['F5', 1], ['E5', 1], ['C5', 1]], [['D5', 1], ['F5', 1], ['A5', 1]], [['G#5', 2], ['B4', 1]],
    [['A5', 1.5], ['G5', .5], ['F5', 1]], [['G5', 1], ['F5', .5], ['E5', .5], ['D5', 1]], [['E5', 1], ['B4', 1], ['E5', 1]], [['C5', 2], ['A4', 1]],
    [['F5', 1.5], ['E5', .5], ['D5', 1]], [['D5', 1], ['B4', 1], ['G4', 1]], [['C5', 1], ['E5', 1], ['G5', 1]], [['B4', 1.5], ['G#4', .5], ['B4', 1]],
  ];
  // counter-melody for every other pass (low strings answer)
  const CNT = [
    [['C4', 3]], [['A3', 3]], [['B3', 3]], [['G3', 1.5], ['B3', 1.5]], [['C4', 3]], [['A3', 1.5], ['C4', 1.5]], [['F3', 3]], [['E3', 1.5], ['G#3', 1.5]],
    [['C4', 3]], [['B3', 1.5], ['D4', 1.5]], [['G3', 3]], [['E3', 1.5], ['A3', 1.5]], [['A3', 3]], [['G3', 1.5], ['B3', 1.5]], [['E3', 1.5], ['G3', 1.5]], [['G#3', 3]],
  ];

  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  let noiseBuf = null;
  function noise() { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s; }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = .55; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(2.6, 2.4);
    const wet = ctx.createGain(); wet.gain.value = .32; verb.connect(wet); wet.connect(master);
    return true;
  }
  /* ---------- instruments ---------- */
  function env(g, t, a, peak, d, sus, rel, len) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.linearRampToValueAtTime(peak * sus, t + a + d);
    g.gain.setValueAtTime(peak * sus, t + Math.max(a + d, len)); g.gain.linearRampToValueAtTime(0, t + Math.max(a + d, len) + rel);
  }
  function voiceOut(node, dry, wet) { const g = ctx.createGain(); g.gain.value = dry; node.connect(g); g.connect(musicBus); const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(verb); }
  function ocarina(f, t, len, vol = .16) { // breathy lead: triangle + sine octave, delayed vibrato
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .009, t + Math.min(.35, len * .6)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const g2 = ctx.createGain(); g2.gain.value = .18; o2.connect(g2); g2.connect(g); o.connect(g);
    env(g, t, .04, vol, .12, .78, .18, len * .92);
    voiceOut(g, 1, .7);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + .5); }
  }
  function harp(f, t, vol = .07) {
    const o = ctx.createOscillator(), g = ctx.createGain(), flt = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; flt.type = 'lowpass'; flt.frequency.setValueAtTime(4200, t); flt.frequency.exponentialRampToValueAtTime(900, t + .6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0008, t + 1.3);
    o.connect(flt); flt.connect(g); voiceOut(g, .9, .6); o.start(t); o.stop(t + 1.4);
  }
  function pad(fs, t, len, vol = .028) {
    const g = ctx.createGain(), flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1300; flt.Q.value = .4;
    for (const f of fs) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(t); o.stop(t + len + .9); }
    flt.connect(g); env(g, t, .35, vol, .2, .85, .8, len); voiceOut(g, .8, .9);
  }
  function bass(f, t, len, vol = .14) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
    env(g, t, .02, vol, .2, .6, .15, len * .9); o.connect(g); voiceOut(g, 1, .15); o.start(t); o.stop(t + len + .3);
  }
  function strings(f, t, len, vol = .05) {
    const g = ctx.createGain(), flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1800;
    for (const det of [-8, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(flt); o.start(t); o.stop(t + len + .7); }
    flt.connect(g); env(g, t, .18, vol, .1, .9, .5, len); voiceOut(g, .8, .8);
  }
  function tamb(t, vol = .025) { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + .12); s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + .15); }
  function timpani(f, t, vol = .3) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + .08); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .9); o.connect(g); voiceOut(g, 1, .4); o.start(t); o.stop(t + 1); }

  /* ---------- sequencer: one bar at a time, scheduled ahead ---------- */
  function scheduleBar(i, t) {
    const chord = CH[PROG[i]], bar = BEAT * 3, odd = loop % 2 === 1, boss = typeof G !== 'undefined' && G.boss && !G.boss.dead;
    bass(N(chord[0]), t, bar);
    pad(chord.slice(1).map(N), t, bar);
    const arp = [chord[1], chord[2], chord[3], chord[2].replace(/\d/, d => +d + 1), chord[3], chord[2]];
    arp.forEach((n, k) => harp(N(n), t + k * BEAT / 2, k === 0 ? .085 : .06));
    let bt = 0;
    for (const [n, b] of MEL[i]) { ocarina(N(odd ? n.replace(/\d/, d => +d - 1) : n), t + bt * BEAT, b * BEAT, odd ? .13 : .16); bt += b; }
    if (odd) { bt = 0; for (const [n, b] of CNT[i]) { strings(N(n.replace(/\d/, d => +d + 1)), t + bt * BEAT, b * BEAT); bt += b; } }
    tamb(t + BEAT); tamb(t + BEAT * 2, .018);
    if (boss) { timpani(N(chord[0]), t); timpani(N(chord[0]), t + BEAT * 2, .18); }
  }
  function pump() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 1.2) {
      scheduleBar(step, nextT); nextT += BEAT * 3; step++;
      if (step >= PROG.length) { step = 0; loop++; }
    }
  }
  /* ---------- sound effects ---------- */
  const last = {};
  const gate = (k, ms) => { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };
  function blip(f0, f1, t, len, type = 'square', vol = .08, dest = sfxBus) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + len); o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .05);
  }
  function whoosh(t, len = .18, f0 = 900, f1 = 3200, vol = .22) {
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + len * .35); g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + len + .02);
  }
  function thump(t, f = 120, vol = .35, len = .16) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f * .6, t + len); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + len + .02); }
  function crack(t, vol = .2, len = .07, hp = 1800) { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + len + .02); }
  const can = () => ctx && started && !muted;
  const SFX = {
    swing(heavy) { if (!can() || !gate('sw', 70)) return; whoosh(ctx.currentTime, heavy ? .26 : .16, heavy ? 500 : 900, heavy ? 2400 : 3600, heavy ? .26 : .18); },
    hit(heavy, crit) {
      if (!can() || !gate('hit', 45)) return; const t = ctx.currentTime;
      crack(t, heavy ? .26 : .18); thump(t, heavy ? 90 : 140, heavy ? .4 : .26);
      if (crit && gate('crit', 120)) { blip(1760, 2640, t, .18, 'square', .05); blip(2637, 0, t + .05, .25, 'triangle', .06); }
    },
    kill() { if (!can() || !gate('kill', 80)) return; const t = ctx.currentTime; blip(520, 90, t, .28, 'square', .05); crack(t + .02, .12, .2, 600); },
    coin() { if (!can() || !gate('coin', 60)) return; const t = ctx.currentTime; blip(988, 0, t, .07, 'square', .04); blip(1319, 0, t + .065, .2, 'square', .04); },
    hurt() { if (!can() || !gate('hurt', 120)) return; const t = ctx.currentTime; thump(t, 70, .45, .22); crack(t, .14, .1, 900); },
    block() { if (!can() || !gate('blk', 90)) return; const t = ctx.currentTime; blip(1400, 1300, t, .25, 'triangle', .08); blip(2100, 1900, t, .2, 'sine', .05); crack(t, .1, .04, 3000); },
    cast(ult) {
      if (!can()) return; const t = ctx.currentTime;
      const notes = ult ? ['A4', 'C5', 'E5', 'A5', 'C6', 'E6'] : ['E5', 'A5', 'B5'];
      notes.forEach((n, i) => blip(N(n), 0, t + i * .045, ult ? .9 : .4, 'triangle', ult ? .07 : .05));
      whoosh(t, ult ? .5 : .28, 300, 5000, ult ? .3 : .18);
      if (ult) { thump(t + .02, 60, .5, .6); }
    },
    potion() { if (!can()) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) blip(500 + i * 180 + Math.random() * 80, 900 + i * 200, t + i * .05, .08, 'sine', .07); },
    tag() { if (!can()) return; const t = ctx.currentTime; whoosh(t, .3, 400, 4000, .22); blip(N('E5'), 0, t + .1, .3, 'triangle', .07); blip(N('A5'), 0, t + .18, .45, 'triangle', .07); },
    levelUp() {
      if (!can()) return; const t = ctx.currentTime;
      [['C5', 0], ['E5', .1], ['G5', .2], ['C6', .3], ['G5', .45], ['C6', .55]].forEach(([n, d], i) => blip(N(n), 0, t + d, i === 5 ? .7 : .14, 'square', .05));
      [['C4', 0], ['G4', .3], ['C5', .55]].forEach(([n, d]) => blip(N(n), 0, t + d, .5, 'triangle', .08));
    },
    loot(q) { if (!can() || !gate('loot', 150)) return; const t = ctx.currentTime; const seq = q === 'unique' || q === 'set' ? ['E6', 'G6', 'B6', 'E7'] : ['B5', 'E6']; seq.forEach((n, i) => blip(N(n), 0, t + i * .06, .35, 'sine', .05)); },
    boss() { if (!can()) return; const t = ctx.currentTime; timpani(N('A1'), t, .5); timpani(N('A1'), t + .35, .4); timpani(N('E2'), t + .7, .5); blip(N('A3'), N('G#3'), t, 1.2, 'sawtooth', .04); },
    click() { if (!can() || !gate('clk', 40)) return; blip(1800, 1200, ctx.currentTime, .04, 'square', .025); },
  };
  /* ---------- Japanese voice-over (speech synthesis) ---------- */
  const LINES = {
    lyn: { skill: ['はっ！', '行くわよ！', '風よ！', '見切った！', 'そこっ！'], ult: ['サカの風よ、我が剣に！', 'これで終わりよ！', '覚悟しなさい！'], tag: ['任せて！', 'リン、参ります！'], hurt: ['くっ…！'], level: ['まだまだ強くなれる！'] },
    hector: { skill: ['うおおっ！', '吹っ飛べ！', 'どりゃあ！', '甘いぜ！', 'おらぁ！'], ult: ['オスティアの力、見せてやる！', 'ぶっ潰す！', 'これで決めるぜ！'], tag: ['俺の出番だな！', '下がってろ！'], hurt: ['ぐっ…！'], level: ['へっ、腕が上がったぜ！'] },
  };
  const VOICE = { lyn: { pitch: 1.35, rate: 1.08, prefer: /Nanami|Haruka|Ayumi|Kyoko|O-ren|Google 日本語|Female/i }, hector: { pitch: .62, rate: 1.0, prefer: /Keita|Ichiro|Otoya|Hattori|Male/i } };
  let voices = [], lastVo = 0;
  function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang)); } catch (e) { voices = []; } }
  if ('speechSynthesis' in window) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { } }
  function say(hero, kind, force) {
    if (muted || !started || !('speechSynthesis' in window) || !voices.length) return;
    const now = performance.now(); if (!force && now - lastVo < 4500) return;
    const L = LINES[hero] && LINES[hero][kind]; if (!L) return;
    lastVo = now;
    try {
      const V = VOICE[hero], u = new SpeechSynthesisUtterance(L[Math.random() * L.length | 0]);
      u.lang = 'ja-JP'; u.voice = voices.find(v => V.prefer.test(v.name)) || voices[0]; u.pitch = V.pitch; u.rate = V.rate; u.volume = 1;
      if (ctx) { u.onstart = () => musicBus.gain.setTargetAtTime(.25, ctx.currentTime, .05); u.onend = () => musicBus.gain.setTargetAtTime(.55, ctx.currentTime, .3); }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { }
  }
  function start() {
    if (started) return;
    if (!ctx && !init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    started = true; nextT = ctx.currentTime + .1; step = 0; loop = 0;
    pump(); timer = setInterval(pump, 250);
    loadVoices();
  }
  function setMuted(m) {
    muted = m; try { localStorage.setItem('bv-muted', m ? '1' : '0'); } catch (e) { }
    if (ctx) master.gain.setTargetAtTime(m ? 0 : .9, ctx.currentTime, .05);
    if (m && 'speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) { }
  }
  // audio may only start after the viewer interacts
  const unlock = () => { start(); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (started) ctx.resume(); });
  return { SFX, say, start, setMuted, get muted() { return muted; }, get started() { return started; }, get hasVoice() { return voices.length > 0; } };
})();
const SFX = AUDIO.SFX;
