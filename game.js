'use strict';
/* game.js — two-lord tag battler (Fire Emblem sprites) with Diablo II items/attributes */

/* =========================================================================
   CONSTANTS & CLASSES
   ========================================================================= */
const VW = 1080;
const PANEL_UI = 352;
const PANEL_W = PANEL_UI * 2;
const GROUND = PANEL_W + 54;
const GRAV = 2700;
const HERO_SCALE = 0.58;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const XP_RATE = 6;
const TEMPO = 1.35;          // global combat tempo: animation speed multiplier for the heroes           // demo pacing multiplier on monster experience
const SAVE_KEY = 'blazing-vanguard-v1';

const CLASS = {
  lyn: {
    key: 'lyn', name: 'Lyn', title: 'Blade Lord of Sacae', color: '#3fbf6a',
    base: { str: 20, dex: 30, vit: 20, ene: 15 }, life: 48, mana: 14, lifeLvl: 2, manaLvl: 1.5, lifeVit: 3, manaEne: 1.5, arBase: 25, block: 20,
    dmgStat: 'dex', weapons: ['sword'], off: 'shield', auto: { str: 1, dex: 3, vit: 1, ene: 0 },
    combo: ['attack', 'attack_1', 'attack_2', 'attack_3'], comboMult: [.9, .95, 1.05, 1.7],
    skillNames: ['Sacaen Flurry', 'Gale Spin', 'Rising Crane', 'Mani Katti', 'Wind Cutter', 'Blade Dance', 'Lightning Strike', 'Sol Katti'],
    skillMult: [5, 4.5, 6, 7.5, 8, 7, 18, 24], skillCd: [4, 5, 6, 7, 8, 7, 16, 22], skillCost: [3, 4, 5, 7, 8, 6, 14, 20], skillReq: [1, 3, 6, 9, 12, 18, 24, 30],
    range: 170, start: [['ssd', 'normal'], ['buc', 'normal']],
    passives: [
      { n: 'Sword Mastery', d: '+8% damage and +25 Attack Rating per point', req: 1, st: l => ({ edmg: 8 * l, ar: 25 * l }) },
      { n: 'Astra', d: '+2% Deadly Strike per point', req: 6, st: l => ({ ds: 2 * l }) },
      { n: "Nomad's Grace", d: '+1.5% Damage Reduced and +3 All Resistances per point', req: 12, st: l => ({ dr: 1.5 * l, allres: 3 * l }) },
      { n: 'Swordfaire', d: '+3% Attack Speed and +2% Run speed per point', req: 24, st: l => ({ ias: 3 * l, frw: 2 * l }) },
    ],
  },
  hector: {
    key: 'hector', name: 'Hector', title: 'Axe Lord of Ostia', color: '#4a74e0',
    base: { str: 32, dex: 16, vit: 28, ene: 8 }, life: 60, mana: 10, lifeLvl: 2.5, manaLvl: 1, lifeVit: 4, manaEne: 1, arBase: 15, block: 30,
    dmgStat: 'str', weapons: ['scythe', 'sword'], off: 'shield', auto: { str: 2, dex: 1, vit: 2, ene: 0 },
    combo: ['attack', 'attack_1', 'attack_2'], comboMult: [1.05, 1.5, 1.2],
    skillNames: ['Hand Axe', 'Armads Cleave', 'Ostian Leap', 'Tomahawk Storm', 'Great Lord Swing', 'Pavise Charge', 'Wolf Beil', 'Armads Judgment'],
    skillMult: [5, 5, 7, 8, 9, 6, 18, 25], skillCd: [4, 5, 6, 7, 8, 7, 16, 22], skillCost: [3, 4, 5, 7, 8, 6, 14, 20], skillReq: [1, 3, 6, 9, 12, 18, 24, 30],
    range: 170, start: [['ssd', 'normal'], ['buc', 'normal']],
    passives: [
      { n: 'Axe Mastery', d: '+8% damage and +20 Attack Rating per point', req: 1, st: l => ({ edmg: 8 * l, ar: 20 * l }) },
      { n: 'Sol', d: '+0.6% Life Stolen per point', req: 6, st: l => ({ ll: Math.round(6 * l) / 10 }) },
      { n: 'Great Shield', d: '+5% maximum Life and +6% Armor per point', req: 12, st: l => ({ lifep: 5 * l, defp: 6 * l }) },
      { n: 'Berserk Blood', d: '+3% Attack Speed and +2% Run speed per point', req: 24, st: l => ({ ias: 3 * l, frw: 2 * l }) },
    ],
  },
  eliwood: {
    key: 'eliwood', name: 'Eliwood', title: 'Knight Lord of Pherae', color: '#d8404a',
    base: { str: 25, dex: 24, vit: 24, ene: 12 }, life: 54, mana: 12, lifeLvl: 2, manaLvl: 1.2, lifeVit: 3.5, manaEne: 1.2, arBase: 20, block: 25,
    dmgStat: 'str', weapons: ['scythe', 'sword'], off: 'shield', auto: { str: 2, dex: 1, vit: 2, ene: 0 },
    combo: ['attack', 'attack_1', 'attack_2', 'attack_3'], comboMult: [1.0, 1.0, 1.1, 1.6],
    skillNames: ['Lance Charge', 'Rapier Arc', 'Cavalier Leap', 'Pherae Feint', 'Galloping Thrust', 'Triple Pierce', 'Durandal', 'Blazing Blade'],
    skillMult: [5, 4.5, 6, 6.5, 8, 7, 18, 24], skillCd: [4, 5, 6, 6, 8, 7, 14, 20], skillCost: [3, 4, 5, 5, 7, 6, 12, 18], skillReq: [1, 3, 6, 9, 12, 18, 24, 30],
    range: 230, start: [['ssd', 'normal'], ['buc', 'normal']],
    passives: [
      { n: 'Lance Mastery', d: '+8% damage and +25 Attack Rating per point', req: 1, st: l => ({ edmg: 8 * l, ar: 25 * l }) },
      { n: 'Charm', d: '+1.5% Damage Reduced and +3 All Resistances per point', req: 6, st: l => ({ dr: 1.5 * l, allres: 3 * l }) },
      { n: 'Canto', d: '+3% Run speed and −2% skill cooldowns per point', req: 12, st: l => ({ frw: 3 * l, cdr: 2 * l }) },
      { n: 'Luna', d: '+2% Deadly Strike per point', req: 24, st: l => ({ ds: 2 * l }) },
    ],
  },
};
const PARTY_KEYS = ['lyn', 'hector'];
const FLOORS = ['Sacae Plains', 'Caelin Highlands', 'Bern Border Fort', 'Lycian Marches', 'Gates of Ostia'];
const POTIONS = {
  hp: [['Minor Healing Potion', 30], ['Light Healing Potion', 60], ['Healing Potion', 100], ['Greater Healing Potion', 180], ['Super Healing Potion', 320]],
  mp: [['Minor Mana Potion', 20], ['Light Mana Potion', 40], ['Mana Potion', 80], ['Greater Mana Potion', 150], ['Super Mana Potion', 250]],
  rj: [['Rejuvenation Potion', .35], ['Full Rejuvenation Potion', 1]],
};

/* =========================================================================
   STAGE / RENDERER
   ========================================================================= */
const stageEl = document.getElementById('stage');
const canvas = document.getElementById('gl');
const uiEl = document.getElementById('ui');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x07050a, 1);
const scene = new THREE.Scene();
let VH = 1920, stageW = 540, stageH = 960;
const camera = new THREE.OrthographicCamera(0, VW, VH, 0, -1000, 1000);
function layout() {
  const iw = window.innerWidth, ih = window.innerHeight;
  let w = iw, h = ih;
  if (w / h > 9 / 16) w = Math.round(h * 9 / 16);
  if (h / w > 2.2) h = Math.round(w * 2.2);
  stageW = w; stageH = h;
  stageEl.style.width = w + 'px'; stageEl.style.height = h + 'px';
  stageEl.style.top = Math.round((ih - h) / 2) + 'px';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  VH = VW * h / w;
  camera.top = VH; camera.bottom = 0; camera.right = VW; camera.left = 0; camera.updateProjectionMatrix();
  uiEl.style.height = (540 * h / w) + 'px';
  uiEl.style.transform = `scale(${w / 540})`;
  if (window.BG) BG.resize();
}
window.addEventListener('resize', layout);

/* =========================================================================
   GAME STATE
   ========================================================================= */
const G = {
  time: 0, speed: 1, auto: true, camX: 0, shakeT: 0, shakeA: 0, hitstop: 0,
  gold: 0, floor: 1, wave: 1, wavesPerFloor: 5, mobs: [], boss: null,
  party: [], active: 0, tagCd: 0, wipe: 0,
  combo: 0, comboT: 0, dmgLog: [], waveSpawned: false, clearT: 0,
  amb: new THREE.Color(1, 1, 1), ambHero: new THREE.Color(1, 1, 1), playtime: 30, secret: null,
  filter: { white: true, magic: false }, autoStat: false, autoSkill: false, newItems: 0, inv: [], gems: 300, wind: 0,
  get hero() { return this.party[this.active]; },
  /* next hero in the tag rotation: the first one after the active hero that is not recovering */
  get partner() { const n = this.party.length; for (let k = 1; k < n; k++) { const h = this.party[(this.active + k) % n]; if (!h.dead) return h; } return this.party[(this.active + 1) % n]; },
  get bench() { return this.party.filter((_, i) => i !== this.active); },
};
const mlvlNow = () => Math.min(99, G.floor * 2 - 1 + (G.wave >= 3 ? 1 : 0));
const difficulty = () => G.floor <= 15 ? 0 : G.floor <= 30 ? 1 : 2;
const DIFF_NAME = ['NORMAL', 'NIGHTMARE', 'HELL'];
const resPenalty = () => [0, -40, -100][difficulty()];
function shake(a, t) { G.shakeA = Math.max(G.shakeA, a); G.shakeT = Math.max(G.shakeT, t); }
function monStats(mlvl, mult) {
  const m = Object.assign({ life: 1, dmg: 1 }, mult);
  return {
    mlvl, life: Math.round((8 + mlvl * 4.5 + mlvl * mlvl * .42) * m.life), def: Math.round(5 + mlvl * 7), ar: Math.round(10 + mlvl * 12),
    dmg: [Math.round((1 + mlvl * .9) * m.dmg), Math.round((3 + mlvl * 1.6) * m.dmg)],
    xp: Math.round((3 * Math.pow(mlvl, 1.9) + 3) * XP_RATE * (m.xp || 1)),
  };
}

/* =========================================================================
   HERO
   ========================================================================= */
class Hero {
  constructor(key, idx) {
    this.key = key; this.idx = idx; this.cls = CLASS[key]; this.asset = ASSETS[key];
    this.view = new SpriteView(this.asset, 1);
    this.asset.reach = this.cls.range + 90;
    this.view.mesh.renderOrder = 22;
    this.shadow = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.shadow, transparent: true, depthTest: false, depthWrite: false, opacity: .8 }));
    this.shadow.renderOrder = 9;
    this.level = 1; this.xp = 0; this.attr = Object.assign({}, this.cls.base); this.points = 0;
    this.equip = {}; for (const s of SLOTS) this.equip[s] = null;
    this.belt = [[], [], [], []];
    this.skillCd = Array(8).fill(0); this.skillPtr = 0; this.queue = -1; this.sinceSkill = 0;
    this.skillLv = [1, 0, 0, 0, 0, 0, 0, 0]; this.passLv = [0, 0, 0, 0]; this.skillPts = 0;
    this.mode = 'bench'; this.freeze = 0; this.x = 0; this.vx = 0; this.y = 0; this.vy = 0; this.air = false; this.jvx = 0; this.ignorePlat = null; this.face = 1; this.limit = 0; this.reviveT = 0; this.heals = []; this.invuln = 0; this.potCd = 0;
    this.hitSets = new Map(); this.flashRed = 0;
    this.view.state.addListener({ event: (e, ev) => this.onEvent(ev.data.name) });
    this.S = computeStats(this, null, 0);
    this.life = this.S.lifeMax; this.mana = this.S.manaMax;
  }
  get dead() { return this.mode === 'dead' || this.reviveT > 0; }
  passiveStats() {
    const o = {};
    this.cls.passives.forEach((p, i) => { if (this.passLv[i]) for (const [k, v] of Object.entries(p.st(this.passLv[i]))) o[k] = (o[k] || 0) + v; });
    return o;
  }
  effLv(i) { return this.skillLv[i] ? this.skillLv[i] + (this.S ? this.S.skills : 0) : 0; }
  skillMul(i) { return 1 + .15 * (this.effLv(i) - 1); }
  learned(i) { return this.skillLv[i] > 0 && this.level >= this.cls.skillReq[i]; }
  recalc() {
    this.S = computeStats(this, null, resPenalty());
    this.life = Math.min(this.life, this.S.lifeMax); this.mana = Math.min(this.mana, this.S.manaMax);
  }
  beltRows() { const b = this.equip.belt; return b && this.S.active.has('belt') ? BASE[b.base].rows : 1; }
  xpFrac() { if (this.level >= 99) return 1; const a = XP_TABLE[this.level], b = XP_TABLE[this.level + 1]; return Math.max(0, Math.min(1, (this.xp - a) / (b - a))); }
  enter(x, tag) {
    scene.add(this.view.mesh); scene.add(this.shadow);
    this.x = x; this.vx = 0; this.freeze = 0; this.hitSets.clear();
    const prev = G.hero && G.hero !== this ? G.hero : null; this.face = prev ? prev.face : 1; this.y = prev ? prev.y : 0; this.air = prev ? prev.air : false; this.vy = prev ? prev.vy : 0; this.jvx = prev ? prev.jvx : 0;
    if (tag) {
      this.play('dash_attack', false); this.mode = 'tagin'; this.invuln = .6;
      this.nextAt = Math.max(this.meta.cancel, this.meta.boxEnd) + .08;
      spawnFx({ tex: TX.ring, x, y: GROUND + 40, sx: 60, sy: 20, sx1: 560, sy1: 160, life: .45, color: new THREE.Color(this.cls.color), ro: 58 });
      spawnFx({ tex: TX.glow, x, y: GROUND + 180, sx: 200, sy: 520, sx1: 60, sy1: 760, life: .4, color: new THREE.Color(this.cls.color), a0: .8, ro: 58 });
    } else { this.play('appear', false); this.mode = 'appear'; }
  }
  leave() {
    scene.remove(this.view.mesh); scene.remove(this.shadow);
    spawnFx({ tex: TX.smoke, x: this.x, y: GROUND + 160, sx: 200, sy: 300, sx1: 380, sy1: 420, life: .45, color: 0x8060a0, a0: .7, ro: 21 });
    if (this.mode !== 'dead') this.mode = 'bench';
  }
  play(name, loop) {
    if (!this.asset.meta[name]) name = 'idle';
    this.anim = name; this.meta = this.asset.meta[name];
    this.entry = this.view.state.setAnimation(0, name, loop);
    this.hitSets.clear(); this.view.prevBox.clear();
  }
  skillReady(i) { return this.learned(i) && this.skillCd[i] <= 0 && this.mana >= this.cls.skillCost[i]; }
  pickSkill() {
    if (this.queue >= 0) { const q = this.queue; if (this.skillReady(q)) { this.queue = -1; return q; } if (!this.learned(q)) this.queue = -1; }
    if (!G.auto || this.sinceSkill < 1.6) return -1;
    for (let k = 0; k < 8; k++) {
      const i = (this.skillPtr + k) % 8;
      if (!this.learned(i)) continue;
      this.skillPtr = i;
      return this.skillReady(i) ? i : -1;
    }
    return -1;
  }
  castSkill(i) {
    this.play('skill_' + i, false);
    this.mode = 'skill'; this.skillIdx = i;
    this.skillCd[i] = this.cls.skillCd[i] * (1 - Math.min(50, this.S.cdr || 0) / 100); this.mana = Math.max(0, this.mana - this.cls.skillCost[i]);
    if (i === this.skillPtr) this.skillPtr = (i + 1) % 8;
    this.sinceSkill = 0;
    const m = this.meta;
    this.nextAt = Math.max(m.cancel, m.boxEnd, m.lastEv) + .12;
    BG.dimV = i >= 6 ? 1.6 : .9;
    UI.skillBanner(this, i);
    SFX.cast(i >= 6);
    if (i >= 6) AUDIO.say(this.key, 'ult', true); else if (Math.random() < .3) AUDIO.say(this.key, 'skill');
    if (i >= 6) { UI.cutIn(this, i); CUT.start(this); G.hitstop = Math.max(G.hitstop, .45); }
    playSkillFx(this, i);
  }
  doCombo() {
    SFX.swing(this.comboIdx === this.cls.combo.length - 1);
    const list = this.cls.combo;
    if (this.comboIdx >= list.length) this.comboIdx = 0;
    this.play(list[this.comboIdx], false);
    this.mode = 'combo'; this.curCombo = this.comboIdx;
    const last = this.comboIdx === list.length - 1;
    this.nextAt = Math.max(this.meta.cancel, this.meta.boxEnd) + (last ? .32 : .06);
    this.comboIdx++;
  }
  onEvent(n) {
    if (G.hero !== this) return;
    if (n === 'move_combo' || n === 'move' || n === 'move_charge') this.vx = Math.max(this.vx, 700);
    else if (n === 'move_combo_back' || n === 'slide_back' || n === 'move_charge_back') this.vx = -380;
    else if (n === 'dash' || n === 'dash_attack') { this.vx = 1150; ghost(this, this.cls.color, .22, .45); }
    else if (n === 'vibranium_normal') shake(7, .16);
    else if (n === 'vibranium_hard') { shake(16, .28); G.hitstop = Math.max(G.hitstop, .05); }
    else if (n === 'vibranium_easy') shake(3, .1);
    else if (n === 'hitstop') G.hitstop = Math.max(G.hitstop, .06);
    else if ((n === 'skill' || n === 'shoot') && this.mode === 'skill' && this.meta.windows === 0) this.eventStrike();
  }
  eventStrike() {
    const m = this.meta, mult = this.cls.skillMult[this.skillIdx] / Math.max(1, m.skillEv) * this.skillMul(this.skillIdx);
    const mx = this.x + 90, my = GROUND + 190;
    const targets = allEnemies().filter(e => !e.dead && e.left() - this.x < 1500 && e.x > this.x - 60);
    for (const e of targets) { muzzle(mx, my, e.x, e.cy()); dealDamage(this, e, mult, true, true); }
    if (!targets.length) muzzle(mx, my, mx + 900, my);
    shake(8, .14);
  }
  checkHits() {
    if (this.cineStrike) return;
    if (this.mode !== 'combo' && this.mode !== 'skill' && this.mode !== 'tagin') return;
    const boxes = this.view.activeBoxes();
    if (!boxes.length) return;
    const isSkill = this.mode === 'skill';
    const mult = isSkill ? this.cls.skillMult[this.skillIdx] / Math.max(1, this.meta.windows) * this.skillMul(this.skillIdx)
      : this.mode === 'tagin' ? 2.2 : this.cls.comboMult[this.curCombo];
    const heavy = isSkill || this.mode === 'tagin' || this.curCombo === this.cls.combo.length - 1;
    for (const b of boxes) {
      if (b.fresh) this.hitSets.set(b.slot, new Set());
      const set = this.hitSets.get(b.slot);
      const [x0, x1, y0, y1] = b.box;
      for (const e of allEnemies()) {
        if (e.dead || set.has(e) || !canStrike(this, e)) continue;
        const hb = e.hurtBox();
        if (x1 < hb[0] || x0 > hb[1] || y1 < hb[2] || y0 > hb[3]) continue;
        set.add(e);
        dealDamage(this, e, mult, heavy, isSkill || this.mode === 'tagin');
      }
    }
  }
  /* Diablo II defense: chance to be hit, block, damage reduction, resistances, hit recovery */
  receive(src) {
    if (this.mode === 'dead' || this.invuln > 0 || G.hero !== this) return;
    const S = this.S;
    const hy = GROUND + 330;
    if (Math.random() > chanceToHit(src.ar, S.def, src.mlvl, this.level)) { UI.number(this.x, hy, 'MISS', 'pm'); return; }
    if (S.block > 0 && Math.random() < S.block / 100) {
      UI.number(this.x, hy, 'BLOCK', 'blk'); SFX.block();
      hitSpark(this.x + 60, GROUND + 200, false, false, 0xd8ad57);
      if ((this.mode === 'idle' || this.mode === 'run') && this.asset.meta.attack_block) this.play('attack_block', false);
      return;
    }
    let d = rnd(src.dmg[0], src.dmg[1]) * (1 - S.dr / 100);
    if (src.elem) { const r = { fire: S.fr, cold: S.cr, ltng: S.lr, pois: S.pr }[src.elem.type] || 0; d += rnd(src.elem.lo, src.elem.hi) * (1 - r / 100); }
    d = Math.max(1, Math.round(d));
    this.life -= d; this.flashRed = 1; SFX.hurt();
    const wasReady = this.limit >= 1; this.limit = Math.min(1, this.limit + d / (S.lifeMax * 1.1)); if (!wasReady && this.limit >= 1) UI.limitReady(this);
    if (d > S.lifeMax / 8 && Math.random() < .3) AUDIO.say(this.key, 'hurt');
    UI.number(this.x, hy + this.y, '-' + d, 'e');
    UI.hurtFlash();
    if (this.life <= 0) { this.die(); return; }
    // hit recovery stagger when a hit takes more than 1/12 of life (as in D2)
    if (d > S.lifeMax / 12 && (this.mode === 'combo' || this.mode === 'idle' || this.mode === 'run') && this.asset.meta.get_hurt) {
      this.play('get_hurt', false); this.mode = 'hurt';
      this.view.state.timeScale = 1 + S.fhr / 100;
    }
  }
  die() {
    this.life = 0; this.mode = 'dead'; this.play('die', false); this.deathT = 1.4; this.deathDone = false;
    UI.toast(this.cls.name.toUpperCase() + ' HAS FALLEN', G.partner.dead ? '' : 'TAGGING ' + G.partner.cls.name.toUpperCase());
  }
  gainXp(v) {
    if (this.level >= 99) return;
    this.xp += Math.round(v);
    while (this.level < 99 && this.xp >= XP_TABLE[this.level + 1]) {
      this.level++; this.points += 5; this.skillPts += 1;
      if (G.hero === this) { SFX.levelUp(); AUDIO.say(this.key, 'level'); }
      this.recalc(); this.life = this.S.lifeMax; this.mana = this.S.manaMax;
      if (G.autoStat) autoAllocate(this);
      if (G.autoSkill) autoSkill(this);
      UI.toastSmall(`${this.cls.name} reached level ${this.level}${G.autoStat ? '' : ' · +5 stat points'}${G.autoSkill ? '' : ' · +1 skill point'}`);
      if (G.hero === this) levelUpFx(this);
      UI.dirtyAll();
    }
  }
  /* nearest enemy on either side, preferring one on the hero's own level */
  target() {
    let best = null, bd = 1e9;
    for (const e of allEnemies()) {
      const vb = viewBounds(); if (e.dead || e.x > vb[1] + 40 || e.x < vb[0] - 200) continue;
      const d = Math.abs(e.x - this.x) + (sameLevel(this, e) ? 0 : 380) + (e.x < this.x ? 60 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /* gap between the hero and an enemy's near edge, measured in the facing direction */
  gapTo(e) { return this.face > 0 ? e.left() - this.x : this.x - e.right(); }
  faceTo(e) { const dx = e.x - this.x; if (Math.abs(dx) > 24) this.face = dx > 0 ? 1 : -1; }
  /* ticking while on the bench: regen, cooldowns, revive */
  benchTick(dt) {
    for (let i = 0; i < 8; i++) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt);
    if (this.reviveT > 0) { this.reviveT -= dt; if (this.reviveT <= 0) { this.mode = 'bench'; this.life = this.S.lifeMax * .5; } return; }
    this.life = Math.min(this.S.lifeMax, this.life + this.S.lifeMax * .04 * dt);
    this.mana = Math.min(this.S.manaMax, this.mana + this.S.manaMax * .04 * dt);
  }
  update(dt) {
    const S = this.S;
    for (let i = 0; i < 8; i++) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt);
    this.sinceSkill += dt; this.invuln = Math.max(0, this.invuln - dt); this.potCd = Math.max(0, this.potCd - dt);
    if (this.mode !== 'dead') {
      this.life = Math.min(S.lifeMax, this.life + (S.lifeMax * .006 + S.regen * .4) * dt);
      this.mana = Math.min(S.manaMax, this.mana + S.manaMax * .025 * dt);
      for (let i = this.heals.length - 1; i >= 0; i--) {
        const hl = this.heals[i], k = Math.min(dt, hl.t);
        if (hl.k === 'hp') this.life = Math.min(S.lifeMax, this.life + hl.rate * k); else this.mana = Math.min(S.manaMax, this.mana + hl.rate * k);
        hl.t -= dt; if (hl.t <= 0) this.heals.splice(i, 1);
      }
      this.autoPotion();
    }
    let adt = dt;
    if (this.freeze > 0) { this.freeze -= dt; adt = 0; }
    if (this.mode !== 'hurt') this.view.state.timeScale = S.speed * TEMPO;
    this.view.sk.x = this.x; this.view.sk.y = GROUND + this.y; this.view.sk.scaleX = this.face;
    if (this.mode === 'run' && !this.air) {
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) {
        this.dustT = .14;
        spawnFx({ tex: TX.smoke, x: this.x - this.face * 40, y: GROUND + this.y + 12, vx: -this.face * 160, vy: 40, sx: 70, sy: 30, sx1: 170, sy1: 60, life: .35, color: G.secret ? 0x704050 : 0xe0d0b0, a0: .55, ro: 16 });
        spawnFx({ tex: TX.streak, x: this.x - this.face * 90, y: GROUND + this.y + rnd(60, 200), rot: this.face > 0 ? Math.PI : 0, sx: rnd(90, 160), sy: 4, sx1: 20, sy1: 2, life: .2, color: new THREE.Color(this.cls.color), a0: .55, ro: 21 });
      }
    }
    this.view.update(adt);
    this.checkHits();
    this.think(dt);
    heroAirTick(this, dt);
    if (Math.abs(this.vx) > 1 && this.freeze <= 0) {
      let nx = this.x + this.vx * this.face * dt;
      const t = this.target();
      if (t && sameLevel(this, t) && (this.cls.range < 300 || this.vx > 0)) nx = this.face > 0 ? Math.min(nx, Math.max(this.x, t.left() - 40)) : Math.max(nx, Math.min(this.x, t.right() + 40));
      this.x = nx;
      this.vx *= Math.pow(.0005, dt);
    }
    const fl = floorBelow(this.x, this.y), shk = Math.max(.35, 1 - (this.y - fl) / 500);
    this.shadow.position.set(this.x, GROUND + fl + 4, 0); this.shadow.scale.set(220 * shk, 46 * shk, 1);
    this.view.u.uTint.value.copy(G.ambHero);
    this.flashRed = Math.max(0, this.flashRed - dt * 5);
    this.view.u.uFlash.value = this.flashRed * .55; this.view.u.uFlashCol.value.setRGB(1, .1, .15);
    this.view.u.uAlpha.value = this.invuln > 0 && this.mode !== 'tagin' && !this.cineStrike ? .6 + .4 * Math.sin(G.time * 40) : 1;
  }
  autoPotion() {
    if (this.potCd > 0) return;
    const S = this.S;
    if (this.life < S.lifeMax * .45 && !this.heals.some(h => h.k === 'hp')) { if (drinkType(this, 'hp') || (this.life < S.lifeMax * .3 && drinkType(this, 'rj'))) return; }
    const nextCost = this.cls.skillCost[this.skillPtr];
    if (this.mana < Math.max(nextCost, S.manaMax * .25) && this.mana < S.manaMax * .5 && !this.heals.some(h => h.k === 'mp')) drinkType(this, 'mp');
  }
  think(dt) {
    if (this.cineStrike) return;
    const tt = this.entry.trackTime;
    if (this.limit >= 1 && G.auto && !this.dead && this.mode !== 'dead' && this.mode !== 'hurt' && !this.air && this.mode !== 'appear' && this.mode !== 'tagin' && (this.mode !== 'combo' && this.mode !== 'skill' || tt >= this.nextAt) && limitBreak(this)) return;
    if (this.mode === 'dead') {
      this.deathT -= dt;
      if (this.deathT <= 0 && !this.deathDone) {
        this.deathDone = true;
        const p = G.partner;
        if (!p.dead) { this.reviveT = 20; tagTo(G.party.indexOf(p), true); }
        else if (G.wipe <= 0) G.wipe = 3.2;
      }
      return;
    }
    if (this.mode === 'hurt') { if (tt >= this.meta.dur) { this.mode = 'idle'; this.view.state.timeScale = this.S.speed; } else return; }
    if (this.air) return;
    const tgt = this.target();
    const range = this.cls.range;
    // turn around between swings (never mid-swing) when the target is behind
    const busy = (this.mode === 'combo' || this.mode === 'skill') && tt < this.nextAt;
    if (tgt && !busy && this.mode !== 'tagin' && this.mode !== 'appear') this.faceTo(tgt);
    const dist = tgt ? this.gapTo(tgt) : 1e9;
    const same = !tgt || sameLevel(this, tgt);
    const inRange = tgt && dist <= range && same;
    if (this.mode === 'appear') { if (tt >= this.meta.dur) this.mode = 'idle'; else return; }
    if (this.mode === 'tagin') { if (tt < this.nextAt) return; this.mode = 'idle'; }
    if (this.mode === 'combo' || this.mode === 'skill') {
      if (tt < this.nextAt) return;
      if (inRange) {
        const sk = this.pickSkill();
        if (sk >= 0) return this.castSkill(sk);
        if (this.mode === 'skill') this.comboIdx = 0;
        return this.doCombo();
      }
      if (tt < this.meta.dur * .85 && tgt && dist < range + 140) return;
      this.comboIdx = 0; this.mode = 'idle';
    }
    if (inRange) {
      const sk = this.pickSkill();
      if (sk >= 0) return this.castSkill(sk);
      this.comboIdx = 0; return this.doCombo();
    }
    if (this.anim === 'attack_block' && tt < this.meta.dur) return;
    if (G.waveHold) { if (this.anim !== 'idle') { this.mode = 'idle'; this.play('idle', true); } return; }
    if (tgt && !same && Math.abs(tgt.x - this.x) < range + 380 && !tgt.dead && (this.mode === 'idle' || this.mode === 'run' || this.mode === 'combo' || this.mode === 'skill')) { const tl = levelOf(tgt); heroJumpTo(this, tl === null ? 0 : tl, tgt); return; }
    if (!tgt) this.face = 1;
    if (this.mode !== 'run') { this.mode = 'run'; this.play('move', true); }
    const burst = tgt && same && dist > range && dist < range + 650;
    const spd = (burst ? 1250 : 620) * this.S.run;
    if (burst) { this.ghostT = (this.ghostT || 0) - dt; if (this.ghostT <= 0) { this.ghostT = .05; ghost(this, this.cls.color, .2, .4); } }
    if (this.face > 0) {
      let nx = this.x + spd * dt;
      if (tgt && same) nx = Math.min(nx, tgt.left() - range + 10);
      for (const e of allEnemies()) if (!e.dead && sameLevel(this, e) && e.x < nx + 40 && e.x > this.x - 40) nx = Math.min(nx, Math.max(this.x, e.left() - 40));
      this.x = nx;
    } else {
      let nx = this.x - spd * dt;
      if (tgt && same) nx = Math.max(nx, tgt.right() + range - 10);
      for (const e of allEnemies()) if (!e.dead && sameLevel(this, e) && e.x > nx - 40 && e.x < this.x + 40) nx = Math.max(nx, Math.min(this.x, e.right() + 40));
      this.x = nx;
    }
  }
  active_idx() { return this.idx; }
}

/* ---------- potions in the belt (4 columns × belt rows, D2 style) ---------- */
function potionTier(mlvl) { return mlvl < 8 ? 0 : mlvl < 16 ? 1 : mlvl < 26 ? 2 : mlvl < 40 ? 3 : 4; }
function potionName(p) { return POTIONS[p.k][p.t][0]; }
function beltAdd(h, p) {
  const rows = h.beltRows();
  const pref = p.k === 'hp' ? [0, 1, 2, 3] : p.k === 'mp' ? [2, 3, 1, 0] : [3, 2, 1, 0];
  for (const c of pref) { const col = h.belt[c]; if (col.length && col[0].k === p.k && col.length < rows) { col.push(p); return true; } }
  for (const c of pref) { const col = h.belt[c]; if (!col.length) { col.push(p); return true; } }
  return false;
}
function drinkCol(h, c) {
  const col = h.belt[c]; if (!col.length || h.dead) return false;
  const p = col.pop();
  const S = h.S;
  if (p.k === 'rj') { const f = POTIONS.rj[p.t][1]; h.life = Math.min(S.lifeMax, h.life + S.lifeMax * f); h.mana = Math.min(S.manaMax, h.mana + S.manaMax * f); }
  else { const v = POTIONS[p.k][p.t][1] * (1 + h.level / 40); h.heals.push({ k: p.k, rate: v / 2.4, t: 2.4 }); }
  h.potCd = .8; SFX.potion();
  if (G.hero === h) {
    const col2 = p.k === 'mp' ? 0x4c6cff : p.k === 'rj' ? 0xb050ff : 0xff3040;
    spawnFx({ tex: TX.glow, x: h.x, y: GROUND + 160, sx: 160, sy: 340, sx1: 80, sy1: 520, life: .5, color: col2, a0: .7, ro: 58 });
  }
  UI.dirty.belt = true;
  return true;
}
function drinkType(h, k) {
  for (let c = 0; c < 4; c++) { const col = h.belt[c]; if (col.length && col[col.length - 1].k === k) return drinkCol(h, c); }
  return false;
}
function trimBelt(h) { const r = h.beltRows(); for (const col of h.belt) col.length = Math.min(col.length, r); }

/* ---------- attributes ---------- */
function spendPoint(h, k) {
  if (h.points <= 0) return;
  h.attr[k]++; h.points--; h.recalc(); UI.dirtyAll(); save();
}
function autoAllocate(h) {
  const plan = h.cls.auto, order = [];
  for (const k in plan) for (let i = 0; i < plan[k]; i++) order.push(k);
  let i = 0; while (h.points > 0) { h.attr[order[i % order.length]]++; h.points--; i++; }
  h.recalc();
}

/* ---------- skill tree: two skill branches (0-2-4-6, 1-3-5-7) + four passives ---------- */
const SKILL_MAX = 20;
function nodeInfo(h, node) {
  if (node.kind === 'skill') {
    const i = node.i, prev = i >= 2 ? i - 2 : -1, lv = h.skillLv[i];
    const reqOk = h.level >= h.cls.skillReq[i], prevOk = prev < 0 || h.skillLv[prev] > 0;
    return { lv, max: SKILL_MAX, reqLv: h.cls.skillReq[i], reqOk, prevOk, prev, can: h.skillPts > 0 && reqOk && prevOk && lv < SKILL_MAX };
  }
  const p = h.cls.passives[node.i], lv = h.passLv[node.i];
  return { lv, max: SKILL_MAX, reqLv: p.req, reqOk: h.level >= p.req, prevOk: true, prev: -1, can: h.skillPts > 0 && h.level >= p.req && lv < SKILL_MAX };
}
function learnNode(h, node) {
  const inf = nodeInfo(h, node); if (!inf.can) return false;
  if (node.kind === 'skill') h.skillLv[node.i]++; else h.passLv[node.i]++;
  h.skillPts--; h.recalc(); UI.dirtyAll(); save(); return true;
}
function autoSkill(h) {
  let guard = 200;
  while (h.skillPts > 0 && guard--) {
    const nodes = [];
    for (let i = 0; i < 8; i++) nodes.push({ kind: 'skill', i });
    for (let i = 0; i < 4; i++) nodes.push({ kind: 'pas', i });
    const ok = nodes.filter(n => nodeInfo(h, n).can);
    if (!ok.length) break;
    const fresh = ok.filter(n => n.kind === 'skill' && h.skillLv[n.i] === 0);
    const pickN = fresh.length ? fresh[0] : ok.sort((a, b) => nodeInfo(h, a).lv - nodeInfo(h, b).lv || (a.kind === 'skill' ? -1 : 1))[0];
    if (pickN.kind === 'skill') h.skillLv[pickN.i]++; else h.passLv[pickN.i]++;
    h.skillPts--;
  }
  h.recalc();
}
function respec(h) {
  h.points += (h.attr.str - h.cls.base.str) + (h.attr.dex - h.cls.base.dex) + (h.attr.vit - h.cls.base.vit) + (h.attr.ene - h.cls.base.ene);
  h.attr = Object.assign({}, h.cls.base);
  h.skillPts += h.skillLv.reduce((a, b) => a + b, 0) - 1 + h.passLv.reduce((a, b) => a + b, 0);
  h.skillLv = [1, 0, 0, 0, 0, 0, 0, 0]; h.passLv = [0, 0, 0, 0]; h.skillPtr = 0;
  h.recalc(); UI.dirtyAll(); save(true);
}

/* ---------- ultimate cut-in: the hero's live idle animation inside a dark band (WebGL, scissored) ---------- */
const CUT = {
  views: {}, scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(0, 1080, 1920, 0, -10, 10), active: null, t: 0, dur: 1.5,
  init() {
    const bandTex = texFrom(makeCanvas(64, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(6,4,3,0)'); g.addColorStop(.12, 'rgba(6,4,3,.94)'); g.addColorStop(.88, 'rgba(6,4,3,.94)'); g.addColorStop(1, 'rgba(6,4,3,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(179,148,102,.7)'; c.fillRect(0, h * .12, w, 2); c.fillRect(0, h * .88 - 2, w, 2);
    }));
    this.band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, depthTest: false, depthWrite: false }));
    this.band.renderOrder = 0; this.scene.add(this.band);
    const streak = texFrom(makeCanvas(512, 64, (c, w, h) => {
      for (let i = 0; i < 40; i++) { const y = Math.random() * h, x = Math.random() * w, l = 40 + Math.random() * 200; const g = c.createLinearGradient(x, 0, x + l, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.55)'); c.fillStyle = g; c.fillRect(x, y, l, 1 + Math.random() * 2); }
    }), true);
    this.streaks = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: streak, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: .5 }));
    this.streaks.renderOrder = 1; this.scene.add(this.streaks);
    this.glow = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: .6 }));
    this.glow.renderOrder = 1; this.scene.add(this.glow);
  },
  start(h) {
    if (!this.band) this.init();
    this.active = { h, v: null }; this.t = 0;
    const c = new THREE.Color(h.cls.color); this.streaks.material.color = c; this.glow.material.color = c;
  },
  update(real) {
    if (!this.active) return;
    this.t += real;
    if (this.t >= this.dur) { this.active = null; return; }
    const t = this.t, kin = Math.min(1, t / .22), ein = 1 - Math.pow(1 - kin, 3), kout = t > this.dur - .3 ? (t - (this.dur - .3)) / .3 : 0;
    this.cam.right = VW; this.cam.top = VH; this.cam.updateProjectionMatrix();
    const cy = VH - 770, bh = 380; this.bandY = cy; this.bandH = bh;
    this.band.position.set(VW / 2, cy, 0); this.band.scale.set(VW, bh * (.3 + .7 * ein), 1); this.band.material.opacity = 1 - kout;
    this.streaks.position.set(VW / 2, cy, 0); this.streaks.scale.set(VW, bh * .8, 1); this.streaks.material.map.offset.x = t * 1.6; this.streaks.material.opacity = .5 * (1 - kout);
    const hx = VW * .66 + (1 - ein) * 520 - t * 50 - kout * 380;
    this.glow.position.set(hx + 40, cy, 0); this.glow.scale.set(520, 420, 1); this.glow.material.opacity = .55 * (1 - kout);
  },
  render() {
    if (!this.active) return;
    const inner = this.bandH * .76, yb = (this.bandY - inner / 2) / VH * stageH, hh = inner / VH * stageH;
    renderer.autoClear = false;
    renderer.setScissorTest(true); renderer.setScissor(0, yb, stageW, hh);
    renderer.render(this.scene, this.cam);
    renderer.setScissorTest(false); renderer.autoClear = true;
  },
};

/* ---------- tag in / out ---------- */
function tagTo(i, forced) {
  if (i === G.active) return false;
  const out = G.hero, inn = G.party[i];
  if (inn.dead) return false;
  if (!forced && (G.tagCd > 0 || out.mode === 'dead')) return false;
  const x = out.x;
  out.leave();
  G.active = i;
  inn.recalc();
  inn.enter(x, true);
  G.tagCd = forced ? 1.5 : 3;
  UI.tagBanner(inn); SFX.tag(); AUDIO.say(inn.key, 'tag', true);
  UI.dirtyAll();
  return true;
}

/* =========================================================================
   ENEMIES
   ========================================================================= */
const MOB_TYPES_STAT = { skeleton: { life: 1, dmg: 1 }, ghoul: { life: 1.4, dmg: 1.15 }, bat: { life: .6, dmg: .8 } };
class Mob {
  constructor(type, x, elite) {
    const T = MOB_TYPES[type]; this.T = T; this.type = type; this.elite = !!elite;
    const sc = elite ? 1.3 : 1; this.sc = sc;
    this.u = { map: { value: T.tex[0] }, uFlash: { value: 0 }, uAlpha: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uFlashCol: { value: new THREE.Color(1, 1, 1) } };
    if (elite) this.u.uTint.value.setRGB(.7, .75, 1.3);
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, .5, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: MOB_VS, fragmentShader: MOB_FS, transparent: true, depthTest: false, depthWrite: false }));
    this.mesh.renderOrder = 15; this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.shadow = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.shadow, transparent: true, depthTest: false, depthWrite: false, opacity: .7 }));
    this.shadow.renderOrder = 9; scene.add(this.shadow);
    this.hpBg = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color: 0x0a0408, depthTest: false, depthWrite: false, transparent: true }));
    this.hpFg = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color: elite ? 0x5c7cff : 0xd8213f, depthTest: false, depthWrite: false, transparent: true }));
    this.hpBg.renderOrder = 40; this.hpFg.renderOrder = 41; scene.add(this.hpBg); scene.add(this.hpFg);
    this.x = x; this.y = T.fly ? rnd(160, 240) : 0; this.baseY = this.y; this.vx = 0; this.vy = 0;
    const st = monStats(mlvlNow() + (elite ? 2 : 0), Object.assign({}, MOB_TYPES_STAT[type], elite ? { life: MOB_TYPES_STAT[type].life * 3, dmg: MOB_TYPES_STAT[type].dmg * 1.5, xp: 3 } : {}));
    Object.assign(this, st);
    this.maxHp = this.life; this.hp = this.life;
    if (elite) this.elem = { type: pick(['fire', 'cold', 'ltng']), lo: Math.round(this.mlvl * .5), hi: Math.round(this.mlvl * 1.2 + 2) };
    this.dead = false; this.deadT = 0; this.flash = 0; this.freeze = 0; this.stun = 0; this.t = rnd(0, 6);
    this.atkCd = rnd(.6, 1.6); this.lunge = 0; this.stop = rnd(60, 220); this.rot = 0; this.showHp = 0;
  }
  left() { return this.x - this.T.hw * this.sc / 2; }
  right() { return this.x + this.T.hw * this.sc / 2; }
  cy() { return GROUND + this.y + this.T.hh * this.sc * .5; }
  hurtBox() { const w = this.T.hw * this.sc, h = this.T.hh * this.sc; return [this.x - w / 2, this.x + w / 2, GROUND + this.y, GROUND + this.y + h]; }
  hit(dmg, heavy, launch) {
    this.hp -= dmg; this.flash = 1; this.freeze = heavy ? .085 : .05; this.stun = .35; this.showHp = 2.5;
    this.vx = heavy ? 360 : 140;
    if (this.T.fly) this.vy = 0;
    else if (launch || this.y > 0) { this.vy = Math.max(this.vy, this.y > 0 ? 520 : rnd(700, 950)); }
    if (this.hp <= 0) this.die();
  }
  die() {
    this.dead = true; this.deadT = 0; this.vx = rnd(380, 620); this.vy = rnd(600, 900); this.vr = rnd(-8, -4);
    const cx = this.x, cy = this.cy();
    for (let i = 0; i < 10; i++) spawnFx({ tex: TX.shard, x: cx, y: cy, vx: rnd(-500, 700), vy: rnd(200, 900), g: 2200, vr: rnd(-20, 20), sx: rnd(10, 22), sy: rnd(10, 22), life: rnd(.6, 1), ground: true, normal: true, a0: 1, a1: 0, fadeLate: true, ro: 16 });
    spawnFx({ tex: TX.smoke, x: cx, y: cy, sx: 160, sy: 160, sx1: 420, sy1: 420, life: .7, color: 0x8a50c0, a0: .7, ro: 17 });
    onKill(this, cx, cy, this.elite ? 'elite' : 'normal');
  }
  update(dt, lead) {
    this.t += dt;
    const T = this.T;
    if (this.dead) {
      this.deadT += dt; this.vy -= GRAV * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.vr * dt;
      if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * .3; this.vx *= .5; this.vr *= .4; }
      this.u.uAlpha.value = Math.max(0, 1 - Math.max(0, this.deadT - .35) / .5);
      this.u.uFlash.value = Math.max(0, .9 - this.deadT * 2);
      this.place(); return this.deadT > .9;
    }
    let adt = dt; if (this.freeze > 0) { this.freeze -= dt; adt = 0; }
    this.flash = Math.max(0, this.flash - dt * 7); this.stun = Math.max(0, this.stun - adt); this.showHp = Math.max(0, this.showHp - dt);
    if (!T.fly && (this.y > 0 || this.vy > 0)) {
      this.vy -= GRAV * adt; this.y += this.vy * adt;
      if (this.y <= 0) { this.y = 0; if (this.vy < -500) { this.vy = -this.vy * .32; spawnFx({ tex: TX.smoke, x: this.x, y: GROUND + 10, sx: 120, sy: 50, sx1: 300, sy1: 90, life: .4, color: 0xb090a0, a0: .6, ro: 16 }); } else this.vy = 0; }
    }
    if (Math.abs(this.vx) > 1) { this.x += this.vx * adt; this.vx *= Math.pow(.002, adt); }
    const stopX = lead.x + 70 + this.stop * (G.boss ? .4 : 1) + T.hw * this.sc / 2;
    if ((this.stun <= 0 && this.y <= .1) || (T.fly && this.stun <= 0)) {
      if (this.x > stopX) { this.x -= T.spd * adt; this.lunge = 0; }
      else { this.atkCd -= adt; if (this.atkCd <= 0 && this.lunge <= 0) { this.lunge = .42; this.didHit = false; } }
    }
    if (this.lunge > 0) {
      this.lunge -= adt;
      if (!this.didHit && this.lunge < .22) { this.didHit = true; this.atkCd = rnd(1.6, 2.4); if (this.x - lead.x < 420) lead.receive(this); }
    }
    if (T.fly) this.y = this.baseY + Math.sin(this.t * 3) * 22;
    this.u.uFlash.value = this.flash * .9; this.u.uFlashCol.value.setRGB(1, .95, .85);
    if (T.tex.length > 1) this.u.map.value = T.tex[(this.t * 9 | 0) % 2];
    this.place(); return false;
  }
  place() {
    const T = this.T, sc = this.sc;
    let lean = 0, sqx = 1, sqy = 1;
    if (this.lunge > 0) { const k = this.lunge > .22 ? (.42 - this.lunge) / .2 : this.lunge / .22; lean = .28 * k; sqx = 1 + .12 * k; }
    if (this.flash > 0) { sqx *= 1 - this.flash * .12; sqy *= 1 + this.flash * .08; }
    const bob = (!this.dead && !T.fly && this.stun <= 0 && this.lunge <= 0) ? Math.abs(Math.sin(this.t * 9)) * 6 : 0;
    const shk = this.freeze > 0 ? rnd(-6, 6) : 0;
    this.mesh.position.set(this.x + shk - (this.lunge > 0 ? 30 * lean / .28 : 0), GROUND + this.y + bob - (T.fly ? T.h * sc * .3 : 0), 0);
    this.mesh.scale.set(T.w * sc * sqx, T.h * sc * sqy, 1);
    this.mesh.rotation.z = this.dead ? this.rot * .2 : (lean + (this.y > 0 && !T.fly ? -.4 : 0));
    const sh = Math.max(.3, 1 - this.y / 500);
    this.shadow.position.set(this.x, GROUND + 4, 0); this.shadow.scale.set(150 * sc * sh, 34 * sc * sh, 1);
    this.shadow.material.opacity = this.dead ? this.u.uAlpha.value * .7 : .7;
    const vis = !this.dead && (this.showHp > 0 || this.elite);
    this.hpBg.visible = this.hpFg.visible = vis;
    if (vis) {
      const top = GROUND + this.y + T.hh * sc + 34, w = 110 * sc, k = Math.max(0, this.hp / this.maxHp);
      this.hpBg.position.set(this.x, top, 0); this.hpBg.scale.set(w + 6, 12, 1);
      this.hpFg.position.set(this.x - w / 2 + w * k / 2, top, 0); this.hpFg.scale.set(w * k, 7, 1);
    }
  }
  dispose() { for (const m of [this.mesh, this.shadow, this.hpBg, this.hpFg]) { scene.remove(m); m.material.dispose(); } this.mesh.geometry.dispose(); }
}

/* ---------- Spine enemies from the project (optional; loaded if present) ---------- */
const SK2 = ['default', 'skin_default'];
const FIRE_EV = /^(attack|skill|skill_\d|shoot)$/;
const ENEMY_DEFS = {
  brigand: { name: 'Brigand', scale: 1, hw: 130, hh: 250, spd: 170, floor: 1, mult: { life: 1.1, dmg: 1 } },
  soldier: { name: 'Soldier', scale: 1, hw: 110, hh: 270, spd: 150, floor: 1, mult: { life: .9, dmg: .95 } },
  assassin: { name: 'Assassin', scale: 1, hw: 110, hh: 250, spd: 230, floor: 2, mult: { life: .8, dmg: 1.2 } },
  shade: { name: 'Black Fang Shade', scale: 1, hw: 110, hh: 250, spd: 240, floor: 3, mult: { life: 1, dmg: 1.25 }, elem: 'cold' },
  revenant: { name: 'Revenant', scale: 1, hw: 120, hh: 270, spd: 95, floor: 1, mult: { life: 1.5, dmg: .9, xp: 1.2 } },
  gwyllgi: { name: 'Gwyllgi', scale: 1, hw: 220, hh: 210, spd: 300, floor: 2, mult: { life: .9, dmg: 1.15 } },
  mogall: { name: 'Mogall', scale: 1, hw: 130, hh: 160, spd: 150, floor: 2, fly: true, ranged: 520, col: 0xff5070, mult: { life: .8, dmg: 1 }, elem: 'ltng' },
  maelduin: { name: 'Maelduin', scale: 1, hw: 210, hh: 320, spd: 170, floor: 3, mult: { life: 2.1, dmg: 1.3, xp: 1.8 } },
};
const BOSS_DEF = { key: 'batta', name: 'Batta the Beast', scale: 1, hw: 200, hh: 360, ranged: 0, col: 0x60c040 };
const SPINE_MOBS = [];
const BOSSES = { batta: BOSS_DEF, dracula: DRAC_DEF };

class SpineMob {
  constructor(key, x, elite, boss) {
    const D = boss ? BOSSES[key] : ENEMY_DEFS[key];
    this.D = D; this.key = key; this.boss = !!boss; this.elite = !!elite; this.asset = ASSETS['e_' + key];
    const sc = D.scale * (elite ? 1.15 : 1); this.sc = sc;
    this.view = new SpriteView(this.asset, sc);
    this.view.sk.scaleX = -sc; // sheets face right: flip to face the heroes
    this.asset.reach = boss ? 380 : 340;
    this.view.mesh.renderOrder = boss ? 18 : 15; scene.add(this.view.mesh);
    this.baseTint = elite ? new THREE.Color(.8, .9, 1.45) : new THREE.Color(1, 1, 1);
    this.floorY = 0; this.plat = null; this.hopT = 0;
    this.shadow = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.shadow, transparent: true, depthTest: false, depthWrite: false, opacity: .75 }));
    this.shadow.renderOrder = 9; scene.add(this.shadow);
    this.hpBg = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color: 0x0a0408, depthTest: false, depthWrite: false, transparent: true }));
    this.hpFg = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color: elite ? 0x5c7cff : 0xd8213f, depthTest: false, depthWrite: false, transparent: true }));
    this.hpBg.renderOrder = 40; this.hpFg.renderOrder = 41;
    if (!boss) { scene.add(this.hpBg); scene.add(this.hpFg); }
    const A = this.asset;
    this.an = {
      move: findAnim(A, 'move', 'walk', 'run', /move/, /walk/, 'idle'), idle: findAnim(A, 'idle', /idle/),
      attacks: A.data.animations.map(a => a.name).filter(n => /^attack(_\d)?$/.test(n)),
      skills: A.data.animations.map(a => a.name).filter(n => /^skill_\d$/.test(n)),
      hurt: findAnim(A, 'get_hurt', 'hurt', /hurt/, /hit/), die: findAnim(A, 'die', /die/, /dead/), appear: findAnim(A, 'appear'),
      knockUp: findAnim(A, 'knock_up'), knockFly: findAnim(A, 'knock_flying'), knockLand: findAnim(A, 'knock_landing'), standUp: findAnim(A, 'stand_up'),
    };
    this.vx = 0; this.vy = 0; this.air = false;
    if (!this.an.attacks.length) this.an.attacks = [findAnim(A, /attack/) || this.an.idle];
    const base = boss ? (key === 'dracula' ? { life: 22, dmg: 1.75, xp: 45 } : { life: 10, dmg: 1.15, xp: 18 }) : Object.assign({}, D.mult);
    if (elite) { base.life *= 3; base.dmg *= 1.5; base.xp = 3; }
    Object.assign(this, monStats(mlvlNow() + (boss ? (key === 'dracula' ? 6 : 3) : elite ? 2 : 0), base));
    this.maxHp = this.life; this.hp = this.life;
    if (boss) this.elem = { type: key === 'dracula' ? 'fire' : 'cold', lo: Math.round(this.mlvl * .5), hi: Math.round(this.mlvl * 1.3 + 2) };
    else if (elite || D.elem) this.elem = { type: D.elem || pick(['fire', 'cold', 'ltng']), lo: Math.round(this.mlvl * .5), hi: Math.round(this.mlvl * 1.2 + 2) };
    this.x = x; this.y = D.fly ? rnd(60, 140) : 0; this.dead = false; this.flash = 0; this.freeze = 0; this.stun = 0; this.t = 0;
    this.mode = 'walk'; this.atkCd = rnd(.5, 1.4); this.stop = boss ? 200 : (D.ranged ? D.ranged * rnd(.7, 1) : rnd(60, 200)); this.showHp = 0; this.hitSets = new Map();
    this.view.state.addListener({ event: (e, ev) => this.onEvent(ev.data.name) });
    this.play(this.an.appear && boss ? this.an.appear : this.an.move, !boss);
    if (boss) { this.mode = 'appear'; }
  }
  play(n, loop) { if (!n) return; this.anim = n; this.meta = this.asset.meta[n]; this.entry = this.view.state.setAnimation(0, n, loop); this.hitSets.clear(); this.view.prevBox.clear(); this.shot = false; }
  onEvent(n) {
    if (n === 'vibranium_hard') shake(12, .22); else if (n === 'vibranium_normal') shake(5, .12);
    if (FIRE_EV.test(n) && (this.D.ranged || this.D.fireAll) && this.mode === 'atk' && !this.dead) { this.shot = true; this.fire(); }
  }
  fire() {
    const h = G.hero; if (!h || h.dead) return;
    const sx = this.x - 60, sy = GROUND + this.y + Math.min(190, this.D.hh * .55);
    const col = this.D.col || (this.elem && this.elem.type === 'cold' ? 0x88aaff : 0xff6060);
    const tx = h.x + 30, ty = GROUND + h.y + 190, dx = tx - sx, dy = ty - sy, L = Math.max(1, Math.hypot(dx, dy));
    const f = spawnFx({ tex: TX.streak, x: sx, y: sy, vx: dx / L * 1400, vy: dy / L * 1400, sx: 90, sy: 10, life: Math.max(.1, L / 1400), color: col, alignVel: true, ro: 57 });
    const k = this.boss ? .45 : 1;
    const src = { ar: this.ar, mlvl: this.mlvl, dmg: [this.dmg[0] * k, this.dmg[1] * k], elem: this.elem ? { type: this.elem.type, lo: this.elem.lo * k, hi: this.elem.hi * k } : null };
    f.onEnd = () => { if (G.hero === h) { h.receive(src); hitSpark(h.x + 30, GROUND + h.y + 200, false, false, col); } };
  }
  left() { return this.x - this.D.hw / 2; }
  right() { return this.x + this.D.hw / 2; }
  side() { const h = G.hero; return !h ? 1 : this.x >= h.x ? 1 : -1; }
  cy() { return GROUND + this.y + this.D.hh * .5; }
  hurtBox() { const w = this.D.hw * (this.elite ? 1.15 : 1), h = this.D.hh * (this.elite ? 1.15 : 1); return [this.x - w / 2, this.x + w / 2, GROUND + this.y, GROUND + this.y + h]; }
  hit(dmg, heavy, launch) {
    if (this.dead) return;
    this.hp -= dmg; this.flash = 1; this.freeze = heavy ? .07 : .045; this.showHp = 2.5;
    if (!this.boss) {
      // knockback: push away from the hero, heavy hits launch into a juggle
      const res = this.elite ? .55 : 1;
      const s = this.side(); this.vx = s * Math.max(Math.abs(this.vx), (heavy ? 900 : 380) * res);
      const canAir = !this.D.fly && this.an.knockUp;
      if (canAir && (this.air || (launch && Math.random() < (this.elite ? .45 : 1)))) {
        const was = this.air;
        this.vy = was ? Math.max(this.vy, 460) : rnd(820, 1080); this.air = true; this.mode = 'knock';
        if (!was) this.play(this.an.knockUp, false);
      } else if (!this.air && this.an.hurt && (heavy || this.mode !== 'atk')) { this.play(this.an.hurt, false); this.mode = 'hurt'; }
    }
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deadT = 0;
      if (!this.boss) { this.vx = this.side() * Math.max(Math.abs(this.vx), 520); if (!this.D.fly && !this.air) this.vy = 520, this.air = true; }
      if (this.an.die) this.play(this.an.die, false);
      if (this.boss) { G.slowmo = { t: 2.6, max: 2.6, x: this.x, y: GROUND + 260 }; setTimeout(() => UI.toast(this.D.name.split(',')[0].toUpperCase() + ' SLAIN', 'BOSS DEFEATED'), 350); }
      const cy = this.cy();
      if (this.boss) { shake(22, .5); G.hitstop = .25; BG.dimV = 1.2; for (let i = 0; i < 6; i++) setTimeout(() => hitSpark(this.x + rnd(-120, 120), GROUND + rnd(80, 380), true, true, 0xb060ff), i * 90); }
      SFX.kill();
      onKill(this, this.x, cy, this.boss ? 'boss' : this.elite ? 'elite' : 'normal');
    }
  }
  update(dt, lead) {
    this.t += dt;
    let adt = dt; if (this.freeze > 0) { this.freeze -= dt; adt = 0; }
    this.flash = Math.max(0, this.flash - dt * 6); this.showHp = Math.max(0, this.showHp - dt);
    if (!this.boss) {
      if (Math.abs(this.vx) > 1) { this.x += this.vx * adt; this.vx *= Math.pow(.003, adt); }
      if (!this.air && !this.D.fly && this.floorY > 0 && !platAt(this.x, this.floorY)) { this.air = true; this.vy = Math.min(this.vy, 0); this.plat = null; }
      if (this.air) {
        const prevY = this.y;
        this.vy -= GRAV * adt; this.y += this.vy * adt;
        const lp = this.vy < 0 ? landingFor(this.x, prevY, this.y, null) : null;
        if (lp && this.vy < 0) { this.y = Math.min(this.y, lp.y); if (this.y <= lp.y) { this.y = lp.y - .001; } }
        if (!this.dead && this.anim === this.an.knockUp && this.entry.trackTime >= this.meta.dur && this.an.knockFly) this.play(this.an.knockFly, true);
        const fl = lp ? lp.y : 0;
        if (this.y <= fl && this.vy < 0) {
          this.y = fl; this.floorY = fl; this.plat = lp;
          spawnFx({ tex: TX.smoke, x: this.x, y: GROUND + fl + 10, sx: 140, sy: 50, sx1: 320, sy1: 100, life: .4, color: 0xc8d4e8, a0: .65, ro: 16 });
          if (this.vy < -780) { this.vy = -this.vy * .3; shake(4, .08); }
          else { this.vy = 0; this.air = false; if (!this.dead) { this.play(this.an.knockLand || this.an.standUp || this.an.idle, false); this.mode = 'land'; } }
        }
      }
    }
    this.view.sk.x = this.x + (this.freeze > 0 ? rnd(-5, 5) : 0); this.view.sk.y = GROUND + this.y + (this.D.fly ? Math.sin(this.t * 3) * 18 : 0);
    this.view.update(adt);
    this.view.u.uFlash.value = this.flash * .75; this.view.u.uFlashCol.value.setRGB(1, .95, .9);
    this.view.u.uTint.value.copy(this.baseTint).multiply(G.amb);
    this.shadow.position.set(this.x, GROUND + floorBelow(this.x, this.y) + 4, 0); this.shadow.scale.set(this.D.hw * 1.6, this.D.hw * .34, 1);
    const tt = this.entry.trackTime;
    if (this.dead) {
      this.deadT += dt;
      const a = Math.max(0, 1 - Math.max(0, this.deadT - (this.boss ? 1.4 : .7)) / .6);
      this.view.u.uAlpha.value = a; this.shadow.material.opacity = a * .75; this.hpBg.visible = this.hpFg.visible = false;
      return this.deadT > (this.boss ? 2.1 : 1.4);
    }
    // melee hitboxes vs the hero
    if (this.mode === 'atk' && !this.D.ranged) {
      for (const b of this.view.activeBoxes()) {
        if (b.fresh) this.hitSets.set(b.slot, new Set());
        const set = this.hitSets.get(b.slot);
        if (set.has(lead) || lead.dead) continue;
        if (b.box[1] < lead.x - 60 || b.box[0] > lead.x + 60 || Math.abs(lead.y - this.y) > (this.boss ? 260 : 140)) continue;
        set.add(lead); lead.receive(this); hitSpark(lead.x + 20, GROUND + 200, false, false, 0x9a40ff);
      }
      if (!this.view.hitSlots.length && !this.didHit && tt > this.meta.dur * .45) { this.didHit = true; if (Math.abs(this.x - lead.x) < 360 && Math.abs(lead.y - this.y) < 140) lead.receive(this); }
    }
    const sd = this.side();
    if (!this.dead && this.mode !== 'atk' && this.mode !== 'knock') this.view.sk.scaleX = -sd * this.sc;
    const stopX = lead.x + sd * (this.stop + this.D.hw / 2);
    if (this.mode === 'appear') { if (tt >= this.meta.dur) { this.mode = 'walk'; this.play(this.an.move, true); } }
    else if (this.mode === 'hurt') { if (tt >= this.meta.dur) { this.mode = 'walk'; this.play(this.an.move, true); } }
    else if (this.mode === 'knock') { /* airborne, no actions */ }
    else if (this.mode === 'land') {
      if (tt >= this.meta.dur) { if (this.an.standUp && this.anim !== this.an.standUp) this.play(this.an.standUp, false); else { this.mode = 'walk'; this.atkCd = Math.max(this.atkCd, .6); this.play(this.an.move, true); } }
    }
    else if (this.mode === 'walk') {
      const onPlat = this.plat && !this.D.fly && !this.air;
      const edge = sd > 0 ? this.plat && this.x <= this.plat.x0 + 34 && lead.x < this.plat.x0 : this.plat && this.x >= this.plat.x1 - 34 && lead.x > this.plat.x1;
      if (onPlat && edge && lead.y < this.floorY - 40) {
        if (this.anim !== this.an.idle) this.play(this.an.idle, true);
        this.hopT += adt; if (this.hopT > 1.1) { this.hopT = 0; this.air = true; this.vy = 380; this.vx = -sd * 340; this.plat = null; this.floorY = 0; }
      } else if (sd > 0 ? this.x > stopX : this.x < stopX) {
        this.x -= sd * (this.D.spd || 160) * 1.4 * adt;
        if (onPlat) this.x = Math.max(this.plat.x0 + 30, Math.min(this.plat.x1 - 30, this.x));
        if (this.anim !== this.an.move) this.play(this.an.move, true);
      }
      else { if (this.anim !== this.an.idle) this.play(this.an.idle, true); this.atkCd -= adt; if (this.atkCd <= 0) this.attack(); }
    } else if (this.mode === 'atk') {
      if (tt >= this.nextAt) {
        if (this.D.ranged && !this.shot) this.fire();
        if (this.chain > 0) { this.chain--; this.attack(true); } else { this.mode = 'walk'; this.atkCd = this.boss ? rnd(.9, 1.7) : rnd(1, 1.8); }
      }
    }
    const vis = !this.boss && (this.showHp > 0 || this.elite);
    this.hpBg.visible = this.hpFg.visible = vis;
    if (vis) {
      const top = GROUND + this.y + this.D.hh * (this.elite ? 1.15 : 1) + 30, w = 120, k = Math.max(0, this.hp / this.maxHp);
      this.hpBg.position.set(this.x, top, 0); this.hpBg.scale.set(w + 6, 12, 1);
      this.hpFg.position.set(this.x - w / 2 + w * k / 2, top, 0); this.hpFg.scale.set(w * k, 7, 1);
    }
    return false;
  }
  attack(cont) {
    const pool = this.boss && Math.random() < .35 && this.an.skills.length ? this.an.skills : this.an.attacks;
    if (!cont) this.chain = this.boss ? (Math.random() < .5 ? 2 : 1) : 0;
    const n = pick(pool);
    this.play(n, false); this.mode = 'atk'; this.didHit = false;
    if (this.key === 'dracula' && /^skill/.test(n)) draculaSpecial(this, n);
    this.nextAt = Math.max(this.meta.cancel, this.meta.boxEnd) + .2;
    if (this.nextAt > this.meta.dur) this.nextAt = this.meta.dur;
  }
  dispose() { for (const m of [this.view.mesh, this.shadow, this.hpBg, this.hpFg]) scene.remove(m); this.view.geo.dispose(); }
}

function makeBoss(x) { return new SpineMob('batta', x, false, true); }

function catchUp(e, lead) {
  if (e.dead || e.x > lead.x - 900 || e.x > G.camX - 150) return;
  spawnFx({ tex: TX.smoke, x: e.x, y: GROUND + 150, sx: 160, sy: 220, sx1: 320, sy1: 360, life: .4, color: 0x7050a0, a0: .6, ro: 17 });
  e.x = lead.x + rnd(420, 620); if (!(e.D && e.D.fly)) { e.y = 0; e.floorY = 0; e.plat = null; e.air = false; e.vy = 0; }
  spawnFx({ tex: TX.smoke, x: e.x, y: GROUND + 150, sx: 160, sy: 220, sx1: 320, sy1: 360, life: .4, color: 0x7050a0, a0: .6, ro: 17 });
}
function allEnemies() { const a = G.mobs.slice(); if (G.boss && !G.boss.dead) a.push(G.boss); return a; }

/* =========================================================================
   COMBAT
   ========================================================================= */
const ELEM_COL = { fire: 0xff7a30, cold: 0x7fb4ff, ltng: 0xffe24a };
function dealDamage(hero, e, mult, heavy, isSkill, sure) {
  const S = hero.S;
  const hb = e.hurtBox();
  if (!sure && Math.random() > chanceToHit(S.ar * (isSkill ? 1.5 : 1), e.def, hero.level, e.mlvl)) {
    UI.number(e.x + rnd(-30, 30), hb[3] + 20, 'MISS', 'm'); return;
  }
  let d = rnd(S.min, S.max) * mult, crit = false, cb = false, elemK = null, el = 0;
  if (Math.random() < S.ds / 100) { d *= 2; crit = true; QUESTS.event('crit'); }
  for (const k of ['fire', 'cold', 'ltng']) { const r = S[k]; if (r[1] > 0) { el += rnd(r[0], r[1]); elemK = elemK || k; } }
  d += el * Math.min(1, mult);
  if (S.cb > 0 && Math.random() < S.cb / 100) { d += e.hp * (e.boss ? .0625 : .25); cb = true; }
  d = Math.max(1, Math.round(d));
  SFX.hit(heavy, crit || cb);
  if (crit || cb || (heavy && isSkill)) hitSheetFx(e, crit || cb);
  e.hit(d, heavy || crit || cb, (isSkill && Math.random() < .45) || (heavy && Math.random() < .35));
  if (S.ll) hero.life = Math.min(S.lifeMax, hero.life + d * S.ll / 100 * (e.boss ? .5 : 1));
  if (S.ml) hero.mana = Math.min(S.manaMax, hero.mana + d * S.ml / 100);
  hero.freeze = Math.max(hero.freeze, heavy ? .06 : .035);
  const hx = Math.min(Math.max(hero.x + hero.face * 120, hb[0]), hb[1]);
  const hy = (hb[2] + hb[3]) / 2 + rnd(-30, 30);
  hitSpark(hero.cls.range > 300 ? e.x : hx, hy, heavy, crit, elemK ? ELEM_COL[elemK] : hero.cls.range > 300 ? 0x86a6ff : null);
  UI.number(e.x + rnd(-40, 40), hb[3] + 20, fmt(d), cb ? 'cb' : crit ? 'c' : (isSkill ? 's' : 'n'));
  G.combo++; G.comboT = 2.4; UI.comboBump();
  G.dmgLog.push([G.time, d]);
  if (heavy) shake(5, .1);
}

/* =========================================================================
   LOOT
   ========================================================================= */
function onKill(e, x, y, kind) {
  const h = G.hero, mlvl = e.mlvl;
  h.gainXp(e.xp * xpPenalty(h.level, mlvl));
  for (const p of G.bench) p.gainXp(e.xp * .35 * xpPenalty(p.level, mlvl));
  const gf = 1 + h.S.gf / 100;
  const goldChance = kind === 'normal' ? .5 : 1;
  if (Math.random() < goldChance) {
    const n = kind === 'boss' ? 24 : kind === 'elite' ? 6 : 3;
    const total = Math.round(rnd(1, 3) * (mlvl * 2 + 3) * gf * (kind === 'boss' ? 12 : kind === 'elite' ? 3 : 1));
    dropCoins(x, y, n, Math.max(1, Math.round(total / n)));
  }
  const gemChance = kind === 'boss' ? 1 : kind === 'elite' ? .06 : .005;
  if (Math.random() < gemChance) {
    const n = kind === 'boss' ? ri(8, 15) : kind === 'elite' ? ri(2, 4) : ri(1, 2);
    G.gems += n; UI.dropLabel(x, y + 30, `${n} Gems`, '#d9b8ff', 'gem');
    if (kind !== 'normal') UI.lootFeedGem(n);
  }
  const potChance = kind === 'boss' ? 1 : kind === 'elite' ? .5 : .18;
  const pots = kind === 'boss' ? 3 : 1;
  for (let i = 0; i < pots; i++) if (Math.random() < potChance) {
    const r = Math.random(); const pk = r < .55 ? 'hp' : r < .92 ? 'mp' : 'rj';
    const pt = { k: pk, t: pk === 'rj' ? (mlvl > 40 && Math.random() < .3 ? 1 : 0) : potionTier(mlvl) };
    const ok = beltAdd(h, pt);
    UI.dropLabel(x + rnd(-60, 60), y, potionName(pt), ok ? '#e9e9e9' : '#777', ok ? 'belt' : null);
    if (ok) UI.dirty.belt = true;
  }
  const picks = kind === 'boss' ? 5 : kind === 'elite' ? 2 : 1;
  const chance = kind === 'boss' ? 1 : kind === 'elite' ? .45 : .14;
  const bonus = kind === 'boss' ? 2.5 : kind === 'elite' ? 1.6 : 1;
  for (let i = 0; i < picks; i++) if (Math.random() < chance) giveItem(rollItem(mlvl, h.S.mf, bonus), x + rnd(-80, 80), y);
  if (kind === 'boss') giveItem(rollItem(mlvl + 2, h.S.mf + 100, 4), x, y + 40);
  if (kind === 'boss' && G.secret) {
    for (let i = 0; i < 6; i++) later(.15 * i, () => giveItem(rollItem(mlvl + 4, h.S.mf + 450, 9), x + rnd(-140, 140), y + rnd(0, 60)));
    const gm = ri(30, 60); G.gems += gm; UI.lootFeedGem(gm);
    SFX.victory(); later(1.2, () => AUDIO.say(G.hero.key, 'win', true));
  }
  QUESTS.onKill(e, kind);
}
function giveItem(it, x, y) {
  const q = it.q;
  const junk = (G.filter.white && (q === 'low' || q === 'normal' || q === 'superior')) || (G.filter.magic && q === 'magic');
  let fate = 'inv';
  if (junk) fate = 'sold';
  else if (!invPlace(G.inv, it)) fate = 'full';
  if (fate !== 'inv') G.gold += sellPrice(it);
  if (fate === 'inv') { G.newItems++; UI.dirty.inv = true; }
  if (q === 'magic' || q === 'rare' || q === 'set' || q === 'unique') { UI.lootFeed(it, fate); if (q !== 'magic') SFX.loot(q); }
  if (fate === 'full') UI.toastSmall('Inventory full · sold ' + it.name);
  UI.dropLabel(x, y, it.name + (fate === 'sold' ? ' · sold' : ''), Q_COLOR[q], fate === 'inv' ? 'inv' : null, it);
  if (q === 'unique' || q === 'set') {
    const c = q === 'unique' ? 0xc7b377 : 0x28e028;
    spawnFx({ tex: TX.glow, x, y: GROUND + 300, sx: 70, sy: 900, sx1: 30, sy1: 1100, life: 1.6, color: c, a0: .85, ro: 58, ease: 3 });
    spawnFx({ tex: TX.ring, x, y: GROUND + 20, sx: 60, sy: 20, sx1: 360, sy1: 110, life: .7, color: c, ro: 58 });
  }
  save();
}
function dropCoins(x, y, n, value) {
  for (let i = 0; i < n; i++) {
    const f = spawnFx({ tex: TX.coin, x, y, vx: rnd(-420, 420), vy: rnd(500, 1100), g: 2600, sx: 30, sy: 30, life: rnd(.7, 1.05), ground: true, normal: true, spin: 9, ro: 30, a0: 1, a1: 1 });
    f.onEnd = (ff) => UI.coinFly(ff.x, ff.y, value);
  }
}

/* =========================================================================
   WAVES
   ========================================================================= */
function spawnWave() {
  G.waveSpawned = true;
  const lead = G.hero;
  const baseX = Math.max(G.camX + VW + 40, lead.x + 600);
  if (G.wave === G.wavesPerFloor) {
    G.boss = makeBoss(baseX + 120); SFX.boss(); STORY.trigger('boss');
    UI.showBoss(true);
    UI.toast(G.boss.D.name.toUpperCase(), 'BOSS APPROACHES');
    return;
  }
  const n = 4 + G.wave + (G.floor % 3);
  const pool = SPINE_MOBS.filter(k => ENEMY_DEFS[k].floor <= G.floor);
  const plats = makeWavePlats(baseX);
  UI.banner(G.wave === 1 ? 'opening' : 'skirmish');
  for (let i = 0; i < n; i++) {
    const elite = G.wave >= 3 && i === n - 1;
    const x = baseX + i * rnd(80, 150);
    if (pool.length) {
      let k = pick(pool);
      if (elite) k = G.floor >= 3 ? 'maelduin' : G.floor >= 2 ? 'shade' : 'brigand';
      const m = new SpineMob(k, x, elite);
      const p = plats.find(q => x > q.x0 + 40 && x < q.x1 - 40);
      if (p && !m.D.fly && Math.random() < .6) { m.y = p.y; m.floorY = p.y; m.plat = p; }
      G.mobs.push(m);
    } else G.mobs.push(new Mob(pick(G.floor === 1 && G.wave === 1 ? ['skeleton', 'skeleton', 'bat'] : ['skeleton', 'ghoul', 'bat']), x, elite));
  }
}
function waveCleared() {
  if (G.wave === G.wavesPerFloor) {
    G.floor++; G.wave = 1;
    UI.toast('FLOOR ' + (G.floor - 1) + ' PURGED', DIFF_NAME[difficulty()] + ' · ' + FLOORS[(G.floor - 1) % FLOORS.length].toUpperCase());
    for (const h of G.party) h.recalc();
    QUESTS.event('floor', G.floor); STORY.trigger('floor');
  } else G.wave++;
  const h = G.hero; h.life = Math.min(h.S.lifeMax, h.life + h.S.lifeMax * .2);
  G.waveSpawned = false; G.clearT = .45;
  UI.dirtyAll(); save();
}
function partyWipe() {
  if (G.secret) exitSecret(false, true);
  for (const m of G.mobs) m.dispose(); G.mobs.length = 0;
  if (G.boss) { G.boss.dispose(); G.boss = null; UI.showBoss(false); }
  const lost = Math.floor(G.gold * .05); G.gold -= lost;
  for (const h of G.party) { h.reviveT = 0; h.mode = 'bench'; h.y = 0; h.air = false; h.recalc(); h.life = h.S.lifeMax; h.mana = h.S.manaMax; }
  const h = G.hero; scene.remove(h.view.mesh); h.enter(h.x, false);
  if (G.wave === G.wavesPerFloor) G.wave = 1;
  G.waveSpawned = false; G.clearT = 1.2; G.wipe = 0; UI.dirtyAll();
  UI.toast('YOU HAVE DIED', lost ? `LOST ${fmt(lost)} GOLD` : '');
}

/* =========================================================================
   SAVE / LOAD (per-viewer browser storage)
   ========================================================================= */
let saveT = 0;
function save(force) {
  if (!force && G.time - saveT < 4) return; saveT = G.time;
  try {
    const data = {
      v: 2, floor: G.floor, gold: G.gold, gems: G.gems, playtime: G.playtime || 0, quests: QUESTS.save(), active: G.active, filter: G.filter, autoStat: G.autoStat, autoSkill: G.autoSkill, seq: ITEM_SEQ, inv: G.inv,
      heroes: G.party.map(h => ({ level: h.level, xp: h.xp, attr: h.attr, points: h.points, equip: h.equip, belt: h.belt, skillLv: h.skillLv, passLv: h.passLv, skillPts: h.skillPts })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const d = JSON.parse(raw); if (d.v !== 2) return false;
    G.floor = d.floor || 1; G.gold = d.gold || 0; G.active = d.active || 0; G.filter = d.filter || G.filter; G.autoStat = !!d.autoStat; G.autoSkill = !!d.autoSkill; ITEM_SEQ = d.seq || 1;
    if (typeof d.gems === 'number') G.gems = d.gems;
    G.playtime = d.playtime || 30; QUESTS.load(d.quests);
    G.inv = (d.inv || []).filter(it => BASE[it.base]);
    d.heroes.forEach((s, i) => {
      const h = G.party[i]; if (!h || !s) return;
      h.level = s.level; h.xp = s.xp; h.attr = s.attr; h.points = s.points;
      for (const k of SLOTS) h.equip[k] = s.equip && s.equip[k] && BASE[s.equip[k].base] ? s.equip[k] : null;
      h.belt = s.belt && s.belt.length === 4 ? s.belt : [[], [], [], []];
      if (s.skillLv) { h.skillLv = s.skillLv; h.passLv = s.passLv || [0, 0, 0, 0]; h.skillPts = s.skillPts || 0; }
      else { h.skillLv = [1, 0, 0, 0, 0, 0, 0, 0]; h.passLv = [0, 0, 0, 0]; h.skillPts = Math.max(0, h.level - 1); }
      h.recalc(); h.life = h.S.lifeMax; h.mana = h.S.manaMax;
    });
    return true;
  } catch (e) { return false; }
}
function resetProgress() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  location.reload();
}
function starterKit(h) {
  for (const [code] of h.cls.start) { const it = finalizeItem(newItem(code, 'normal', 1)); h.equip[TYPE_SLOT[BASE[code].type]] = it; }
  for (let i = 0; i < 4; i++) beltAdd(h, { k: 'hp', t: 0 });
  h.recalc(); h.life = h.S.lifeMax; h.mana = h.S.manaMax;
}

/* =========================================================================
   MAIN LOOP
   ========================================================================= */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(.05, (now - last) / 1000); last = now;
  let dt = real * G.speed;
  if (G.hitstop > 0) { G.hitstop -= real; dt *= .12; }
  CINE.tick(real); dt *= CINE.slow;
  let zoom = 1, focus = null;
  if (G.slowmo) {
    const sm = G.slowmo; sm.t -= real;
    const k = sm.t / sm.max;                         // 1 → 0
    const ease = k > .25 ? 1 : k / .25;              // hold, then release
    dt *= 1 - ease * .82;
    zoom = 1 + .2 * ease; focus = sm;
    if (sm.t <= 0) G.slowmo = null;
  }
  G.time += dt;
  G.tagCd = Math.max(0, G.tagCd - dt);
  const lead = G.hero;
  if (G.wipe > 0) { G.wipe -= real; if (G.wipe <= 0) partyWipe(); }
  const alive = G.mobs.some(m => !m.dead) || (G.boss && !G.boss.dead);
  tickLater(dt);
  if (G.secret) { if (G.secret.bossUp && !G.boss && !G.secret.ending) { G.secret.ending = true; later(3.2, () => exitSecret(true)); } }
  else if (!G.waveSpawned) { G.clearT -= dt; if (G.clearT <= 0) spawnWave(); }
  else if (!alive && !G.mobs.length && !G.boss) waveCleared();
  riftTick(dt); envTick(real); QUESTS.tick(real); STORY.tick(real);
  lead.update(dt);
  for (const b of G.bench) b.benchTick(dt);
  // auto tag: low life and a healthy partner
  if (G.auto && G.tagCd <= 0 && !lead.dead && lead.life < lead.S.lifeMax * .28 && !G.partner.dead && G.partner.life > G.partner.S.lifeMax * .7) tagTo(G.party.indexOf(G.partner));
  for (let i = G.mobs.length - 1; i >= 0; i--) { catchUp(G.mobs[i], lead); if (G.mobs[i].update(dt, lead)) { G.mobs[i].dispose(); G.mobs.splice(i, 1); } }
  if (G.boss) catchUp(G.boss, lead);
  if (G.boss && G.boss.update(dt, lead)) { G.boss.dispose(); G.boss = null; UI.showBoss(false); }
  updateFx(dt); updateSheetFx(dt); updateGhosts(dt); clearPlats(false);
  if (G.comboT > 0) { G.comboT -= real; if (G.comboT <= 0) G.combo = 0; }
  const want = lead.x - 500;
  G.camX += (want - G.camX) * Math.min(1, real * 4);
  // crowd camera: pull back when a route gets crowded, settle back once it thins out / is cleared
  const crowd = allEnemies().filter(e => !e.dead).length;
  if (crowd >= 7) G.crowdOn = true; else if (crowd <= 2 || !G.waveSpawned || G.secret && !G.boss) G.crowdOn = false;
  const zWant = G.crowdOn ? (G.secret ? .86 : .76) : 1;
  G.camZoom = (G.camZoom || 1) + (zWant - (G.camZoom || 1)) * Math.min(1, real * (zWant < (G.camZoom || 1) ? 1.4 : 1.1));
  let sx = 0, sy = 0;
  if (G.shakeT > 0) { G.shakeT -= real; sx = rnd(-1, 1) * G.shakeA; sy = rnd(-1, 1) * G.shakeA * .7; G.shakeA *= Math.pow(.02, real); }
  const cz = G.camZoom || 1;
  // keep the hero's screen x and the ground line fixed while zooming
  const ax = G.camX + (500 - VW / 2) * (1 - 1 / cz), ay = (GROUND + 120 - VH / 2) * (1 - 1 / cz);
  if (focus) {
    const k = (zoom - 1) / .2;
    camera.position.x = ax + (focus.x - (G.camX + VW / 2)) * k * .8 + sx; camera.position.y = ay + (focus.y - VH / 2) * k * .6 + sy;
  } else { camera.position.x = ax + sx; camera.position.y = ay + sy; }
  zoom *= cz;
  if (Math.abs(camera.zoom - zoom) > 1e-4) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
  BG.update(G.camX, dt, G.time);
  WEATHER.update(G.camX, dt, real);
  CUT.update(real);
  UI.tick();
  renderer.render(scene, camera);
  CUT.render();
  save();
}

async function boot() {
  layout();
  buildFxTextures();
  const lt = document.getElementById('loadTxt');
  try {
    lt.textContent = 'rallying Lyn · Hector…';
    await Promise.all(PARTY_KEYS.map(k => loadSprite(k)));
  } catch (e) { lt.textContent = 'Could not load ' + (e.message || e); throw e; }
  lt.textContent = 'scouting the brigands…';
  await Promise.all(Object.keys(ENEMY_DEFS).map(k => loadSprite('e_' + k).then(() => SPINE_MOBS.push(k)).catch(() => null)));
  await loadSprite('e_batta');
  await loadSprite('e_dracula').catch(() => null);
  await loadSheetFx();
  buildMobTextures();
  await ITEM_ART.load();
  await loadHeroArt();
  UI.makeSnapshots();
  try { BG.art = await loadEnvArt(); } catch (e) { BG.art = null; }
  BG.build();
  WEATHER.build();
  G.party = PARTY_KEYS.map((k, i) => new Hero(k, i));
  if (!load()) { for (const h of G.party) starterKit(h); }
  for (const h of G.party) h.recalc();
  G.active = Math.min(G.active, G.party.length - 1);
  G.hero.enter(420, false);
  G.camX = G.hero.x - 500;
  G.clearT = 1.4;
  UI.init();
  QUESTS.init(); STORY.init();
  document.getElementById('loading').remove();
  last = performance.now();
  requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => save(true));
}
boot();
