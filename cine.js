'use strict';
/* cine.js — afterimages and the two full-screen finishers with cutscenes:
   Lyn  · "Sol Katti"        — Sacae wind: green gale, eye cut-in, seven afterimage dashes slicing every foe on screen, lightning finale.
   Hector · "Armads Judgment" — Ostian thunder-axe: ember storm, eye cut-in, leap off-screen and a ground-shattering slam with fire pillars. */

/* ---------- afterimages (copies of the current sprite frame that fade out) ---------- */
const GHOSTS = [];
function ghost(h, color, life = .28, alpha = .55) {
  const v = h.view, src = v.mesh;
  const u = {
    map: { value: v.u.map.value }, uRect: { value: v.u.uRect.value.clone() }, uFlash: { value: .35 }, uAlpha: { value: alpha },
    uTint: { value: new THREE.Color(color) }, uFlashCol: { value: new THREE.Color(color) },
  };
  const m = new THREE.Mesh(src.geometry, new THREE.ShaderMaterial({ uniforms: u, vertexShader: SPR_VS, fragmentShader: SPR_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.position.copy(src.position); m.scale.copy(src.scale); m.renderOrder = 20; m.frustumCulled = false; scene.add(m);
  GHOSTS.push({ m, u, t: 0, life, alpha });
}
function updateGhosts(dt) {
  for (let i = GHOSTS.length - 1; i >= 0; i--) {
    const g = GHOSTS[i]; g.t += dt; g.u.uAlpha.value = g.alpha * Math.max(0, 1 - g.t / g.life);
    if (g.t >= g.life) { scene.remove(g.m); g.m.material.dispose(); GHOSTS.splice(i, 1); }
  }
}

/* ---------- Limit Break: charged by damage taken, fired by the triangle button (or automatically in Auto mode) ---------- */
function limitBreak(h) {
  h = h || G.hero;
  if (!h || h.limit < 1 || h.dead || h.air || CINE.active || h.cineStrike) return false;
  if (!CINE.targets().length) { UI.toastSmall('No enemies in sight'); return false; }
  h.limit = 0; h.mode = 'skill'; h.skillIdx = 7; h.play('skill_7', false);
  CINE.play(h); UI.limitRender(true);
  return true;
}
/* ---------- finisher cutscenes ---------- */
const CINE_DEF = {
  lyn: {
    title: 'Sol Katti', sub: 'LIMIT BREAK · BLADE OF THE SACAE WIND', theme: 'wind',
    eyes: { size: 616 * 2.25, x: -60 * 2.25, y: -168 * 2.25 }, art: 'sprites/lyn_art.webp',
  },
  hector: {
    title: 'Armads Judgment', sub: 'LIMIT BREAK · THUNDER AXE OF OSTIA', theme: 'fire',
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
  targets() { return allEnemies().filter(e => !e.dead && e.x > G.camX - 120 && e.x < G.camX + VW + 120); },
  strike(h, mult, color) {
    for (const e of this.targets()) dealDamage(h, e, mult, true, true, true);
  },
  tick(real) {
    const A = this.active; if (!A) return;
    const prevT = A.t; A.t += real;
    const at = (s) => prevT < s && A.t >= s;
    const h = A.h, mult = (h.cls.skillMult[7] * 1.6 + 10) * Math.max(1, h.skillMul(7));
    if (at(1.55)) {
      $('cine').classList.add('out'); this.slow = 1; BG.flash(1.2); shake(14, .3);
      setTimeout(() => { const el = $('cine'); el.hidden = true; el.className = ''; }, 450);
    }
    if (h.key === 'lyn') {
      if (at(1.6)) sheetFx('aura', 0, 0, { screen: true, ro: 9, color: 0x80ffb0, alpha: .9, dy: 380, fade: .4 });
      for (let k = 0; k < 7; k++) {
        if (at(1.62 + k * .13)) {
          const tg = this.targets();
          const e = tg.length ? tg[k % tg.length] : null;
          const from = h.x;
          h.face = k % 2 ? -1 : 1;
          h.x = e ? e.x - h.face * rnd(60, 140) : G.camX + rnd(200, VW - 200);
          h.y = e ? (e.floorY || 0) : 0; h.air = false;
          h.play(k % 2 ? 'attack_2' : 'attack_3', false);
          for (let g = 0; g < 4; g++) ghost(h, 0x60ffb0, .35, .5 - g * .1);
          const ang = rnd(-.6, .6);
          spawnFx({ tex: TX.slash, x: (from + h.x) / 2, y: GROUND + h.y + 200, rot: ang + (h.face < 0 ? Math.PI : 0), sx: 300, sy: 100, sx1: 1500, sy1: 260, life: .26, color: 0xb0ffd8, ro: 64 });
          spawnFx({ tex: TX.streak, x: (from + h.x) / 2, y: GROUND + h.y + 180, rot: ang, sx: Math.abs(h.x - from) + 400, sy: 18, sx1: Math.abs(h.x - from) + 600, sy1: 2, life: .2, color: 0x80ffc0, ro: 64 });
          SFX.swing(true);
          this.strike(h, mult / 8);
          G.hitstop = Math.max(G.hitstop, .04);
        }
      }
      if (at(2.62)) {
        for (const e of this.targets()) sheetFx('bolt', e.x, GROUND + (e.y || 0) - 10, { scale: 4.4, color: 0xd0ffe0, ro: 63 });
        BG.flash(.9); shake(26, .5); SFX.thunder && SFX.thunder(); this.strike(h, mult / 8);
      }
      if (at(3.0)) this.end(h);
    } else {
      if (at(1.6)) { h.air = true; h.vy = 2600; h.jvx = 0; h.y = Math.max(h.y, 1); h.play('jump', true); h.mode = 'jump'; SFX.jump(); ghost(h, 0xffb060, .4, .6);
        spawnFx({ tex: TX.ring, x: h.x, y: GROUND + h.y + 10, sx: 80, sy: 20, sx1: 700, sy1: 160, life: .4, color: 0xffa040, ro: 58 }); }
      if (A.t > 1.6 && A.t < 2.2 && Math.random() < .5) ghost(h, 0xff8040, .25, .4);
      if (at(2.05)) { h.vy = -6400; const tg = this.targets(); if (tg.length) { const c = tg.reduce((s, e) => s + e.x, 0) / tg.length; h.jvx = (c - 160 - h.x) / .25; } h.play('attack_1', false); }
      if (A.phase === 0 && A.t > 2.05 && !h.air) {
        A.phase = 1; h.jvx = 0;
        BG.flash(.85); shake(34, .7); G.hitstop = Math.max(G.hitstop, .12);
        sheetFx('pillars', 0, 0, { screen: true, ro: 9, color: 0xffa060, alpha: .8, dy: 380, fade: .4 });
        for (const s of [-1, 1]) for (let r = 0; r < 3; r++) spawnFx({ tex: TX.ring, x: h.x + s * r * 260, y: GROUND + h.y + 12, sx: 100, sy: 30, sx1: 1300, sy1: 240, life: .55 + r * .1, color: r ? 0xff7030 : 0xffe0a0, ro: 58, ease: 3 });
        for (let k = 0; k < 26; k++) spawnFx({ tex: TX.shard, x: h.x + rnd(-500, 500), y: GROUND + 20, vx: rnd(-500, 500), vy: rnd(700, 1600), g: 2600, vr: rnd(-20, 20), sx: rnd(14, 30), sy: rnd(14, 30), life: rnd(.7, 1.1), normal: true, ground: true, color: 0x8a6040, ro: 30, fadeLate: true });
        for (const e of this.targets()) sheetFx('tower', e.x, GROUND + (e.floorY || 0) - 10, { scale: 4.4, color: 0xffc080, ro: 63 });
        SFX.boss(); SFX.thunder && SFX.thunder();
        this.strike(h, mult * .4);
        later(.18, () => this.strike(h, mult * .3));
        later(.36, () => { this.strike(h, mult * .3); shake(18, .3); });
        A.endAt = A.t + .9;
      }
      if (A.endAt && A.t >= A.endAt) this.end(h);
    }
  },
  end(h) {
    this.active = null; this.slow = 1;
    h.cineStrike = false; h.invuln = .5; h.mode = 'idle'; h.nextAt = 0; h.play('idle', true);
  },
};
