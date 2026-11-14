'use strict';
/* ui.js — panel, sheets, D2 tooltips, item art, combat text */
/* ---------------- snapshots for portraits & skill icons, rendered from the skeletons ---------------- */
function snapshot(view, animName, t, cx, cy, size, px, bg, aspect = 1) {
  const sk = view.sk;
  sk.setToSetupPose(); sk.x = 0; sk.y = 0;
  const anim = view.asset.data.findAnimation(animName);
  if (anim) anim.apply(sk, 0, t, false, null, 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
  sk.updateWorldTransform(); view.build();
  const w = px, h = Math.round(px * aspect);
  const rt = new THREE.WebGLRenderTarget(w, h);
  const cam = new THREE.OrthographicCamera(cx - size / 2, cx + size / 2, cy + size * aspect / 2, cy - size * aspect / 2, -10, 10);
  const sc = new THREE.Scene(); sc.add(view.mesh);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  const buf = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  renderer.setRenderTarget(null); renderer.setClearColor(0x07050a, 1); rt.dispose(); sc.remove(view.mesh);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4, a = buf[s + 3];
    const k = a ? 255 / a : 0;
    img.data[d] = Math.min(255, buf[s] * k); img.data[d + 1] = Math.min(255, buf[s + 1] * k); img.data[d + 2] = Math.min(255, buf[s + 2] * k); img.data[d + 3] = a;
  }
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d').putImageData(img, 0, 0);
  if (bg) bg(ctx, w, h);
  ctx.drawImage(tmp, 0, 0);
  return c;
}
/* pick the frame of a skill with the most visible ink inside the icon crop */
function bestFrame(view, animName, m, cx, cy, size) {
  const px = 48, rt = new THREE.WebGLRenderTarget(px, px), buf = new Uint8Array(px * px * 4);
  const cam = new THREE.OrthographicCamera(cx - size / 2, cx + size / 2, cy + size / 2, cy - size / 2, -10, 10);
  const sc = new THREE.Scene(); sc.add(view.mesh);
  const anim = view.asset.data.findAnimation(animName);
  let best = m.dur * .4, bestScore = -1;
  const end = Math.max(m.cancel, m.boxEnd, m.lastEv, .3);
  for (let k = 1; k <= 9; k++) {
    const t = end * k / 9.5;
    view.sk.setToSetupPose(); view.sk.x = 0; view.sk.y = 0;
    anim.apply(view.sk, 0, t, false, null, 1, spine.MixBlend.setup, spine.MixDirection.mixIn);
    view.sk.updateWorldTransform(); view.build();
    renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(sc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, px, px, buf);
    let score = 0;
    for (let i = 0; i < buf.length; i += 4) score += Math.min(255, buf[i + 3] + (buf[i] + buf[i + 1] + buf[i + 2]) / 3);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  renderer.setRenderTarget(null); renderer.setClearColor(0x07050a, 1); rt.dispose(); sc.remove(view.mesh);
  return best;
}
/* =========================================================================
   ITEM ART — project icons (Art/UI/Icon/Item) for helm/armor/boots/amulet/ring/weapons,
   procedural icons for gloves/belts/shields/bolts until art exists
   ========================================================================= */
/* Fire Emblem stamp art (icons/fe/<n>.png), three pools per type: normal / exceptional / elite */
const ICON_SETS = {
  sword: [[57, 56, 53], [38, 64, 15, 13], [26, 33, 60, 45, 34, 14]],
  scythe: [[50, 51, 55], [36, 27, 23, 31], [24, 32, 28, 65, 54]],
  xbow: [[16], [29], [39]], bolts: [[1], [25], [35]],
  helm: [[79], [63, 18], [19, 20, 21]], armor: [[75], [94], [94, 98]], gloves: [[100], [98], [97]], boots: [[69], [69], [69]],
  belt: [[67], [86], [86]], shield: [[73], [73], [73]], ring: [[70], [84], [88]], amulet: [[76], [83], [97]],
};
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const ITEM_ART = {
  ok: new Set(), cache: {},
  async load() {
    const ids = new Set(); for (const t in ICON_SETS) for (const tier of ICON_SETS[t]) for (const id of tier) ids.add(id);
    await Promise.all([...ids].map(id => new Promise(res => { const im = new Image(); im.onload = () => { this.ok.add(id); res(); }; im.onerror = res; im.src = 'icons/fe/' + id + '.png'; })));
  },
  url(it) {
    const b = BASE[it.base];
    const sets = ICON_SETS[b.type];
    if (sets) {
      let pool = sets[b.tier].filter(id => this.ok.has(id));
      if ((it.q === 'unique' || it.q === 'set') && b.tier < 2) { const up = sets[Math.min(2, b.tier + 1)].filter(id => this.ok.has(id)); if (up.length) pool = up; }
      if (pool.length) return 'icons/fe/' + pool[strHash(it.base + (it.uniq || it.set || '')) % pool.length] + '.png';
    }
    const key = b.type + b.tier + b.w + b.h;
    if (!this.cache[key]) this.cache[key] = drawItemIcon(b.type, b.w, b.h, b.tier);
    return this.cache[key];
  },
};
function drawItemIcon(type, w, h, tier) {
  const P = 64, W = w * P, H = h * P;
  const metal = ['#a7adb6', '#b8945a', '#7d7fa0'][tier], dark = ['#3a3d44', '#4a3520', '#2d2a44'][tier], acc = ['#c94040', '#d8ad57', '#9b5cff'][tier];
  const c = makeCanvas(W, H, (x) => {
    x.lineJoin = 'round'; x.lineCap = 'round';
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, metal); g.addColorStop(1, dark);
    x.fillStyle = g; x.strokeStyle = '#0a0709'; x.lineWidth = 4;
    if (type === 'gloves') {
      x.beginPath(); x.moveTo(W * .25, H * .95); x.lineTo(W * .22, H * .5); x.lineTo(W * .2, H * .18); x.quadraticCurveTo(W * .3, H * .08, W * .38, H * .2);
      x.lineTo(W * .45, H * .1); x.quadraticCurveTo(W * .55, H * .05, W * .58, H * .2); x.lineTo(W * .66, H * .14); x.quadraticCurveTo(W * .78, H * .14, W * .76, H * .32);
      x.lineTo(W * .88, H * .42); x.quadraticCurveTo(W * .92, H * .55, W * .78, H * .6); x.lineTo(W * .74, H * .95); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = dark; x.fillRect(W * .22, H * .72, W * .54, H * .12); x.fillStyle = acc; x.fillRect(W * .44, H * .74, W * .1, H * .08);
    } else if (type === 'belt') {
      x.beginPath(); x.roundRect ? x.roundRect(W * .04, H * .3, W * .92, H * .4, 8) : x.rect(W * .04, H * .3, W * .92, H * .4); x.fill(); x.stroke();
      x.fillStyle = acc; x.strokeStyle = '#0a0709'; x.beginPath(); x.rect(W * .42, H * .18, W * .16, H * .64); x.fill(); x.stroke();
      x.fillStyle = dark; x.fillRect(W * .47, H * .3, W * .06, H * .4);
      for (let i = 0; i < 6; i++) { x.fillStyle = metal; x.beginPath(); x.arc(W * (.1 + i * .06 + (i > 2 ? .46 : 0)), H * .5, 3, 0, 7); x.fill(); }
    } else if (type === 'shield') {
      x.beginPath();
      if (h <= 2) { x.arc(W / 2, H / 2, Math.min(W, H) * .42, 0, 7); }
      else { x.moveTo(W * .12, H * .08); x.lineTo(W * .88, H * .08); x.lineTo(W * .88, H * .5); x.quadraticCurveTo(W * .86, H * .82, W * .5, H * .96); x.quadraticCurveTo(W * .14, H * .82, W * .12, H * .5); x.closePath(); }
      x.fill(); x.stroke();
      x.strokeStyle = acc; x.lineWidth = 6; x.beginPath(); x.moveTo(W / 2, H * .18); x.lineTo(W / 2, H * .78); x.moveTo(W * .26, H * .4); x.lineTo(W * .74, H * .4); x.stroke();
      x.fillStyle = acc; x.beginPath(); x.arc(W / 2, H * .4, 9, 0, 7); x.fill();
    } else if (type === 'bolts') {
      x.fillStyle = '#5a3a24'; x.beginPath(); x.roundRect ? x.roundRect(W * .2, H * .25, W * .6, H * .72, 10) : x.rect(W * .2, H * .25, W * .6, H * .72); x.fill(); x.stroke();
      for (let i = 0; i < 4; i++) { const bx = W * (.3 + i * .13); x.strokeStyle = '#d8d0c0'; x.lineWidth = 3; x.beginPath(); x.moveTo(bx, H * .3); x.lineTo(bx, H * .06); x.stroke(); x.fillStyle = metal; x.beginPath(); x.moveTo(bx - 6, H * .08); x.lineTo(bx, H * .01); x.lineTo(bx + 6, H * .08); x.fill(); }
      x.fillStyle = acc; x.fillRect(W * .2, H * .45, W * .6, H * .06);
    } else {
      x.beginPath(); x.arc(W / 2, H / 2, Math.min(W, H) * .35, 0, 7); x.fill(); x.stroke();
    }
  });
  return c.toDataURL();
}
function potionIcon(k) { return 'icons/fe/' + { hp: 99, mp: 85, rj: 82 }[k] + '.png'; }

/* =========================================================================
   UI
   ========================================================================= */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DOLL = { // px in the 516-wide paperdoll, 38px cells (D2 layout)
  rhand: [40, 40, 2, 4], head: [220, 0, 2, 2], amulet: [310, 20, 1, 1], torso: [220, 86, 2, 3], lhand: [400, 40, 2, 4],
  ring1: [170, 210, 1, 1], belt: [220, 210, 2, 1], ring2: [310, 210, 1, 1], gloves: [40, 200, 2, 2], boots: [400, 200, 2, 2],
};
const CELL = 46, DCELL = 38;

/* change-only DOM writers: rewriting identical text/HTML/styles every frame forces style+layout work, which is what hurts on phones */
function sTe(e, v) { v = String(v); if (e._t !== v) { e._t = v; e.textContent = v; } }
function sT(id, v) { sTe($(id), v); }
function sH(id, v) { const e = $(id); if (e._h !== v) { e._h = v; e.innerHTML = v; } }
function sW(id, v) { const e = $(id); if (e._w !== v) { e._w = v; e.style.width = v; } }
function sHid(id, v) { const e = $(id); if (e.hidden !== !!v) e.hidden = !!v; }
const UI = {
  portraits: {}, icons: {}, figures: {}, dirty: { inv: true, char: true, belt: true, grid: true }, sheet: null, viewIdx: 0, sel: null, resetArm: 0,
  dirtyAll() { this.dirty.inv = this.dirty.char = this.dirty.belt = this.dirty.grid = true; this.dirty.waves = this.dirty.shop = true; },
  init() {
    const snd = $('sndBtn');
    const sndRender = () => { snd.classList.toggle('on', !AUDIO.muted); snd.textContent = AUDIO.muted ? '♪ Off' : '♪ On'; snd.setAttribute('aria-label', AUDIO.muted ? 'Sound off' : 'Sound on'); };
    snd.addEventListener('click', () => { AUDIO.start(); AUDIO.setMuted(!AUDIO.muted); sndRender(); }); sndRender();
    uiEl.addEventListener('click', (e) => { if (e.target.closest('button')) SFX.click(); });
    $('autoBtn').addEventListener('click', () => { G.auto = !G.auto; $('autoBtn').classList.toggle('on', G.auto); });
    $('spdBtn').addEventListener('click', () => { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; $('spdBtn').textContent = '×' + G.speed; $('spdBtn').classList.toggle('on', G.speed > 1); });
    $('tagBtn').addEventListener('click', () => { if (!tagTo(G.party.indexOf(G.partner))) this.toastSmall(G.partner.dead ? G.partner.cls.name + ' is recovering' : 'Tag is on cooldown'); });
    $('charBtn').addEventListener('click', () => this.open('char'));
    $('invBtn').addEventListener('click', () => this.open('inv'));
    $('skillBtn').addEventListener('click', () => this.open('skills'));
    $('shopBtn').addEventListener('click', () => this.open('shop'));
    $('gxClose').addEventListener('click', () => { $('gacha').hidden = true; this.dirtyAll(); });
    $('shClose').addEventListener('click', () => this.close());
    for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => this.open(b.dataset.tab, this.viewIdx));
    this.buildGrid(); this.buildBelt();
    this.dirtyAll();
  },
  /* ---------- bottom panel ---------- */
  buildGrid() {
    const grid = $('grid'); grid.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'slot' + (i >= 6 ? ' ult' : ''); b.id = 'slot' + i;
      b.innerHTML = `<img alt=""><i class="cd"></i><span class="rn">${i + 1}</span><span class="mc"></span><span class="cdt"></span>`;
      b.addEventListener('click', () => { const h = G.hero; if (!h.learned(i)) { this.skSel = { kind: 'skill', i }; this.open('skills'); return; } h.queue = i; });
      grid.appendChild(b);
    }
  },
  buildBelt() {
    const belt = $('belt'); belt.innerHTML = '';
    for (let c = 0; c < 4; c++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pot'; b.id = 'pot' + c;
      b.innerHTML = `<img alt=""><span class="k">${c + 1}</span><span class="n"></span>`;
      b.addEventListener('click', () => drinkCol(G.hero, c));
      belt.appendChild(b);
    }
  },
  renderGrid() {
    const h = G.hero;
    $('heroName').textContent = h.cls.name; $('heroCls').textContent = h.cls.title;
    for (let i = 0; i < 8; i++) { const s = $('slot' + i); s.querySelector('img').src = this.icons[h.key][i]; s.setAttribute('aria-label', `${ROMAN[i]} ${h.cls.skillNames[i]}`); s.querySelector('.mc').textContent = h.cls.skillCost[i]; }
    const p = G.partner;
    $('tagImg').src = this.portraits[p.key]; $('tagName').textContent = p.cls.name;
  },
  renderBelt() {
    const h = G.hero, rows = h.beltRows();
    for (let c = 0; c < 4; c++) {
      const col = h.belt[c], el = $('pot' + c), top = col[col.length - 1];
      el.querySelector('img').src = top ? potionIcon(top.k) : '';
      el.querySelector('img').style.visibility = top ? 'visible' : 'hidden';
      el.querySelector('.n').textContent = col.length ? `${col.length}/${rows}` : '';
      el.title = top ? potionName(top) : 'Empty';
    }
  },
  renderWaves() {
    const w = $('waves'); w.innerHTML = '';
    for (let i = 1; i <= G.wavesPerFloor; i++) {
      if (i === G.wavesPerFloor) { const s = document.createElement('span'); s.className = 'skull' + (G.wave === i ? ' now' : ''); w.appendChild(s); }
      else { const p = document.createElement('i'); if (i < G.wave) p.className = 'done'; else if (i === G.wave) p.className = 'now'; w.appendChild(p); }
    }
    $('floorN').textContent = G.floor;
    $('floorName').textContent = G.secret ? 'The Upside Down' : FLOORS[(G.floor - 1) % FLOORS.length];
    const dn = DIFF_NAME[difficulty()];
    $('diffSub').textContent = dn[0] + dn.slice(1).toLowerCase() + ' · mlvl ' + mlvlNow();
    $('objTxt').textContent = G.secret ? 'Defeat Count Dracula' : G.wave === G.wavesPerFloor ? 'Defeat ' + BOSS_DEF.name : `Rout the enemy · ${G.wave}/${G.wavesPerFloor - 1}`;
    $('diffTxt').innerHTML = `<b>${dn}</b> · mlvl ${mlvlNow()}`;
    $('diffTxt').className = 'diff d' + difficulty();
  },
  tick() {
    const h = G.hero, S = h.S;
    if (this.dirty.grid) { this.renderGrid(); this.dirty.grid = false; }
    if (this.dirty.waves) { this.renderWaves(); this.dirty.waves = false; }
    if (this.dirty.belt) { this.renderBelt(); this.dirty.belt = false; }
    sW('lifeFill', (100 * h.life / S.lifeMax).toFixed(1) + '%');
    sW('manaFill', (100 * h.mana / S.manaMax).toFixed(1) + '%');
    sH('lifeTx', `${Math.ceil(h.life)}<small> / ${S.lifeMax}</small>`);
    sH('manaTx', `${Math.floor(h.mana)}<small> / ${S.manaMax}</small>`);
    sT('heroLv', h.level);
    sW('xpFill', (h.xpFrac() * 100).toFixed(1) + '%');
    for (let i = 0; i < 8; i++) {
      const s = $('slot' + i), locked = !h.learned(i);
      const cd = h.skillCd[i], mx = h.cls.skillCd[i];
      const cv = cd > 0 ? (cd / mx).toFixed(2) : '0'; if (s._cd !== cv) { s._cd = cv; s.style.setProperty('--cd', cv); }
      sTe(s._cdt || (s._cdt = s.querySelector('.cdt')), locked ? (h.level < h.cls.skillReq[i] ? 'Lv ' + h.cls.skillReq[i] : h.skillPts > 0 && nodeInfo(h, { kind: 'skill', i }).can ? 'Learn' : '—') : cd > 0 ? Math.ceil(cd) : '');
      s.classList.toggle('locked', locked);
      sTe(s._mc || (s._mc = s.querySelector('.mc')), h.cost(i)); s.classList.toggle('nomana', !locked && h.mana < h.cost(i));
      s.classList.toggle('cast', h.mode === 'skill' && h.skillIdx === i);
      s.classList.toggle('q', h.queue === i);
      s.classList.toggle('next', G.auto && h.skillPtr === i && !locked);
    }
    const p = G.partner;
    sW('tagHp', (100 * p.life / p.S.lifeMax).toFixed(1) + '%');
    sT('tagSub', p.reviveT > 0 ? `Recovering ${Math.ceil(p.reviveT)}s` : `Level ${p.level}`);
    const tcd = Math.max(G.tagCd, p.reviveT > 0 ? 1 : 0);
    $('tagBtn').classList.toggle('cool', tcd > 0);
    $('tagBtn').classList.toggle('ready', tcd <= 0 && !G.partner.dead && !G.hero.cineStrike);
    sT('tagCd', G.tagCd > 0 ? Math.ceil(G.tagCd) : '');
    sT('goldTxt', fmt(G.gold));
    const cut = G.time - 5; while (G.dmgLog.length && G.dmgLog[0][0] < cut) G.dmgLog.shift();
    sT('dpsTxt', fmtS(G.dmgLog.reduce((s, d) => s + d[1], 0) / 5));
    const pts = G.party.reduce((s, x) => s + x.points, 0);
    sHid('charBadge', !pts); sT('charBadge', pts);
    const spts = G.party.reduce((s2, x) => s2 + x.skillPts, 0);
    sHid('skillBadge', !spts); sT('skillBadge', spts);
    sT('gemTxt', fmt(G.gems));
    sHid('invBadge', !G.newItems); sT('invBadge', G.newItems);
    if (G.boss) {
      const k = Math.max(0, G.boss.hp / G.boss.maxHp);
      sW('bossFill', (k * 100).toFixed(2) + '%'); sW('bossLag', (k * 100).toFixed(2) + '%');
      sT('bossHpTxt', fmt(G.boss.hp));
    }
    $('combo').classList.toggle('on', G.combo >= 3);
    if (this.sheet) {
      if (this.sheet === 'inv' && this.dirty.inv) { this.renderInv(); this.dirty.inv = false; }
      if (this.sheet === 'skills' && this.dirty.char) { this.renderSkills(); this.dirty.char = false; }
      if (this.sheet === 'shop' && this.dirty.shop) { this.renderShop(); this.dirty.shop = false; }
      if (this.sheet === 'char' && (this.dirty.char || (G.time | 0) !== this._ct)) { this._ct = G.time | 0; this.renderChar(); this.dirty.char = false; }
    }
  },
  /* ---------- sheets ---------- */
  open(tab, idx) {
    this.sheet = tab; this.viewIdx = idx ?? G.active; this.sel = null; this.hideTip();
    $('sheet').hidden = false;
    for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    const wt = $('whoTabs'); wt.innerHTML = '';
    G.party.forEach((h, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'who' + (i === this.viewIdx ? ' on' : '');
      b.innerHTML = `<img alt="" src="${this.portraits[h.key]}"><span>${h.cls.name}${h.points ? `<i>${h.points}</i>` : ''}</span>`;
      b.addEventListener('click', () => this.open(this.sheet, i));
      wt.appendChild(b);
    });
    if (tab === 'inv') G.newItems = 0;
    this.dirty.shop = true;
    this.dirty.inv = this.dirty.char = true;
    this.tick();
  },
  close() { this.sheet = null; $('sheet').hidden = true; this.hideTip(); },
  canUse(h, it) {
    if (!usableBy(h.cls, it)) return `${h.cls.name} cannot use ${TYPE_NAME[BASE[it.base].type]}s`;
    if (it.lvlreq > h.level) return `Requires level ${it.lvlreq}`;
    if (it.reqStr > h.S.str) return 'Not enough Strength';
    if (it.reqDex > h.S.dex) return 'Not enough Dexterity';
    return null;
  },
  renderInv() {
    const h = G.party[this.viewIdx], S = h.S;
    const slotHtml = (s) => {
      const it = h.equip[s];
      const blocked = s === 'lhand' && !it && h.equip.rhand && BASE[h.equip.rhand.base].twoH && h.cls.off === 'shield';
      const inactive = it && !S.active.has(s);
      const lab = it ? `<span class="dlab q-${it.q}">${esc(it.name)}<small>${SLOT_LABEL[s]}</small></span>` : '';
      return `<div class="dwrap">${lab}<button type="button" class="dslot ${it ? 'q-' + it.q : ''} ${inactive ? 'bad' : ''} ${blocked ? 'blocked' : ''} ${this.sel && it && this.sel.it === it ? 'sel' : ''}" data-slot="${s}" aria-label="${SLOT_LABEL[s]}">${it ? `<img alt="${esc(it.name)}" src="${ITEM_ART.url(it)}">` : `<span>${blocked ? 'Two-<br>Handed' : SLOT_LABEL[s].replace(' ', '<br>')}</span>`}</button></div>`;
    };
    const L = ['head', 'torso', 'gloves', 'belt', 'boots'], R = ['amulet', 'ring1', 'ring2', 'rhand', 'lhand'];
    const items = G.inv.map(it => {
      const b = BASE[it.base], bad = this.canUse(h, it);
      return `<button type="button" class="iitem q-${it.q} ${bad ? 'bad' : ''} ${this.sel && this.sel.it === it ? 'sel' : ''}" data-id="${it.id}"
        style="left:${it.x * CELL}px;top:${it.y * CELL}px;width:${CELL}px;height:${CELL}px" aria-label="${esc(it.name)}"><img alt="" src="${ITEM_ART.url(it)}"></button>`;
    }).join('');
    const el = (k) => S[k][1] ? ` <span class="el ${k}">+${S[k][0]}-${S[k][1]}</span>` : '';
    $('shBody').innerHTML = `
      <div class="doll"><div class="floor"></div><img class="fig" alt="${h.cls.name}" src="${this.figures[h.key]}">
        <div class="dcol l">${L.map(slotHtml).join('')}</div><div class="dcol r">${R.map(slotHtml).join('')}</div></div>
      <div class="sumline"><span>Damage <b>${S.min}-${S.max}</b>${el('fire')}${el('cold')}${el('ltng')}</span><span>Armor <b>${S.def}</b></span><span>Life <b>${S.lifeMax}</b></span><span>Magic Find <b>${S.mf}%</b></span></div>
      <div class="invgrid" style="width:${INV_W * CELL}px;height:${INV_H * CELL}px">${items}</div>
      <div class="invfoot">
        <span class="g"><i class="ic gold"></i>${fmt(G.gold)}</span>
        <span class="lf">AUTO-SELL</span>
        <button type="button" class="chipbtn ${G.filter.white ? 'on' : ''}" id="fWhite">Common</button>
        <button type="button" class="chipbtn ${G.filter.magic ? 'on' : ''}" id="fMagic">Magic</button>
        <button type="button" class="chipbtn" id="sellJunk">Salvage common</button>
        <button type="button" class="chipbtn gold" id="equipBest">Equip best</button>
      </div>`;
    for (const b of $('shBody').querySelectorAll('.dslot')) b.addEventListener('click', () => { const it = h.equip[b.dataset.slot]; if (it) this.select(it, 'eq', b.dataset.slot); });
    for (const b of $('shBody').querySelectorAll('.iitem')) b.addEventListener('click', () => { const it = G.inv.find(x => x.id === +b.dataset.id); if (it) this.select(it, 'inv'); });
    $('fWhite').addEventListener('click', () => { G.filter.white = !G.filter.white; this.dirty.inv = true; save(true); });
    $('fMagic').addEventListener('click', () => { G.filter.magic = !G.filter.magic; this.dirty.inv = true; save(true); });
    $('equipBest').addEventListener('click', () => { const n = equipBest(h); this.toastSmall(n ? `${h.cls.name} equipped ${n} upgrade${n > 1 ? 's' : ''}` : 'Nothing better in the bag'); this.hideTip(); });
    $('sellJunk').addEventListener('click', () => {
      let n = 0, g = 0; for (let i = G.inv.length - 1; i >= 0; i--) { const it = G.inv[i]; if (it.q === 'low' || it.q === 'normal' || it.q === 'superior') { g += sellPrice(it); G.inv.splice(i, 1); n++; } }
      G.gold += g; this.toastSmall(n ? `Sold ${n} items for ${fmt(g)} gold` : 'No common items to sell'); this.hideTip(); this.dirty.inv = true; save(true);
    });
  },
  renderChar() {
    const h = G.party[this.viewIdx], S = h.S, C = h.cls, m = mlvlNow();
    const ATTR = [['str', 'Strength', '#7a2a1c'], ['dex', 'Dexterity', '#2c5a2a'], ['vit', 'Vitality', '#7a5a1c'], ['ene', 'Energy', '#2a3a7a']];
    const attr = ([k, label, c]) => {
      const bonus = S[k] - h.attr[k];
      return `<div class="arow"><i class="ai" style="--c:${c}"></i><span class="al">${label}</span><b class="${bonus ? 'mod' : ''}">${S[k]}</b><button type="button" class="plus" data-k="${k}" ${h.points ? '' : 'disabled'} aria-label="Add a point to ${label}">+</button></div>`;
    };
    const row = (a, b, cls = '') => `<div class="srow"><span>${a}</span><i></i><b class="${cls}">${b}</b></div>`;
    const res = (k, label) => row(label, S[k] + '%', S[k] < 0 ? 'neg' : S[k] >= 75 ? 'max' : '');
    const cth = Math.round(chanceToHit(S.ar, monStats(m).def, h.level, m) * 100);
    const el = ['fire', 'cold', 'ltng'].filter(k => S[k][1]).map(k => `${S[k][0]}-${S[k][1]} ${k === 'ltng' ? 'lightning' : k}`).join(', ') || '—';
    const nextXp = h.level >= 99 ? '—' : fmt(XP_TABLE[h.level + 1] - h.xp);
    $('shBody').innerHTML = `
      <div class="cs-top"><img alt="" src="${this.portraits[h.key]}"><div><div class="nm">${C.name}</div><div class="cl">${C.title}</div></div>
        <div class="lv"><b>${h.level}</b><small>${nextXp} xp to next level</small></div></div>
      <div class="cs-xp"><i style="width:${(h.xpFrac() * 100).toFixed(1)}%"></i></div>
      <div class="sec">Attributes</div>
      <div class="attrs">${ATTR.map(attr).join('')}</div>
      <div class="ptsline ${h.points ? 'has' : ''}"><span>Points to spend <b>${h.points}</b></span><button type="button" class="chipbtn ${G.autoStat ? 'on' : ''}" id="autoStat">Auto-allocate</button></div>
      <div class="sec">Offensive</div>
      <div class="slist">${row('Damage', `${S.min}-${S.max}`)}${row('Elemental', el)}${row('Attack Rating', S.ar)}${row(`Hit chance · mlvl ${m}`, cth + '%')}${row('Attack Speed', '+' + S.ias + '%')}${row('Deadly Strike', S.ds + '%')}${row('Crushing Blow', S.cb + '%')}${row('Life / Mana Steal', `${S.ll}% / ${S.ml}%`)}</div>
      <div class="sec">Defensive</div>
      <div class="slist">${row('Life', `${Math.ceil(h.life)} / ${S.lifeMax}`)}${row('Mana', `${Math.floor(h.mana)} / ${S.manaMax}`)}${row('Armor', S.def)}${row('Block Chance', S.block + '%')}${row('Damage Reduced', S.dr + '%')}${row('Hit Recovery', '+' + S.fhr + '%')}${res('fr', 'Fire Resist')}${res('cr', 'Cold Resist')}${res('lr', 'Lightning Resist')}${res('pr', 'Poison Resist')}</div>
      <div class="sec">Utility</div>
      <div class="slist">${row('Magic Find', S.mf + '%')}${row('Gold Find', S.gf + '%')}${row('Move Speed', '+' + S.frw + '%')}${row('All Skills', '+' + S.skills)}${row('Replenish Life', S.regen)}${row('Difficulty', DIFF_NAME[difficulty()])}</div>
      <div class="cs-foot"><span>Resistances ${resPenalty()}% on ${DIFF_NAME[difficulty()].toLowerCase()}</span><button type="button" class="chipbtn danger" id="resetBtn">${this.resetArm > G.time ? 'Tap again to erase' : 'Reset progress'}</button></div>`;
    for (const b of $('shBody').querySelectorAll('.plus')) b.addEventListener('click', () => spendPoint(h, b.dataset.k));
    $('autoStat').addEventListener('click', () => { G.autoStat = !G.autoStat; if (G.autoStat) for (const x of G.party) autoAllocate(x); this.dirtyAll(); save(true); });
    $('resetBtn').addEventListener('click', () => { if (this.resetArm > G.time) resetProgress(); else { this.resetArm = G.time + 3; this.dirty.char = true; } });
  },
  /* ---------- D4 tooltip ---------- */
  select(it, where, slot) { this.sel = { it, where, slot }; this.dirty.inv = true; this.showTip(); },
  hideTip() { $('tip').hidden = true; if (this.sel) { this.sel = null; this.dirty.inv = true; } },
  itemLines(it, h) {
    const b = BASE[it.base], S = h.S, Lb = [];
    const QN = { low: 'Low Quality', normal: 'Common', superior: 'Superior', magic: 'Magic', rare: 'Rare', set: 'Set', unique: 'Unique' };
    const head = `<div class="th" style="--qc:${Q_COLOR[it.q]}"><div class="tn">${esc(it.name)}</div>
      <div class="tt">${QN[it.q]} ${TIER_NAME[b.tier] !== 'Normal' ? TIER_NAME[b.tier] + ' ' : ''}${it.q === 'rare' || it.q === 'unique' || it.q === 'set' ? b.name : TYPE_NAME[b.type]}${b.twoH ? ' · Two-Handed' : ''}</div>
      <div class="ilv">Item Level<b>${it.ilvl}</b></div></div>`;
    if (it.def !== undefined) Lb.push(`<div class="big"><b class="${it.defMod ? 'mod' : ''}">${it.def}</b><span>Armor</span></div>`);
    if (it.dmg) Lb.push(`<div class="big"><b class="${it.dmgMod ? 'mod' : ''}">${it.dmg[0]}-${it.dmg[1]}</b><span>Damage</span></div>`);
    const meta = [];
    if (b.type === 'shield') meta.push(`${b.block}% Block Chance`);
    if (b.type === 'belt') meta.push(`${b.rows} potion rows`);
    if (WEAPON_TYPES.has(b.type)) meta.push(b.wsm < 0 ? 'Fast attack speed' : b.wsm > 0 ? 'Slow attack speed' : 'Normal attack speed');
    if (meta.length) Lb.push(`<div class="tmeta">${meta.join(' · ')}</div>`);
    const keys = Object.keys(it.stats).sort((a, b2) => STAT_ORDER.indexOf(a) - STAT_ORDER.indexOf(b2));
    const ac = it.q === 'set' ? 'st' : it.q === 'unique' ? 'un' : 'mg';
    const aff = keys.filter(k => !((k === 'ed' || k === 'def') && it.def !== undefined && it.q === 'superior')).map(k => `<div class="aff ${ac}">${STAT_TXT[k] ? STAT_TXT[k](it.stats[k]) : k}</div>`);
    if (aff.length) { Lb.push('<div class="tdiv"></div>'); Lb.push(...aff); }
    if (it.set) {
      const SD = SETS[it.set], members = SET_ITEMS.filter(x => x.set === it.set);
      const owned = new Set(SLOTS.map(s => h.equip[s]).filter(x => x && x.set === it.set).map(x => x.name));
      const n = owned.size;
      Lb.push(`<div class="setname">${SD.name} (${n}/${members.length})</div>`);
      for (const mm of members) Lb.push(`<div class="aff st ${owned.has(mm.n) ? '' : 'dim'}">${mm.n}</div>`);
      for (const k in SD.partial) for (const st in SD.partial[k]) Lb.push(`<div class="aff st ${n >= +k ? '' : 'dim'}">(${k}) ${STAT_TXT[st](SD.partial[k][st])}</div>`);
      for (const st in SD.full) Lb.push(`<div class="aff un ${n >= members.length ? '' : 'dim'}">(Full) ${STAT_TXT[st](SD.full[st])}</div>`);
    }
    Lb.push('<div class="tdiv"></div>');
    if (b.str) Lb.push(`<div class="req ${b.str > S.str ? 'red' : ''}">Requires ${b.str} Strength</div>`);
    if (b.dex) Lb.push(`<div class="req ${b.dex > S.dex ? 'red' : ''}">Requires ${b.dex} Dexterity</div>`);
    if (it.lvlreq) Lb.push(`<div class="req ${it.lvlreq > h.level ? 'red' : ''}">Requires Level ${it.lvlreq}</div>`);
    if (!usableBy(h.cls, it)) Lb.push(`<div class="req red">${h.cls.name} cannot use ${TYPE_NAME[b.type]}s</div>`);
    Lb.push(`<div class="sell">Sell value <i class="ic gold"></i> ${fmt(sellPrice(it))}</div>`);
    return head + `<div class="tbody">${Lb.join('')}</div>`;
  },
  compare(h, it, slot) {
    const S0 = h.S, S1 = computeStats(h, { [slot]: it }, resPenalty());
    const d = [];
    const add = (lab, a, b) => { const x = Math.round(b - a); if (x) d.push(`<span class="${x > 0 ? 'up' : 'down'}">${x > 0 ? '+' : ''}${x} ${lab}</span>`); };
    add('Damage', (S0.min + S0.max) / 2, (S1.min + S1.max) / 2); add('Armor', S0.def, S1.def); add('Life', S0.lifeMax, S1.lifeMax);
    add('Attack Rating', S0.ar, S1.ar); add('Mana', S0.manaMax, S1.manaMax); add('% Magic Find', S0.mf, S1.mf); add('Total Resistance', S0.fr + S0.cr + S0.lr + S0.pr, S1.fr + S1.cr + S1.lr + S1.pr);
    return `<div class="cmp"><span class="ttl">Compared to equipped</span>${d.length ? d.join('') : '<span class="dim">No change</span>'}</div>`;
  },
  showTip() {
    const { it, where, slot } = this.sel; const h = G.party[this.viewIdx];
    const tip = $('tip'); let cmp = '', acts = '';
    if (where === 'inv') {
      const why = this.canUse(h, it);
      const t = BASE[it.base].type;
      if (!why) {
        const tslot = TYPE_SLOT[t] === 'ring' ? (h.equip.ring1 ? (h.equip.ring2 ? 'ring1' : 'ring2') : 'ring1') : TYPE_SLOT[t];
        cmp = this.compare(h, it, tslot);
        if (TYPE_SLOT[t] === 'ring' && h.equip.ring1 && h.equip.ring2) acts += `<button type="button" class="tbtn" data-a="eq" data-s="ring1">Equip left</button><button type="button" class="tbtn" data-a="eq" data-s="ring2">Equip right</button>`;
        else acts += `<button type="button" class="tbtn" data-a="eq">Equip</button>`;
      } else acts += `<div class="why red">${why}</div>`;
      acts += `<button type="button" class="tbtn ghost" data-a="sell">Sell</button>`;
    } else acts += `<button type="button" class="tbtn" data-a="uneq">Unequip</button>`;
    acts += `<button type="button" class="tbtn ghost" data-a="close">Close</button>`;
    tip.innerHTML = this.itemLines(it, h) + cmp + `<div class="ta">${acts}</div>`;
    tip.hidden = false;
    for (const b of tip.querySelectorAll('.tbtn')) b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'eq') equipItem(h, it, b.dataset.s);
      else if (a === 'sell') { const i = G.inv.indexOf(it); if (i >= 0) { G.inv.splice(i, 1); G.gold += sellPrice(it); save(true); } }
      else if (a === 'uneq') unequip(h, slot);
      this.hideTip(); this.dirtyAll();
    });
  },
  /* ---------- skill tree ---------- */
  passiveIcon(key, i) {
    if (this.passIcons && this.passIcons[key]) return this.passIcons[key][i];
    this._pi = this._pi || {}; const id = key + i; if (this._pi[id]) return this._pi[id];
    const col = CLASS[key].color;
    return this._pi[id] = makeCanvas(128, 128, (c) => {
      const g = c.createRadialGradient(64, 60, 4, 64, 64, 80); g.addColorStop(0, '#2a1d14'); g.addColorStop(1, '#060504'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      c.translate(64, 64); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 5; c.shadowColor = col; c.shadowBlur = 14; c.lineCap = 'round';
      const glyph = [
        () => { c.beginPath(); c.moveTo(-30, 30); c.lineTo(26, -26); c.stroke(); c.beginPath(); c.arc(30, -10, 22, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); },
        () => { c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(30, 6, 0, 32); c.quadraticCurveTo(-30, 6, 0, -34); c.fill(); },
        () => { c.beginPath(); c.moveTo(0, -34); c.lineTo(30, -20); c.lineTo(26, 14); c.lineTo(0, 34); c.lineTo(-26, 14); c.lineTo(-30, -20); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(0, -14); c.lineTo(0, 16); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke(); },
        () => { for (const dx of [-16, 4]) { c.beginPath(); c.moveTo(dx - 10, -26); c.lineTo(dx + 14, 0); c.lineTo(dx - 10, 26); c.stroke(); } },
      ][i];
      glyph();
    }).toDataURL();
  },
  renderSkills() {
    const h = G.party[this.viewIdx], C = h.cls;
    if (!this.skSel) this.skSel = { kind: 'skill', i: 0 };
    const nodeHtml = (node) => {
      const inf = nodeInfo(h, node), sel = this.skSel.kind === node.kind && this.skSel.i === node.i;
      const isP = node.kind === 'pas';
      const img = isP ? this.passiveIcon(h.key, node.i) : this.icons[h.key][node.i];
      const name = isP ? C.passives[node.i].n : C.skillNames[node.i];
      return `<button type="button" class="node ${isP ? 'pas' : ''} ${inf.lv ? 'has' : 'off'} ${inf.can ? 'can' : ''} ${sel ? 'sel' : ''}" data-k="${node.kind}" data-i="${node.i}" aria-label="${esc(name)}">
        <img alt="" src="${img}"><span class="lv">${inf.lv}/${inf.max}</span></button>
        <div class="nlab ${inf.lv ? 'has' : ''}">${esc(name)}${inf.reqOk ? '' : `<br><span class="red">Level ${inf.reqLv}</span>`}</div>`;
    };
    const col = (title, nodes) => `<div class="tcol"><h4>${title}</h4>${nodes.map(nodeHtml).join('')}</div>`;
    const sel = this.skSel, inf = nodeInfo(h, sel);
    let det = '';
    if (sel.kind === 'skill') {
      const i = sel.i, m = ASSETS[h.key].meta['skill_' + i];
      const hits = Math.max(1, m.windows || m.skillEv || 1);
      const lvE = h.effLv(i), cur = Math.round(C.skillMult[i] * 100 * (lvE ? h.skillMul(i) : 1)), nxt = Math.round(C.skillMult[i] * 100 * (1 + .15 * Math.max(0, lvE)));
      det = `<div class="sn">${ROMAN[i]} · ${C.skillNames[i]}</div><div class="sk">Active skill · Mana ${C.skillCost[i]} · Cooldown ${C.skillCd[i]}s${inf.prev >= 0 ? ' · needs ' + C.skillNames[inf.prev] : ''}</div>
        <p>Deals <b>${cur}%</b> weapon damage spread over ${hits} hit${hits > 1 ? 's' : ''}.${h.S.skills ? ` (+${h.S.skills} from items)` : ''}</p>
        ${inf.lv < SKILL_MAX ? `<p class="nx">Next rank: ${nxt}% weapon damage</p>` : ''}`;
    } else {
      const p = C.passives[sel.i];
      det = `<div class="sn">${p.n}</div><div class="sk">Passive · Requires level ${p.req}</div><p>${p.d}.</p>
        ${inf.lv ? `<p>Current: ${Object.entries(p.st(inf.lv)).map(([k, v]) => STAT_TXT[k] ? STAT_TXT[k](v) : (k === 'defp' ? `+${v}% Armor` : k === 'cdr' ? `−${v}% Cooldowns` : k)).join(' · ')}</p>` : ''}`;
    }
    $('shBody').innerHTML = `
      <div class="st-head"><span class="pts ${h.skillPts ? 'has' : ''}">Skill points <b>${h.skillPts}</b></span>
        <span><button type="button" class="chipbtn ${G.autoSkill ? 'on' : ''}" id="autoSkill">Auto-spend</button></span></div>
      <div class="tree">
        ${col('Carnage', [0, 2, 4, 6].map(i => ({ kind: 'skill', i })))}
        ${col('Technique', [1, 3, 5, 7].map(i => ({ kind: 'skill', i })))}
        ${col('Passives', [0, 1, 2, 3].map(i => ({ kind: 'pas', i })))}
      </div>
      <div class="sdetail frame">${det}<div class="row"><button type="button" class="tbtn" id="learnBtn" ${inf.can ? '' : 'disabled'}>${inf.can ? 'Learn · 1 point' : inf.lv >= SKILL_MAX ? 'Maxed' : !inf.reqOk ? `Requires level ${inf.reqLv}` : !inf.prevOk ? 'Learn the previous skill first' : 'No skill points'}</button></div></div>`;
    // connector lines inside the two skill columns
    for (const colEl of [...$('shBody').querySelectorAll('.tcol')].slice(0, 2)) {
      const nodes = [...colEl.querySelectorAll('.node')];
      for (let k = 1; k < nodes.length; k++) {
        const a = nodes[k - 1], b = nodes[k], ln = document.createElement('i');
        ln.className = 'link' + (a.classList.contains('has') ? ' on' : '');
        ln.style.top = (a.offsetTop + a.offsetHeight) + 'px'; ln.style.height = (b.offsetTop - a.offsetTop - a.offsetHeight) + 'px';
        colEl.appendChild(ln);
      }
    }
    for (const b of $('shBody').querySelectorAll('.node')) b.addEventListener('click', () => { this.skSel = { kind: b.dataset.k, i: +b.dataset.i }; this.dirty.char = true; });
    $('learnBtn').addEventListener('click', () => { learnNode(h, this.skSel); this.dirty.char = true; });
    $('autoSkill').addEventListener('click', () => { G.autoSkill = !G.autoSkill; if (G.autoSkill) for (const x of G.party) autoSkill(x); this.dirtyAll(); save(true); });
  },
  /* ---------- shop & reliquary (mock store) ---------- */
  chestIcon() {
    if (this._chest) return this._chest;
    return this._chest = makeCanvas(220, 220, (c) => {
      c.translate(110, 120);
      const g = c.createLinearGradient(0, -60, 0, 60); g.addColorStop(0, '#4a2e1a'); g.addColorStop(1, '#1a0f08');
      c.fillStyle = g; c.strokeStyle = '#b39466'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-80, -10); c.lineTo(80, -10); c.lineTo(76, 60); c.lineTo(-76, 60); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-80, -10); c.quadraticCurveTo(0, -80, 80, -10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#b39466'; c.fillRect(-6, -40, 12, 100); c.fillRect(-80, 14, 160, 8);
      c.shadowColor = '#b070ff'; c.shadowBlur = 30; c.fillStyle = '#c8a0ff'; c.beginPath(); c.moveTo(0, -4); c.lineTo(14, 14); c.lineTo(0, 32); c.lineTo(-14, 14); c.closePath(); c.fill();
    }).toDataURL();
  },
  renderShop() {
    const g = G.gems;
    const gem = '<i class="ic gem"></i>';
    const B = SHOP_BUNDLES.map((b, k) => `<div class="bundle frame"><div class="bt"><span class="bi" style="--bc:${b.c}">${b.ico}</span><b>${b.n}</b></div><p>${b.d}</p>
      <button type="button" class="buy ${g < b.cost ? 'no' : ''}" data-b="${k}">${gem} ${b.cost}</button></div>`).join('');
    const P = GEM_PACKS.map((p, k) => `<button type="button" class="pack frame" data-p="${k}"><span class="gv">${gem} ${fmt(p.g)}</span><span class="pv">${p.name}</span><span class="pv">${p.price}</span><span class="demo">DEMO · FREE</span></button>`).join('');
    $('shBody').innerHTML = `
      <div class="shop-sec">Reliquary <small>gem gacha</small></div>
      <div class="relic frame"><div class="chest"><img alt="" src="${this.chestIcon()}"></div><div>
        <h3>Armory of Lycia</h3><p>Sealed relics from the Lycian League vaults. Item level ${shopIlvl()}. Ten draws guarantee a Rare or better.</p>
        <div class="rates"><span style="--qc:var(--q-unique)">Unique ${GACHA_RATES.unique}%</span><span style="--qc:var(--q-set)">Set ${GACHA_RATES.set}%</span><span style="--qc:var(--q-rare)">Rare ${GACHA_RATES.rare}%</span><span style="--qc:var(--q-magic)">Magic ${GACHA_RATES.magic}%</span></div>
        <div class="buyrow"><button type="button" class="buy ${g < 100 ? 'no' : ''}" id="pull1">Draw ×1 · ${gem} 100</button><button type="button" class="buy ${g < 900 ? 'no' : ''}" id="pull10">Draw ×10 · ${gem} 900</button></div>
      </div></div>
      <div class="shop-sec">Bundles</div>
      <div class="bundles">${B}</div>
      <div class="shop-sec">Gems <small>demo store · no real purchase</small></div>
      <div class="packs">${P}</div>
      <div class="shopnote">You hold ${gem} ${fmt(g)} gems. Gems drop rarely from elites and always from bosses.</div>`;
    $('pull1').addEventListener('click', () => this.gacha(1));
    $('pull10').addEventListener('click', () => this.gacha(10));
    for (const b of $('shBody').querySelectorAll('.bundle .buy')) b.addEventListener('click', () => buyBundle(+b.dataset.b));
    for (const b of $('shBody').querySelectorAll('.pack')) b.addEventListener('click', () => { const p = GEM_PACKS[+b.dataset.p]; G.gems += p.g; this.toastSmall(`Demo purchase · +${fmt(p.g)} gems`); this.dirty.shop = true; save(true); });
  },
  gacha(n) {
    const cost = n === 10 ? 900 : 100;
    if (G.gems < cost) { this.toastSmall('Not enough gems'); return; }
    G.gems -= cost;
    const items = gachaRoll(n);
    let sold = 0;
    for (const it of items) { if (!invPlace(G.inv, it)) { G.gold += sellPrice(it); it._sold = true; sold++; } else G.newItems++; }
    const grid = $('gxGrid'); grid.className = 'gx-grid' + (n === 1 ? ' one' : '');
    const rank = { magic: 1, rare: 2, set: 3, unique: 4 };
    const best = items.reduce((a, b) => (rank[b.q] || 0) > (rank[a.q] || 0) ? b : a, items[0]);
    grid.innerHTML = items.map((it, k) => `<div class="gcard" style="--qc:${Q_COLOR[it.q]}" data-k="${k}"><div class="back"></div><div class="face"><img alt="" src="${ITEM_ART.url(it)}"><b>${esc(it.name)}</b><small>${it.q.toUpperCase()}${it._sold ? ' · SOLD' : ''}</small></div></div>`).join('');
    $('gxSub').textContent = `Best: ${best.name}${sold ? ` · ${sold} sold, bag full` : ''}`;
    $('gacha').hidden = false;
    [...grid.children].forEach((c, k) => setTimeout(() => c.classList.add('flip'), 350 + k * 140));
    for (const it of items) if (it.q === 'set' || it.q === 'unique' || it.q === 'rare') setTimeout(() => this.lootFeed(it, it._sold ? 'sold' : 'inv'), 400 + items.indexOf(it) * 140);
    this.dirtyAll(); save(true);
  },
  /* ---------- loot feed (corner notifications) ---------- */
  lootFeed(it, fate) {
    const f = $('lootFeed');
    while (f.childElementCount >= 5) f.firstElementChild.remove();
    const b = BASE[it.base];
    const QN = { magic: 'Magic', rare: 'Rare', set: 'Set', unique: 'Unique' };
    const el = document.createElement('div'); el.className = 'lf q-' + it.q; el.style.setProperty('--qc', Q_COLOR[it.q]);
    el.innerHTML = `<span class="ico"><img alt="" src="${ITEM_ART.url(it)}"></span><span><b>${esc(it.name)}</b><small>${QN[it.q] || ''} ${TYPE_NAME[b.type]}${fate === 'sold' || fate === 'full' ? ' · sold' : ''}</small></span>`;
    f.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 520); }, it.q === 'magic' ? 2600 : 5200);
  },
  lootFeedGem(n) {
    const f = $('lootFeed');
    while (f.childElementCount >= 5) f.firstElementChild.remove();
    const el = document.createElement('div'); el.className = 'lf'; el.style.setProperty('--qc', '#b48cff');
    el.innerHTML = `<span class="ico"><i class="ic gem" style="width:16px;height:16px"></i></span><span><b>${n} Gems</b><small>Currency</small></span>`;
    f.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 520); }, 3600);
  },
  /* ---------- combat text & feedback ---------- */
  toUi(x, y) { const z = camera.zoom, sx = (x - camera.position.x - VW / 2) * z + VW / 2, sy = (y - camera.position.y - VH / 2) * z + VH / 2; return [sx / 2, (VH - sy) / 2]; },
  number(x, y, txt, cls) {
    const fx = $('fx');
    if (fx.childElementCount > (PERF.mobile ? 28 : 80)) fx.firstElementChild.remove();
    const [ux, uy] = this.toUi(x, y);
    const el = document.createElement('div'); el.className = 'dmg ' + cls;
    if ((cls === 'c' || cls === 'cb' || cls === 's') && /^\d+$/.test(txt)) { el.classList.add('tn'); el.innerHTML = talesNum(txt); } else el.textContent = txt;
    el.style.left = ux + 'px'; el.style.top = uy + 'px';
    fx.appendChild(el);
    const big = cls === 'c' || cls === 'cb' ? 1.5 : cls === 's' ? 1.3 : 1.15;
    const rise = cls === 'lv' ? 90 : 70 + Math.random() * 30;
    const sk = '';
    const a = el.animate([
      { transform: `translate(-50%,-100%)${sk} scale(${big})`, opacity: 0 },
      { transform: `translate(-50%,-100%)${sk} scale(1)`, opacity: 1, offset: .12 },
      { transform: `translate(-50%,calc(-100% - ${rise * .45}px))${sk} scale(1)`, opacity: 1, offset: .65 },
      { transform: `translate(-50%,calc(-100% - ${rise}px))${sk} scale(.9)`, opacity: 0 },
    ], { duration: cls === 'lv' ? 1400 : 900, easing: 'cubic-bezier(.2,.7,.3,1)' });
    a.onfinish = () => el.remove();
  },
  dropLabel(x, y, text, color, dest, it) {
    const fx = $('fx'); const [ux, uy] = this.toUi(x, y + 40);
    const el = document.createElement('div'); el.className = 'drop';
    el.innerHTML = `${it ? `<img alt="" src="${ITEM_ART.url(it)}">` : ''}<span style="color:${color}">${esc(text)}</span>`; el.style.setProperty('--dc', color);
    el.style.left = ux + 'px'; el.style.top = uy + 'px';
    fx.appendChild(el);
    const target = dest === 'belt' ? $('belt') : dest === 'inv' ? $('invBtn') : dest === 'gem' ? $('gemWrap') : null;
    const frames = [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .12 }, { transform: 'translate(-50%,-70%) scale(1)', opacity: 1, offset: .6 }];
    if (target) {
      const r = target.getBoundingClientRect(), u = uiEl.getBoundingClientRect(), s = 540 / u.width;
      const tx = (r.left + r.width / 2 - u.left) * s - ux, ty = (r.top + r.height / 2 - u.top) * s - uy;
      frames.push({ transform: `translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(.3)`, opacity: .2 });
    } else frames.push({ transform: 'translate(-50%,-90%) scale(1)', opacity: 0 });
    const a = el.animate(frames, { duration: 1700, easing: 'cubic-bezier(.4,0,.6,1)' });
    a.onfinish = () => { el.remove(); if (target) { target.classList.remove('ping'); void target.offsetWidth; target.classList.add('ping'); } };
  },
  comboBump() { const b = $('comboN'); b.innerHTML = talesNum(G.combo); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); },
  coinFly(x, y, value) {
    const fx = $('fx'); const [ux, uy] = this.toUi(x, y);
    const t = $('goldTxt').getBoundingClientRect(), u = uiEl.getBoundingClientRect(), s = 540 / u.width;
    const tx = (t.left - u.left) * s - 14, ty = (t.top - u.top) * s + 8;
    const el = document.createElement('i'); el.className = 'coinfly'; el.style.left = ux + 'px'; el.style.top = uy + 'px';
    fx.appendChild(el);
    const a = el.animate([{ transform: 'translate(0,0) scale(1.3)' }, { transform: `translate(${(tx - ux) * .3}px,${(ty - uy) * .1 - 60}px) scale(1.1)`, offset: .35 }, { transform: `translate(${tx - ux}px,${ty - uy}px) scale(.7)` }],
      { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.5,0,.8,.6)' });
    a.onfinish = () => { el.remove(); G.gold += value; SFX.coin(); QUESTS.event('gold', value); const g = $('goldWrap'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); };
  },
  hurtFlash() { const v = $('hurtVig'); v.classList.remove('on'); void v.offsetWidth; v.classList.add('on'); },
  skillBanner(h, i) {
    const b = $('banner'); b.innerHTML = '';
    const d = document.createElement('div'); d.className = 'skillname'; d.style.setProperty('--c', h.cls.color);
    d.innerHTML = `<span class="rn">${ROMAN[i]}</span><span class="tx">${h.cls.skillNames[i]}</span><span class="who">${h.cls.name.toUpperCase()}</span>`;
    b.appendChild(d);
  },
  tagBanner(h) {
    const b = $('banner'); b.innerHTML = '';
    const d = document.createElement('div'); d.className = 'skillname tag'; d.style.setProperty('--c', h.cls.color);
    d.innerHTML = `<span class="rn">TAG IN</span><span class="tx">${h.cls.name}</span><span class="who">${h.cls.title.toUpperCase()}</span>`;
    b.appendChild(d);
  },
  cutIn(h, i) {
    const c = $('cutin'); c.innerHTML = '';
    const d = document.createElement('div'); d.className = 'cut'; d.style.setProperty('--c', h.cls.color);
    d.innerHTML = `<img alt="" src="${this.portraits[h.key + '_cut']}"><div class="t">${h.cls.skillNames[i]}</div><div class="s">AWAKENING · ${h.cls.name.toUpperCase()}</div>`;
    c.appendChild(d); setTimeout(() => d.remove(), 1300);
  },
  toast(a, b) { const t = $('toast'); t.innerHTML = `${esc(a)}<small>${esc(b || '')}</small>`; t.classList.toggle('death', /DIED|FALLEN/.test(a)); t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); },
  toastSmall(a) { const t = $('toast2'); t.textContent = a; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); },
  showBoss(v) { $('bossbar').hidden = !v; if (v && G.boss) { $('bossName').textContent = G.boss.D.name; $('bossFill').style.width = '100%'; $('bossLag').style.width = '100%'; } },
  makeSnapshots() {
    const iconBg = (hue) => (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * .45, 4, w / 2, h / 2, w * .75);
      g.addColorStop(0, `hsl(${hue},45%,22%)`); g.addColorStop(1, '#07040a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    };
    const LOOK = { lyn: { hue: 150, head: { w: 26, h: 26, dy: 0, dx: 2 } }, hector: { hue: 222, head: { w: 28, h: 28, dy: 0, dx: 0 } } };
    for (const key of PARTY_KEYS) {
      const L = LOOK[key], A = ASSETS[key], idle = A.anims.idle.f[0].id, sel = A.anims.select.f[0].id, art = HERO_ART[key];
      const face = artFace(key, 168, iconBg(L.hue));
      this.portraits[key] = (face || spriteSnap(key, idle, { outW: 168, outH: 168, crop: L.head, bg: iconBg(L.hue), fill: .95 })).toDataURL();
      this.portraits[key + '_cut'] = art && art.img ? art.src : spriteSnap(key, sel, { outW: 360, outH: 432 }).toDataURL();
      this.figures[key] = art && art.img ? art.src : spriteSnap(key, idle, { outW: 300, outH: 324, fill: .92, alignBottom: true }).toDataURL();
      this.icons[key] = SKI.skills(key);
      this.passIcons = this.passIcons || {}; this.passIcons[key] = SKI.passives(key);
    }
  },
};

/* ---------- equip / unequip with D2 rules ---------- */
function equipItem(h, it, ringSlot) {
  const why = UI.canUse(h, it); if (why) { UI.toastSmall(why); return false; }
  const t = BASE[it.base].type;
  let slot = TYPE_SLOT[t];
  if (slot === 'ring') slot = ringSlot || (!h.equip.ring1 ? 'ring1' : !h.equip.ring2 ? 'ring2' : 'ring1');
  const back = [];
  if (h.equip[slot]) back.push(slot);
  if (slot === 'rhand' && BASE[it.base].twoH && h.equip.lhand && BASE[h.equip.lhand.base].type === 'shield') back.push('lhand');
  if (slot === 'lhand' && t === 'shield' && h.equip.rhand && BASE[h.equip.rhand.base].twoH) back.push('rhand');
  // room check: simulate returning displaced items to the bag
  const sim = G.inv.filter(x => x !== it).map(x => ({ base: x.base, x: x.x, y: x.y }));
  for (const s of back) if (!invPlace(sim, { base: h.equip[s].base })) { UI.toastSmall('Not enough room in the inventory'); return false; }
  G.inv.splice(G.inv.indexOf(it), 1); it.x = it.y = -1;
  const displaced = back.map(s => { const o = h.equip[s]; h.equip[s] = null; return o; });
  h.equip[slot] = it;
  for (const o of displaced) invPlace(G.inv, o);
  h.recalc(); trimBelt(h); UI.dirtyAll(); save(true);
  return true;
}
function unequip(h, slot) {
  const it = h.equip[slot]; if (!it) return;
  if (!invPlace(G.inv, it)) { UI.toastSmall('Not enough room in the inventory'); return; }
  h.equip[slot] = null; h.recalc(); trimBelt(h); UI.dirtyAll(); save(true);
}

/* one-tap upgrade pass: equip any bag item that raises the hero's overall power score */
function powerScore(S) {
  const el = (r) => (r[0] + r[1]) / 2;
  return ((S.min + S.max) / 2 + el(S.fire) + el(S.cold) + el(S.ltng)) * S.speed * (1 + S.ds / 100) * 4
    + S.def * .35 + S.lifeMax * 1.2 + S.manaMax * .4 + (S.fr + S.cr + S.lr + S.pr) * .8 + S.ar * .05 + S.mf * .25 + S.ll * 6 + S.block * 2 + S.skills * 25 + (S.beltRows || 1) * 12;
}
function equipBest(h) {
  let n = 0;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const it of G.inv.slice()) {
      if (UI.canUse(h, it)) continue;
      const t = BASE[it.base].type, slots = TYPE_SLOT[t] === 'ring' ? ['ring1', 'ring2'] : [TYPE_SLOT[t]];
      const base = powerScore(h.S);
      let best = null, bs = base + 1;
      for (const sl of slots) {
        const ov = { [sl]: it };
        if (sl === 'rhand' && BASE[it.base].twoH && h.equip.lhand && BASE[h.equip.lhand.base].type === 'shield') ov.lhand = null;
        if (sl === 'lhand' && t === 'shield' && h.equip.rhand && BASE[h.equip.rhand.base].twoH) continue;
        const sc = powerScore(computeStats(h, ov, resPenalty()));
        if (sc > bs) { bs = sc; best = sl; }
      }
      if (best && equipItem(h, it, best.startsWith('ring') ? best : undefined)) { n++; changed = true; }
    }
    if (!changed) break;
  }
  return n;
}

/* Diablo IV–style globe frame: dark iron ring, bronze edges, rivets and two curling horns */
function drawGlobeFrame(flip) {
  return makeCanvas(320, 304, (c) => {
    const cx = 160, cy = 152, r = 98;
    if (flip) { c.translate(320, 0); c.scale(-1, 1); }
    const iron = c.createLinearGradient(0, 30, 0, 280); iron.addColorStop(0, '#3a3128'); iron.addColorStop(.5, '#1b1713'); iron.addColorStop(1, '#0b0907');
    // horns
    const horn = (sx) => {
      c.save(); c.translate(cx, cy); c.scale(sx, 1);
      c.beginPath(); c.moveTo(r * .55, -r * .78); c.bezierCurveTo(r * 1.0, -r * 1.25, r * 1.4, -r * 1.28, r * 1.55, -r * 1.55);
      c.bezierCurveTo(r * 1.3, -r * 1.05, r * 1.15, -r * .62, r * .9, -r * .4); c.closePath();
      const g = c.createLinearGradient(r * .5, -r * 1.5, r * 1.1, -r * .4); g.addColorStop(0, '#6a5640'); g.addColorStop(.4, '#2a221b'); g.addColorStop(1, '#100d0a');
      c.fillStyle = g; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = 'rgba(200,170,120,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(r * .62, -r * .8); c.bezierCurveTo(r * 1.0, -r * 1.2, r * 1.32, -r * 1.25, r * 1.5, -r * 1.5); c.stroke();
      c.restore();
    };
    horn(-1); horn(1);
    // bottom spike & side fins
    c.beginPath(); c.moveTo(cx - 26, cy + r - 4); c.lineTo(cx, cy + r + 46); c.lineTo(cx + 26, cy + r - 4); c.closePath(); c.fillStyle = iron; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * (r - 6), cy + 10); c.lineTo(cx + s * (r + 30), cy + 34); c.lineTo(cx + s * (r - 2), cy + 46); c.closePath(); c.fillStyle = iron; c.fill(); c.stroke(); }
    // ring
    c.beginPath(); c.arc(cx, cy, r + 13, 0, Math.PI * 2); c.arc(cx, cy, r - 4, 0, Math.PI * 2, true); c.fillStyle = iron; c.fill('evenodd');
    c.lineWidth = 2; c.strokeStyle = '#000'; c.beginPath(); c.arc(cx, cy, r + 13, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#8a7454'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, r + 10, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#b39466'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r - 3, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.9)'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r - 6, 0, Math.PI * 2); c.stroke();
    // engraved runes / rivets
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, x = cx + Math.cos(a) * (r + 4), y = cy + Math.sin(a) * (r + 4);
      c.fillStyle = i % 4 === 0 ? '#c9a86a' : '#5a4a36'; c.beginPath(); c.arc(x, y, i % 4 === 0 ? 3.2 : 2, 0, Math.PI * 2); c.fill();
    }
    // top crest gem
    c.save(); c.translate(cx, cy - r - 12); c.rotate(Math.PI / 4);
    c.fillStyle = '#120d0a'; c.fillRect(-11, -11, 22, 22); c.strokeStyle = '#b39466'; c.lineWidth = 2; c.strokeRect(-11, -11, 22, 22);
    const gg = c.createRadialGradient(0, 0, 1, 0, 0, 8); gg.addColorStop(0, flip ? '#9fb2ff' : '#ff8a6a'); gg.addColorStop(1, flip ? '#1c2a8a' : '#6a0e06');
    c.fillStyle = gg; c.fillRect(-6, -6, 12, 12); c.restore();
  }).toDataURL();
}

/* ---------- shop data (mock) ---------- */
const GACHA_RATES = { unique: 3, set: 6, rare: 25, magic: 66 };
const shopIlvl = () => Math.max(mlvlNow() + 3, G.hero ? G.hero.level : 1);
function gachaRoll(n) {
  const out = [], il = shopIlvl();
  for (let i = 0; i < n; i++) {
    const r = Math.random() * 100;
    const q = r < GACHA_RATES.unique ? 'unique' : r < GACHA_RATES.unique + GACHA_RATES.set ? 'set' : r < GACHA_RATES.unique + GACHA_RATES.set + GACHA_RATES.rare ? 'rare' : 'magic';
    out.push(makeByQuality(q, il));
  }
  if (n >= 10 && !out.some(it => it.q !== 'magic')) out[out.length - 1] = makeByQuality('rare', il);
  return out;
}
const SHOP_BUNDLES = [
  { n: "Pilgrim's Satchel", ico: '❖', c: '#2a3a7a', cost: 150, d: '4 Magic items and 6 potions of your tier.', fn: () => { const il = shopIlvl(); const it = []; for (let i = 0; i < 4; i++) it.push(makeByQuality('magic', il)); for (let i = 0; i < 6; i++) beltAdd(G.hero, { k: i % 3 ? 'hp' : 'mp', t: potionTier(il) }); return it; } },
  { n: "Crypt Lord's Hoard", ico: '⚜', c: '#1d5a2c', cost: 450, d: 'One guaranteed Set item and two Rares.', fn: () => { const il = shopIlvl(); return [makeByQuality('set', il), makeByQuality('rare', il), makeByQuality('rare', il)]; } },
  { n: 'Elixir Crate', ico: '⚗\uFE0E', c: '#7a1c1c', cost: 60, d: 'Fill both heroes’ belts with the best potions you can drink.', fn: () => { for (const h of G.party) { const rows = h.beltRows(); for (let c = 0; c < 4; c++) { h.belt[c] = []; for (let r = 0; r < rows; r++) h.belt[c].push({ k: c < 2 ? 'hp' : c === 2 ? 'mp' : 'rj', t: c === 3 ? 0 : potionTier(shopIlvl()) }); } } UI.dirty.belt = true; return []; } },
  { n: 'Tome of Forbidden Lore', ico: '✦', c: '#5a2a7a', cost: 300, d: '+1 skill point for the active hero.', fn: () => { G.hero.skillPts++; return []; } },
  { n: 'Token of Absolution', ico: '✠', c: '#7a5a1c', cost: 200, d: 'Refund every attribute and skill point of the active hero.', fn: () => { respec(G.hero); return []; } },
  { n: 'Gilded Coffer', ico: '⛁', c: '#6a4a10', cost: 50, d: 'Gold worth 600 × current floor.', fn: () => { G.gold += 600 * G.floor; return []; } },
];
const GEM_PACKS = [
  { name: 'Handful', g: 80, price: '$0.99' }, { name: 'Pouch', g: 500, price: '$4.99' }, { name: 'Coffer', g: 1200, price: '$9.99' }, { name: 'Vault', g: 6500, price: '$49.99' },
];
function buyBundle(k) {
  const b = SHOP_BUNDLES[k];
  if (G.gems < b.cost) { UI.toastSmall('Not enough gems'); return; }
  G.gems -= b.cost;
  const items = b.fn() || [];
  let sold = 0;
  for (const it of items) { if (!invPlace(G.inv, it)) { G.gold += sellPrice(it); sold++; } else { G.newItems++; if (it.q !== 'normal') UI.lootFeed(it, 'inv'); } }
  UI.toastSmall(`${b.n} opened${sold ? ` · ${sold} sold, bag full` : ''}`);
  UI.dirtyAll(); save(true);
}

/* Tales of Eternia–style battle numerals (sprites/font/d0..d9.png) */
function talesNum(n) { return String(n).split('').map(d => `<img src="sprites/font/d${d}.png" alt="${d}">`).join(''); }
