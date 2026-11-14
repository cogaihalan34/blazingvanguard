'use strict';
/* cine.js — afterimages and the two full-screen finishers with cutscenes:
   Lyn  · "Sol Katti"        — Sacae wind: green gale, eye cut-in, seven afterimage dashes slicing every foe on screen, lightning finale.
   Hector · "Armads Judgment" — Ostian thunder-axe: ember storm, eye cut-in, leap off-screen and a ground-shattering slam with fire pillars. */

/* ---------- afterimages (copies of the current sprite frame that fade out) ---------- */
const GHOSTS = [], GHOST_POOL = [];
function ghost(h, color, life = .28, alpha = .55) {
  const v = h.view, src = v.mesh;
  let g = GHOST_POOL.pop();
  if (!g) {
    const u = { map: { value: null }, uRect: { value: new THREE.Vector4() }, uFlash: { value: .35 }, uAlpha: { value: 1 }, uTint: { value: new THREE.Color() }, uFlashCol: { value: new THREE.Color() } };
    const m = new THREE.Mesh(src.geometry, new THREE.ShaderMaterial({ uniforms: u, vertexShader: SPR_VS, fragmentShader: SPR_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.renderOrder = 20; m.frustumCulled = false;
    if (typeof SB !== 'undefined') SB.trackInst(m, 'gst');
    g = { m, u };
  }
  g.u.map.value = v.u.map.value; g.u.uRect.value.copy(v.u.uRect.value); g.u.uFlash.value = .35; g.u.uAlpha.value = alpha;
  g.u.uTint.value.set(color); g.u.uFlashCol.value.set(color);
  g.m.position.copy(src.position); g.m.scale.copy(src.scale); scene.add(g.m);
  g.t = 0; g.life = life; g.alpha = alpha;
  GHOSTS.push(g);
}
function updateGhosts(dt) {
  for (let i = GHOSTS.length - 1; i >= 0; i--) {
    const g = GHOSTS[i]; g.t += dt; g.u.uAlpha.value = g.alpha * Math.max(0, 1 - g.t / g.life);
    if (g.t >= g.life) { scene.remove(g.m); GHOSTS.splice(i, 1); GHOST_POOL.push(g); }
  }
}

/* ---------- Limit Break: charged by damage taken, fired by the triangle button (or automatically in Auto mode) ---------- */
function limitBreak(h) {
  h = h || G.hero;
  if (!h || h.limit < 1 || h.dead || h.mode === 'dead' || h.life <= 0 || h.air || CINE.active || h.cineStrike || G.wipe > 0) return false;
  if (!CINE.targets().length) { UI.toastSmall('No enemies in sight'); return false; }
  h.limit = 0; h.mode = 'skill'; h.skillIdx = 7; h.play('skill_7', false);
  CINE.play(h); UI.limitRender(true);
  return true;
}
/* ---------- finisher cutscenes ---------- */
const CINE_DEF = {
  lyn: {
    title: 'Sacaean Frost Dance', sub: 'LIMIT BREAK · BLADE OF THE SACAE WIND', theme: 'wind',
    eyes: { size: 616 * 2.25, x: -66 * 2.25, y: -166 * 2.25 }, art: 'sprites/lyn_art.webp',
  },
  hector: {
    title: 'Meteor Armads', sub: 'LIMIT BREAK · STARFALL OF OSTIA', theme: 'fire',
    eyes: { size: 630 * 2.45, x: -185 * 2.45, y: -150 * 2.45 }, art: 'sprites/hector_art.webp',
  },
};
const CINE = {
  active: null, slow: 1,
  play(h) {
    const D = CINE_DEF[h.key]; if (!D) return false;
    const el = $('cine');
    el.className = 'cn-' + D.theme; el.hidden = false;
    $('cnArt').src = D.art;
    const eyes = $('cnEyes'); eyes.style.backgroundImage = `url(${D.art})`; eyes.style.backgroundSize = D.eyes.size + 'px auto'; eyes.style.backgroundPosition = `${D.eyes.x}px ${D.eyes.y}px`;
    $('cnTitle').textContent = D.title; $('cnSub').textContent = D.sub;
    void el.offsetWidth; el.classList.add('run');
    this.active = { h, t: 0, D, phase: 0, hits: 0 };
    this.slow = .04;
    h.cineStrike = true; h.invuln = 4;
    h.nextAt = 99;
    SFX.cast(true); AUDIO.say(h.key, 'ult', true); SFX.rift && h.key === 'hector' && SFX.boss();
    BG.dimV = 2;
    return true;
  },
  targets() { const vb = viewBounds(); return allEnemies().filter(e => !e.dead && e.x > vb[0] - 120 && e.x < vb[1] + 120); },
  strike(h, mult, color) {
    for (const e of this.targets()) dealDamage(h, e, mult, true, true, true);
  },
  tick(real) {
    const A = this.active; if (!A) return;
    if (A.h !== G.hero || A.h.mode === 'dead' || A.h.life <= 0 || A.t > 7) { this.abort(); return; }
    const prevT = A.t; A.t += real;
    const at = (s) => prevT < s && A.t >= s;
    const h = A.h, mult = (h.cls.skillMult[7] * 1.6 + 10) * Math.max(1, h.skillMul(7));
    if (at(1.55)) {
      $('cine').classList.add('out'); this.slow = 1; BG.flash(1.2); shake(14, .3);
      setTimeout(() => { const el = $('cine'); el.hidden = true; el.className = ''; }, 450);
    }
    if (h.key === 'lyn') {
      /* Sacaean Critical: her full sword-dance chain (spin, lunges, afterimage thrusts, vanishing slash, final cut)
         with Megacool ice erupting under the enemies and giant crescent slashes over the screen */
      if (at(1.6)) { A.lastHit = -1; h.play('limit', false); h.view.state.timeScale = 1; A.animEnd = 1.6 + h.view.anim.dur + .35; }
      const fr = h.view.anim && h.view.anim.name === 'limit' ? h.view.anim.f[h.view.fi] : null;
      if (fr && fr.hit !== undefined && fr.hit !== A.lastHit) {
        A.lastHit = fr.hit; const n = fr.hit, tg = this.targets(), FX = ASSETS.lyn.fxTex || {};
        const vb = viewBounds(), cx = (vb[0] + vb[1]) / 2;
        const arcs = ['arc', 'slash', 'arc2', 'nick', 'arc', 'streak', 'arc2', 'slash', 'arc'];
        const T = FX[arcs[n % arcs.length]];
        if (T) { const k = 9 + (n === 8 ? 5 : 0); spawnFx({ tex: T.tex, x: cx + rnd(-140, 140), y: GROUND + rnd(200, 480), sx: T.w * k, sy: T.h * k, sx1: T.w * k * 1.25, sy1: T.h * k * 1.1, rot: rnd(-.5, .5), life: .28, color: 0xdff8ff, ro: 66 }); }
        for (const e of tg) spawnFx({ tex: TX.slash, x: e.x, y: GROUND + (e.floorY || 0) + rnd(120, 260), rot: rnd(-1, 1), sx: 260, sy: 80, sx1: 700, sy1: 160, life: .2, color: 0xa8f0ff, ro: 64 });
        for (let g = 0; g < 3; g++) ghost(h, 0x80e8ff, .3, .45 - g * .12);
        if (n === 2 || n === 5) for (const e of tg) sheetFx('megacool', e.x, GROUND + (e.floorY || 0) - 20, { scale: 3.6, color: 0xd0f4ff, ro: 63, speed: 1.6 });
        if (n === 6) sheetFx('megacool', 0, 0, { screen: true, fit: 1.15, dy: 140, ro: 63, color: 0xc8f0ff, speed: 1.3 });
        if (n === 8) { BG.flash(1.1); shake(36, .7); SFX.thunder && SFX.thunder(); for (const e of tg) sheetFx('megacool', e.x, GROUND + (e.floorY || 0) - 20, { scale: 4.6, color: 0xffffff, ro: 63, speed: 1.2 }); }
        else { shake(10 + n * 2, .18); BG.flash(.25); }
        SFX.swing(true); SFX.hit(true, n >= 7);
        G.hitstop = Math.max(G.hitstop, n === 8 ? .12 : .035);
        this.strike(h, mult / (n === 8 ? 4 : 10.7));
      }
      if (A.animEnd && A.t >= A.animEnd) this.end(h);
    } else {
      /* Meteor: Hector calls down a starfall — the sky goes dark, burning rocks rain on the field, the ground erupts */
      if (at(1.6)) {
        A.scene = sheetFx('meteor', 0, 0, { screen: true, fit: 1.35, dy: 420, ro: 9.2, alpha: 1, speed: 1.15, fadeIn: .35, fade: .45 });
        h.play('skill_6', false); SFX.rift && SFX.rift();
      }
      if (A.t > 1.9 && A.t < 3.3 && Math.random() < .35) {
        const vb = viewBounds(), x = rnd(vb[0], vb[1]);
        spawnFx({ tex: TX.streak, x, y: GROUND + rnd(600, 1400), rot: -Math.PI * .62, sx: rnd(260, 480), sy: 14, sx1: 80, sy1: 4, life: .35, color: 0xffa040, ro: 64 });
      }
      const boom = (k) => {
        BG.flash(.7 + k * .2); shake(26 + k * 8, .5); G.hitstop = Math.max(G.hitstop, .06); SFX.boss();
        for (const e of this.targets()) {
          sheetFx(k === 2 ? 'pillars' : 'tower', e.x, GROUND + (e.floorY || 0) - 10, { scale: k === 2 ? 1.6 : 4.4, color: 0xffb070, ro: 63 });
          for (let q = 0; q < 6; q++) spawnFx({ tex: TX.shard, x: e.x + rnd(-80, 80), y: GROUND + (e.floorY || 0) + 20, vx: rnd(-500, 500), vy: rnd(600, 1300), g: 2600, vr: rnd(-20, 20), sx: rnd(14, 28), sy: rnd(14, 28), life: rnd(.6, 1), normal: true, ground: true, color: 0x6a4030, ro: 30, fadeLate: true });
        }
        this.strike(h, mult * [.3, .3, .4][k]);
      };
      if (at(3.1)) boom(0);
      if (at(3.45)) boom(1);
      if (at(3.85)) boom(2);
      if (at(4.6)) this.end(h);
    }
  },
  cleanup(A) {
    if (!A) return;
    for (const m of [A.spear, A.glow]) if (m) { scene.remove(m); m.material.dispose(); }
    for (const f of [A.vortex, A.scene]) if (f) f.dead = true;
  },
  abort() {
    const A = this.active; this.cleanup(A); this.active = null; this.slow = 1;
    const el = $('cine'); el.hidden = true; el.className = '';
    if (A) { A.h.cineStrike = false; if (A.h.mode !== 'dead') { A.h.mode = 'idle'; A.h.nextAt = 0; A.h.play('idle', true); } }
  },
  end(h) {
    this.cleanup(this.active); this.active = null; this.slow = 1;
    h.cineStrike = false; h.invuln = .5; h.nextAt = 0; if (h.mode !== 'dead' && h.life > 0) { h.mode = 'idle'; h.play('idle', true); }
  },
};

/* ---------- level up: pillar of light, rings, rising sparks + Tales-style LEVEL up! banner ---------- */
function levelUpFx(h) {
  const x = h.x, y = GROUND + h.y;
  spawnFx({ tex: TX.glow, x, y: y + 400, sx: 260, sy: 900, sx1: 60, sy1: 1300, life: .9, color: 0xffe8a0, a0: .9, ro: 58 });
  spawnFx({ tex: TX.glow, x, y: y + 300, sx: 120, sy: 700, sx1: 30, sy1: 1000, life: .7, color: 0xffffff, a0: 1, ro: 59 });
  for (let r = 0; r < 3; r++) spawnFx({ tex: TX.ring, x, y: y + 16, sx: 60, sy: 18, sx1: 700 + r * 220, sy1: 180 + r * 40, life: .6 + r * .15, color: r ? 0xffcf6a : 0xffffff, ro: 58, ease: 3 });
  for (let k = 0; k < 28; k++) spawnFx({ tex: TX.glow, x: x + rnd(-160, 160), y: y + rnd(0, 120), vx: rnd(-60, 60), vy: rnd(380, 900), sx: rnd(14, 26), sy: rnd(14, 26), sx1: 4, sy1: 4, life: rnd(.7, 1.3), color: k % 3 ? 0xffe080 : 0x9ff0ff, ro: 60 });
  sheetFx('barrier', x + 10, y, { scale: 4.6, color: 0xffe0a0, ro: 23 });
  BG.flash(.35);
  const el = $('lvup');
  $('lvFrom').innerHTML = talesNum(h.level - 1); $('lvTo').innerHTML = talesNum(h.level);
  $('lvSub').textContent = h.cls.name.toUpperCase() + ' · ALL STATS UP';
  el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(levelUpFx.t); levelUpFx.t = setTimeout(() => { el.hidden = true; el.classList.remove('on'); }, 2300);
}
