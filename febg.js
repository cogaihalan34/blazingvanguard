'use strict';
/* febg.js — Fire Emblem (GBA)–style battle backdrop, painted procedurally as low-res pixel art and
   scaled up with nearest filtering. Parallax: sky → mountains → castle → hills → near trees → battle platform. */
const PX = 6; // world units per art pixel
function pixCanvas(w, h, draw) { return makeCanvas(w, h, (c) => { c.imageSmoothingEnabled = false; draw(c, w, h); }); }
function pxTex(layer) { const t = layer.tex; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; }
const rect = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function wrapX(W, x, w, fn) { fn(x); if (x + w > W) fn(x - W); if (x < 0) fn(x + W); }
/* ordered 4x4 Bayer dither between two colours */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ditherBand(c, x0, y0, w, h, colA, colB, k0, k1) {
  for (let y = 0; y < h; y++) {
    const k = k0 + (k1 - k0) * (y / Math.max(1, h - 1));
    for (let x = 0; x < w; x++) { c.fillStyle = BAYER[(y & 3) * 4 + (x & 3)] / 16 < k ? colB : colA; c.fillRect(x0 + x, y0 + y, 1, 1); }
  }
}
function pixCloud(c, W, x, y, s, r) {
  const puffs = [];
  for (let i = 0; i < 4 + (r() * 3 | 0); i++) puffs.push([x + i * s * 1.1 + r() * s, y - r() * s * .9, s * (.7 + r() * .6)]);
  for (const [col, dy, grow] of [['#a8c8e8', 2, 0], ['#f8f8f8', 0, 0], ['#ffffff', -1, -1.5]]) {
    c.fillStyle = col;
    for (const [px, py, pr] of puffs) wrapX(W, px - pr, pr * 2, (xx) => {
      const rr = pr + grow, cx = xx + pr;
      for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(Math.max(0, rr * rr - yy * yy))); c.fillRect(Math.round(cx - hw), Math.round(py + yy + dy), hw * 2, 1); }
    });
  }
  c.fillStyle = '#a8c8e8'; c.fillRect(Math.round(x - s * .3), Math.round(y + s * .4), Math.round(puffs.length * s * 1.2), 2);
}
function drawFESky(c, W, H) {
  const bands = ['#3870d8', '#4880e0', '#5890e8', '#68a0f0', '#78b0f0', '#88c0f8', '#a0d0f8', '#b8e0f8', '#d0ecf8'];
  const bh = H / bands.length;
  for (let i = 0; i < bands.length; i++) {
    rect(c, bands[i], 0, i * bh, W, bh + 1);
    if (i < bands.length - 1) ditherBand(c, 0, Math.round((i + 1) * bh - 4), W, 4, bands[i], bands[i + 1], .1, .9);
  }
  const r = seeded(12);
  for (let i = 0; i < 9; i++) pixCloud(c, W, r() * W, H * (.25 + r() * .5), 5 + r() * 6, r);
}
function drawFEMountains(c, W, H) {
  const r = seeded(4);
  const ridge = (base, amp, col, hi, snow) => {
    const pts = []; let y = base;
    for (let x = 0; x <= W; x++) { y += (r() - .5) * 2.2; y += (base - y) * .04; pts.push(y); }
    // add a few peaks
    for (let k = 0; k < 6; k++) { const px = r() * W | 0, ph = amp * (.5 + r() * .5), pw = 18 + r() * 30;
      for (let x = -pw; x <= pw; x++) { const xi = ((px + x) % W + W) % W; pts[xi] -= ph * (1 - Math.abs(x) / pw); } }
    pts[W] = pts[0];
    for (let x = 0; x < W; x++) {
      const top = Math.round(pts[x]);
      rect(c, col, x, top, 1, H - top);
      if (hi && pts[x + 1 < W ? x + 1 : 0] > pts[x]) rect(c, hi, x, top, 1, 3);
      if (snow && top < base - amp * .55) rect(c, '#f0f8f8', x, top, 1, Math.max(1, Math.round((base - amp * .55 - top) * .6)));
    }
  };
  ridge(H * .5, H * .48, '#7080c0', '#98a8e0', true);
  ridge(H * .78, H * .3, '#4c6098', '#6478b0', false);
  ditherBand(c, 0, H - 12, W, 12, '#4c6098', '#88a8d0', .1, .8);
}
function drawFECastle(c, W, H) {
  const stone = '#b8b0a8', stoneD = '#888090', stoneDD = '#585068', roof = '#3050a8', roofH = '#5878d0', roofD = '#203070', win = '#283048';
  const ground = H - 6;
  // hill under the castle
  for (let x = 0; x < W; x++) { const d = Math.abs(x - W * .5) / (W * .5); const top = Math.round(ground - 26 * Math.cos(Math.min(1, d) * Math.PI / 2)); rect(c, '#58a038', x, top, 1, H - top); rect(c, '#78c050', x, top, 1, 2); }
  const cx = W * .5;
  const brick = (x, y, w, h) => {
    rect(c, stone, x, y, w, h);
    for (let yy = y + 3; yy < y + h; yy += 4) { rect(c, stoneD, x, yy, w, 1); for (let xx = x + ((yy / 4) % 2 ? 2 : 5); xx < x + w; xx += 7) rect(c, stoneD, xx, yy - 3, 1, 3); }
    rect(c, stoneDD, x + w - 1, y, 1, h); rect(c, '#d8d0c8', x, y, 1, h);
  };
  const crenel = (x, y, w) => { for (let xx = x; xx < x + w - 1; xx += 4) { rect(c, stone, xx, y - 3, 2, 3); rect(c, stoneDD, xx + 2, y - 3, 0, 3); } };
  const tower = (x, w, h, roofH2) => {
    const top = ground - 26 - h;
    brick(x, top, w, h + 26);
    // conical roof
    for (let i = 0; i < roofH2; i++) { const hw = Math.round((w / 2 + 2) * (i / roofH2)); rect(c, roof, x + w / 2 - hw, top - roofH2 + i, hw * 2, 1); rect(c, roofH, x + w / 2 - hw, top - roofH2 + i, Math.max(1, hw * .6), 1); }
    rect(c, roofD, x - 2, top - 1, w + 4, 2);
    for (let wy = top + 8; wy < ground - 34; wy += 14) { rect(c, win, x + w / 2 - 1, wy, 3, 5); rect(c, stoneDD, x + w / 2 - 2, wy - 1, 5, 1); }
    // banner
    rect(c, '#403830', x + w / 2, top - roofH2 - 8, 1, 8); rect(c, '#d83020', x + w / 2 + 1, top - roofH2 - 8, 6, 3); rect(c, '#f0c040', x + w / 2 + 3, top - roofH2 - 7, 2, 1);
  };
  // curtain walls
  brick(cx - 120, ground - 52, 240, 52); crenel(cx - 120, ground - 52, 240);
  // gate
  rect(c, stoneDD, cx - 12, ground - 34, 24, 34); rect(c, '#302018', cx - 10, ground - 32, 20, 32);
  for (let x = cx - 9; x < cx + 10; x += 3) rect(c, '#605040', x, ground - 31, 1, 30);
  for (let i = 0; i < 10; i++) rect(c, stoneDD, cx - 10 + i, ground - 34 - Math.round(Math.sqrt(100 - (i - 10) * (i - 10)) * .5), 1, 1);
  // keep
  brick(cx - 40, ground - 100, 80, 50); crenel(cx - 40, ground - 100, 80);
  for (const wx of [cx - 26, cx - 8, cx + 10]) { rect(c, win, wx, ground - 88, 4, 8); rect(c, '#f8d870', wx + 1, ground - 87, 2, 2); }
  tower(cx - 130, 22, 44, 22); tower(cx + 108, 22, 44, 22); tower(cx - 62, 18, 70, 26); tower(cx + 44, 18, 70, 26); tower(cx - 9, 18, 96, 30);
  // small villages / trees around on the hill sides
  const r = seeded(31);
  for (let i = 0; i < 26; i++) { const x = r() * W, onLeft = x < cx - 140 || x > cx + 140; if (!onLeft) continue; feTree(c, W, x, ground - 2 - r() * 8, 4 + r() * 3, r); }
}
function feTree(c, W, x, y, s, r) {
  const dark = '#205818', mid = '#388028', hi = '#60a840', out = '#103008';
  wrapX(W, x - s * 1.4, s * 2.8, (xx) => {
    const cx = xx + s * 1.4;
    rect(c, '#604020', cx - 1, y - s * .6, 2, s * .8);
    for (const [col, dx, dy, k] of [[out, 0, 0, 1.08], [dark, 0, 0, 1], [mid, -s * .15, -s * .2, .8], [hi, -s * .35, -s * .45, .4]]) {
      const rr = s * k; c.fillStyle = col;
      for (let yy = -rr; yy <= rr * .8; yy++) { const hw = Math.round(Math.sqrt(Math.max(0, rr * rr - yy * yy)) * 1.1); c.fillRect(Math.round(cx + dx - hw), Math.round(y - s * 1.2 + dy + yy), hw * 2, 1); }
    }
  });
}
function drawFEHills(c, W, H) {
  const r = seeded(77);
  const pts = []; for (let x = 0; x < W; x++) pts.push(H * .45 + Math.sin(x / W * Math.PI * 4) * 8 + Math.sin(x / W * Math.PI * 10 + 1) * 4);
  for (let x = 0; x < W; x++) { const t = Math.round(pts[x]); rect(c, '#489030', x, t, 1, H - t); rect(c, '#68b040', x, t, 1, 2); }
  ditherBand(c, 0, H - 14, W, 14, '#489030', '#387828', .1, .8);
  for (let i = 0; i < 46; i++) { const x = r() * W; feTree(c, W, x, pts[Math.floor(x) % W] + 6 + r() * 14, 5 + r() * 4, r); }
}
function drawFENear(c, W, H) {
  const r = seeded(53);
  // wooden fence segments, rocks and big trees
  for (let k = 0; k < 3; k++) {
    const x0 = r() * W, len = 30 + r() * 40, y = H - 6;
    for (let x = 0; x < len; x += 8) wrapX(W, x0 + x, 2, (xx) => { rect(c, '#3a2410', xx - 1, y - 13, 4, 14); rect(c, '#906030', xx, y - 12, 2, 12); });
    wrapX(W, x0, len, (xx) => { rect(c, '#3a2410', xx, y - 11, len, 4); rect(c, '#b07840', xx, y - 10, len, 2); rect(c, '#3a2410', xx, y - 5, len, 3); rect(c, '#b07840', xx, y - 5, len, 1); });
  }
  for (let i = 0; i < 5; i++) { const x = r() * W; feTree(c, W, x, H - 4, 10 + r() * 6, r); }
  for (let i = 0; i < 8; i++) { const x = r() * W, s = 3 + r() * 4; wrapX(W, x, s * 2, (xx) => { rect(c, '#383848', xx, H - s - 1, s * 2 + 1, s + 1); rect(c, '#9898a8', xx + 1, H - s, s * 2 - 1, s - 1); rect(c, '#c8c8d0', xx + 1, H - s, s, 1); }); }
}
function drawFEGround(c, W, H) {
  // top: the battle platform (grass plane), then the dirt cliff face
  const plane = 20;
  rect(c, '#68b040', 0, 0, W, plane);
  ditherBand(c, 0, 0, W, 6, '#90d060', '#68b040', .1, .9);
  ditherBand(c, 0, plane - 6, W, 6, '#68b040', '#509830', .1, .9);
  const r = seeded(19);
  for (let i = 0; i < 70; i++) { const x = r() * W | 0, y = 2 + r() * (plane - 5) | 0; rect(c, r() < .5 ? '#50a030' : '#98d868', x, y, 1, 2); rect(c, '#509830', x + 1, y + 1, 1, 1); }
  // worn dirt path along the middle of the plane
  for (let x = 0; x < W; x++) { const y = 8 + Math.round(Math.sin(x / W * Math.PI * 2) * 1.5); rect(c, '#c8a060', x, y, 1, 4); if (r() < .3) rect(c, '#a88040', x, y + 1 + (r() * 3 | 0), 1, 1); }
  rect(c, '#e0c080', 0, 8, W, 0);
  rect(c, '#305818', 0, plane, W, 2);
  // cliff face
  const g = ['#a07040', '#886038', '#704830', '#583828', '#402818'];
  const fh = H - plane - 2, bh = fh / g.length;
  for (let i = 0; i < g.length; i++) { rect(c, g[i], 0, plane + 2 + i * bh, W, bh + 1); if (i < g.length - 1) ditherBand(c, 0, Math.round(plane + 2 + (i + 1) * bh - 3), W, 3, g[i], g[i + 1], .2, .8); }
  for (let i = 0; i < 24; i++) { const x = r() * W, y = plane + 6 + r() * (fh - 10), s = 2 + r() * 3; rect(c, '#30201a', x, y, s + 1, s); rect(c, '#b89070', x, y, s, s - 1); rect(c, '#d8b890', x, y, s - 1, 1); }
  // grass overhang
  for (let x = 0; x < W; x += 2) rect(c, '#509830', x, plane + 1, 1, 1 + (r() * 3 | 0));
}
function drawFEGrassFg(c, W, H) {
  const r = seeded(91);
  for (let i = 0; i < 9; i++) {
    const x = r() * W, s = 5 + r() * 6;
    wrapX(W, x, s * 2, (xx) => {
      for (let k = 0; k < s * 1.6; k++) { const bx = xx + k, bh = (2 + r() * s) | 0; rect(c, '#183808', bx, H - bh - 1, 1, bh + 1); rect(c, k % 2 ? '#307818' : '#58a030', bx, H - bh, 1, bh); }
    });
  }
}
async function loadEnvArt() { return { fe: true }; }
/* ---------- night sky (stars + moon) shown over the day sky as night falls ---------- */
function drawFENight(c, W, H) {
  const r = seeded(41);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#06082a'); g.addColorStop(.6, '#141c54'); g.addColorStop(1, '#2a3270');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) { const x = r() * W | 0, y = r() * H * .75 | 0, b = r(); rect(c, b > .9 ? '#ffffff' : b > .6 ? '#c8d8ff' : '#7080c0', x, y, 1, 1); if (b > .95) { rect(c, '#9fb0ff', x - 1, y, 3, 1); rect(c, '#9fb0ff', x, y - 1, 1, 3); } }
  const mx = W * .72, my = H * .2, mr = 13;
  for (let yy = -mr; yy <= mr; yy++) { const hw = Math.round(Math.sqrt(mr * mr - yy * yy)); rect(c, '#f4f0d0', mx - hw, my + yy, hw * 2, 1); }
  for (let yy = -mr; yy <= mr; yy++) { const hw = Math.round(Math.sqrt(mr * mr - yy * yy)); rect(c, '#141c54', mx - hw + 7, my + yy - 3, Math.max(0, hw * 2 - 9), 1); }
  ditherBand(c, 0, H - 12, W, 12, '#2a3270', '#3a4488', .1, .8);
}
/* ---------- the Upside Down: pixel void sky, inverted castle keep, ash and red veins ---------- */
function drawVoidSky(c, W, H) {
  const bands = ['#06020a', '#100512', '#1c0818', '#2a0c1c', '#3a1020', '#4e1424', '#62182a', '#3a0e1a'];
  const bh = H / bands.length;
  for (let i = 0; i < bands.length; i++) { rect(c, bands[i], 0, i * bh, W, bh + 1); if (i < bands.length - 1) ditherBand(c, 0, Math.round((i + 1) * bh - 4), W, 4, bands[i], bands[i + 1], .1, .9); }
  const r = seeded(66);
  // storm clouds (dark, lit red from below)
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = H * (.15 + r() * .55), s = 6 + r() * 10;
    for (const [col, dy] of [['#3a0c16', 2], ['#1a0610', 0]]) { c.fillStyle = col; for (let k = 0; k < 5; k++) { const px = x + k * s * .9, rr = s * (.6 + r() * .5); wrapX(W, px - rr, rr * 2, (xx) => { for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(Math.max(0, rr * rr - yy * yy))); c.fillRect(Math.round(xx + rr - hw), Math.round(y + yy + dy), hw * 2, 1); } }); } }
  }
  // red lightning veins
  for (let i = 0; i < 6; i++) {
    let x = r() * W, y = r() * H * .3; c.fillStyle = r() < .5 ? '#ff3040' : '#c01830';
    for (let k = 0; k < 40; k++) { x += (r() - .5) * 3; y += 1; c.fillRect(Math.round(((x % W) + W) % W), Math.round(y), 1, 1); if (r() < .06) { let bx = x, by = y; for (let q = 0; q < 10; q++) { bx += (r() - .3) * 2; by += 1; c.fillRect(Math.round(((bx % W) + W) % W), Math.round(by), 1, 1); } } }
  }
  for (let i = 0; i < 60; i++) rect(c, r() < .5 ? '#5a1a26' : '#2a0a12', r() * W, r() * H, 1, 1);
}
function drawVoidDebris(c, W, H) {
  const r = seeded(88);
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = H * (.1 + r() * .7), w = 8 + r() * 26, h = 4 + r() * 8;
    wrapX(W, x, w, (xx) => {
      rect(c, '#140810', xx, y, w, h); rect(c, '#2a1420', xx + 1, y, w - 2, 2);
      for (let k = 0; k < w; k += 2) rect(c, '#140810', xx + k, y + h, 2, 1 + (r() * 6 | 0));
      if (r() < .5) rect(c, '#ff3048', xx + w * .5, y + h - 2, 1, 1);
    });
  }
}
function tintImage(img, opts) {
  return makeCanvas(img.width, img.height, (c, W, H) => {
    c.imageSmoothingEnabled = false;
    if (opts.flip) { c.translate(0, H); c.scale(1, -1); }
    c.drawImage(img, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = opts.tint; c.fillRect(0, 0, W, H);
    if (opts.glow) { c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, opts.flip ? 0 : H, 0, opts.flip ? H : 0); g.addColorStop(0, opts.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalCompositeOperation = 'source-atop'; c.fillRect(0, 0, W, H); }
  });
}
async function loadEnvArt() {
  const I = { fe: true };
  await Promise.all([['island', 'sprites/keep_island.png'], ['colonnade', 'sprites/keep_colonnade.png']].map(([k, u]) => loadImage(u).then(im => { I[k] = im; }).catch(() => null)));
  return I;
}
BG.buildArt = function (I) {
  const scene0 = scene;
  this.sets = { normal: { layers: [], objs: [] }, void: { layers: [], objs: [] } };
  this.sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3870d8, depthTest: false, depthWrite: false }));
  this.sky.renderOrder = 0; scene0.add(this.sky);
  const add = (set, canvasEl, yBottom, p, ro, opts, px = PX) => { const L = new Layer(canvasEl, canvasEl.width * px, canvasEl.height * px, yBottom, p, ro, opts); pxTex(L); this.sets[set].layers.push(L); return L; };
  /* daylight world */
  this.skyL = add('normal', pixCanvas(240, 240, drawFESky), GROUND + 250, .03, 1);
  this.nightL = add('normal', pixCanvas(240, 240, drawFENight), GROUND + 250, .03, 1.5, { opacity: 0 });
  this.lit = [];
  this.lit.push(add('normal', pixCanvas(520, 110, drawFEMountains), GROUND + 330, .06, 2, {}, 4));
  this.lit.push(add('normal', pixCanvas(480, 150, drawFECastle), GROUND + 250, .16, 3, {}, 3));
  this.lit.push(add('normal', pixCanvas(320, 80, drawFEHills), GROUND + 40, .45, 4));
  this.lit.push(add('normal', pixCanvas(300, 60, drawFENear), GROUND + 36, .72, 5));
  this.lit.push(add('normal', pixCanvas(160, 70, drawFEGround), GROUND + 64 - 70 * PX, 1, 6));
  this.lit.push(add('normal', pixCanvas(260, 24, drawFEGrassFg), GROUND - 110, 1.35, 72));
  this.fog = new Layer(makeCanvas(1024, 256, (c, W, H) => {
    const r = seeded(9);
    for (let i = 0; i < 40; i++) { const x = r() * W, y = H * (.3 + r() * .5), rr = 40 + r() * 120;
      wrapDraw(W, x, xx => { const g = c.createRadialGradient(xx, y, 0, xx, y, rr); g.addColorStop(0, 'rgba(230,245,255,.10)'); g.addColorStop(1, 'rgba(230,245,255,0)'); c.fillStyle = g; c.fillRect(xx - rr, y - rr, rr * 2, rr * 2); }); }
  }), 1600, 360, GROUND + 120, .9, 4.5, { drift: 20, opacity: .7 });
  this.sets.normal.layers.push(this.fog);
  /* the Upside Down */
  add('void', pixCanvas(240, 240, drawVoidSky), GROUND + 250, .03, 1);
  if (I.island) add('void', tintImage(I.island, { flip: true, tint: 'rgba(90,10,40,.3)', glow: 'rgba(255,60,80,.4)' }), VH - I.island.height * 1.05 + 120, .12, 2, {}, 1.05);
  add('void', pixCanvas(260, 160, drawVoidDebris), GROUND + 200, .3, 3, {}, 5);
  if (I.colonnade) {
    add('void', tintImage(I.colonnade, { flip: true, tint: 'rgba(40,0,20,.5)' }), VH - 442 * .9 + 60, .55, 3.5, {}, .9);
    add('void', tintImage(I.colonnade, { tint: 'rgba(90,10,40,.28)', glow: 'rgba(255,60,90,.3)' }), GROUND - (442 - 250) * 1.25, 1, 6, {}, 1.25);
  } else add('void', pixCanvas(160, 70, drawFEGround), GROUND + 64 - 70 * PX, 1, 6);
  const vfog = new Layer(makeCanvas(1024, 256, (c, W, H) => {
    const r = seeded(19);
    for (let i = 0; i < 50; i++) { const x = r() * W, y = H * (.3 + r() * .5), rr = 40 + r() * 120;
      wrapDraw(W, x, xx => { const g = c.createRadialGradient(xx, y, 0, xx, y, rr); g.addColorStop(0, 'rgba(255,40,70,.13)'); g.addColorStop(1, 'rgba(255,40,70,0)'); c.fillStyle = g; c.fillRect(xx - rr, y - rr, rr * 2, rr * 2); }); }
  }), 1600, 360, GROUND - 60, 1.2, 70, { drift: 18, opacity: .9 });
  this.sets.void.layers.push(vfog);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x402818, depthTest: false, depthWrite: false }));
  under.renderOrder = 5.5; scene0.add(under); this.under = under;
  this.flames = [];
  this.dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x080614, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  this.dim.renderOrder = 8; scene0.add(this.dim); this.dimV = 0;
  this.flashM = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
  this.flashM.renderOrder = 8.5; scene0.add(this.flashM); this.flashV = 0;
  this.embers = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, color: 0xfff0a0 }));
    m.renderOrder = 71; scene0.add(m);
    if (typeof SB !== 'undefined') SB.track(m);
    this.embers.push({ m, x: rnd(0, VW), y: rnd(GROUND - 80, VH), vx: rnd(-20, 20), vy: rnd(10, 40), s: rnd(5, 10), ph: rnd(0, 6) });
  }
  this.world = 'normal';
  this.setWorld('normal');
  this.resize();
};
BG.setWorld = function (w) {
  this.world = w;
  for (const [k, S] of Object.entries(this.sets)) for (const L of S.layers) L.group.visible = k === w;
  this.layersList = this.sets[w].layers;
  if (w === 'void') { this.sky.material.color.set(0x050206); this.under.material.color.set(0x0a0306); for (const e of this.embers) e.m.material.color.set(0xff3040); }
  else { this.under.material.color.set(0x402818); for (const e of this.embers) e.m.material.color.set(0xfff0a0); }
  this.light = null;
};
/* day/night & weather tint: light = THREE.Color for the land, night 0..1, rain darkening 0..1 */
BG.setLight = function (land, night, skyCol) {
  if (this.world !== 'normal') return;
  for (const L of this.lit) L.mat.color.copy(land);
  this.skyL.mat.color.copy(skyCol);
  this.nightL.mat.opacity = night;
  this.sky.material.color.copy(skyCol).multiplyScalar(.6);
  this.under.material.color.setRGB(.25 * land.r, .16 * land.g, .09 * land.b);
  this.fog.mat.color.copy(land);
  for (const e of this.embers) e.m.material.color.setRGB(1, .94 - night * .1, .63 + night * .3);
};
BG.flash = function (v) { this.flashV = Math.max(this.flashV, v); };
const _bgUpdate = BG.update;
BG.update = function (camX, dt, time) {
  _bgUpdate.call(this, camX, dt, time);
  this.flashV = Math.max(0, this.flashV - dt * 3.2);
  this.flashM.material.opacity = Math.min(.85, this.flashV);
  this.flashM.position.set(camX + VW / 2, VH / 2, 0); this.flashM.scale.set(VW + 200, VH + 200, 1);
};

/* ---------- weather particles: petals, leaves, rain, and rising ash in the Upside Down ---------- */
const SNOW_VS = `attribute float size; attribute float alpha; uniform float uScale; varying float vA;
void main(){ vA = alpha; gl_PointSize = size * uScale; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SNOW_FS = `uniform vec3 uColor; uniform float uShape; uniform float uSlant; varying float vA;
void main(){ vec2 p = gl_PointCoord - .5;
  if (uShape > .5) { if (abs(p.x + p.y * uSlant) > .05) discard; }
  else if (abs(p.x) > .32 || abs(p.y) > .22) discard;
  gl_FragColor = vec4(uColor * vA, vA); }`;
const WEATHER = {
  layers: [], gust: 0, gustT: 4, t: 0, mode: 'normal', rain: 0, windK: 0, rainT: 0, windT: 0,
  build() {
    const mk = (n, o) => {
      const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), P = [];
      for (let i = 0; i < n; i++) P.push({ x: rnd(0, VW + 400) - 200, y: rnd(o.y0, o.y1()), s: rnd(o.s0, o.s1), a: rnd(o.a0, o.a1), ph: rnd(0, 6.28), sp: rnd(.7, 1.3) });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const u = { uScale: { value: 1 }, uColor: { value: new THREE.Color(o.col) }, uShape: { value: o.rain ? 1 : 0 }, uSlant: { value: 0 } };
      const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
      const pts = new THREE.Points(g, m); pts.renderOrder = o.ro; pts.frustumCulled = false; scene.add(pts);
      const L = Object.assign({ P, g, u, pts, n, vis: 1 }, o); this.layers.push(L); return L;
    };
    this.petals = mk(40, { ro: 7, s0: 5, s1: 8, a0: .5, a1: .9, fall: [30, 60], depth: .55, y0: GROUND - 40, y1: () => VH + 40, col: 0xffd8e8 });
    this.leaves = mk(60, { ro: 74, s0: 10, s1: 16, a0: .7, a1: 1, fall: [60, 110], depth: 1.3, y0: GROUND - 60, y1: () => VH + 40, col: 0x90d060, extra: true });
    this.rainL = mk(260, { ro: 73, s0: 26, s1: 40, a0: .35, a1: .7, fall: [1500, 1900], depth: .35, y0: GROUND - 120, y1: () => VH + 60, col: 0xc8dcff, rain: true });
    this.ash = mk(90, { ro: 73, s0: 4, s1: 9, a0: .4, a1: .95, fall: [-60, -25], depth: .25, y0: GROUND - 160, y1: () => VH + 40, col: 0xff4a50, ash: true });
    this.setMode('normal');
  },
  setMode(m) {
    this.mode = m;
    this.petals.pts.visible = this.leaves.pts.visible = m === 'normal';
    this.rainL.pts.visible = m === 'normal';
    this.ash.pts.visible = m === 'void';
  },
  update(camX, dt) {
    if (!this.layers.length) return;
    this.t += dt; this.gustT -= dt;
    if (this.gustT <= 0) { this.gust = rnd(160, 300) * (1 + this.windK * 2); this.gustT = rnd(6, 11) * (1 - this.windK * .6); }
    this.gust *= Math.pow(.35, dt);
    G.wind = this.mode === 'void' ? -20 : -(40 + this.windK * 380 + Math.sin(this.t * .23) * 30 + this.gust);
    const scale = renderer.getPixelRatio() * stageW / VW;
    this.rainL.u.uSlant.value = Math.max(-1.2, Math.min(1.2, G.wind / 900));
    for (const L of this.layers) {
      if (!L.pts.visible) continue;
      L.u.uScale.value = scale;
      const pos = L.g.attributes.position.array, sz = L.g.attributes.size.array, al = L.g.attributes.alpha.array;
      const active = L.rain ? Math.round(L.n * this.rain) : L.extra ? Math.round(L.n * (.2 + this.windK * .8)) : L.n;
      for (let i = 0; i < L.P.length; i++) {
        const p = L.P[i];
        if (i >= active) { al[i] = 0; continue; }
        p.ph += dt * (1.2 + p.sp);
        const fall = L.fall[0] + (L.fall[1] - L.fall[0]) * (p.sp - .7) / .6;
        p.x += (G.wind * L.depth * p.sp + (L.rain ? 0 : Math.sin(p.ph) * 30)) * dt;
        p.y -= fall * dt;
        if (L.ash) { if (p.y > L.y1()) { p.y = L.y0 + rnd(0, 60); p.x = rnd(-200, VW + 200); } }
        else if (p.y < L.y0) {
          if (L.rain && Math.random() < .15 && typeof spawnFx === 'function') spawnFx({ tex: TX.ring, x: camX + ((p.x % (VW + 400)) + (VW + 400)) % (VW + 400) - 200, y: GROUND + rnd(4, 40), sx: 10, sy: 4, sx1: 46, sy1: 12, life: .25, color: 0xb8ccff, a0: .5, ro: 16 });
          p.y = L.y1() - rnd(0, 60); p.x = rnd(-200, VW + 200);
        }
        const sx = ((p.x % (VW + 400)) + (VW + 400)) % (VW + 400) - 200;
        pos[i * 3] = camX + sx; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = 0;
        sz[i] = L.rain ? p.s : p.s * (.6 + .4 * Math.abs(Math.sin(p.ph)));
        al[i] = L.ash ? p.a * (.5 + .5 * Math.sin(p.ph * 2)) : p.a;
      }
      L.g.attributes.position.needsUpdate = L.g.attributes.size.needsUpdate = L.g.attributes.alpha.needsUpdate = true;
    }
  },
};
