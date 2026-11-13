'use strict';
/* sprite.js — frame-based pixel sprites with the same surface the game used from Spine:
   view.sk {x,y,scaleX,scaleY}, view.state.setAnimation/addListener/timeScale, entry.trackTime, view.u uniforms,
   view.activeBoxes() for hit windows, ASSETS[key].meta for cancel points / hit windows. */
const SPR_VS = `uniform vec4 uRect; varying vec2 vUv; void main(){ vUv = uRect.xy + uv * uRect.zw; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SPR_FS = `uniform sampler2D map; uniform float uFlash; uniform float uAlpha; uniform vec3 uTint; uniform vec3 uFlashCol; varying vec2 vUv;
void main(){ vec4 t = texture2D(map, vUv); if (t.a < .5) discard; vec3 c = t.rgb * uTint; c = mix(c, uFlashCol, uFlash); gl_FragColor = vec4(c, uAlpha); }`;
const SPR_EV = { shake: 'vibranium_normal', shakeH: 'vibranium_hard', dash: 'dash', hitstop: 'hitstop', back: 'move_combo_back' };
let ENTRY_SEQ = 1;
/* sheets whose art faces left: mirrored at draw time so every hero faces the enemy (right) */
const SPRITE_FLIP = { lyn: true, hector: true, e_gwyllgi: true, e_maelduin: true, e_mogall: true, e_revenant: true, e_dracula: true };

async function loadSprite(key) {
  const D = SPRITE_DATA[key];
  const img = await loadImage(D.png);
  const tex = new THREE.Texture(img);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const anims = {}, meta = {};
  for (const [name, a] of Object.entries(D.anims)) {
    let t = 0; const fr = a.f.map(f => { const o = Object.assign({ d: D.dt, r: D.frames[f.id] }, f); o.t0 = t; t += o.d; return o; });
    const dur = t;
    let boxEnd = 0; const wins = new Set();
    for (const f of fr) if (f.hit !== undefined) { wins.add(f.hit); boxEnd = Math.max(boxEnd, f.t0 + f.d); }
    anims[name] = { name, loop: a.loop, f: fr, dur, bob: name === 'move' && fr.length === 1 };
    meta[name] = { name, dur, boxEnd, windows: wins.size, skillEv: 0, lastEv: 0, cancel: wins.size ? boxEnd + (dur - boxEnd) * .35 : dur * .6 };
  }
  // per-frame FX textures (Lyn's sword arcs etc.)
  const fxTex = {};
  for (const [n, id] of Object.entries(D.fx || {})) {
    const [x, y, w, h] = D.frames[id];
    const c = makeCanvas(w, h, (cx) => cx.drawImage(img, x, y, w, h, 0, 0, w, h));
    const t2 = new THREE.CanvasTexture(c); t2.magFilter = THREE.NearestFilter; t2.minFilter = THREE.NearestFilter; t2.generateMipmaps = false;
    fxTex[n] = { tex: t2, w, h };
  }
  ASSETS[key] = { key, img, tex, D, flip: SPRITE_FLIP[key] ? -1 : 1, W: D.W, H: D.H, scale: D.scale, anims, meta, fxTex, reach: 260,
    data: { animations: Object.keys(anims).map(name => ({ name })), findAnimation: (n) => anims[n] || null } };
  return ASSETS[key];
}

class SpriteView {
  constructor(asset, scale = 1) {
    this.asset = asset;
    this.sk = { x: 0, y: 0, scaleX: scale, scaleY: scale };
    this.u = {
      map: { value: asset.tex }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uFlash: { value: 0 }, uAlpha: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uFlashCol: { value: new THREE.Color(1, 1, 1) },
    };
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SPR_VS, fragmentShader: SPR_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.listeners = []; this.hitSlots = [{}]; this.slots = []; this.prevBox = new Map(); this.t = 0;
    const self = this;
    this.state = {
      timeScale: 1,
      setAnimation(track, name, loop) { return self.set(name, loop); },
      addListener(l) { self.listeners.push(l); },
    };
    this.set('idle', true);
  }
  set(name, loop) {
    const a = this.asset.anims[name] || this.asset.anims.idle;
    this.anim = a; this.fi = -1;
    this.entry = { trackTime: 0, loop: loop ?? a.loop, id: ENTRY_SEQ++, anim: a };
    this.slots = [];
    this.applyFrame(0);
    return this.entry;
  }
  frameAt(t) {
    const a = this.anim, f = a.f;
    if (this.entry.loop) t = t % a.dur; else if (t >= a.dur) return f.length - 1;
    for (let i = f.length - 1; i >= 0; i--) if (t >= f[i].t0) return i;
    return 0;
  }
  applyFrame(i) {
    if (i === this.fi) return;
    const a = this.anim, prev = this.fi;
    // fire events for every frame we pass through (non-looping play only moves forward)
    if (this.fi >= 0 || i === 0) {
      const from = prev < 0 ? 0 : (i > prev ? prev + 1 : 0);
      for (let k = from; k <= i; k++) { const ev = a.f[k].ev; if (ev) { const n = SPR_EV[ev] || ev; for (const l of this.listeners) if (l.event) l.event(this.entry, { data: { name: n } }); } }
    }
    this.fi = i;
    const [x, y, w, h] = a.f[i].r, A = this.asset;
    this.u.uRect.value.set(x / A.W, 1 - (y + h) / A.H, w / A.W, h / A.H);
  }
  update(dt) {
    this.t += dt;
    this.entry.trackTime += dt * this.state.timeScale;
    this.applyFrame(this.frameAt(this.entry.trackTime));
    this.place();
  }
  place() {
    const f = this.anim.f[this.fi], [, , w, h, ax, ay] = f.r, s = this.asset.scale * (f.r[6] || 1);
    const sx = this.sk.scaleX * s * this.asset.flip, sy = this.sk.scaleY * s;
    const bob = this.anim.bob ? Math.abs(Math.sin(this.t * 9)) * s * 1.6 : 0;
    this.mesh.scale.set(w * sx, h * sy, 1);
    this.mesh.position.set(this.sk.x + (w / 2 - ax) * sx, this.sk.y + bob + (h / 2 - ay) * sy, 0);
  }
  activeBoxes() {
    const f = this.anim.f[this.fi];
    if (!f || f.hit === undefined) return [];
    const [, , w, h, ax] = f.r, s = this.asset.scale * (f.r[6] || 1), dir = Math.sign(this.sk.scaleX) || 1, k = Math.abs(this.sk.scaleX) * s;
    const reach = Math.max((this.asset.flip < 0 ? ax : w - ax) * k, this.asset.reach);
    const slot = this.slots[f.hit] || (this.slots[f.hit] = { win: f.hit });
    const key = this.entry.id + ':' + f.hit;
    const fresh = this.prevBox.get(slot) !== key; this.prevBox.set(slot, key);
    const x = this.sk.x, y = this.sk.y;
    return [{ slot, box: dir > 0 ? [x - 30, x + reach, y, y + h * k + 120] : [x - reach, x + 30, y, y + h * k + 120], fresh }];
  }
}
/* still image of one frame, scaled with nearest neighbour onto a canvas (portraits, paper doll, cut-ins) */
function spriteSnap(key, frameId, opt) {
  const A = ASSETS[key], [x, y, w, h, ax] = A.D.frames[frameId];
  const o = Object.assign({ outW: 168, outH: 168, crop: null, bg: null }, opt);
  return makeCanvas(o.outW, o.outH, (c) => {
    c.imageSmoothingEnabled = false;
    if (o.bg) o.bg(c, o.outW, o.outH);
    let sx = x, sy = y, sw = w, sh = h;
    if (o.crop) { sw = Math.min(w, o.crop.w); sh = Math.min(h, o.crop.h); sx = x + Math.max(0, Math.min(w - sw, Math.round(ax - sw / 2 + (o.crop.dx || 0) * A.flip))); sy = y + (o.crop.dy || 0); }
    const k = Math.min(o.outW / sw, o.outH / sh) * (o.fill || 1);
    const dw = sw * k, dh = sh * k;
    if (A.flip < 0) { c.translate(o.outW, 0); c.scale(-1, 1); }
    c.drawImage(A.img, sx, sy, sw, sh, Math.round((o.outW - dw) / 2), Math.round(o.alignBottom ? o.outH - dh : (o.outH - dh) / 2), Math.round(dw), Math.round(dh));
  });
}

/* painted hero art (FEH-style portraits) for portraits, the paper doll and ultimate cut-ins; face = [x, y, size] crop */
const HERO_ART = { lyn: { src: 'sprites/lyn_art.webp', face: [62, 105, 240] }, hector: { src: 'sprites/hector_art.webp', face: [160, 40, 240] } };
async function loadHeroArt() {
  await Promise.all(Object.values(HERO_ART).map(a => loadImage(a.src).then(im => { a.img = im; }).catch(() => null)));
}
function artFace(key, size, bg) {
  const a = HERO_ART[key]; if (!a || !a.img) return null;
  return makeCanvas(size, size, (c) => { if (bg) bg(c, size, size); const [x, y, s] = a.face; c.drawImage(a.img, x, y, s, s, 0, 0, size, size); });
}

/* ---------- GBA spell animations (Fire Emblem battle FX), additive, frame-stepped ---------- */
const SFX_FS = `uniform sampler2D map; uniform float uAlpha; uniform vec3 uCol; varying vec2 vUv;
void main(){ vec3 c = texture2D(map, vUv).rgb * uCol * uAlpha; gl_FragColor = vec4(c, 1.0); }`;
/* opaque full-screen summon scenes: normal blending, soft fade at the top and bottom of the frame */
const SFX_VS2 = `uniform vec4 uRect; varying vec2 vUv; varying vec2 vL; void main(){ vL = uv; vUv = uRect.xy + uv * uRect.zw; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SFX_FS2 = `uniform sampler2D map; uniform float uAlpha; uniform vec3 uCol; varying vec2 vUv; varying vec2 vL;
void main(){ vec3 c = texture2D(map, vUv).rgb * uCol; float e = smoothstep(0.0, .14, vL.y) * smoothstep(1.0, .86, vL.y); gl_FragColor = vec4(c, uAlpha * e); }`;
const FXT = {}, SHEET_FX = [];
async function loadSheetFx() {
  await Promise.all(Object.entries(FX_DATA).map(([k, d]) => loadImage(d.png).then(img => {
    const t = new THREE.Texture(img); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; FXT[k] = t;
  }).catch(() => null)));
}
/* o: { scale, sx, sy, color, ro, loop, life, speed, screen, alpha, at: {frame: fn} } ; (x, y) = bottom-centre in world units */
function sheetFx(name, x, y, o = {}) {
  const D = FX_DATA[name]; if (!D || !FXT[name]) return null;
  const u = { map: { value: FXT[name] }, uRect: { value: new THREE.Vector4() }, uAlpha: { value: o.alpha ?? 1 }, uCol: { value: new THREE.Color(o.color ?? 0xffffff) } };
  const m = new THREE.Mesh(fxGeo, D.opaque
    ? new THREE.ShaderMaterial({ uniforms: u, vertexShader: SFX_VS2, fragmentShader: SFX_FS2, transparent: true, depthTest: false, depthWrite: false })
    : new THREE.ShaderMaterial({ uniforms: u, vertexShader: SPR_VS, fragmentShader: SFX_FS, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }));
  m.renderOrder = o.ro ?? 63; m.frustumCulled = false; scene.add(m);
  const f = Object.assign({ m, u, D, name, x, y, t: 0, fi: -1, scale: 4.5, speed: 1, fired: {} }, o);
  f.sx = o.sx ?? f.scale; f.sy = o.sy ?? f.scale;
  SHEET_FX.push(f); stepSheetFx(f, 0); return f;
}
function stepSheetFx(f, dt) {
  const D = f.D;
  f.t += dt * f.speed;
  let i = Math.floor(f.t / D.dt);
  const life = f.life ?? (f.loop ? 1e9 : D.n * D.dt);
  if (f.t >= life || f.dead) { scene.remove(f.m); f.m.material.dispose(); return false; }
  if (f.loop) i %= D.n; else i = Math.min(D.n - 1, i);
  if (f.at) for (const k in f.at) if (!f.fired[k] && i >= +k) { f.fired[k] = 1; f.at[k](f); }
  if (i !== f.fi) {
    f.fi = i; const c = i % D.cols, r = Math.floor(i / D.cols);
    f.u.uRect.value.set(c * D.w / D.W, 1 - (r + 1) * D.h / D.H, D.w / D.W, D.h / D.H);
  }
  if (f.fade || f.fadeIn) f.u.uAlpha.value = (f.alpha ?? 1) * (f.fade ? Math.min(1, (life - f.t) / f.fade) : 1) * (f.fadeIn ? Math.min(1, f.t / f.fadeIn) : 1);
  const fit = f.fit ? (VW / camera.zoom) / D.w * f.fit : 0;
  const w = D.w * (fit || f.sx), h = D.h * (fit || f.sy);
  if (f.screen) { const vc = viewCenter(); f.m.position.set(vc[0] + (f.dx || 0), (f.dy === undefined ? vc[1] : GROUND + f.dy), 0); }
  else f.m.position.set(f.x, f.y + h / 2, 0);
  f.m.scale.set(w * (f.flip ? -1 : 1), h, 1);
  return true;
}
function updateSheetFx(dt) { for (let i = SHEET_FX.length - 1; i >= 0; i--) if (!stepSheetFx(SHEET_FX[i], dt)) SHEET_FX.splice(i, 1); }

/* centre of what the camera currently shows, in world units (accounts for crowd zoom) */
function viewCenter() { return [camera.position.x + VW / 2, camera.position.y + VH / 2]; }
function viewBounds() { const z = camera.zoom || 1, c = camera.position.x + VW / 2; return [c - VW / (2 * z), c + VW / (2 * z)]; }
