/* =========================================================================
   SPRITE BATCHER — the "SRP batcher" of this game.
   All procedural FX textures, a white texel, the gradient damage digits and a pixel-font glyph set live in ONE
   2048×1024 atlas. Every small quad (particles, embers, shadows, HP bars, damage numbers) is written into a dynamic
   vertex buffer and drawn with one draw call per (sort layer × blend mode) instead of one mesh + material each.
   ========================================================================= */
const SB = (() => {
  const AW = 2048, AH = 1024, CAP = 2048;
  let ready = false, tex = null, cv = null, cx = null;
  const rects = new Map();      // THREE.Texture | string → [u0, v0(bottom), u1, v1(top), wpx, hpx]
  const glyph = {};             // char → { r, w, h }       (white pixel-font glyphs with a dark outline)
  const digit = { n: [], c: [] }; // gradient digits: plain / crit-outlined
  const batches = new Map();    // key → batch
  const order = [];
  const tracked = new Set();
  const nums = [], numFree = [];
  // shelf packer
  let px = 2, py = 2, rowH = 0;
  function place(w, h) {
    if (px + w + 2 > AW) { px = 2; py += rowH + 3; rowH = 0; }
    if (py + h + 2 > AH) throw new Error('atlas full');
    const x = px, y = py; px += w + 3; rowH = Math.max(rowH, h);
    return [x, y];
  }
  function addImage(key, img, w, h) {
    w = w || img.width; h = h || img.height;
    const [x, y] = place(w, h); cx.drawImage(img, x, y, w, h);
    const r = [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH, w, h];
    rects.set(key, r); return r;
  }
  const VS = `attribute vec4 acol; varying vec2 vUv; varying vec4 vC;
void main(){ vUv = uv; vC = acol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const FS = `uniform sampler2D map; varying vec2 vUv; varying vec4 vC;
void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb * vC.rgb, t.a * vC.a); }`;
  function batch(ro, add) {
    const key = ro + (add ? 'a' : 'n');
    let b = batches.get(key); if (b) return b;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(CAP * 12), uv = new Float32Array(CAP * 8), col = new Float32Array(CAP * 16), idx = new Uint16Array(CAP * 6);
    for (let i = 0; i < CAP; i++) { const v = i * 4, o = i * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const ua = new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage);
    const ca = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa); geo.setAttribute('uv', ua); geo.setAttribute('acol', ca);
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, vertexShader: VS, fragmentShader: FS, transparent: true,
      depthTest: false, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = ro; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    b = { mesh, geo, pos, uv, col, pa, ua, ca, n: 0 };
    batches.set(key, b); order.push(b); return b;
  }
  // collapse the many fine-grained render orders into a few sort layers (additive is order-independent anyway)
  function layerOf(ro) { return ro < 10 ? ro : ro < 15 ? 14 : ro < 40 ? 16 : ro < 42 ? 41 : ro < 70 ? 62 : ro < 79 ? 71 : 80; }
  function quad(b, x, y, rot, sx, sy, r, cr, cg, cb, ca) {
    if (b.n >= CAP) return;
    const i = b.n++, p = i * 12, u = i * 8, c = i * 16;
    const co = rot ? Math.cos(rot) : 1, si = rot ? Math.sin(rot) : 0, hx = sx * .5, hy = sy * .5;
    const ax = co * hx, ay = si * hx, bx = -si * hy, by = co * hy;
    const P = b.pos;
    P[p] = x - ax - bx; P[p + 1] = y - ay - by; P[p + 2] = 0;
    P[p + 3] = x + ax - bx; P[p + 4] = y + ay - by; P[p + 5] = 0;
    P[p + 6] = x + ax + bx; P[p + 7] = y + ay + by; P[p + 8] = 0;
    P[p + 9] = x - ax + bx; P[p + 10] = y - ay + by; P[p + 11] = 0;
    const U = b.uv;
    U[u] = r[0]; U[u + 1] = r[1]; U[u + 2] = r[2]; U[u + 3] = r[1]; U[u + 4] = r[2]; U[u + 5] = r[3]; U[u + 6] = r[0]; U[u + 7] = r[3];
    const C = b.col;
    for (let k = 0; k < 16; k += 4) { C[c + k] = cr; C[c + k + 1] = cg; C[c + k + 2] = cb; C[c + k + 3] = ca; }
  }

  /* ---------- build the atlas (after textures + font are ready) ---------- */
  async function init() {
    cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; cx = cv.getContext('2d');
    const white = document.createElement('canvas'); white.width = white.height = 8;
    const wc = white.getContext('2d'); wc.fillStyle = '#fff'; wc.fillRect(0, 0, 8, 8);
    const wr = addImage('white', white); const inset = 2 / AW;
    rects.set('white', [wr[0] + inset, wr[1] + inset, wr[2] - inset, wr[3] - inset, 8, 8]);
    for (const k of ['slash', 'star', 'ring', 'glow', 'smoke', 'shadow', 'coin', 'streak', 'shard']) if (TX[k] && TX[k].image) addImage(TX[k], TX[k].image);
    // gradient digits (pixel art → scale ×4 with no smoothing) — plain, and crit with dark outline + gold glow
    const imgs = await Promise.all('0123456789'.split('').map(d => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'sprites/font/d' + d + '.png'; })));
    const S = 4;
    imgs.forEach((im, d) => {
      if (!im) return;
      const w = im.width * S, h = im.height * S;
      const a = document.createElement('canvas'); a.width = w; a.height = h; const ac = a.getContext('2d'); ac.imageSmoothingEnabled = false; ac.drawImage(im, 0, 0, w, h);
      digit.n[d] = { r: addImage('dn' + d, a), w, h };
      const pad = 14, b2 = document.createElement('canvas'); b2.width = w + pad * 2; b2.height = h + pad * 2; const bc = b2.getContext('2d'); bc.imageSmoothingEnabled = false;
      const sil = document.createElement('canvas'); sil.width = w; sil.height = h; const sc = sil.getContext('2d'); sc.drawImage(a, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#1a0c02'; sc.fillRect(0, 0, w, h);
      bc.shadowColor = 'rgba(255,204,64,.9)'; bc.shadowBlur = 12; bc.drawImage(sil, pad, pad); bc.shadowBlur = 0;
      for (const [ox, oy] of [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, -3], [-3, 3], [3, 3]]) bc.drawImage(sil, pad + ox, pad + oy);
      bc.drawImage(a, pad, pad);
      digit.c[d] = { r: addImage('dc' + d, b2), w: w + pad * 2, h: h + pad * 2, pad };
    });
    // pixel-font glyphs (white fill, dark outline → tinted per style through vertex colour)
    try { await document.fonts.load('40px "Phantasia"'); } catch (e) { }
    const FS_ = 40, OUT = 5, ch = FS_ + OUT * 2 + 6;
    const set = '0123456789.,-+!%/:◆ ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (const c of set) {
      const m = document.createElement('canvas').getContext('2d'); m.font = `${FS_}px "Phantasia", sans-serif`;
      const gw = Math.max(8, Math.ceil(m.measureText(c).width)) + OUT * 2 + 2;
      const g = document.createElement('canvas'); g.width = gw; g.height = ch; const gc = g.getContext('2d');
      gc.font = m.font; gc.textBaseline = 'alphabetic'; gc.lineJoin = 'round'; gc.lineWidth = OUT * 2; gc.strokeStyle = '#120a20';
      const by = ch - OUT - 10;
      if (c !== ' ') { gc.strokeText(c, OUT + 1, by); gc.fillStyle = '#fff'; gc.fillText(c, OUT + 1, by); }
      glyph[c] = { r: addImage('g' + c, g), w: gw, h: ch, adv: gw - OUT * 2 + 1 };
    }
    tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    for (const b of order) b.mesh.material.uniforms.map.value = tex;
    ready = true;
  }

  /* ---------- particles (engine.spawnFx) ---------- */
  function has(t) { return ready && rects.has(t); }

  /* ---------- existing meshes absorbed into the batch (embers, shadows, HP bars) ---------- */
  function track(m) {
    if (!ready || !m) return;
    const map = m.material && m.material.map; if (map && !rects.has(map)) return;
    m.layers.set(1);           // the camera only renders layer 0 → the mesh itself is no longer drawn
    tracked.add(m);
  }
  function shown(o) { for (; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; }

  /* ---------- damage numbers ---------- */
  const STY = {
    n: { h: 20, c: [1, 1, 1] }, e: { h: 20, c: [1, .54, .48] }, m: { h: 18, c: [.86, .86, .86] }, pm: { h: 18, c: [.86, .86, .86] },
    blk: { h: 18, c: [1, .88, .63] }, lv: { h: 22, c: [1, .86, .5] },
    s: { h: 32, c: [1, .7, .28], dig: 'n', tint: [1, 1, 1] }, c: { h: 40, c: [1, .88, .3], dig: 'c', tint: [1, .97, .7] },
    cb: { h: 40, c: [.34, .71, 1], dig: 'c', tint: [.7, .88, 1] },
  };
  function number(x, y, txt, cls) {
    if (!ready) return false;
    if (nums.length > (PERF.mobile ? 60 : 140)) numFree.push(nums.shift());
    const n = numFree.pop() || {};
    n.x = x; n.y = y; n.txt = String(txt); n.cls = cls; n.t0 = performance.now() / 1000; n.big = cls === 'c' || cls === 'cb' ? 1.5 : cls === 's' ? 1.3 : 1.15;
    n.rise = cls === 'lv' ? 90 : 70 + Math.random() * 30; n.dur = cls === 'lv' ? 1.4 : .9;
    nums.push(n);
    return true;
  }
  const _items = [];
  function drawNumber(nm, now, k) {
    let t = (now - nm.t0) / nm.dur; if (t >= 1) return false;
    const e = 1 - Math.pow(1 - t, 2.4);       // ≈ cubic-bezier(.2,.7,.3,1)
    let sc, a, ry;
    if (e < .12) { const q = e / .12; sc = nm.big + (1 - nm.big) * q; a = q; ry = 0; }
    else if (e < .65) { const q = (e - .12) / .53; sc = 1; a = 1; ry = nm.rise * .45 * q; }
    else { const q = (e - .65) / .35; sc = 1 - .1 * q; a = 1 - q; ry = nm.rise * (.45 + .55 * q); }
    const st = STY[nm.cls] || STY.n;
    const useDig = st.dig && /^\d+$/.test(nm.txt);
    const b = batch(80, false);
    const H = st.h * k * sc;                  // on-screen height in world units
    const items = _items; items.length = 0;
    let W = 0;
    for (const c of nm.txt) {
      if (useDig) { const g = digit[st.dig][+c]; if (!g) continue; const s = H / (g.h - (g.pad || 0) * 2); items.push([g, s]); W += (g.w - (g.pad || 0) * 2) * s; }
      else { const g = glyph[c] || glyph['?'] || glyph[' ']; if (!g) continue; const s = H / (g.h * .62); items.push([g, s]); W += g.adv * s; }
    }
    let cx0 = nm.x - W / 2; const by = nm.y + ry * k;
    const col = useDig ? st.tint : st.c;
    for (const [g, s] of items) {
      const w = g.w * s, h = g.h * s, adv = useDig ? (g.w - (g.pad || 0) * 2) * s : g.adv * s;
      const ox = useDig ? (g.pad || 0) * s : (g.w - g.adv) * s / 2;
      quad(b, cx0 + adv / 2 + (useDig ? 0 : 0), by + h / 2 - (useDig ? (g.pad || 0) * s : h * .14), 0, w, h, g.r, col[0], col[1], col[2], a);
      cx0 += adv; void ox;
    }
    return true;
  }


  /* ---------- GPU instancing: every sprite that shares a sheet (mobs of one type, hit-spark sheets…) → ONE draw call ---------- */
  const IVS = `attribute vec4 iXf; attribute vec4 iRect; attribute vec4 iCol; attribute vec4 iFx;
varying vec2 vUv; varying vec4 vC; varying vec4 vF;
void main(){ vUv = iRect.xy + uv * iRect.zw; vC = iCol; vF = iFx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iXf.xy + position.xy * iXf.zw, 0.0, 1.0); }`;
  const IFS_SPR = `uniform sampler2D map; varying vec2 vUv; varying vec4 vC; varying vec4 vF;
void main(){ vec4 t = texture2D(map, vUv); if (t.a < .5) discard; vec3 c = mix(t.rgb * vC.rgb, vF.rgb, vF.a); gl_FragColor = vec4(c, vC.a); }`;
  const IFS_SFX = `uniform sampler2D map; varying vec2 vUv; varying vec4 vC;
void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb * vC.rgb * vC.a, 1.0); }`;
  const ICAP = 256;
  const ibatches = new Map(), iorder = [];
  const itracked = new Map();     // mesh → kind ('spr' | 'sfx')
  function ibatch(kind, map, ro) {
    const key = kind + map.uuid + ro;
    let b = ibatches.get(key); if (b) return b;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.setIndex(base.index); geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    const mk = () => new THREE.InstancedBufferAttribute(new Float32Array(ICAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const A = { iXf: mk(), iRect: mk(), iCol: mk(), iFx: mk() };
    for (const k in A) geo.setAttribute(k, A[k]);
    geo.instanceCount = 0;
    const mat = kind === 'spr' || kind === 'gst'
      ? new THREE.ShaderMaterial({ uniforms: { map: { value: map } }, vertexShader: IVS, fragmentShader: IFS_SPR, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
          blending: kind === 'gst' ? THREE.AdditiveBlending : THREE.NormalBlending })
      : new THREE.ShaderMaterial({ uniforms: { map: { value: map } }, vertexShader: IVS, fragmentShader: IFS_SFX, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = ro; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    b = { mesh, geo, A, n: 0 }; ibatches.set(key, b); iorder.push(b); return b;
  }
  function trackInst(m, kind) { if (!m) return; m.layers.set(1); itracked.set(m, kind); }
  function untrackInst(m) { if (!m) return; itracked.delete(m); m.layers.set(0); }
  function flushInst() {
    for (const b of iorder) b.n = 0;
    for (const [m, kind] of itracked) {
      if (!m.parent) continue;                  // pooled & parked: keep the entry, skip drawing
      if (!shown(m)) continue;
      const u = m.material.uniforms; const map = u.map.value; if (!map) continue;
      const alpha = u.uAlpha.value; if (alpha <= .004) continue;
      const b = ibatch(kind, map, m.renderOrder); if (b.n >= ICAP) continue;
      const i = b.n++ * 4, A = b.A, r = u.uRect.value;
      A.iXf.array[i] = m.position.x; A.iXf.array[i + 1] = m.position.y; A.iXf.array[i + 2] = m.scale.x; A.iXf.array[i + 3] = m.scale.y;
      A.iRect.array[i] = r.x; A.iRect.array[i + 1] = r.y; A.iRect.array[i + 2] = r.z; A.iRect.array[i + 3] = r.w;
      const isSpr = kind !== 'sfx', c = isSpr ? u.uTint.value : u.uCol.value;
      A.iCol.array[i] = c.r; A.iCol.array[i + 1] = c.g; A.iCol.array[i + 2] = c.b; A.iCol.array[i + 3] = alpha;
      if (isSpr) { const fc = u.uFlashCol.value; A.iFx.array[i] = fc.r; A.iFx.array[i + 1] = fc.g; A.iFx.array[i + 2] = fc.b; A.iFx.array[i + 3] = u.uFlash.value; }
    }
    for (const b of iorder) {
      b.mesh.visible = b.n > 0; b.geo.instanceCount = b.n;
      if (!b.n) continue;
      for (const k in b.A) { const a = b.A[k]; a.updateRange.offset = 0; a.updateRange.count = b.n * 4; a.needsUpdate = true; }
    }
  }
  /* ---------- per frame: rebuild every batch from current state, upload, draw ---------- */
  function flush() {
    flushInst();
    if (!ready) return;
    for (const b of order) b.n = 0;
    // particles
    for (const f of FX) {
      if (!f.batched || f._a === undefined || f._a <= .004) continue;
      quad(batch(layerOf(f.ro ?? 60), !f.normal), f.x, f.y, f._rot, f._sx, f._sy, rects.get(f.tex), f._cr, f._cg, f._cb, f._a);
    }
    // tracked meshes
    for (const m of tracked) {
      if (!m.parent) { tracked.delete(m); continue; }
      const mt = m.material; if (!shown(m) || mt.opacity <= .004) continue;
      const r = mt.map ? rects.get(mt.map) : rects.get('white');
      quad(batch(layerOf(m.renderOrder), mt.blending === THREE.AdditiveBlending), m.position.x, m.position.y, m.rotation.z, m.scale.x, m.scale.y, r, mt.color.r, mt.color.g, mt.color.b, mt.opacity);
    }
    // damage numbers
    const now = performance.now() / 1000, k = 2 / (camera.zoom || 1);
    for (let i = nums.length - 1; i >= 0; i--) if (!drawNumber(nums[i], now, k)) numFree.push(nums.splice(i, 1)[0]);
    for (const b of order) {
      b.mesh.visible = b.n > 0;
      if (!b.n) continue;
      b.geo.setDrawRange(0, b.n * 6);
      b.pa.updateRange.count = b.n * 12; b.pa.needsUpdate = true;
      b.ua.updateRange.count = b.n * 8; b.ua.needsUpdate = true;
      b.ca.updateRange.count = b.n * 16; b.ca.needsUpdate = true;
    }
  }
  return { init, has, track, trackInst, untrackInst, number, flush, get instCalls() { return iorder.filter(b => b.n).length; }, get ready() { return ready; }, get drawCalls() { return order.filter(b => b.n).length; } };
})();
