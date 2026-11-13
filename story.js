'use strict';
/* story.js — FE: Three Houses–style dialogue events (blue theme) with animated portraits,
   counting quests (HUD shortcut + quest-log modal), and the extra HUD bits: rift QTE, rift transition, Skirmish banner, time/weather label. */

/* =========================================================================
   CAST & CONVERSATIONS
   ========================================================================= */
const CAST = {
  lyn: { name: 'Lyn', port: 'sprites/port/lyn.webp', col: '#3fbf6a' },
  hector: { name: 'Hector', port: 'sprites/port/hector.webp', col: '#4a74e0' },
  gilbert: { name: 'Gilbert', port: 'sprites/port/gilbert.webp', col: '#9ab0c8' },
  shamir: { name: 'Shamir', port: 'sprites/port/shamir.webp', col: '#3a8a86' },
  hubert: { name: 'Hubert', port: 'sprites/port/hubert.webp', col: '#7a6aa0' },
};
const CONVOS = {
  start: [
    [['lyn', 'The wind is restless today, Hector. Bandits are gathering on the plains.'], ['hector', 'Good. I was getting bored of marching. Let them come!'], ['gilbert', 'Stay sharp, my lords. Their numbers grow with every league we take.']],
  ],
  boss: [
    [['hector', 'That brute up ahead... that has to be their chief.'], ['lyn', 'Batta. He burned my people\'s camp. I won\'t let him walk away.'], ['hector', 'Then let\'s make it quick. I\'ll take the front.']],
    [['gilbert', 'A warlord approaches. Mind his reach, he swings like a storm.'], ['lyn', 'Understood. Hector, cover me!'], ['hector', 'Always.']],
  ],
  floor: [
    [['shamir', 'Area\'s clear. I counted the bodies, there\'s more of them deeper in.'], ['hector', 'Then we push deeper. Simple.'], ['shamir', 'Simple gets people killed. Watch your flanks.']],
    [['hubert', 'Kukuku... efficient work. The enemy\'s supply lines are already faltering.'], ['lyn', 'You\'ve been watching us this whole time?'], ['hubert', 'Watching is what I do best, Lady Lyndis.']],
  ],
  portal: [
    [['hubert', 'That tear in the air... a rift to the other side. Interesting.'], ['lyn', 'Something is calling from inside it. It feels cold.'], ['hector', 'Cold or not, I bet there\'s treasure in there. Let\'s jump in!']],
    [['shamir', 'A rift. Mercenaries talk about those. Most who enter don\'t come back.'], ['hector', '"Most." I like those odds.']],
  ],
  secret: [
    [['lyn', 'Everything is... upside down. The sky is bleeding.'], ['hubert', 'You stand in the reflection of our world. Its master will not welcome guests.'], ['hector', 'Then we\'ll introduce ourselves. Loudly.']],
  ],
  secretWin: [
    [['hector', 'Ha! Count of what, exactly? Count of zero, now!'], ['lyn', 'The rift is closing. We should go before it seals us in.'], ['hubert', 'Do bring me a souvenir next time. Kukuku...']],
  ],
  night: [
    [['lyn', 'Night falls. On the plains, my father taught me to read the stars.'], ['hector', 'I only read one thing at night: the enemy sneaking up on us.'], ['lyn', 'Then read carefully. They\'re here.']],
    [['gilbert', 'Darkness favors ambushers. Keep your torches low and your blades high.']],
  ],
  day: [
    [['hector', 'Sun\'s up! Finally I can see who I\'m hitting.'], ['lyn', 'You never needed to see them before.']],
  ],
  rain: [
    [['shamir', 'Rain. Good. Covers our footsteps, ruins their bowstrings.'], ['hector', 'Ruins my mood, too.']],
    [['lyn', 'The rain smells of the steppe. It feels like home.']],
  ],
  wind: [
    [['lyn', 'A gale from the west! Use it, Hector, strike with the wind at your back!'], ['hector', 'I\'ll strike with or without it!']],
  ],
  banter: [
    [['hector', 'Lyn, how many have you taken down?'], ['lyn', 'Enough that I stopped counting. You?'], ['hector', 'One more than you. Always one more.']],
    [['gilbert', 'Lord Hector, your form is sloppy. You overextend after every swing.'], ['hector', 'It works, doesn\'t it?'], ['gilbert', '...It does. That is what worries me.']],
    [['shamir', 'You fight well for nobles.'], ['lyn', 'I was a nomad before I was a noble.'], ['shamir', 'That explains it.']],
    [['hubert', 'Each victory brings our enemies closer to despair. Delightful.'], ['lyn', 'Do you ever say anything that isn\'t unsettling?'], ['hubert', 'Rarely.']],
    [['lyn', 'Hector, your axe is chipped.'], ['hector', 'It\'s seen worse. So have I.']],
    [['gilbert', 'Supplies are holding. Keep the pace, but don\'t let the vanguard thin out.']],
  ],
};

/* =========================================================================
   DIALOGUE PLAYER
   ========================================================================= */
const STORY = {
  queue: [], cur: null, idx: 0, chars: 0, hold: 0, nextBanter: rnd(70, 110), used: {}, flags: {}, lastNight: null, lastWeather: 'clear', envT: 0,
  init() {
    const d = $('dlg');
    d.addEventListener('click', () => this.advance());
    later(2.5, () => this.trigger('start'));
  },
  trigger(kind, force) {
    const pool = CONVOS[kind]; if (!pool) return;
    if (!force && this.used[kind] && G.time - this.used[kind] < 90) return;
    if (this.cur && !force) { if (this.queue.length < 2 && kind !== 'banter') this.queue.push(kind); return; }
    this.used[kind] = G.time;
    this.play(pool[Math.random() * pool.length | 0]);
  },
  play(lines) { this.cur = lines; this.idx = -1; this.next(); $('dlg').hidden = false; uiEl.classList.add('dlgon'); requestAnimationFrame(() => $('dlg').classList.add('on')); },
  next() {
    this.idx++;
    if (!this.cur || this.idx >= this.cur.length) { this.close(); return; }
    const [who, text] = this.cur[this.idx], C = CAST[who];
    const d = $('dlg');
    $('dlgName').textContent = C.name; $('dlgText').textContent = '';
    const img = $('dlgPort');
    if (img.dataset.who !== who) { img.dataset.who = who; img.src = C.port; d.classList.remove('swap'); void d.offsetWidth; d.classList.add('swap'); }
    d.style.setProperty('--who', C.col);
    this.text = text; this.chars = 0; this.hold = 0; d.classList.add('talk');
  },
  advance() { if (!this.cur) return; if (this.chars < this.text.length) { this.chars = this.text.length; $('dlgText').textContent = this.text; } else this.next(); },
  close() {
    this.cur = null; const d = $('dlg'); d.classList.remove('on', 'talk'); uiEl.classList.remove('dlgon');
    setTimeout(() => { if (!this.cur) d.hidden = true; }, 350);
    if (this.queue.length) { const k = this.queue.shift(); setTimeout(() => this.trigger(k, true), 900); }
  },
  tick(real) {
    if (this.cur) {
      if (this.chars < this.text.length) {
        const before = this.chars | 0; this.chars = Math.min(this.text.length, this.chars + real * 42);
        if ((this.chars | 0) !== before) { $('dlgText').textContent = this.text.slice(0, this.chars | 0); if ((this.chars | 0) % 3 === 0) SFX.text && SFX.text(); }
        if (this.chars >= this.text.length) $('dlg').classList.remove('talk');
      } else { this.hold += real; if (this.hold > Math.max(2.4, this.text.length * .05)) this.next(); }
    }
    // environment-driven chatter
    this.envT -= real;
    if (this.envT <= 0) {
      this.envT = 1;
      $('envTxt').textContent = ENV.label;
      if (!G.secret) {
        const night = nightFactor(G.playtime || 0) > .75;
        if (this.lastNight !== null && night !== this.lastNight) this.trigger(night ? 'night' : 'day');
        this.lastNight = night;
        if (ENV.weather !== this.lastWeather && ENV.weather !== 'clear') this.trigger(ENV.weather);
        this.lastWeather = ENV.weather;
      }
    }
    if (!this.cur && !G.secret && !G.boss) { this.nextBanter -= real; if (this.nextBanter <= 0) { this.nextBanter = rnd(80, 140); this.trigger('banter'); } }
  },
};

/* =========================================================================
   QUESTS — simple counters; 6 in the log, the top 2 pinned on the HUD
   ========================================================================= */
const QUEST_MOBS = { brigand: 'Brigands', soldier: 'Soldiers', assassin: 'Assassins', shade: 'Black Fang Shades', revenant: 'Revenants', gwyllgi: 'Gwyllgi', mogall: 'Mogall', maelduin: 'Maelduin' };
const QUESTS = {
  log: [], done: 0, seq: 1, hudKey: '',
  init() { if (!this.log.length) for (let i = 0; i < 6; i++) this.log.push(this.make()); this.render(); },
  save() { return { log: this.log, done: this.done, seq: this.seq }; },
  load(d) { if (!d) return; this.log = (d.log || []).filter(q => q && q.type); this.done = d.done || 0; this.seq = d.seq || 1; },
  make() {
    const f = G.floor, opts = [];
    const mobs = Object.keys(QUEST_MOBS).filter(k => ENEMY_DEFS[k] && ENEMY_DEFS[k].floor <= Math.max(f, 1) + 1 && SPINE_MOBS.includes(k));
    for (const k of mobs) opts.push({ w: 3, type: 'killKey', key: k, n: 10 + ri(2, 5) * 5 });
    opts.push({ w: 3, type: 'kill', n: 30 + ri(2, 8) * 10 });
    opts.push({ w: 2, type: 'elite', n: ri(3, 6) });
    opts.push({ w: 2, type: 'crit', n: 15 + ri(1, 5) * 5 });
    opts.push({ w: 1.5, type: 'gold', n: Math.round((150 + f * 120) / 50) * 50 });
    opts.push({ w: 1, type: 'boss', n: 1 });
    opts.push({ w: 1, type: 'rift', n: 1 });
    opts.push({ w: .8, type: 'floor', n: f + ri(1, 2) });
    const busy = new Set(this.log.map(q => q.type + (q.key || '')));
    const pool = opts.filter(o => !busy.has(o.type + (o.key || '')));
    let tot = pool.reduce((s, o) => s + o.w, 0), r = Math.random() * tot, o = pool[0];
    for (const p of pool) { r -= p.w; if (r <= 0) { o = p; break; } }
    const big = o.type === 'boss' || o.type === 'rift' || o.type === 'floor';
    const q = { id: this.seq++, type: o.type, key: o.key, n: o.n, prog: o.type === 'floor' ? f : 0,
      reward: { xp: big ? .6 : .25 + Math.random() * .2, gems: big ? ri(30, 50) : ri(8, 20), item: big ? 'rare' : Math.random() < .5 ? 'magic' : null } };
    return q;
  },
  title(q) {
    switch (q.type) {
      case 'killKey': return [`Hunt: ${QUEST_MOBS[q.key]}`, `Defeat ${q.n} ${QUEST_MOBS[q.key]}`];
      case 'kill': return ['Vanguard Duty', `Defeat ${q.n} enemies`];
      case 'elite': return ['Champion Slayer', `Defeat ${q.n} elite enemies`];
      case 'crit': return ['Critical Edge', `Land ${q.n} critical hits`];
      case 'gold': return ['War Chest', `Collect ${fmt(q.n)} gold`];
      case 'boss': return ['Warlord\'s Bane', 'Defeat a boss'];
      case 'rift': return ['Into the Upside Down', 'Enter a rift and defeat its master'];
      case 'floor': return ['March Onward', `Reach floor ${q.n}`];
    }
    return ['Quest', ''];
  },
  bump(q, v) {
    if (q.prog >= q.n) return;
    q.prog = q.type === 'floor' ? Math.max(q.prog, v) : Math.min(q.n, q.prog + v);
    if (q.prog >= q.n) this.complete(q); else this.dirty = true;
  },
  event(type, v = 1, key) {
    for (const q of this.log.slice()) {
      if (q.type === type && (!q.key || q.key === key)) this.bump(q, v);
      if (type === 'killKey' && q.type === 'kill') this.bump(q, v);
    }
  },
  onKill(e, kind) {
    if (kind === 'boss') { this.event('boss'); if (G.secret) this.event('rift'); return; }
    this.event('killKey', 1, e.key);
    if (kind === 'elite') this.event('elite');
  },
  complete(q) {
    const [t] = this.title(q);
    // rewards: share of a level's experience for both heroes, gems, maybe an item
    for (const h of G.party) { const need = (XP_TABLE[Math.min(99, h.level + 1)] || h.xp) - XP_TABLE[h.level]; h.gainXp(Math.max(50, need * q.reward.xp)); }
    G.gems += q.reward.gems;
    if (q.reward.item) giveItem(rollItem(mlvlNow() + 2, G.hero.S.mf + (q.reward.item === 'rare' ? 250 : 120), q.reward.item === 'rare' ? 6 : 3), G.hero.x + 200, GROUND + 300);
    this.done++;
    SFX.levelUp(); UI.toast('QUEST COMPLETE', t.toUpperCase());
    q.finished = true; this.dirty = true; $('questDot').hidden = false;
    const el = document.querySelector(`#questHud [data-q="${q.id}"]`); if (el) el.classList.add('done');
    setTimeout(() => { const i = this.log.indexOf(q); if (i >= 0) { this.log.splice(i, 1); this.log.push(this.make()); } this.dirty = true; this.render(true); save(true); }, 1500);
  },
  tick() { if (this.dirty) { this.dirty = false; this.render(); } UI.limitRender(); },
  render(force) {
    const hud = $('questHud'); if (!hud) return;
    const top = this.log.slice(0, 2);
    const key = top.map(q => q.id + ':' + q.prog + (q.finished ? 'f' : '')).join('|');
    if (key !== this.hudKey || force) {
      this.hudKey = key;
      hud.querySelector('.ql').innerHTML = top.map(q => { const [t, d] = this.title(q); const p = q.type === 'floor' ? `${Math.min(q.prog, q.n)}/${q.n}` : `${fmt(q.prog)}/${fmt(q.n)}`;
        return `<div class="qi ${q.finished ? 'done' : ''}" data-q="${q.id}"><b>${esc(d)}</b><span>${p}</span><i style="width:${(100 * Math.min(1, q.prog / q.n)).toFixed(0)}%"></i></div>`; }).join('');
    }
    if (!$('questModal').hidden) this.renderModal();
  },
  renderModal() {
    const rows = this.log.map(q => {
      const [t, d] = this.title(q), k = Math.min(1, q.prog / q.n), r = q.reward;
      return `<div class="qrow ${q.finished ? 'done' : ''}"><div class="qt"><b>${esc(t)}</b><small>${esc(d)}</small></div>
        <div class="qbar"><i style="width:${(k * 100).toFixed(1)}%"></i><span>${q.type === 'floor' ? Math.min(q.prog, q.n) + ' / ' + q.n : fmt(q.prog) + ' / ' + fmt(q.n)}</span></div>
        <div class="qrw"><span class="chip">EXP ${Math.round(r.xp * 100)}%</span><span class="chip gem"><i class="ic gem"></i>${r.gems}</span>${r.item ? `<span class="chip ${r.item}">${r.item === 'rare' ? 'Rare item' : 'Magic item'}</span>` : ''}</div></div>`;
    }).join('');
    $('qmBody').innerHTML = rows + `<div class="qfoot">Quests completed <b>${this.done}</b> · new quests arrive as you finish old ones</div>`;
  },
  open() { $('questModal').hidden = false; this.renderModal(); },
  close() { $('questModal').hidden = true; },
};

/* =========================================================================
   HUD additions
   ========================================================================= */
Object.assign(UI, {
  limitRender(force) {
    const h = G.hero; if (!h) return;
    const k = Math.min(1, h.limit || 0), key = (k * 100 | 0) + (h.key);
    if (!force && key === this._lk) return; this._lk = key;
    const b = $('limitBtn'); b.style.setProperty('--fill', k.toFixed(3));
    if (b.dataset.who !== h.key) { b.dataset.who = h.key; $('limitIcon').src = 'sprites/crest_' + h.key + '.png'; b.classList.toggle('hector', h.key === 'hector'); }
    b.classList.toggle('ready', k >= 1); b.setAttribute('aria-label', k >= 1 ? 'Limit Break ready' : `Limit ${Math.round(k * 100)}%`);
    $('limitPct').textContent = k >= 1 ? 'READY' : Math.floor(k * 100) + '%';
  },
  limitReady(h) { if (G.hero === h) { SFX.qte(); this.toastSmall(h.cls.name + "'s Limit Break is ready!"); } },
  qteShow(on) {
    const q = $('qte'); q.hidden = !on;
    if (on) { SFX.qte(); q.classList.remove('pop'); void q.offsetWidth; q.classList.add('pop'); if (!this._seenPortal) { this._seenPortal = true; STORY.trigger('portal', true); } }
  },
  qteTick(k) { $('qte').style.setProperty('--k', k.toFixed(3)); },
  rift() { const r = $('rift'); r.classList.remove('on'); void r.offsetWidth; r.classList.add('on'); },
  banner(name) {
    const b = $('fbanner'); b.src = 'sprites/' + name + '.png'; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  },
});
const _initUI = UI.init.bind(UI);
UI.init = function () {
  _initUI();
  $('qte').addEventListener('click', () => { SFX.qte(); enterSecret(); QUESTS.event('riftEnter'); });
  $('questIcon').addEventListener('click', () => { QUESTS.open(); $('questDot').hidden = true; });
  $('limitBtn').addEventListener('click', () => { if (!limitBreak(G.hero) && G.hero.limit < 1) this.toastSmall('Limit gauge charges as you take damage'); });
  $('qmClose').addEventListener('click', () => QUESTS.close());
  $('questModal').addEventListener('click', (e) => { if (e.target.id === 'questModal') QUESTS.close(); });
};

/* =========================================================================
   TITLE SCREEN — key art, logo shimmer, "TAP TO START" (unlocks audio + title BGM) → "TAP TO PLAY"
   ========================================================================= */
const TITLE = {
  stage: 0,
  show() {
    G.title = true; AUDIO.setWorld('title');
    const t = $('title'); t.hidden = false; requestAnimationFrame(() => t.classList.add('in'));
    const go = (e) => {
      if (this.stage === 0) {
        this.stage = 1; AUDIO.start(); AUDIO.setWorld('title'); t.classList.add('armed');
        $('ttBtn').textContent = 'TAP TO PLAY'; $('ttHint').textContent = 'Lyn & Hector await your command';
        return;
      }
      if (this.stage === 1 && e.target.closest('#ttBtn, .tt-tap')) this.play();
    };
    t.addEventListener('click', go);
  },
  play() {
    if (this.stage !== 1) return; this.stage = 2;
    SFX.cast(true); const t = $('title'); t.classList.add('out');
    AUDIO.setWorld(G.secret ? 'void' : 'normal');
    setTimeout(() => { t.hidden = true; G.title = false; last = performance.now(); }, 900);
  },
};
