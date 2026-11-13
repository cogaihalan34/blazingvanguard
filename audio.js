'use strict';
/* audio.js — music tracks (Main Heroine for the field, Dungeon for the Upside Down) streamed through WebAudio for crossfades/ducking,
   synthesized SFX, environment ambience (rain, wind, night insects, day birds, void drone + heartbeat, thunder),
   and Japanese battle voice-over for Lyn (strong, feminine) and Hector (deep, fierce) through the browser's speech voices. */
const AUDIO = (() => {
  let ctx = null, master, musicBus, sfxBus, ambBus, verb, started = false, muted = false, timer = null;
  try { muted = localStorage.getItem('bv-muted') === '1'; } catch (e) { }
  const N = (name) => { const m = /^([A-G])(#|b)?(\d)$/.exec(name); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (base + (+m[3] - 4) * 12 - 9) / 12); };
  function impulse(sec, decay) { const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  let noiseBuf = null;
  function noise(loop) { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s; }

  /* ---------- music: two looping <audio> streams with crossfade ---------- */
  const TRACKS = { normal: 'audio/main_heroine.mp3', void: 'audio/dungeon.mp3', title: 'audio/title.mp3?v=2' };
  const MUSIC_VOL = { normal: .62, void: .7, title: .75 };
  const tracks = {}; let world = 'title', duck = 1;
  function makeTrack(key) {
    const el = new Audio(); el.src = TRACKS[key]; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    const g = ctx.createGain(); g.gain.value = 0; let src = null;
    try { src = ctx.createMediaElementSource(el); src.connect(g); g.connect(musicBus); } catch (e) { src = null; }
    const t = { el, g, ok: true, playing: false };
    el.addEventListener('error', () => { t.ok = false; if (key === 'normal') startSynth(); });
    return t;
  }
  function playTrack(key, fade = 1.2) {
    for (const [k, t] of Object.entries(tracks)) {
      const on = k === key;
      if (on && !t.playing) { t.playing = true; const p = t.el.play(); if (p && p.catch) p.catch(() => { t.playing = false; }); }
      t.g.gain.setTargetAtTime(on ? MUSIC_VOL[k] : 0, ctx.currentTime, fade / 3);
      if (!on && t.playing) { const tt = t; setTimeout(() => { if (world !== k) { tt.el.pause(); tt.playing = false; if (k === 'void') tt.el.currentTime = 0; } }, fade * 1000 + 200); }
    }
  }
  /* fallback synth waltz if the music files cannot be loaded (e.g. opened from file://) */
  let synthOn = false, nextT = 0, step = 0;
  const BEAT = 60 / 92;
  const CH = { Am: ['A2', 'C4', 'E4'], F: ['F2', 'A3', 'C4'], G: ['G2', 'B3', 'D4'], Em: ['E2', 'G3', 'B3'], Dm: ['D2', 'F3', 'A3'], E: ['E2', 'G#3', 'B3'], C: ['C2', 'E3', 'G3'] };
  const PROG = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'Dm', 'E'];
  const MEL = [[['E5', 2], ['D5', .5], ['C5', .5]], [['C5', 1], ['A4', 1], ['C5', 1]], [['D5', 1.5], ['E5', .5], ['D5', 1]], [['B4', 3]], [['E5', 1], ['A5', 1.5], ['G5', .5]], [['F5', 1], ['E5', 1], ['C5', 1]], [['D5', 1], ['F5', 1], ['A5', 1]], [['G#5', 2], ['B4', 1]]];
  function tone(f, t, len, type, vol, dest) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .03); g.gain.linearRampToValueAtTime(0, t + len); o.connect(g); g.connect(dest || musicBus); o.start(t); o.stop(t + len + .05); }
  function startSynth() { if (synthOn || !ctx) return; synthOn = true; nextT = ctx.currentTime + .1; }
  function synthPump() {
    if (!synthOn || world !== 'normal') return;
    while (nextT < ctx.currentTime + 1.2) {
      const ch = CH[PROG[step]]; tone(N(ch[0]), nextT, BEAT * 3, 'triangle', .12);
      ch.slice(1).forEach((n, k) => tone(N(n), nextT + (k + 1) * BEAT / 2, BEAT, 'triangle', .05));
      let bt = 0; for (const [n, b] of MEL[step]) { tone(N(n), nextT + bt * BEAT, b * BEAT * .95, 'triangle', .13); bt += b; }
      nextT += BEAT * 3; step = (step + 1) % PROG.length;
    }
  }

  /* ---------- environment ambience ---------- */
  const env = { rain: 0, wind: 0, night: 0, void: 0 };
  let amb = null;
  function buildAmbience() {
    amb = {};
    // rain: filtered noise bed
    { const s = noise(true), lp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 2600; hp.type = 'highpass'; hp.frequency.value = 350; g.gain.value = 0;
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(ambBus); s.start(); amb.rain = g; }
    // wind: band-passed noise swept by a slow LFO, plus a faint howl
    { const s = noise(true), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = .9; lfo.frequency.value = .13; lg.gain.value = 300; lfo.connect(lg); lg.connect(bp.frequency);
      g.gain.value = 0; s.connect(bp); bp.connect(g); g.connect(ambBus); s.start(); lfo.start(); amb.wind = g;
      const o = ctx.createOscillator(), og = ctx.createGain(), ol = ctx.createOscillator(), olg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 210; ol.frequency.value = .21; olg.gain.value = 60; ol.connect(olg); olg.connect(o.frequency);
      og.gain.value = 0; o.connect(og); og.connect(ambBus); o.start(); ol.start(); amb.howl = og; }
    // void: detuned low drone through a dark filter
    { const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; g.gain.value = 0;
      for (const f of [55, 58.3, 82.4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
      const s = noise(true), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 180; bp.Q.value = 2; const ng = ctx.createGain(); ng.gain.value = .5; s.connect(bp); bp.connect(ng); ng.connect(lp); s.start();
      lp.connect(g); g.connect(ambBus); amb.void = g; }
    amb.nextChirp = 0; amb.nextBird = 0; amb.nextBeat = 0; amb.nextDrip = 0;
  }
  function setEnv(o) {
    Object.assign(env, o);
    if (!amb || !ctx) return;
    const t = ctx.currentTime;
    amb.rain.gain.setTargetAtTime(env.rain * .32, t, .8);
    amb.wind.gain.setTargetAtTime(env.wind * .42 + env.rain * .05, t, .8);
    amb.howl.gain.setTargetAtTime(env.wind * .018, t, 1.2);
    amb.void.gain.setTargetAtTime(env.void * .1, t, .8);
  }
  function chirp(f0, f1, t, len, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + len); o.connect(g); g.connect(ambBus); o.start(t); o.stop(t + len + .02); }
  function ambiencePump() {
    if (!amb) return; const t = ctx.currentTime;
    if (env.void < .5) {
      if (env.night > .5 && t > amb.nextChirp) { const base = rnd(4000, 4600); for (let i = 0; i < 4; i++) chirp(base, base * .98, t + i * .07, .05, .018 * env.night); amb.nextChirp = t + rnd(.8, 2.4); }
      if (env.night < .35 && env.rain < .3 && t > amb.nextBird) { const f = rnd(2200, 3400); chirp(f, f * 1.4, t, .09, .02); chirp(f * 1.3, f * .9, t + .12, .12, .018); if (Math.random() < .5) chirp(f * 1.1, f * 1.5, t + .3, .08, .015); amb.nextBird = t + rnd(3, 8); }
      if (env.rain > .3 && t > amb.nextDrip) { chirp(rnd(900, 1800), rnd(400, 700), t, .05, .03 * env.rain); amb.nextDrip = t + rnd(.05, .3); }
    } else if (t > amb.nextBeat) { thump(t, 52, .32, .2); thump(t + .22, 46, .24, .22); amb.nextBeat = t + 1.45; }
  }
  /* ---------- init / pump ---------- */
  function init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
    verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 2.4);
    const wet = ctx.createGain(); wet.gain.value = .25; verb.connect(wet); wet.connect(master);
    tracks.normal = makeTrack('normal'); tracks.void = makeTrack('void'); tracks.title = makeTrack('title');
    buildAmbience();
    return true;
  }
  function pump() { if (!ctx) return; synthPump(); ambiencePump(); }
  function setWorld(w) { world = w; if (started) playTrack(w, w === 'void' ? 1.6 : w === 'title' ? .6 : 2.4); setEnv({ void: w === 'void' ? 1 : 0 }); }

  /* ---------- sound effects ---------- */
  const last = {};
  const gate = (k, ms) => { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; };
  function blip(f0, f1, t, len, type = 'square', vol = .08, dest = sfxBus) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + len); o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .05); }
  function whoosh(t, len = .18, f0 = 900, f1 = 3200, vol = .22) { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + len); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + len * .35); g.gain.linearRampToValueAtTime(0, t + len); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + len + .02); }
  function thump(t, f = 120, vol = .35, len = .16, dest) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f * .6, t + len); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len); o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + len + .02); }
  function crack(t, vol = .2, len = .07, hp = 1800) { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + len + .02); }
  /* metallic FM bell: inharmonic partial with a fast-decaying index, gives the bright "shing" of fantasy hits */
  function bell(t, f, vol = .1, dec = .45, ratio = 1.414, idx = 3, dest) {
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.frequency.value = f; m.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * idx, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + dec);
    m.connect(mg); mg.connect(c.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(.0005, t + dec);
    c.connect(g); g.connect(dest || sfxBus); const w = ctx.createGain(); w.gain.value = .35; g.connect(w); w.connect(verb);
    c.start(t); m.start(t); c.stop(t + dec + .05); m.stop(t + dec + .05);
  }
  /* very short bright transient: the "đanh" crack at the front of every impact */
  function snap(t, vol = .3, hp = 2600, len = .035) {
    const s = noise(), f = ctx.createBiquadFilter(), p = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = hp; p.type = 'peaking'; p.frequency.value = 5200; p.gain.value = 10; p.Q.value = 1.2;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
    s.connect(f); f.connect(p); p.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + len + .01);
  }
  function sparkle(t, n = 5, base = 2600, vol = .035) { for (let i = 0; i < n; i++) bell(t + i * .035 + Math.random() * .02, base * (1 + Math.random() * .9), vol, .3, 2.76, 1.2); }
  const can = () => ctx && started && !muted;
  const SFX = {
    swing(heavy) { if (!can() || !gate('sw', 70)) return; const t = ctx.currentTime; whoosh(t, heavy ? .2 : .12, heavy ? 1400 : 2400, heavy ? 6200 : 8000, heavy ? .3 : .22); if (heavy) bell(t + .05, 1800, .025, .2, 3.1, 1); },
    hit(heavy, crit) {
      if (!can() || !gate('hit', 40)) return; const t = ctx.currentTime;
      snap(t, heavy ? .42 : .3); bell(t, heavy ? 1250 : 1650 + Math.random() * 300, heavy ? .07 : .05, heavy ? .35 : .22, 1.414, heavy ? 4 : 3);
      thump(t, heavy ? 85 : 130, heavy ? .42 : .24, heavy ? .18 : .1);
      if (crit && gate('crit', 110)) { bell(t + .01, 2637, .09, .55, 2.0, 2); bell(t + .06, 3520, .06, .5, 2.0, 1.5); sparkle(t + .05, 4, 3200, .03); }
    },
    kill() { if (!can() || !gate('kill', 80)) return; const t = ctx.currentTime; snap(t, .25, 1800, .06); bell(t, 880, .05, .5, 1.5, 5); whoosh(t + .02, .3, 3000, 600, .12); },
    coin() { if (!can() || !gate('coin', 60)) return; const t = ctx.currentTime; bell(t, 1976, .045, .12, 3.0, .8); bell(t + .06, 2637, .05, .35, 3.0, .8); },
    hurt() { if (!can() || !gate('hurt', 120)) return; const t = ctx.currentTime; thump(t, 70, .45, .22); crack(t, .14, .1, 900); },
    block() { if (!can() || !gate('blk', 90)) return; const t = ctx.currentTime; snap(t, .35, 3000); bell(t, 2093, .1, .6, 1.0, .6); bell(t, 3136, .05, .45, 1.0, .4); },
    cast(ult) { if (!can()) return; const t = ctx.currentTime; const notes = ult ? ['A4', 'E5', 'A5', 'C#6', 'E6', 'A6'] : ['E5', 'B5', 'E6']; notes.forEach((n, i) => bell(t + i * .04, N(n), ult ? .07 : .05, ult ? 1.1 : .5, 2.0, 1.5)); sparkle(t + .1, ult ? 9 : 4, 2800, .03); whoosh(t, ult ? .5 : .25, 600, 9000, ult ? .3 : .18); if (ult) thump(t + .02, 55, .55, .7); },
    potion() { if (!can()) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) blip(500 + i * 180 + Math.random() * 80, 900 + i * 200, t + i * .05, .08, 'sine', .07); },
    tag() { if (!can()) return; const t = ctx.currentTime; whoosh(t, .3, 400, 4000, .22); blip(N('E5'), 0, t + .1, .3, 'triangle', .07); blip(N('A5'), 0, t + .18, .45, 'triangle', .07); },
    levelUp() { if (!can()) return; const t = ctx.currentTime; [['C5', 0], ['E5', .09], ['G5', .18], ['C6', .27], ['E6', .4], ['G6', .5], ['C7', .62]].forEach(([n, d], i) => bell(t + d, N(n), i > 4 ? .08 : .06, i === 6 ? 1.6 : .5, 2.0, 1.2)); [['C4', 0], ['G4', .27], ['C5', .62]].forEach(([n, d]) => blip(N(n), 0, t + d, .6, 'triangle', .08)); sparkle(t + .62, 10, 3000, .03); },
    loot(q) { if (!can() || !gate('loot', 150)) return; const t = ctx.currentTime; const seq = q === 'unique' || q === 'set' ? ['E6', 'G6', 'B6', 'E7'] : ['B5', 'E6']; seq.forEach((n, i) => blip(N(n), 0, t + i * .06, .35, 'sine', .05)); },
    boss() { if (!can()) return; const t = ctx.currentTime; thump(t, 40, .6, .9); thump(t + .35, 40, .5, .9); thump(t + .7, 60, .6, 1); blip(N('A3'), N('G#3'), t, 1.2, 'sawtooth', .04); },
    text() { if (!can() || !gate('txt', 55)) return; blip(rnd(900, 1100), 0, ctx.currentTime, .03, 'square', .012); },
    click() { if (!can() || !gate('clk', 40)) return; blip(1800, 1200, ctx.currentTime, .04, 'square', .025); },
    jump() { if (!can() || !gate('jmp', 120)) return; const t = ctx.currentTime; blip(320, 760, t, .14, 'square', .045); whoosh(t, .2, 600, 2200, .12); },
    land() { if (!can() || !gate('lnd', 120)) return; const t = ctx.currentTime; thump(t, 80, .3, .14); crack(t, .08, .06, 1200); },
    thunder() { if (!can()) return; const t = ctx.currentTime + rnd(.2, 1); const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 2.4); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + 2.8); s.connect(lp); lp.connect(g); g.connect(ambBus); s.start(t); s.stop(t + 3); thump(t, 34, .5, 1.6, ambBus); },
    portal() { if (!can()) return; const t = ctx.currentTime; for (let i = 0; i < 6; i++) blip(N('A3') * Math.pow(1.5, i % 3) * (i > 2 ? 2 : 1), N('A3') * .9, t + i * .09, .8, 'sine', .05); whoosh(t, 1.2, 200, 3000, .2); thump(t, 50, .4, 1.2); },
    qte() { if (!can()) return; const t = ctx.currentTime; blip(N('E6'), 0, t, .12, 'square', .06); blip(N('B6'), 0, t + .08, .3, 'square', .06); },
    rift() { if (!can()) return; const t = ctx.currentTime; whoosh(t, 1.4, 4000, 120, .4); thump(t + .2, 30, .7, 1.8); for (let i = 0; i < 8; i++) blip(rnd(80, 300), rnd(40, 90), t + i * .08, .5, 'sawtooth', .03); },
    victory() { if (!can()) return; const t = ctx.currentTime; [['C5', 0], ['C5', .16], ['C5', .32], ['C5', .5], ['G#4', .75], ['A#4', 1.0], ['C5', 1.25], ['A#4', 1.48], ['C5', 1.6]].forEach(([n, d], i) => blip(N(n), 0, t + d, i === 8 ? 1.1 : .15, 'square', .055)); },
  };

  /* ---------- Japanese voice-over (browser speech) ---------- */
  const LINES = {
    lyn: {
      skill: ['はぁっ！', '行くわよ！', '風よ、導いて！', '見切った！', 'そこよ！', '逃がさない！'],
      ult: ['サカの風よ、我が剣に宿れ！', 'これで終わりよ！', '覚悟しなさい！'],
      tag: ['任せて！', 'リン、参ります！', '私が相手よ！'], hurt: ['くっ…まだよ！', 'この程度で！'], level: ['もっと強くなれる！'],
      portal: ['あれは…異界の門！？'], secret: ['この気配…ただ者じゃないわ。'], win: ['草原の風が、私たちに味方したのね。'],
    },
    hector: {
      skill: ['うおおおっ！', '吹っ飛べ！', 'どりゃあああ！', '甘ぇんだよ！', 'おらぁっ！', '砕けろ！'],
      ult: ['オスティアの力、思い知れ！', 'まとめて叩き潰す！', 'これで決めるぜ！'],
      tag: ['俺の出番だな！', '下がってろ、俺がやる！'], hurt: ['ぐっ…効かねえよ！', 'やるじゃねえか…！'], level: ['へっ、まだまだ強くなるぜ！'],
      portal: ['面白ぇ、飛び込んでやる！'], secret: ['来やがれ、化け物！'], win: ['へっ、地獄の門番も大したことねえな！'],
    },
  };
  /* Lyn: lower than a girlish register, measured and firm. Hector: very low pitch, slower, plus a synthesized growl under the line. */
  const VOICE = {
    lyn: { pitch: 1.22, rate: 1.06, prefer: /Nanami|Mayu|Aoi|Haruka|Ayumi|Kyoko|Sayaka|Google 日本語|Female/i },
    hector: { pitch: .32, rate: .84, prefer: /Keita|Naoki|Daichi|Ichiro|Otoya|Hattori|Male/i, growl: true },
  };
  let voices = [], lastVo = 0;
  function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang)); } catch (e) { voices = []; } }
  if ('speechSynthesis' in window) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { } }
  function growl(dur) {
    if (!can()) return; const t = ctx.currentTime;
    const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain(), ws = ctx.createWaveShaper();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); } ws.curve = curve;
    lp.type = 'lowpass'; lp.frequency.value = 260; s.connect(lp); lp.connect(g);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(62, t); o.frequency.linearRampToValueAtTime(48, t + dur); o.connect(ws); ws.connect(og); og.connect(g);
    og.gain.value = .25; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .05); g.gain.setValueAtTime(.16, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(sfxBus); s.start(t); s.stop(t + dur + .05); o.start(t); o.stop(t + dur + .05);
  }
  function pickVoice(V) {
    const pref = voices.filter(v => V.prefer.test(v.name));
    return pref[0] || voices[0];
  }
  function say(hero, kind, force) {
    if (muted || !started || !('speechSynthesis' in window) || !voices.length) return;
    const now = performance.now(); if (!force && now - lastVo < 4500) return;
    const L = LINES[hero] && LINES[hero][kind]; if (!L) return;
    lastVo = now;
    try {
      const V = VOICE[hero], text = L[Math.random() * L.length | 0], u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.voice = pickVoice(V); u.pitch = V.pitch; u.rate = V.rate; u.volume = 1;
      u.onstart = () => { if (ctx) musicBus.gain.setTargetAtTime(.4, ctx.currentTime, .05); if (V.growl) growl(Math.min(1.4, .18 * text.length)); };
      u.onend = () => { if (ctx) musicBus.gain.setTargetAtTime(1, ctx.currentTime, .3); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { }
  }
  function start() {
    if (started) return;
    if (!ctx && !init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
    playTrack(world, .8);
    timer = setInterval(pump, 200);
    setEnv({});
    loadVoices();
  }
  function setMuted(m) {
    muted = m; try { localStorage.setItem('bv-muted', m ? '1' : '0'); } catch (e) { }
    if (ctx) master.gain.setTargetAtTime(m ? 0 : .9, ctx.currentTime, .05);
    if (m && 'speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) { }
  }
  const unlock = () => { start(); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); for (const t of Object.values(tracks)) if (t.playing) t.el.pause(); }
    else if (started) { ctx.resume(); const t = tracks[world]; if (t && t.playing) t.el.play().catch(() => null); }
  });
  return { SFX, say, start, setMuted, setWorld, setEnv, get muted() { return muted; }, get started() { return started; }, get hasVoice() { return voices.length > 0; } };
})();
const SFX = AUDIO.SFX;
