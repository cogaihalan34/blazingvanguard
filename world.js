'use strict';
/* world.js — floating platforms (jump up / drop down), the rift portal + QTE + secret Upside-Down level,
   day/night cycle every 5 minutes of play, weather (rain / strong wind) and the per-skill GBA spell effects. */

/* ---------- game-time timers ---------- */
const LATER = [];
function later(t, fn) { LATER.push({ t, fn }); }
function tickLater(dt) { for (let i = LATER.length - 1; i >= 0; i--) { const L = LATER[i]; L.t -= dt; if (L.t <= 0) { LATER.splice(i, 1); try { L.fn(); } catch (e) { console.error(e); } } } }

/* =========================================================================
   PLATFORMS
   ========================================================================= */
const PLATS = [];
const PLAT_H = 22; // art pixels
function drawPlat(w, style) {
  const H = PLAT_H;
  return makeCanvas(w, H, (c) => {
    c.imageSmoothingEnabled = false;
    const r = seeded(w * 7 + (style === 'void' ? 3 : 1));
    const rows = [];
    for (let x = 0; x < w; x++) { const edge = Math.min(x, w - 1 - x); rows.push(Math.min(H, 8 + Math.round(Math.min(edge, 10) * .9 + r() * 3))); }
    if (style === 'void') {
      for (let x = 0; x < w; x++) { rect(c, '#160a12', x, 2, 1, rows[x]); rect(c, '#2c1622', x, 2, 1, 3); rect(c, '#4a2232', x, 2, 1, 1); }
      for (let i = 0; i < w / 6; i++) { const x = r() * w | 0, y = 5 + (r() * 8 | 0); rect(c, '#0a0408', x, y, 3, 1); }
      for (let i = 0; i < w / 12; i++) { let x = r() * w, y = 4; c.fillStyle = '#ff3048'; for (let k = 0; k < 6; k++) { x += (r() - .5) * 2; y += 1; c.fillRect(Math.round(x), Math.round(y), 1, 1); } }
      rect(c, '#8a2a40', 0, 2, w, 1);
    } else {
      for (let x = 0; x < w; x++) {
        const d = rows[x];
        rect(c, '#5a3a20', x, 4, 1, d - 2); rect(c, '#7a5030', x, 4, 1, 2); rect(c, '#3a2410', x, 3 + d - 2, 1, 1);
        if (r() < .08) rect(c, '#2a4a18', x, 4 + d - 2, 1, 2 + (r() * 3 | 0));
      }
      for (let i = 0; i < w / 5; i++) { const x = r() * w | 0, y = 6 + (r() * 8 | 0); if (y < rows[x] + 2) { rect(c, '#8a6040', x, y, 2, 1); rect(c, '#3a2410', x, y + 1, 2, 1); } }
      rect(c, '#305818', 0, 0, w, 5); rect(c, '#68b040', 0, 0, w, 3); rect(c, '#98d868', 0, 0, w, 1);
      for (let x = 0; x < w; x += 2) rect(c, '#509830', x, 3, 1, 1 + (r() * 3 | 0));
    }
  });
}
class Plat {
  constructor(x0, x1, y, style) {
    this.x0 = x0; this.x1 = x1; this.y = y; this.style = style;
    const pw = Math.max(16, Math.round((x1 - x0) / PX));
    const tex = texFrom(drawPlat(pw, style)); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(.5, -.5, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    this.mesh.renderOrder = 12; this.mesh.frustumCulled = false;
    this.mesh.position.set(x0, GROUND + y + 3 * PX, 0); this.mesh.scale.set(x1 - x0, PLAT_H * PX, 1);
    scene.add(this.mesh);
  }
  dispose() { scene.remove(this.mesh); this.mesh.material.map.dispose(); this.mesh.material.dispose(); this.mesh.geometry.dispose(); }
}
function addPlat(x0, x1, y) { const p = new Plat(x0, x1, y, G.secret ? 'void' : 'grass'); PLATS.push(p); return p; }
function clearPlats(all) { for (let i = PLATS.length - 1; i >= 0; i--) { const p = PLATS[i]; if (all || p.x1 < G.camX - 600) { p.dispose(); PLATS.splice(i, 1); } } }
function platAt(x, y) { for (const p of PLATS) if (Math.abs(p.y - y) < 3 && x >= p.x0 - 6 && x <= p.x1 + 6) return p; return null; }
function landingFor(x, prevY, y, ignore) { let best = null; for (const p of PLATS) if (p !== ignore && x >= p.x0 - 8 && x <= p.x1 + 8 && prevY >= p.y - 1 && y <= p.y && (!best || p.y > best.y)) best = p; return best; }
function floorBelow(x, y) { let best = 0; for (const p of PLATS) if (x >= p.x0 && x <= p.x1 && p.y <= y + 2 && p.y > best) best = p.y; return best; }
/* level an enemy stands on (null = flying, reachable from anywhere close) */
function levelOf(e) { if (e.D && e.D.fly) return null; return e.floorY || 0; }
/* same footing: an enemy knocked into the air still counts by the ledge it stands on, so a hero below never "juggles" it from the ground */
function sameLevel(h, e) { if (e.D && e.D.fly) return Math.abs(h.y - (e.y || 0)) < 320; return Math.abs((e.floorY || 0) - h.y) < 70; }
/* can a swing from the hero's footing connect with this enemy? */
function canStrike(h, e) { if (e.D && e.D.fly) return Math.abs(h.y - (e.y || 0)) < 360; return Math.abs((e.floorY || 0) - h.y) < 90; }
/* lay out 1–2 ledges ahead for a wave; returns them so mobs can be placed on top */
function makeWavePlats(baseX) {
  clearPlats(false);
  const out = [];
  const n = Math.random() < .35 ? 2 : 1;
  let x = baseX - rnd(80, 220);
  for (let i = 0; i < n; i++) {
    const w = rnd(420, 640), y = i === 0 ? rnd(200, 245) : rnd(385, 425);
    out.push(addPlat(x, x + w, y));
    x += w * rnd(.45, .8);
  }
  return out;
}

/* ---------- hero jumping ---------- */
function heroJumpTo(h, tl, tgt) {
  if (h.air) return;
  let vy, jvx;
  if (tl > h.y + 10) {
    const p = platAt(tgt.x, tl) || PLATS.find(q => Math.abs(q.y - tl) < 3);
    const dy = tl - h.y, vy0 = Math.sqrt(2 * GRAV * (dy + 110)), T = vy0 / GRAV + Math.sqrt(2 * 110 / GRAV);
    const side = tgt.x >= h.x ? 1 : -1; h.face = side;
    let lx = tgt.x - side * h.cls.range * .7; if (p) lx = Math.max(p.x0 + 50, Math.min(p.x1 - 50, lx));
    vy = vy0; jvx = Math.max(-1100, Math.min(1100, (lx - h.x) / T));
    h.ignorePlat = null;
  } else {
    h.ignorePlat = platAt(h.x, h.y);
    const side = tgt.x >= h.x ? 1 : -1; h.face = side;
    const here = platAt(h.x, h.y), toEdge = here ? (side > 0 ? here.x1 + 40 - h.x : here.x0 - 40 - h.x) : 0;
    let lx = tgt.x - side * h.cls.range * .7;
    if (here && Math.sign(lx - h.x) === side && Math.abs(lx - h.x) < Math.abs(toEdge)) lx = h.x + toEdge;
    vy = 480; jvx = Math.max(-800, Math.min(800, (lx - h.x) / .8));
  }
  h.air = true; h.vy = vy; h.jvx = jvx; h.mode = 'jump'; h.play('jump', true);
  SFX.jump();
  spawnFx({ tex: TX.smoke, x: h.x, y: GROUND + h.y + 10, sx: 120, sy: 40, sx1: 300, sy1: 80, life: .35, color: G.secret ? 0x804050 : 0xd8c8a8, a0: .6, ro: 16 });
}
function heroAirTick(h, dt) {
  if (!h.air) {
    if (h.y > 0 && !platAt(h.x, h.y)) { h.air = true; h.vy = 0; h.jvx = 0; h.ignorePlat = null; h.mode = 'jump'; h.play('jump', true); }
    return;
  }
  const prev = h.y;
  h.vy -= GRAV * dt; h.y += h.vy * dt; h.x += h.jvx * dt;
  if (h.vy < 0) {
    const p = landingFor(h.x, prev, h.y, h.ignorePlat);
    if (p || h.y <= 0) {
      h.y = p ? p.y : 0; h.air = false; h.vy = 0; h.ignorePlat = null; h.mode = 'idle'; h.play('idle', true);
      SFX.land(); shake(3, .08);
      spawnFx({ tex: TX.smoke, x: h.x, y: GROUND + h.y + 8, sx: 160, sy: 40, sx1: 360, sy1: 90, life: .4, color: G.secret ? 0x804050 : 0xd8c8a8, a0: .7, ro: 16 });
    }
  }
}

/* =========================================================================
   SKILL EFFECTS (GBA spell animations)
   ========================================================================= */
const SKILL_FX = {
  lyn: [
    [{ fx: 'hit', at: 'target', d: .12, k: 2.4, color: 0x9fffd0 }],
    [{ fx: 'tornado', at: 'target', d: .08, k: 3.2, color: 0xa8ffd8 }],
    [{ fx: 'barrier', at: 'self', d: 0, k: 4, color: 0x7dffb0 }, { fx: 'crit', at: 'target', d: .3, k: 2.2, color: 0xc0ffe0 }],
    [{ fx: 'crit', at: 'target', d: .2, k: 2.6 }],
    [{ fx: 'tornado', at: 'all', d: .15, k: 3, color: 0xa0ffe0 }],
    [{ fx: 'silencer', at: 'target', d: .25, k: 2.6, color: 0x80ffc0 }],
    [{ fx: 'aura', at: 'screen', d: 0, alpha: .75, color: 0x90ffc0 }, { fx: 'bolt', at: 'all', d: .35, k: 4.2 }],
    [{ fx: 'aura', at: 'screen', d: 0 }, { fx: 'crit', at: 'all', d: .45, k: 3 }, { fx: 'bolt', at: 'all', d: .8, k: 4.2, color: 0xfff0a0 }],
  ],
  hector: [
    [{ fx: 'twin', at: 'target', d: .2, k: 4 }],
    [{ fx: 'crit', at: 'target', d: .25, k: 2.6, color: 0xffb0a0 }],
    [{ fx: 'tower', at: 'target', d: .4, k: 3.6 }],
    [{ fx: 'spiral', at: 'target', d: .2, k: 2.2 }],
    [{ fx: 'tower', at: 'all', d: .3, k: 3.4 }],
    [{ fx: 'barrier', at: 'self', d: 0, k: 4.2, color: 0x80c0ff }],
    [{ fx: 'spiral', at: 'screen', d: 0, alpha: .85 }, { fx: 'tower', at: 'all', d: .45, k: 4 }],
    [{ fx: 'pillars', at: 'screen', d: 0, alpha: .9 }, { fx: 'ice', at: 'all', d: .7, k: 4.5, color: 0xffd080 }],
  ],
};
function playSkillFx(h, i) {
  const list = (SKILL_FX[h.key] || [])[i]; if (!list) return;
  for (const e of list) later(e.d, () => {
    if (e.at === 'screen') { sheetFx(e.fx, 0, 0, { screen: true, ro: 9, alpha: e.alpha ?? 1, color: e.color, dy: 380, fade: .25 }); return; }
    if (e.at === 'self') { sheetFx(e.fx, h.x + 20 * h.face, GROUND + h.y, { scale: e.k, color: e.color, ro: 23, flip: h.face < 0 }); return; }
    const tgts = e.at === 'all' ? allEnemies().filter(m => !m.dead && Math.abs(m.x - h.x) < 1100).slice(0, 6) : [h.target()].filter(Boolean);
    for (const m of tgts) sheetFx(e.fx, m.x, GROUND + (m.y || 0) - 10, { scale: e.k, color: e.color, ro: 63, flip: Math.random() < .5 });
  });
}
let lastHitFx = 0;
function hitSheetFx(e, crit) {
  if (G.time - lastHitFx < (crit ? .12 : .3)) return; lastHitFx = G.time;
  const hb = e.hurtBox();
  sheetFx(crit ? 'crit' : 'hit', e.x, (hb[2] + hb[3]) / 2 - (crit ? 150 : 170), { scale: crit ? 1.6 : 1.4, ro: 62, speed: 1.3 });
}

/* =========================================================================
   RIFT PORTAL · QTE · THE UPSIDE DOWN
   ========================================================================= */
const RIFT = { next: rnd(40, 70), portal: null };
const DRAC_DEF = { key: 'dracula', name: 'Count Dracula, the Beast', scale: 1, hw: 240, hh: 460, ranged: 0, col: 0xff3040 };
function riftTick(dt) {
  const p = RIFT.portal;
  if (p) {
    p.t += dt;
    const k = Math.min(1, p.t / .4) * (p.t > p.life - .4 ? Math.max(0, (p.life - p.t) / .4) : 1);
    p.core.scale.set(260 * k, 420 * k * (1 + Math.sin(p.t * 6) * .04), 1); p.core.material.opacity = .9 * k;
    p.ring.rotation.z += dt * 2; p.ring.scale.set(300 * k, 460 * k, 1); p.ring.material.opacity = .8 * k;
    if (p.spiral) { p.spiral.sx = .95 * k; p.spiral.sy = 2.7 * k; }
    if (Math.random() < .5) spawnFx({ tex: TX.glow, x: p.x + rnd(-120, 120), y: GROUND + rnd(40, 420), vx: (p.x - (p.x + rnd(-200, 200))) * .5, vy: rnd(-40, 40), sx: 14, sy: 14, sx1: 2, sy1: 2, life: .6, color: 0xc070ff, ro: 14 });
    UI.qteTick(Math.max(0, 1 - p.t / p.life));
    if (p.t >= p.life) closePortal(false);
    return;
  }
  if (G.secret || G.boss || !G.waveSpawned || G.wipe > 0 || G.wave >= G.wavesPerFloor || G.hero.dead) return;
  RIFT.next -= dt;
  if (RIFT.next <= 0) openPortal();
}
function openPortal() {
  const h = G.hero, x = h.x + rnd(420, 520);
  const core = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, color: 0x7a20ff }));
  core.position.set(x, GROUND + 230, 0); core.renderOrder = 13; scene.add(core);
  const ring = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.ring, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, color: 0xff40a0 }));
  ring.position.set(x, GROUND + 230, 0); ring.renderOrder = 13.5; scene.add(ring);
  const spiral = sheetFx('spiral', x, GROUND + 60, { loop: true, sx: .1, sy: .1, color: 0x9a50ff, ro: 13.2, alpha: .9 });
  RIFT.portal = { x, t: 0, life: 4.6, core, ring, spiral };
  shake(6, .3); SFX.portal(); AUDIO.say(h.key, 'portal', true);
  UI.qteShow(true);
}
function closePortal(entered) {
  const p = RIFT.portal; if (!p) return;
  scene.remove(p.core); scene.remove(p.ring); p.core.material.dispose(); p.ring.material.dispose(); if (p.spiral) p.spiral.dead = true;
  RIFT.portal = null; RIFT.next = rnd(55, 95);
  UI.qteShow(false);
  if (!entered) UI.toastSmall('The rift collapsed…');
}
function disposeField() {
  if (CINE.active) CINE.abort();
  for (const m of G.mobs) m.dispose(); G.mobs.length = 0;
  if (G.boss) { G.boss.dispose(); G.boss = null; UI.showBoss(false); }
  clearPlats(true);
}
function enterSecret() {
  if (!RIFT.portal || G.secret) return;
  const px = RIFT.portal.x;
  closePortal(true);
  G.secret = { bossUp: false, ending: false };
  SFX.rift(); UI.rift();
  G.hitstop = Math.max(G.hitstop, .3);
  later(.55, () => {
    disposeField();
    BG.setWorld('void'); WEATHER.setMode('void'); AUDIO.setWorld('void');
    const h = G.hero; h.y = 0; h.air = false; h.x = px; G.camX = h.x - 500;
    addPlat(h.x + 160, h.x + 560, 230); addPlat(h.x + 760, h.x + 1180, 230);
    UI.toast('THE UPSIDE DOWN', 'A WORLD TURNED INSIDE OUT');
    UI.dirtyAll();
  });
  later(2.2, () => {
    if (!G.secret) return;
    const h = G.hero;
    G.boss = new SpineMob('dracula', h.x + 640, false, true);
    G.secret.bossUp = true;
    UI.showBoss(true); SFX.boss(); AUDIO.say(h.key, 'secret', true);
    UI.toast('COUNT DRACULA', 'LORD OF THE VOID AWAKENS'); STORY.trigger('secret', true);
    UI.dirtyAll();
  });
}
function exitSecret(win, immediate) {
  if (!G.secret) return;
  G.secret.ending = true;
  const go = () => {
    disposeField();
    BG.setWorld('normal'); WEATHER.setMode('normal'); AUDIO.setWorld('normal');
    G.secret = null; G.waveSpawned = false; G.clearT = 1.4;
    RIFT.next = rnd(70, 120);
    UI.toast(win ? 'RIFT SEALED' : 'LOST IN THE VOID', win ? 'LEGENDARY SPOILS CLAIMED' : 'THE PARTY ESCAPED THE UPSIDE DOWN');
    UI.dirtyAll(); save(true);
    if (win) later(1.5, () => STORY.trigger('secretWin', true));
  };
  if (immediate) { go(); return; }
  UI.rift(); SFX.rift();
  later(.55, go);
}
/* secret-level boss tweaks: Dracula's hellfire (Elfire tower) and pillar storm (Forblaze) */
function draculaSpecial(b, anim) {
  const h = G.hero; if (!h || h.dead) return;
  const src = { ar: b.ar * 1.2, mlvl: b.mlvl, dmg: [b.dmg[0] * .9, b.dmg[1] * 1.1], elem: { type: 'fire', lo: b.mlvl, hi: b.mlvl * 2 } };
  if (anim === 'skill_0') {
    sheetFx('pillars', 0, 0, { screen: true, ro: 9, color: 0xff5050, alpha: .9, dy: 380, fade: .3 });
    later(.7, () => { if (G.hero && !G.hero.air) G.hero.receive(src); });
  } else {
    const x = h.x;
    later(.25, () => sheetFx('tower', x, GROUND + h.y - 10, { scale: 4.4, color: 0xff6060, ro: 63, at: { 5: () => { const hh = G.hero; if (hh && Math.abs(hh.x - x) < 170 && Math.abs(hh.y - h.y) < 120) hh.receive(src); shake(10, .2); } } }));
  }
}

/* =========================================================================
   DAY / NIGHT · WEATHER
   ========================================================================= */
const ENV = { weather: 'clear', wT: rnd(45, 80), rainT: 0, windT: 0, thunderT: 8, label: '' };
const C_DAY = new THREE.Color(1, 1, 1), C_DUSK = new THREE.Color(1, .74, .56), C_NIGHT = new THREE.Color(.36, .42, .74);
const S_DAY = new THREE.Color(1, 1, 1), S_DUSK = new THREE.Color(1, .62, .5), S_NIGHT = new THREE.Color(.25, .3, .55), S_RAIN = new THREE.Color(.55, .6, .7);
const DAY_LEN = 300; // seconds of play per day / night
function nightFactor(t) {
  const ph = (t % (DAY_LEN * 2)) / DAY_LEN; // 0..2: day then night
  const tr = 25 / DAY_LEN;
  if (ph < 1) return ph < tr ? 1 - ph / tr : ph > 1 - tr ? (ph - (1 - tr)) / tr * .5 : 0;
  const q = ph - 1; return q < tr ? .5 + q / tr * .5 : q > 1 - tr ? 1 - (q - (1 - tr)) / tr * .5 : 1;
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function envTick(real) {
  G.playtime = (G.playtime || 0) + real;
  if (G.secret) {
    G.amb.setRGB(1, .8, .84); G.ambHero.setRGB(1, .9, .92);
    WEATHER.rain += (0 - WEATHER.rain) * Math.min(1, real); WEATHER.windK += (0 - WEATHER.windK) * Math.min(1, real);
    AUDIO.setEnv({ rain: 0, wind: 0, night: 0, void: 1 });
    ENV.label = '✦ Void'; return;
  }
  const n = nightFactor(G.playtime);
  // weather state machine
  ENV.wT -= real;
  if (ENV.wT <= 0) {
    if (ENV.weather === 'clear') { const r = Math.random(); ENV.weather = r < .45 ? 'rain' : r < .75 ? 'wind' : 'clear'; ENV.wT = ENV.weather === 'clear' ? rnd(40, 80) : rnd(40, 80); }
    else { ENV.weather = 'clear'; ENV.wT = rnd(60, 130); }
    if (ENV.weather !== 'clear') UI.toastSmall(ENV.weather === 'rain' ? 'Rain sweeps across the plains' : 'A strong wind is rising');
  }
  const rT = ENV.weather === 'rain' ? 1 : 0, wT = ENV.weather === 'wind' ? 1 : ENV.weather === 'rain' ? .25 : 0;
  WEATHER.rain += (rT - WEATHER.rain) * Math.min(1, real * .35);
  WEATHER.windK += (wT - WEATHER.windK) * Math.min(1, real * .35);
  const rain = WEATHER.rain;
  // colours: day → dusk → night
  const dusk = n < .5 ? n * 2 : 2 - n * 2, nk = Math.max(0, (n - .5) * 2);
  _c1.copy(C_DAY).lerp(C_DUSK, Math.min(1, dusk) * (n < .5 ? 1 : 0)).lerp(C_NIGHT, nk);
  if (n >= .5) _c1.copy(C_DUSK).lerp(C_NIGHT, nk);
  _c1.multiplyScalar(1 - rain * .22);
  _c2.copy(S_DAY).lerp(S_DUSK, n < .5 ? dusk : 1 - nk).lerp(S_NIGHT, nk).lerp(S_RAIN, rain * .6 * (1 - nk));
  BG.setLight(_c1, nk, _c2);
  G.amb.copy(_c1); G.ambHero.copy(_c1).lerp(C_DAY, .45);
  // thunder in heavy rain
  if (rain > .7) { ENV.thunderT -= real; if (ENV.thunderT <= 0) { BG.flash(.8 + Math.random() * .4); later(.08, () => BG.flash(.6)); SFX.thunder(); ENV.thunderT = rnd(10, 22); } }
  AUDIO.setEnv({ rain, wind: WEATHER.windK, night: nk, void: 0 });
  ENV.label = (nk > .5 ? '☾ Night' : n > .25 ? (G.playtime % (DAY_LEN * 2) < DAY_LEN ? '◐ Dusk' : '◑ Dawn') : '☀ Day') + (ENV.weather === 'rain' ? ' · Rain' : ENV.weather === 'wind' ? ' · Gale' : '');
}
