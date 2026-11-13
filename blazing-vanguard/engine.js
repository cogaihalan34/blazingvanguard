'use strict';
/* engine.js — renderer, spine→three, fx, procedural background, placeholder mob art */
/* =========================================================================
   CANVAS TEXTURE HELPERS
   ========================================================================= */
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h); return c;
}
function texFrom(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; }
  return t;
}
function rnd(a, b) { return a + Math.random() * (b - a); }
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function fmt(n) {
  n = Math.round(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e7) return (n / 1e6).toFixed(1) + 'M';
  return n.toLocaleString('en-US');
}
function fmtS(n) { if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K'; return Math.round(n).toString(); }

/* =========================================================================
   SPINE → THREE renderer (blend-mode aware, PMA aware, clipping)
   ========================================================================= */
const SPINE_VS = `attribute vec4 color; varying vec2 vUv; varying vec4 vC;
void main(){ vUv=uv; vC=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const SPINE_FS = `uniform sampler2D map; uniform float uFlash; uniform float uAlpha; uniform float uPma; uniform vec3 uFlashCol; uniform vec3 uTint;
varying vec2 vUv; varying vec4 vC;
void main(){ vec4 t=texture2D(map,vUv); if(uPma<0.5) t.rgb*=t.a;
 vec4 c=vec4(t.rgb*vC.rgb*vC.a, t.a*vC.a); c.rgb*=uTint; c.rgb=mix(c.rgb,uFlashCol*c.a,uFlash); c*=uAlpha; gl_FragColor=c; }`;
const QUAD_TRIS = [0, 1, 2, 2, 3, 0];

class SpineTex extends spine.Texture {
  constructor(img) { super(img); }
  setFilters() {} setWraps() {} dispose() {}
}

class SpineView {
  constructor(asset, scale) {
    const d = asset.data;
    this.asset = asset;
    this.sk = new spine.Skeleton(d);
    const skin = new spine.Skin('mix');
    for (const n of asset.skins) { const s = d.findSkin(n); if (s) skin.addSkin(s); }
    this.sk.setSkin(skin); this.sk.setSlotsToSetupPose();
    this.sk.scaleX = scale; this.sk.scaleY = scale;
    const sd = new spine.AnimationStateData(d); sd.defaultMix = 0.07;
    this.state = new spine.AnimationState(sd);
    const MAXV = 24000;
    this.pos = new Float32Array(MAXV * 3); this.col = new Float32Array(MAXV * 4); this.uv = new Float32Array(MAXV * 2);
    this.idx = new Uint32Array(MAXV * 3); this.maxV = MAXV;
    const g = this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aUv = new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage);
    this.aIdx = new THREE.BufferAttribute(this.idx, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('uv', this.aUv); g.setIndex(this.aIdx);
    this.u = {
      map: { value: asset.tex }, uFlash: { value: 0 }, uAlpha: { value: 1 }, uPma: { value: asset.pma ? 1 : 0 },
      uFlashCol: { value: new THREE.Color(1, 1, 1) }, uTint: { value: new THREE.Color(1, 1, 1) },
    };
    const base = { uniforms: this.u, vertexShader: SPINE_VS, fragmentShader: SPINE_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendEquation: THREE.AddEquation };
    const mN = new THREE.ShaderMaterial(Object.assign({}, base, { blendDst: THREE.OneMinusSrcAlphaFactor }));
    const mA = new THREE.ShaderMaterial(Object.assign({}, base, { blendDst: THREE.OneFactor }));
    mN.uniforms = this.u; mA.uniforms = this.u;
    this.mesh = new THREE.Mesh(g, [mN, mA]);
    this.mesh.frustumCulled = false;
    this.clipper = new spine.SkeletonClipping();
    this.tmp = new Float32Array(2048);
    this.tc = new spine.Color();
    this.hitSlots = this.sk.slots.filter(s => s.data.name.startsWith('hitbox'));
    this.prevBox = new Map();
  }
  update(dt) {
    this.state.update(dt); this.state.apply(this.sk); this.sk.updateWorldTransform(); this.build();
  }
  build() {
    const sk = this.sk, clipper = this.clipper, skc = sk.color, g = this.geo;
    const pos = this.pos, col = this.col, uv = this.uv, idx = this.idx;
    let v = 0, ii = 0, gStart = 0, gMat = -1;
    g.clearGroups();
    for (const slot of sk.drawOrder) {
      if (!slot.bone.active) { clipper.clipEndWithSlot(slot); continue; }
      const att = slot.getAttachment();
      let nv, tris, uvs, ac;
      if (att instanceof spine.RegionAttachment) {
        att.computeWorldVertices(slot.bone, this.tmp, 0, 2); nv = 8; tris = QUAD_TRIS; uvs = att.uvs; ac = att.color;
      } else if (att instanceof spine.MeshAttachment) {
        nv = att.worldVerticesLength; if (this.tmp.length < nv) this.tmp = new Float32Array(nv * 2);
        att.computeWorldVertices(slot, 0, nv, this.tmp, 0, 2); tris = att.triangles; uvs = att.uvs; ac = att.color;
      } else if (att instanceof spine.ClippingAttachment) {
        clipper.clipStart(slot, att); continue;
      } else { clipper.clipEndWithSlot(slot); continue; }
      const sc = slot.color;
      const a = skc.a * sc.a * ac.a;
      if (a <= 0.002) { clipper.clipEndWithSlot(slot); continue; }
      const r = skc.r * sc.r * ac.r, gg = skc.g * sc.g * ac.g, b = skc.b * sc.b * ac.b;
      const bm = slot.data.blendMode;
      const mat = (bm === spine.BlendMode.Additive || bm === spine.BlendMode.Screen) ? 1 : 0;
      if (mat !== gMat) { if (gMat >= 0 && ii > gStart) g.addGroup(gStart, ii - gStart, gMat); gStart = ii; gMat = mat; }
      const base = v;
      if (clipper.isClipping()) {
        this.tc.set(r, gg, b, a);
        clipper.clipTriangles(this.tmp, nv, tris, tris.length, uvs, this.tc, null, false);
        const cv = clipper.clippedVertices, ct = clipper.clippedTriangles;
        if (v + cv.length / 8 >= this.maxV) break;
        for (let k = 0; k < cv.length; k += 8) {
          pos[v * 3] = cv[k]; pos[v * 3 + 1] = cv[k + 1]; pos[v * 3 + 2] = 0;
          col[v * 4] = cv[k + 2]; col[v * 4 + 1] = cv[k + 3]; col[v * 4 + 2] = cv[k + 4]; col[v * 4 + 3] = cv[k + 5];
          uv[v * 2] = cv[k + 6]; uv[v * 2 + 1] = cv[k + 7]; v++;
        }
        for (let k = 0; k < ct.length; k++) idx[ii++] = base + ct[k];
      } else {
        if (v + nv / 2 >= this.maxV) break;
        const t = this.tmp;
        for (let k = 0; k < nv; k += 2) {
          pos[v * 3] = t[k]; pos[v * 3 + 1] = t[k + 1]; pos[v * 3 + 2] = 0;
          col[v * 4] = r; col[v * 4 + 1] = gg; col[v * 4 + 2] = b; col[v * 4 + 3] = a;
          uv[v * 2] = uvs[k]; uv[v * 2 + 1] = uvs[k + 1]; v++;
        }
        for (let k = 0; k < tris.length; k++) idx[ii++] = base + tris[k];
      }
      clipper.clipEndWithSlot(slot);
    }
    clipper.clipEnd();
    if (gMat >= 0 && ii > gStart) g.addGroup(gStart, ii - gStart, gMat);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aUv.needsUpdate = this.aIdx.needsUpdate = true;
    this.aPos.updateRange.count = v * 3; this.aCol.updateRange.count = v * 4; this.aUv.updateRange.count = v * 2; this.aIdx.updateRange.count = ii;
    g.setDrawRange(0, ii);
  }
  /* returns array of {box:[x0,x1,y0,y1], fresh:bool} for active hitbox slots */
  activeBoxes() {
    const out = [];
    for (const s of this.hitSlots) {
      const att = s.getAttachment();
      if (att instanceof spine.BoundingBoxAttachment && s.bone.active) {
        const n = att.worldVerticesLength; if (this.tmp.length < n) this.tmp = new Float32Array(n * 2);
        att.computeWorldVertices(s, 0, n, this.tmp, 0, 2);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (let i = 0; i < n; i += 2) { const x = this.tmp[i], y = this.tmp[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const fresh = this.prevBox.get(s) !== att;
        this.prevBox.set(s, att);
        out.push({ slot: s, box: [x0, x1, y0, y1], fresh });
      } else this.prevBox.set(s, null);
    }
    return out;
  }
}

/* animation metadata straight from the skeleton: cancel point, hitbox windows, event times */
function animMeta(data, anim) {
  const m = { name: anim.name, dur: anim.duration, cancel: null, boxEnd: 0, windows: 0, skillEv: 0, lastEv: 0 };
  for (const tl of anim.timelines) {
    if (tl instanceof spine.EventTimeline) {
      for (let i = 0; i < tl.events.length; i++) {
        const t = tl.frames[i], n = tl.events[i].data.name;
        if (n === 'cancel_anim' && m.cancel === null) m.cancel = t;
        if (n === 'skill' || n === 'shoot') { m.skillEv++; m.lastEv = Math.max(m.lastEv, t); }
      }
    } else if (tl instanceof spine.AttachmentTimeline) {
      const sn = data.slots[tl.slotIndex].name;
      if (sn.startsWith('hitbox')) {
        for (let i = 0; i < tl.frames.length; i++) {
          if (tl.attachmentNames[i]) m.windows++; else m.boxEnd = Math.max(m.boxEnd, tl.frames[i]);
        }
      }
    }
  }
  if (m.cancel === null) m.cancel = m.dur * 0.6;
  return m;
}

/* =========================================================================
   ASSET LOADING
   ========================================================================= */
const ASSETS = {};
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
/* generic Spine loader: def = {skel (base64 txt), atlas, png, pma ('auto'|bool), skins:[...]} */
function detectPma(img) {
  try {
    const w = Math.min(512, img.width), h = Math.min(512, img.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; let over = 0, semi = 0;
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a > 8 && a < 240) { semi++; if (Math.max(d[i], d[i + 1], d[i + 2]) > a + 6) over++; } }
    return semi > 0 && over / semi < 0.01;
  } catch (e) { return true; }
}
async function loadSpine(key, def) {
  const [atlasTxt, img, bin] = await Promise.all([
    fetch(def.atlas).then(r => { if (!r.ok) throw new Error(def.atlas); return r.text(); }),
    loadImage(def.png),
    fetch(def.skel).then(r => { if (!r.ok) throw new Error(def.skel); return r.text(); }).then(t => { const b = atob(t.trim()); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }),
  ]);
  const pma = def.pma === 'auto' || def.pma === undefined ? detectPma(img) : def.pma;
  const tex = new THREE.Texture(img);
  tex.flipY = false; tex.premultiplyAlpha = false; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
  tex.needsUpdate = true;
  const atlas = new spine.TextureAtlas(atlasTxt, () => new SpineTex(img));
  const sb = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas));
  const data = sb.readSkeletonData(bin);
  const meta = {};
  for (const a of data.animations) meta[a.name] = animMeta(data, a);
  const skins = (def.skins || ['default']).filter(n => data.findSkin(n));
  ASSETS[key] = { data, tex, pma, skins, meta, def };
  return ASSETS[key];
}
/* pick an animation by candidate names / regex */
function findAnim(asset, ...cands) {
  const names = asset.data.animations.map(a => a.name);
  for (const c of cands) {
    if (typeof c === 'string') { if (names.includes(c)) return c; }
    else { const n = names.find(x => c.test(x)); if (n) return n; }
  }
  return null;
}

/* =========================================================================
   FX TEXTURES
   ========================================================================= */
const TX = {};
function buildFxTextures() {
  TX.glow = texFrom(makeCanvas(128, 128, (c, w) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }));
  TX.slash = texFrom(makeCanvas(512, 256, (c) => {
    // crescent: big arc minus offset arc
    c.translate(256, 220);
    const g = c.createLinearGradient(-240, 0, 240, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.35, 'rgba(255,255,255,.9)'); g.addColorStop(.6, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, 240, 200, 0, Math.PI, 2 * Math.PI); c.ellipse(0, 22, 236, 168, 0, 2 * Math.PI, Math.PI, true); c.closePath(); c.fill();
  }));
  TX.streak = texFrom(makeCanvas(256, 32, (c) => {
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 16); c.lineTo(230, 10); c.lineTo(256, 16); c.lineTo(230, 22); c.closePath(); c.fill();
  }));
  TX.ring = texFrom(makeCanvas(256, 256, (c) => {
    c.strokeStyle = 'rgba(255,255,255,1)'; c.lineWidth = 10; c.shadowColor = '#fff'; c.shadowBlur = 16;
    c.beginPath(); c.arc(128, 128, 104, 0, Math.PI * 2); c.stroke();
  }));
  TX.star = texFrom(makeCanvas(256, 256, (c) => {
    c.translate(128, 128);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-128, 0); c.lineTo(0, -10); c.lineTo(128, 0); c.lineTo(0, 10); c.closePath(); c.fill(); }
    c.beginPath(); c.arc(0, 0, 40, 0, Math.PI * 2); c.fill();
  }));
  TX.coin = texFrom(makeCanvas(64, 64, (c) => {
    const g = c.createRadialGradient(24, 22, 2, 32, 32, 30); g.addColorStop(0, '#fff7cf'); g.addColorStop(.45, '#f2c14c'); g.addColorStop(1, '#8a5510');
    c.fillStyle = g; c.beginPath(); c.arc(32, 32, 28, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#6b3f08'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(255,240,190,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(32, 32, 18, 0, Math.PI * 2); c.stroke();
  }));
  TX.shard = texFrom(makeCanvas(32, 32, (c) => { c.fillStyle = '#e9dfc5'; c.beginPath(); c.moveTo(4, 12); c.lineTo(28, 6); c.lineTo(26, 20); c.lineTo(6, 26); c.closePath(); c.fill(); }));
  TX.smoke = texFrom(makeCanvas(128, 128, (c) => {
    for (let i = 0; i < 18; i++) {
      const x = 64 + rnd(-24, 24), y = 64 + rnd(-24, 24), r = rnd(18, 40);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    }
  }));
  TX.shadow = texFrom(makeCanvas(128, 64, (c) => {
    const g = c.createRadialGradient(64, 32, 0, 64, 32, 64); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.setTransform(1, 0, 0, .5, 0, 16); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }));
}

/* simple pooled additive / normal sprites */
const FX = [];
const fxGeo = new THREE.PlaneGeometry(1, 1);
function spawnFx(o) {
  const mat = new THREE.MeshBasicMaterial({ map: o.tex, transparent: true, depthTest: false, depthWrite: false, color: o.color || 0xffffff,
    blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: o.a0 ?? 1 });
  const m = new THREE.Mesh(fxGeo, mat);
  m.renderOrder = o.ro ?? 60; m.frustumCulled = false;
  scene.add(m);
  const f = Object.assign({ m, t: 0, life: .3, x: 0, y: 0, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, sx: 100, sy: 100, sx1: null, sy1: null, a0: 1, a1: 0, drag: 0, ground: false, ease: 1 }, o);
  if (f.sx1 === null) f.sx1 = f.sx; if (f.sy1 === null) f.sy1 = f.sy;
  FX.push(f); return f;
}
function updateFx(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t += dt;
    const k = Math.min(1, f.t / f.life);
    const e = 1 - Math.pow(1 - k, f.ease === 1 ? 2.2 : f.ease);
    f.vy -= f.g * dt; f.vx *= (1 - f.drag * dt); f.vy *= (1 - f.drag * dt);
    f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
    if (f.ground && f.y < GROUND) { f.y = GROUND; f.vy = Math.abs(f.vy) * .45; f.vx *= .6; if (Math.abs(f.vy) < 60) f.vy = 0; }
    if (f.onUpdate) f.onUpdate(f, dt);
    f.m.position.set(f.x, f.y, 0);
    f.m.rotation.z = f.rot;
    let sx = f.sx + (f.sx1 - f.sx) * e, sy = f.sy + (f.sy1 - f.sy) * e;
    if (f.alignVel) f.m.rotation.z = Math.atan2(f.vy, f.vx);
    if (f.spin) sx *= Math.abs(Math.cos(f.t * f.spin));
    f.m.scale.set(sx, sy, 1);
    f.m.material.opacity = f.a0 + (f.a1 - f.a0) * (f.fadeLate ? Math.max(0, (k - .6) / .4) : k);
    if (f.t >= f.life || f.dead) { scene.remove(f.m); f.m.material.dispose(); FX.splice(i, 1); if (f.onEnd) f.onEnd(f); }
  }
}

function hitSpark(x, y, heavy, crit, color) {
  const c = new THREE.Color(color || (crit ? 0xff5070 : 0xffb050));
  const ang = rnd(-.7, .5) + (Math.random() < .5 ? 0 : Math.PI);
  spawnFx({ tex: TX.slash, x, y, rot: ang, sx: 120, sy: 60, sx1: heavy ? 520 : 360, sy1: heavy ? 200 : 140, life: .16, color: 0xffffff, a0: 1, a1: 0, ro: 62 });
  spawnFx({ tex: TX.slash, x, y, rot: ang, sx: 140, sy: 70, sx1: heavy ? 600 : 420, sy1: heavy ? 240 : 170, life: .22, color: c, a0: .9, a1: 0, ro: 61 });
  spawnFx({ tex: TX.star, x, y, rot: rnd(0, 3), sx: heavy ? 260 : 180, sy: heavy ? 260 : 180, sx1: 40, sy1: 40, life: .14, color: 0xffffff, ro: 63 });
  spawnFx({ tex: TX.glow, x, y, sx: heavy ? 360 : 220, sy: heavy ? 360 : 220, sx1: 80, sy1: 80, life: .2, color: c, a0: .8, ro: 59 });
  const n = heavy ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), sp = rnd(500, heavy ? 1400 : 1000);
    spawnFx({ tex: TX.streak, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 200, g: 1600, drag: 4, alignVel: true, sx: rnd(50, 110), sy: rnd(6, 10), life: rnd(.18, .32), color: i % 2 ? c : 0xffe7b0, ro: 64 });
  }
  if (heavy) spawnFx({ tex: TX.ring, x, y, sx: 40, sy: 40, sx1: 420, sy1: 420, life: .3, color: c, a0: .9, ro: 58, ease: 3 });
}
function muzzle(x, y, tx, ty) {
  const dx = tx - x, dy = ty - y, len = Math.hypot(dx, dy);
  spawnFx({ tex: TX.streak, x: (x + tx) / 2, y: (y + ty) / 2, rot: Math.atan2(dy, dx), sx: len, sy: 10, sx1: len, sy1: 2, life: .12, color: 0x9fb7ff, ro: 57 });
}

/* =========================================================================
   BACKGROUND — procedural gothic cathedral, parallax layers
   ========================================================================= */
function wrapDraw(W, x, fn) { fn(x); if (x < 200) fn(x + W); if (x > W - 200) fn(x - W); }
function pointedArch(c, x, y, w, h) { // x,y = bottom-left; h = height to spring point; tip above
  const r = w * .85;
  c.moveTo(x, y); c.lineTo(x, y - h);
  c.arc(x + r, y - h, r, Math.PI, Math.PI + Math.acos((r - w / 2) / r) * 1, false);
  c.arc(x + w - r, y - h, r, -Math.acos((r - w / 2) / r), 0, false);
  c.lineTo(x + w, y); c.closePath();
}
function drawSky(c, W, H) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#05030a'); g.addColorStop(.35, '#1a0a1f'); g.addColorStop(.62, '#4a1226'); g.addColorStop(.8, '#2a0b1a'); g.addColorStop(1, '#0d0610');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = seeded(7);
  for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,${200 + r() * 55 | 0},${200 + r() * 55 | 0},${r() * .7})`; c.fillRect(r() * W, r() * H * .55, r() < .1 ? 2 : 1, r() < .1 ? 2 : 1); }
  const mx = W * .7, my = H * .27, mr = W * .14;
  let gg = c.createRadialGradient(mx, my, mr * .8, mx, my, mr * 4.5);
  gg.addColorStop(0, 'rgba(230,60,60,.45)'); gg.addColorStop(.3, 'rgba(150,20,50,.18)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gg; c.fillRect(0, 0, W, H);
  gg = c.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
  gg.addColorStop(0, '#ffe2cc'); gg.addColorStop(.55, '#f08a6a'); gg.addColorStop(1, '#a6262f');
  c.fillStyle = gg; c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();
  c.globalAlpha = .18; c.fillStyle = '#5a0f1c';
  for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(mx + (r() - .5) * mr * 1.3, my + (r() - .5) * mr * 1.3, mr * (.08 + r() * .16), 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
}
function drawClouds(c, W, H) {
  const r = seeded(11);
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = H * (.2 + r() * .7), rw = 120 + r() * 320, rh = 14 + r() * 30;
    wrapDraw(W, x, (xx) => {
      const g = c.createRadialGradient(xx, y, 0, xx, y, rw);
      g.addColorStop(0, `rgba(${40 + r() * 30 | 0},10,${30 + r() * 20 | 0},.55)`); g.addColorStop(1, 'rgba(20,5,15,0)');
      c.save(); c.translate(xx, y); c.scale(1, rh / rw); c.translate(-xx, -y); c.fillStyle = g; c.beginPath(); c.arc(xx, y, rw, 0, Math.PI * 2); c.fill(); c.restore();
    });
  }
}
function drawCastle(c, W, H) {
  const r = seeded(3);
  c.fillStyle = '#12091a';
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) c.lineTo(x, H - 140 - Math.sin(x / W * Math.PI * 4) * 40 - r() * 16);
  c.lineTo(W, H); c.closePath(); c.fill();
  const towers = [];
  for (let i = 0; i < 16; i++) towers.push({ x: r() * W, w: 30 + r() * 70, h: 180 + r() * 420 });
  towers.sort((a, b) => b.h - a.h);
  for (const t of towers) {
    wrapDraw(W, t.x, (x) => {
      const top = H - 120 - t.h;
      c.fillStyle = '#160b1f'; c.fillRect(x, top, t.w, t.h + 120);
      c.beginPath(); c.moveTo(x - 6, top); c.lineTo(x + t.w / 2, top - t.w * 1.6 - r() * 60); c.lineTo(x + t.w + 6, top); c.closePath(); c.fill();
      c.fillStyle = '#2a1430'; c.fillRect(x + t.w - 4, top, 4, t.h);
      for (let k = 0; k < 5; k++) {
        if (r() < .55) {
          const wy = top + 30 + r() * (t.h - 60), wx = x + t.w * (.3 + r() * .4);
          c.fillStyle = r() < .5 ? '#ffb24a' : '#ff7a3a'; c.shadowColor = '#ff8a3d'; c.shadowBlur = 10;
          c.fillRect(wx - 3, wy - 7, 6, 12); c.shadowBlur = 0;
        }
      }
    });
  }
  const fg = c.createLinearGradient(0, H - 260, 0, H);
  fg.addColorStop(0, 'rgba(70,20,50,0)'); fg.addColorStop(1, 'rgba(70,20,50,.75)');
  c.fillStyle = fg; c.fillRect(0, H - 260, W, 260);
}
function stainedGlass(c, x, y, w, h, hue, r) {
  // y = bottom
  c.save(); c.beginPath(); pointedArch(c, x, y, w, h); c.clip();
  const g = c.createRadialGradient(x + w / 2, y - h * .9, 10, x + w / 2, y - h * .7, h);
  g.addColorStop(0, `hsla(${hue},80%,70%,1)`); g.addColorStop(.5, `hsla(${hue + 20},70%,38%,1)`); g.addColorStop(1, `hsla(${hue - 30},60%,14%,1)`);
  c.fillStyle = g; c.fillRect(x, y - h * 2, w, h * 2);
  for (let i = 0; i < 26; i++) { c.fillStyle = `hsla(${hue + (r() - .5) * 120},80%,${40 + r() * 30}%,.55)`; c.fillRect(x + r() * w, y - r() * h * 1.6, 8 + r() * 26, 10 + r() * 30); }
  c.strokeStyle = '#0b0610'; c.lineWidth = 4;
  for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + w * k / 4, y); c.lineTo(x + w * k / 4, y - h); c.stroke(); }
  for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(x, y - h * k / 5); c.lineTo(x + w, y - h * k / 5); c.stroke(); }
  c.beginPath(); c.arc(x + w / 2, y - h - w * .2, w * .28, 0, Math.PI * 2); c.stroke();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(x + w / 2, y - h - w * .2); c.lineTo(x + w / 2 + Math.cos(a) * w * .28, y - h - w * .2 + Math.sin(a) * w * .28); c.stroke(); }
  c.restore();
  c.strokeStyle = '#3a2a40'; c.lineWidth = 10; c.beginPath(); pointedArch(c, x, y, w, h); c.stroke();
}
function drawNave(c, W, H) {
  const r = seeded(21);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(18,10,24,0)'); g.addColorStop(.12, '#140c1b'); g.addColorStop(1, '#0c0710');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // stone courses
  c.strokeStyle = 'rgba(80,60,90,.18)'; c.lineWidth = 2;
  for (let y = 160; y < H; y += 46) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); for (let x = (y / 46 % 2) * 60; x < W; x += 120) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 46); c.stroke(); } }
  const bay = W / 4, hues = [350, 270, 210, 330];
  for (let i = 0; i < 4; i++) {
    const bx = i * bay;
    // window + light shaft
    const ww = bay * .42, wx = bx + (bay - ww) / 2, wb = H * .62, wh = H * .36;
    c.save(); c.globalCompositeOperation = 'lighter';
    const sh = c.createLinearGradient(0, wb - wh, 0, H);
    sh.addColorStop(0, `hsla(${hues[i]},70%,55%,.16)`); sh.addColorStop(1, `hsla(${hues[i]},70%,40%,0)`);
    c.fillStyle = sh; c.beginPath(); c.moveTo(wx, wb - wh * .5); c.lineTo(wx + ww, wb - wh * .5); c.lineTo(wx + ww + 160, H); c.lineTo(wx + 40, H); c.closePath(); c.fill();
    c.restore();
    stainedGlass(c, wx, wb, ww, wh, hues[i], r);
    // column
    const cx = bx - 34;
    wrapDraw(W, cx, (x) => {
      const cg = c.createLinearGradient(x, 0, x + 68, 0);
      cg.addColorStop(0, '#0d0812'); cg.addColorStop(.4, '#2a1f31'); cg.addColorStop(.7, '#1a121f'); cg.addColorStop(1, '#09060c');
      c.fillStyle = cg; c.fillRect(x, H * .12, 68, H);
      c.fillStyle = '#2f2336'; c.fillRect(x - 12, H * .12, 92, 22); c.fillRect(x - 16, H - 60, 100, 60);
    });
    // vault ribs
    c.strokeStyle = '#231a2a'; c.lineWidth = 26;
    c.beginPath(); c.moveTo(bx, H * .12 + 10); c.quadraticCurveTo(bx + bay / 2, -H * .06, bx + bay, H * .12 + 10); c.stroke();
    c.strokeStyle = 'rgba(120,90,130,.25)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(bx, H * .12); c.quadraticCurveTo(bx + bay / 2, -H * .08, bx + bay, H * .12); c.stroke();
  }
  const fg = c.createLinearGradient(0, H * .7, 0, H);
  fg.addColorStop(0, 'rgba(10,5,14,0)'); fg.addColorStop(1, 'rgba(10,5,14,.85)');
  c.fillStyle = fg; c.fillRect(0, H * .7, W, H * .3);
}
const FLAMES_NEAR = [];
function drawPillars(c, W, H) {
  FLAMES_NEAR.length = 0;
  const r = seeded(33);
  const P = [{ x: 260, w: 150 }, { x: 1560, w: 130 }];
  for (const p of P) {
    const x = p.x, w = p.w;
    const cg = c.createLinearGradient(x, 0, x + w, 0);
    cg.addColorStop(0, '#08050a'); cg.addColorStop(.3, '#2b2131'); cg.addColorStop(.55, '#3b2e41'); cg.addColorStop(1, '#0a070c');
    c.fillStyle = cg; c.fillRect(x, 0, w, H);
    c.fillStyle = 'rgba(0,0,0,.35)';
    for (let k = 0; k < 4; k++) c.fillRect(x + w * (.18 + k * .2), 0, 4, H);
    c.fillStyle = '#3e3045'; c.fillRect(x - 18, H - 90, w + 36, 90); c.fillStyle = '#1b141f'; c.fillRect(x - 18, H - 90, w + 36, 10);
    // candelabra
    const cy = H - 430, cx = x + w / 2;
    c.strokeStyle = '#6b5332'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy + 60); c.lineTo(cx, cy); c.stroke();
    c.beginPath(); c.moveTo(cx - 70, cy - 10); c.quadraticCurveTo(cx, cy + 50, cx + 70, cy - 10); c.stroke();
    for (const dx of [-70, 0, 70]) {
      c.fillStyle = '#e8dcc0'; c.fillRect(cx + dx - 7, cy - 52 + (dx === 0 ? -14 : 0), 14, 42);
      c.fillStyle = '#ffcf6a'; c.beginPath(); c.ellipse(cx + dx, cy - 64 + (dx === 0 ? -14 : 0), 6, 12, 0, 0, Math.PI * 2); c.fill();
      FLAMES_NEAR.push({ x: cx + dx, y: H - (cy - 64 + (dx === 0 ? -14 : 0)) });
    }
  }
  // banners
  for (const bx of [760, 2050]) {
    const bw = 130, top = 120, bh = 520;
    c.fillStyle = '#3b2a1a'; c.fillRect(bx - 20, top - 10, bw + 40, 12);
    const bg = c.createLinearGradient(bx, 0, bx + bw, 0); bg.addColorStop(0, '#3f0711'); bg.addColorStop(.5, '#7c1022'); bg.addColorStop(1, '#30050c');
    c.fillStyle = bg; c.beginPath(); c.moveTo(bx, top);
    c.lineTo(bx + bw, top); c.lineTo(bx + bw, top + bh);
    for (let k = 4; k >= 0; k--) c.lineTo(bx + bw * k / 4 + (k % 2 ? 0 : 0), top + bh - (k % 2 ? 50 : 0) + r() * 20);
    c.closePath(); c.fill();
    c.strokeStyle = '#c99a48'; c.lineWidth = 3; c.strokeRect(bx + 12, top + 14, bw - 24, bh - 90);
    c.fillStyle = '#d4a650'; c.save(); c.translate(bx + bw / 2, top + 200);
    c.beginPath(); c.moveTo(0, -60); c.lineTo(18, -10); c.lineTo(60, 0); c.lineTo(18, 10); c.lineTo(0, 70); c.lineTo(-18, 10); c.lineTo(-60, 0); c.lineTo(-18, -10); c.closePath(); c.fill();
    c.fillStyle = '#5a0b18'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // hanging chains
  c.strokeStyle = '#3b3340'; c.lineWidth = 4;
  for (const hx of [520, 1180, 1900, 2260]) {
    const len = 200 + r() * 300;
    for (let y = 0; y < len; y += 16) { c.beginPath(); c.ellipse(hx, y, y / 16 % 2 ? 3 : 6, 9, 0, 0, Math.PI * 2); c.stroke(); }
  }
}
function drawFloor(c, W, H) {
  // top face (perspective tiles) 0..100, front face 100..H
  const tg = c.createLinearGradient(0, 0, 0, 100);
  tg.addColorStop(0, '#2b2230'); tg.addColorStop(1, '#3f3344');
  c.fillStyle = tg; c.fillRect(0, 0, W, 100);
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2;
  for (const y of [22, 50, 84]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  for (let x = 0; x <= W; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (x - W / 2) * .06, 100); c.stroke(); }
  c.fillStyle = 'rgba(150,20,40,.25)';
  const r = seeded(5);
  for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(r() * W, 30 + r() * 60, 20 + r() * 50, 4 + r() * 6, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#d9c9a8'; c.fillRect(0, 98, W, 4);
  c.fillStyle = '#7b6a55'; c.fillRect(0, 102, W, 6);
  const fg = c.createLinearGradient(0, 108, 0, H);
  fg.addColorStop(0, '#2a2030'); fg.addColorStop(1, '#0c080f');
  c.fillStyle = fg; c.fillRect(0, 108, W, H - 108);
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
  for (let y = 108, row = 0; y < H; y += 54, row++) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    for (let x = row % 2 ? 0 : 64; x < W; x += 128) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 54); c.stroke(); }
  }
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
  for (let y = 110; y < H; y += 54) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}

class Layer {
  constructor(canvasEl, worldW, worldH, yBottom, p, ro, opts = {}) {
    this.tex = texFrom(canvasEl); this.tex.generateMipmaps = true; this.tex.minFilter = THREE.LinearMipmapLinearFilter; this.w = worldW; this.p = p;
    this.group = new THREE.Group(); this.copies = [];
    const n = Math.ceil(VW / worldW) + 2;
    const geo = new THREE.PlaneGeometry(worldW, worldH); geo.translate(worldW / 2, worldH / 2, 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, opacity: opts.opacity ?? 1,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, this.mat); m.position.set(k * worldW, yBottom, 0); m.renderOrder = ro; m.frustumCulled = false;
      this.group.add(m); this.copies.push(m);
    }
    this.drift = opts.drift || 0; this.t = 0;
    scene.add(this.group);
  }
  update(camX, dt) {
    this.t += dt * this.drift * (this.drift && typeof G !== 'undefined' ? 1 + Math.abs(G.wind || 0) / 120 : 1);
    const s = camX * this.p + this.t; const off = ((s % this.w) + this.w) % this.w;
    this.group.position.x = camX - off;
  }
}

const BG = {
  build() {
    if (this.art) return this.buildArt(this.art);
    const sky = makeCanvas(512, 1024, drawSky);
    this.skyTex = texFrom(sky);
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.skyTex, depthTest: false, depthWrite: false }));
    this.sky.renderOrder = 0; scene.add(this.sky);
    this.clouds = new Layer(makeCanvas(2048, 512, drawClouds), 2400, 600, GROUND + 560, .03, 1, { drift: 14, opacity: .9 });
    this.castle = new Layer(makeCanvas(2048, 800, drawCastle), 2400, 940, GROUND + 260, .12, 2);
    this.nave = new Layer(makeCanvas(2048, 1100, drawNave), 2600, 1400, GROUND - 40, .4, 3);
    const pill = makeCanvas(2400, 1300, drawPillars);
    this.pillars = new Layer(pill, 2400, 1300, GROUND - 20, .75, 4);
    // flames on pillars as additive sprites (children of each copy)
    this.flames = [];
    const fmat = new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, color: 0xff9a40 });
    for (const cp of this.pillars.copies) {
      for (const f of FLAMES_NEAR) {
        const m = new THREE.Mesh(fxGeo, fmat.clone()); m.position.set(f.x, f.y, 0); m.scale.set(90, 110, 1); m.renderOrder = 5; cp.add(m); this.flames.push(m);
      }
    }
    this.floor = new Layer(makeCanvas(1024, 512, drawFloor), 1024, 512, GROUND - 512 + 70, 1, 6);
    // ground fog & dim overlay
    this.fog = new Layer(makeCanvas(1024, 256, (c, W, H) => {
      const r = seeded(9);
      for (let i = 0; i < 50; i++) { const x = r() * W, y = H * (.3 + r() * .5), rr = 40 + r() * 120;
        wrapDraw(W, x, xx => { const g = c.createRadialGradient(xx, y, 0, xx, y, rr); g.addColorStop(0, 'rgba(150,110,170,.16)'); g.addColorStop(1, 'rgba(150,110,170,0)'); c.fillStyle = g; c.fillRect(xx - rr, y - rr, rr * 2, rr * 2); }); }
    }), 1600, 360, GROUND - 120, 1.2, 70, { drift: 30, opacity: .8 });
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050008, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.dim.renderOrder = 8; scene.add(this.dim);
    this.dimV = 0;
    // embers
    this.embers = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, color: Math.random() < .7 ? 0xff7a30 : 0xd060ff }));
      m.renderOrder = 71; scene.add(m);
      this.embers.push({ m, x: rnd(0, VW), y: rnd(GROUND - 80, VH), vx: rnd(-20, 20), vy: rnd(20, 70), s: rnd(6, 16), ph: rnd(0, 6) });
    }
    this.resize();
  },
  resize() {
    if (!this.sky) return;
    this.sky.scale.set(VW, VH - GROUND + 200, 1);
  },
  update(camX, dt, time) {
    this.sky.position.set(camX + VW / 2, GROUND - 200 + (VH - GROUND + 200) / 2, 0);
    if (this.layersList) this.sky.scale.set(VW + 400, VH - GROUND + 400, 1);
    for (const L of (this.layersList || [this.clouds, this.castle, this.nave, this.pillars, this.floor, this.fog])) L.update(camX, dt);
    if (this.under) { this.under.position.set(camX + VW / 2, GROUND - 400, 0); this.under.scale.set(VW + 400, 800, 1); }
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i]; const k = .75 + Math.sin(time * 13 + i * 1.7) * .12 + Math.sin(time * 31 + i) * .08;
      f.material.opacity = k; if (!f.userData.s) f.userData.s = [f.scale.x === 1 ? 80 : f.scale.x, f.scale.y === 1 ? 110 : f.scale.y]; f.scale.set(f.userData.s[0] * k, f.userData.s[1] * k, 1);
    }
    this.dimV = Math.max(0, this.dimV - dt * .9);
    this.dim.material.opacity = Math.min(.62, this.dimV);
    this.dim.position.set(camX + VW / 2, VH / 2, 0); this.dim.scale.set(VW + 200, VH + 200, 1);
    for (const e of this.embers) {
      e.ph += dt; e.x += (e.vx + Math.sin(e.ph * 1.3) * 20) * dt; e.y += e.vy * dt;
      if (e.y > VH + 20) { e.y = GROUND - 60; e.x = rnd(0, VW); }
      const sx = ((e.x % VW) + VW) % VW;
      e.m.position.set(camX + sx, e.y, 0);
      const fl = .5 + Math.sin(e.ph * 6) * .3; e.m.scale.set(e.s * fl + 4, e.s * fl + 4, 1); e.m.material.opacity = .7 * fl;
    }
  },
};
window.BG = BG;

/* =========================================================================
   ENEMY SPRITES (procedural silhouettes, rim-lit, glowing eyes)
   ========================================================================= */
function limb(c, pts, w, col, out) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = out || '#120a10'; c.lineWidth = w + 6; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
}
function eye(c, x, y, r, col) {
  const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, '#fff'); g.addColorStop(.2, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 4, 0, Math.PI * 2); c.fill();
}
function drawSkeletonMob(c, W, H) {
  c.translate(W / 2, H - 6);
  const bone = '#ded3b8';
  // tattered cape
  c.fillStyle = '#3d0c17'; c.beginPath(); c.moveTo(-6, -232); c.lineTo(30, -228);
  c.lineTo(62, -60); c.lineTo(46, -74); c.lineTo(36, -40); c.lineTo(20, -66); c.lineTo(8, -36); c.lineTo(-2, -70); c.closePath(); c.fill();
  // back arm + shield
  limb(c, [22, -206, 40, -176, 44, -150], 9, '#b8ad92');
  c.fillStyle = '#3a2618'; c.strokeStyle = '#a37a3c'; c.lineWidth = 6; c.beginPath(); c.arc(48, -150, 38, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#a37a3c'; c.beginPath(); c.arc(48, -150, 9, 0, Math.PI * 2); c.fill();
  // legs
  limb(c, [10, -122, 24, -66, 22, -12, 36, -8], 11, '#b8ad92');
  limb(c, [-6, -122, -26, -66, -30, -12, -44, -8], 12, bone);
  // pelvis + spine + ribs
  c.fillStyle = bone; c.strokeStyle = '#120a10'; c.lineWidth = 4; c.beginPath(); c.ellipse(2, -126, 28, 13, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  limb(c, [2, -128, 0, -170, 4, -212], 8, bone);
  for (let i = 0; i < 4; i++) { c.strokeStyle = '#120a10'; c.lineWidth = 9; c.beginPath(); c.ellipse(2, -150 - i * 14, 30 - i * 2, 10, 0, Math.PI * .05, Math.PI * .95); c.stroke(); c.strokeStyle = bone; c.lineWidth = 5; c.stroke(); }
  // skull
  c.fillStyle = bone; c.strokeStyle = '#120a10'; c.lineWidth = 5;
  c.beginPath(); c.arc(-4, -238, 25, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.roundRect ? c.roundRect(-24, -228, 26, 18, 4) : c.rect(-24, -228, 26, 18); c.fill(); c.stroke();
  c.fillStyle = '#120a10'; c.beginPath(); c.arc(-14, -240, 7, 0, Math.PI * 2); c.arc(4, -240, 6, 0, Math.PI * 2); c.fill();
  eye(c, -14, -240, 3, '#ff2a40'); eye(c, 4, -240, 2.5, '#ff2a40');
  // helm crest
  c.fillStyle = '#5a4a3a'; c.beginPath(); c.moveTo(-28, -252); c.quadraticCurveTo(-4, -286, 22, -250); c.lineTo(20, -244); c.quadraticCurveTo(-4, -270, -26, -246); c.fill();
  // front arm + sword
  limb(c, [-10, -206, -38, -178, -56, -158], 10, bone);
  c.save(); c.translate(-58, -156); c.rotate(-2.3);
  c.fillStyle = '#120a10'; c.fillRect(-6, -8, 128, 16);
  const sg = c.createLinearGradient(0, -6, 0, 6); sg.addColorStop(0, '#e6eef5'); sg.addColorStop(1, '#6d7682');
  c.fillStyle = sg; c.beginPath(); c.moveTo(18, -5); c.lineTo(118, -3); c.lineTo(132, 0); c.lineTo(118, 3); c.lineTo(18, 5); c.closePath(); c.fill();
  c.fillStyle = '#a37a3c'; c.fillRect(10, -14, 8, 28); c.fillRect(-6, -4, 18, 8);
  c.restore();
}
function drawGhoul(c, W, H) {
  c.translate(W / 2, H - 6);
  const skin = c.createLinearGradient(0, -200, 0, 0); skin.addColorStop(0, '#7d8a6c'); skin.addColorStop(1, '#2d3527');
  // back arm
  limb(c, [24, -150, 40, -110, 20, -70], 14, '#4c5842');
  // legs
  limb(c, [14, -96, 34, -52, 22, -10, 40, -6], 15, '#4c5842');
  limb(c, [-6, -96, -20, -50, -10, -10, -30, -6], 16, '#66735a');
  // body hunched
  c.fillStyle = skin; c.strokeStyle = '#0d0a0c'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-30, -96); c.quadraticCurveTo(-48, -150, -28, -196); c.quadraticCurveTo(10, -226, 46, -186); c.quadraticCurveTo(52, -130, 30, -92); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(20,15,15,.55)'; c.lineWidth = 3;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(4, -140 + i * 0, 26 - i * 0, Math.PI * (1.1 + i * .02), Math.PI * 1.6); c.stroke(); }
  // loincloth
  c.fillStyle = '#3a2a24'; c.beginPath(); c.moveTo(-30, -100); c.lineTo(32, -96); c.lineTo(22, -60); c.lineTo(8, -74); c.lineTo(-4, -56); c.lineTo(-16, -72); c.lineTo(-28, -60); c.closePath(); c.fill();
  // head (forward, low)
  c.fillStyle = '#6f7c5f'; c.strokeStyle = '#0d0a0c'; c.lineWidth = 5;
  c.beginPath(); c.ellipse(-44, -184, 26, 22, -.3, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#1a0f0c'; c.beginPath(); c.moveTo(-68, -176); c.lineTo(-40, -170); c.lineTo(-62, -160); c.closePath(); c.fill();
  c.fillStyle = '#e8dcc0'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-64 + i * 6, -173); c.lineTo(-61 + i * 6, -166); c.lineTo(-58 + i * 6, -172); c.fill(); }
  eye(c, -56, -192, 3.5, '#ffd23a'); eye(c, -40, -194, 3, '#ffd23a');
  // front arm long with claws
  limb(c, [-24, -160, -58, -128, -84, -96], 15, '#7d8a6c');
  c.strokeStyle = '#e8dcc0'; c.lineWidth = 4; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-86, -96); c.quadraticCurveTo(-104 - i * 3, -94 + i * 8, -102 - i * 2, -76 + i * 8); c.stroke(); }
}
function drawBat(c, W, H, up) {
  c.translate(W / 2, H / 2);
  const wing = (s) => {
    c.save(); c.scale(s, 1);
    c.fillStyle = '#26112e'; c.strokeStyle = '#0a040c'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(10, -6);
    if (up) { c.lineTo(60, -70); c.lineTo(120, -56); c.quadraticCurveTo(100, -30, 112, -10); c.quadraticCurveTo(84, -18, 80, 0); c.quadraticCurveTo(52, -10, 40, 10); }
    else { c.lineTo(70, 6); c.lineTo(124, 40); c.quadraticCurveTo(96, 40, 98, 58); c.quadraticCurveTo(76, 44, 64, 56); c.quadraticCurveTo(48, 36, 30, 22); }
    c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(160,60,110,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, -4); c.lineTo(up ? 112 : 112, up ? -50 : 42); c.stroke();
    c.restore();
  };
  wing(1); wing(-1);
  c.fillStyle = '#331638'; c.strokeStyle = '#0a040c'; c.lineWidth = 4;
  c.beginPath(); c.ellipse(0, 4, 22, 28, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-14, -18); c.lineTo(-20, -44); c.lineTo(-4, -24); c.moveTo(14, -18); c.lineTo(20, -44); c.lineTo(4, -24); c.fill(); c.stroke();
  eye(c, -8, -6, 3, '#ff2a40'); eye(c, 8, -6, 3, '#ff2a40');
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-6, 10); c.lineTo(-3, 18); c.lineTo(0, 10); c.moveTo(6, 10); c.lineTo(3, 18); c.lineTo(0, 10); c.fill();
}
const MOB_TYPES = {};
function buildMobTextures() {
  MOB_TYPES.skeleton = { tex: [texFrom(makeCanvas(256, 320, drawSkeletonMob))], w: 256, h: 320, hw: 110, hh: 250, hp: 1, spd: 120, fly: false, gold: 1 };
  MOB_TYPES.ghoul = { tex: [texFrom(makeCanvas(256, 256, drawGhoul))], w: 256, h: 256, hw: 120, hh: 200, hp: 1.4, spd: 160, fly: false, gold: 1.3 };
  MOB_TYPES.bat = { tex: [texFrom(makeCanvas(256, 160, (c, w, h) => drawBat(c, w, h, true))), texFrom(makeCanvas(256, 160, (c, w, h) => drawBat(c, w, h, false)))], w: 256, h: 160, hw: 120, hh: 100, hp: .6, spd: 220, fly: true, gold: .8 };
}
const MOB_VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const MOB_FS = `uniform sampler2D map; uniform float uFlash; uniform float uAlpha; uniform vec3 uTint; uniform vec3 uFlashCol; varying vec2 vUv;
void main(){ vec4 t=texture2D(map,vUv); t.rgb*=uTint; t.rgb=mix(t.rgb,uFlashCol,uFlash); gl_FragColor=vec4(t.rgb,t.a*uAlpha); }`;

