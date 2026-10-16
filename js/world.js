/* Sky Balloon — world renderer (canvas).
   World units: x grows right, y grows down. Height h (an integer) sits at y = −h·U, sea level is y = 0.
   Every sprite placement below is derived from measured anchor fractions of the trimmed art. */
(function (SB) {
  'use strict';
  const A = SB.assets, U_ = SB.util;
  const U = 84;                                   // pixels per integer step of height
  const INK = '#2a1846';
  const W_ = SB.world = { U, INK };

  /* ---------- measured sprite geometry (fractions of the trimmed images) ---------- */
  const G = W_.geom = {
    body:    { key: 'vessel/gondola/gondola-body', w: 200, cy: 0.66, rim: 0.35, bottom: 0.965 },
    balloon: { key: 'tokens/balloons/balloon-idle', w: 72, ax: 0.5, ay: 0.985, cy: 0.44 },
    sandbag: { key: 'tokens/sandbags/sandbag-idle', w: 54, ax: 0.52, ay: 0.03, cy: 0.66 },
    pilotH: 118,
    ring:    { key: 'world/gates/gate-ring', h: 4.0 * U, hole: 0.555, plaqueX: 0.5, plaqueY: 0.268 },
    coral:   { key: 'world/gates/gate-coral', h: 3.7 * U, hole: 0.6 }
  };
  const BH = A.hForW(G.balloon.key, G.balloon.w), SH = A.hForW(G.sandbag.key, G.sandbag.w);
  const GH = A.hForW(G.body.key, G.body.w);
  W_.ship = { rimY: (G.body.rim - G.body.cy) * GH, bottomY: (G.body.bottom - G.body.cy) * GH, BH, SH, GH };

  let cv, ctx, pr = 1, W = 1920, H = 1080, Z = 1;
  /* Zoom out: the world is drawn on a larger logical canvas (stage ÷ ZOOM) that is shown at stage size,
     so everything in the scene appears ZOOM× as big and the camera sees more around the ship. */
  const ZOOM = { land: 0.8, port: 0.84 };
  W_.init = function (canvas) { cv = canvas; ctx = cv.getContext('2d'); W_.resize(); sampleGuide(); };
  W_.resize = function () {
    const st = SB.layout.stage; Z = ZOOM[SB.layout.mode] || 1; W = st.w / Z; H = st.h / Z;
    pr = U_.clamp(SB.layout.scale * (window.devicePixelRatio || 1), 0.6, 2) * Z;   // same sharpness per screen pixel
    cv.width = Math.round(W * pr); cv.height = Math.round(H * pr);
    cv.style.width = st.w + 'px'; cv.style.height = st.h + 'px';
    const sea = document.getElementById('sea');
    if (sea) Object.assign(sea.style, { width: W + 'px', height: H + 'px', transform: `scale(${Z})` });
    const svg = document.getElementById('sea-svg');
    if (svg) { svg.setAttribute('width', W); svg.setAttribute('height', SEA_H); svg.setAttribute('viewBox', `0 0 ${W} ${SEA_H}`); }
  };

  /* ---------- camera ---------- */
  const cam = W_.cam = { x: 0, y: 0, shake: 0 };
  const cine = W_.cine = { z: 1 };                 // extra camera zoom toward the ship, used by the arrival scene (≥ 1)
  const vx = () => SB.layout.view.sx * W, vy = () => SB.layout.view.sy * H;
  const sx = (wx, p = 1) => (wx - cam.x) * p + vx();
  const sy = (wy, p = 1) => (wy - cam.y) * p + vy();
  W_.toScreen = (wx, wy) => ({ x: sx(wx) * Z, y: sy(wy) * Z });          // world → stage px
  W_.toWorld = (x, y) => ({ x: x / Z - vx() + cam.x, y: y / Z - vy() + cam.y });   // stage px → world

  /* ---------- sky→sea colour, sampled from the depth-gradient guide (horizon at 50%) ---------- */
  let guide = null;
  // Colours measured from parallax/depth-gradient-guide (top → horizon at 50% → bottom).
  // Used when the browser blocks pixel reads (opening index.html straight from disk).
  const GUIDE_STOPS = [[0, [6, 125, 255]], [0.25, [90, 188, 251]], [0.47, [254, 244, 208]], [0.5, [230, 246, 217]],
    [0.53, [127, 251, 241]], [0.7, [2, 164, 210]], [0.85, [1, 80, 157]], [1, [0, 32, 103]]];
  function guideFromStops() {
    guide = [];
    for (let i = 0; i < 512; i++) {
      const f = i / 511; let k = 1; while (k < GUIDE_STOPS.length - 1 && GUIDE_STOPS[k][0] < f) k++;
      const [f0, c0] = GUIDE_STOPS[k - 1], [f1, c1] = GUIDE_STOPS[k], t = (f - f0) / ((f1 - f0) || 1);
      guide.push(c0.map((v, j) => Math.round(v + (c1[j] - v) * t)));
    }
  }
  function sampleGuide() {
    const im = A.img('parallax/depth-gradient-guide');
    try {
      if (!im || !im.width) throw 0;
      const c = document.createElement('canvas'); c.width = 4; c.height = 512;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0, 4, 512);
      const d = x.getImageData(1, 0, 1, 512).data; guide = [];
      for (let i = 0; i < 512; i++) guide.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    } catch (e) { guideFromStops(); }
  }
  const SPAN = 15;                                 // guide covers heights +15 … −15
  function colAt(h) {
    if (!guide) return h >= 0 ? [150, 205, 240] : [20, 90, 150];
    const i = U_.clamp(Math.round(256 - h / SPAN * 256), 0, 511);
    return guide[i];
  }
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  /* ---------- small draw helpers ---------- */
  function sprite(key, x, y, w, o = {}) {        // (x, y) = point at anchor (ax, ay) of the image
    const im = A.img(key); if (!im || !im.width) return;
    const h = o.h || A.hForW(key, w), ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.sx || o.sy || o.flip) ctx.scale((o.sx || 1) * (o.flip ? -1 : 1), o.sy || 1);
    ctx.drawImage(im, -ax * w, -ay * h, w, h);
    ctx.restore();
  }
  W_.sprite = sprite;
  /** Mirror-tiled parallax strip: tiles alternate flipped so every join is seamless. */
  function strip(key, pf, wy, h, o = {}) {
    const im = A.img(key); if (!im || !im.width) return;
    const tw = A.wForH(key, h);
    let top = sy(wy, o.pfy ?? 1);
    if (o.anchor === 'bottom') top -= h; else if (o.anchor === 'center') top -= h / 2;
    if (top > H || top + h < 0) return;
    const off = -(cam.x * pf) % (tw * 2);
    ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
    for (let x = off - tw * 2, i = 0; x < W + tw; x += tw, i++) {
      const flip = ((Math.round((x - off) / tw) % 2) + 2) % 2 === 1;
      const iw = im.naturalWidth, ih = im.naturalHeight;   // inset 3px: generated strips have soft side columns
      if (flip) { ctx.save(); ctx.translate(x + tw, top); ctx.scale(-1, 1); ctx.drawImage(im, 3, 0, iw - 6, ih, -1, 0, tw + 2, h); ctx.restore(); }
      else ctx.drawImage(im, 3, 0, iw - 6, ih, x - 1, top, tw + 2, h);
    }
    ctx.restore();
  }

  /* ---------- per-level decor ---------- */
  let decor = null;
  W_.buildDecor = function (lv, length) {
    const r = U_.rnd;
    const seabedH = (lv.min ?? -6) - 1.25;
    decor = { length, seabedH, maxH: lv.max ?? 10, sky: [], sea: [], whale: null, storms: [], puffs: [] };
    const skyTop = decor.maxH + 1;
    const reps = Math.max(1, Math.round(length / 4500));   // keep the scenery as busy on longer levels
    for (let i = 0; i < reps; i++) decor.sky.push({ kind: 'gull', x: r(-200, length + 800), h: r(3, skyTop), vx: r(50, 90), w: r(70, 96), ph: r(0, 6) });
    const seaKinds = [].concat(...Array(Math.ceil(reps / 2)).fill(['fish-school', 'jelly']));   // a couple of calm sea creatures, not a crowd
    seaKinds.forEach((k, i) => decor.sea.push({ kind: k, x: r(-300, length + 800), h: r(seabedH + 1.2, -1.2), vx: k === 'jelly' ? r(-8, 8) : r(-50, 50) || 25, w: k === 'manta' ? 120 : k === 'whale-calf' ? 120 : k === 'jelly' ? 66 : 96, ph: r(0, 6) }));
    for (let x = r(-400, 200); x < length * 0.5 + 1600; x += r(1800, 2600)) decor.puffs.push({ x, h: r(2.5, decor.maxH + 1.5), w: r(170, 250), a: r(0.3, 0.45) });
    if (/Storm/.test(lv.world || '')) for (let i = 0; i < Math.max(3, Math.floor((length - 600) / 1100)); i++) decor.storms.push({ x: 600 + i * 1100 + r(-200, 200), h: decor.maxH + r(0.5, 2), w: r(200, 260), ph: r(0, 6) });
  };

  /* ---------- background ---------- */
  function drawBackground(t) {
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 12; i++) {
      const yy = H * i / 12, h = -(yy - vy() + cam.y) / U;
      grd.addColorStop(i / 12, rgb(colAt(h)));
    }
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    if (!decor) return;
    const seabedY = -decor.seabedH * U;
    // sky layers
    if (decor.whale) {
      const w = decor.whale; w.x += w.vx * SB.state.dt; if (w.x > decor.length + 1500) w.x = -900;
      sprite('world/sky-whale', sx(w.x, 0.3), sy(-w.h * U + Math.sin(t * 0.5) * 20, 0.6), 520, { alpha: 0.55 });
    }
    decor.puffs.forEach(c => sprite('fx/flight/cloud-puff', sx(c.x, 0.5), sy(-c.h * U, 0.8), c.w, { alpha: c.a }));   // a few far, faint clouds
    decor.storms.forEach(s => {
      const zap = Math.sin(t * 1.3 + s.ph) > 0.93;
      sprite(zap ? 'world/obstacles/storm-cloud-zap' : 'world/obstacles/storm-cloud', sx(s.x, 0.6), sy(-s.h * U, 0.8), s.w, { alpha: 0.9 });
    });
    decor.sky.forEach(b => {
      b.x += b.vx * SB.state.dt; if (b.x > decor.length + 1400) b.x = -700;
      const yy = sy(-b.h * U + Math.sin(t * 1.8 + b.ph) * 16, 0.9), xx = sx(b.x, 0.9);
      if (b.kind === 'gull') sprite('world/creatures/gull-' + (1 + (Math.floor(t * 8 + b.ph) % 3)), xx, yy, b.w);
      else sprite('world/creatures/' + b.kind, xx, yy, b.w);
    });
    // sea layers
    decor.sea.forEach(f => {
      f.x += f.vx * SB.state.dt; if (f.x > decor.length + 1400) f.x = -700; if (f.x < -900) f.x = decor.length + 1300;
      const xx = sx(f.x, 0.85), yy = sy(-f.h * U + Math.sin(t * 1.4 + f.ph) * 12, 0.95);
      if (f.kind === 'jelly') sprite('world/obstacles/jellyfish-' + (1 + (Math.floor(t * 1.6 + f.ph) % 2)), xx, yy, f.w, { alpha: 0.85 });
      else sprite('world/creatures/' + f.kind, xx, yy, f.w, { flip: f.vx < 0, alpha: 0.85 });
    });
    strip('parallax/reef-mid', 0.7, seabedY + 40, 220, { anchor: 'bottom', alpha: 0.6 });   // one soft reef line only
    // sand below the seabed strip
    const sbY = sy(seabedY + 60);
    if (sbY < H) { ctx.fillStyle = '#e1c588'; ctx.fillRect(0, sbY, W, H - sbY + 2); }
    strip('parallax/seabed', 1, seabedY + 70, 150, { anchor: 'bottom' });
  }

  /* ---------- gates ---------- */
  function drawGate(g, t) {
    const x = sx(g.x), y = sy(-g.h * U);
    if (x < -400 || x > W + 400) return;
    const pos = g.h >= 0;
    if (g.active && !SB.state.scripted) {   // dashed guide at the target height, from the ship to the gate (not during the arrival scene)
      const shipX = sx(SB.state.ship.x);
      ctx.save(); ctx.setLineDash([16, 14]); ctx.lineDashOffset = -t * 40; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,214,90,.9)'; ctx.shadowColor = 'rgba(255,190,40,.8)'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(Math.max(shipX + 120, 140), y); ctx.lineTo(x - 30, y); ctx.stroke(); ctx.restore();
    }
    const pulse = g.active ? 1 + Math.sin(t * 4) * 0.025 : 1;
    if (pos) {
      const gh = G.ring.h * pulse, gw = A.wForH(G.ring.key, gh);
      const key = g.passed ? 'world/gates/gate-ring-passed' : G.ring.key;
      sprite(key, x, y, gw, { h: gh, ax: 0.5, ay: G.ring.hole });
      plaqueText(g.h, x, y + (G.ring.plaqueY - G.ring.hole) * gh, gh * 0.15, g);
    } else {
      const gh = G.coral.h * pulse, gw = A.wForH(G.coral.key, gh);
      sprite(g.passed ? 'world/gates/gate-coral-passed' : G.coral.key, x, y, gw, { h: gh, ax: 0.5, ay: G.coral.hole });
      const pw = 150, top = y - G.coral.hole * gh - 8;
      sprite('world/gates/plaque-small', x, top, pw, { ay: 1 });
      plaqueText(g.h, x, top - A.hForW('world/gates/plaque-small', pw) * 0.5, 50, g);
    }
    if (g.coin && !g.coinTaken) {                    // spinning shell coin in the gate opening
      const s = Math.cos(t * 3 + g.x);
      sprite(Math.abs(s) < 0.25 ? 'world/pickups/shell-coin-edge' : 'world/pickups/shell-coin', x, y, 54, { sx: Math.max(0.25, Math.abs(s)) });
    }
  }
  function plaqueText(n, x, y, size, g) {
    const txt = U_.fmt(n);
    ctx.save(); ctx.font = `700 ${size}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = g.passed ? '#1d6b37' : n > 0 ? '#a8470a' : n < 0 ? '#0f3f8a' : '#7a5208';
    ctx.strokeText(txt, x, y + 2);
    ctx.fillStyle = g.passed ? '#d9ffe4' : n > 0 ? '#ffd9a8' : n < 0 ? '#d6ecff' : '#ffe79a';
    ctx.fillText(txt, x, y + 2); ctx.restore();
  }

  /* ---------- the airship ---------- */
  function drawShip(S, t) {
    const sh = S.ship, x = sx(sh.x), y = sy(sh.y) + Math.sin(t * 2.1) * 3;
    const { rimY, bottomY } = W_.ship;
    const atts = S.tokens.filter(k => k.attached && !k.dragging);
    // 1. ropes from the balloons down to the rim
    ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(95,58,22,.9)';
    atts.forEach(k => {
      if (k.type !== 'b') return;
      const bx = sx(k.x), by = sy(k.y), ax = x + k.ax, ay = y + rimY + 6;
      ctx.beginPath(); ctx.moveTo(bx, by - 2); ctx.quadraticCurveTo((bx + ax) / 2, (by + ay) / 2 + 6, ax, ay); ctx.stroke();
    });
    ctx.restore();
    // 2. balloons (back row first)
    atts.filter(k => k.type === 'b').sort((a, b) => a.ry - b.ry).forEach(k => drawBalloon(k));
    // 3. rudder + propeller at the stern (left)
    const tilt = sh.tilt;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    sprite('vessel/gondola/rudder', -G.body.w * 0.47, -6, 52, { ay: 0.5 });
    const pf = 1 + (Math.floor(t * 18) % 4);
    sprite('vessel/gondola/propeller-' + pf, -G.body.w * 0.56, 4, 58);
    // 4. pilot behind the basket front
    const pose = S.pose;
    const pk = 'characters/pilot-poses/pilot-' + pose, pw = A.wForH(pk, G.pilotH);
    sprite(pk, -14, rimY + 40, pw, { ay: 1, h: G.pilotH });
    // 5. basket, flag, hook rail
    sprite('vessel/gondola/flag', G.body.w * 0.36, rimY + 4, 54, { ax: 0.2, ay: 0.95, rot: Math.sin(t * 3) * 0.05 });
    sprite(S.dented ? 'vessel/gondola/gondola-dented' : G.body.key, 0, 0, G.body.w, { ay: G.body.cy });
    sprite('vessel/gondola/hook-rail', 0, bottomY - 4, 150, { ay: 0.3 });
    ctx.restore();
    // 6. sandbags hanging from the rail
    atts.filter(k => k.type === 's').forEach(k => {
      const bx = sx(k.x), by = sy(k.y);
      if (k.row) {   // second row: extra rope down from the rail
        ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,78,30,.95)';
        ctx.beginPath(); ctx.moveTo(x + k.ax, y + bottomY + 2); ctx.lineTo(bx, by + 4); ctx.stroke(); ctx.restore();
      }
      drawSandbag(k);
    });
  }
  function drawBalloon(k) {
    const g = G.balloon;
    if (k.glow) { ctx.save(); ctx.shadowColor = 'rgba(255,214,90,.95)'; ctx.shadowBlur = 22; }
    sprite(g.key, sx(k.x), sy(k.y), g.w * k.scale, { ax: g.ax, ay: g.ay, rot: k.rot, alpha: k.alpha, sx: k.sqx, sy: k.sqy });
    if (k.glow) ctx.restore();
  }
  function drawSandbag(k) {
    const g = G.sandbag;
    if (k.glow) { ctx.save(); ctx.shadowColor = 'rgba(120,190,255,.95)'; ctx.shadowBlur = 20; }
    sprite(g.key, sx(k.x), sy(k.y), g.w * k.scale, { ax: g.ax, ay: g.ay, rot: k.rot, alpha: k.alpha, sx: k.sqx, sy: k.sqy });
    if (k.glow) ctx.restore();
  }

  /* ---------- particles ---------- */
  function drawParticle(p) {
    const x = sx(p.x), y = sy(p.y), life = p.age / p.life, a = (p.fade ? 1 - life : 1) * (p.alpha ?? 1);
    if (p.kind === 'img') sprite(p.key, x, y, p.w * (1 + (p.grow || 0) * life), { alpha: a, rot: p.rot || 0, flip: p.flip, ay: p.ay ?? 0.5 });
    else if (p.kind === 'frames') {
      const i = Math.min(p.keys.length - 1, Math.floor(p.age * p.fps));
      sprite(p.keys[i], x, y, p.w, { ay: p.ay ?? 0.5, alpha: life > 0.8 ? (1 - life) * 5 : 1 });
    } else if (p.kind === 'token') {
      const g = p.type === 'b' ? G.balloon : G.sandbag;
      sprite(g.key, x, y, g.w, { ax: g.ax, ay: g.ay, rot: p.rot, alpha: a });
    } else if (p.kind === 'text') {
      ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${p.size || 40}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = (p.size || 40) * 0.22; ctx.strokeStyle = INK; ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color || '#fff'; ctx.fillText(p.text, x, y); ctx.restore();
    }
  }

  /* ---------- the sea surface: live SVG over the canvas ----------
     Each layer sums three Gerstner waves (sharp crests, flat troughs) with wavelengths that never line up,
     so the surface never visibly repeats. Layers further back are smaller and drift slower with the camera. */
  const SEA_H = 380, SEA_TOP = 70;                 // svg height; how far above sea level the svg starts
  const LAYERS = {   // [amplitude px, wavelength px, angular speed /s, phase]
    back:  { par: 0.55, dy: -14, amp: 1,   tOff: 0,   waves: [[5.5, 380, 1.3, 1.3], [3.0, 171, 2.2, 4.1], [1.5, 77, 3.4, 2.2]] },
    mid:   { par: 0.8,  dy: -7,  amp: 1,   tOff: 0,   waves: [[8.0, 455, 1.4, 0.4], [4.4, 203, 2.4, 2.9], [2.0, 89, 3.8, 5.0]] },
    front: { par: 1,    dy: 0,   amp: 1,   tOff: 0,   waves: [[11, 520, 1.5, 0], [5.8, 233, 2.6, 2.1], [2.8, 101, 4.0, 4.4]] }
  };
  LAYERS.r1 = { ...LAYERS.front, par: 0.9, dy: 30, amp: 0.6, tOff: 0.9 };   // light bending just under the surface
  LAYERS.r2 = { ...LAYERS.front, par: 0.8, dy: 68, amp: 0.45, tOff: 2.1 };
  function wave(layer, t, step = 9) {
    const pts = [], camX = cam.x * layer.par, tt = t + layer.tOff;
    for (let x0 = -60; x0 <= W + 60; x0 += step) {
      let x = x0, y = layer.dy;
      for (const [A0, L, w, ph] of layer.waves) {
        const A = A0 * layer.amp, k = 2 * Math.PI / L, th = k * (x0 + camX) - w * tt + ph, Q = 0.6 / (A0 * k * 3);
        x -= Q * A * Math.sin(th); y -= A * Math.cos(th);
      }
      pts.push([x, y + SEA_TOP]);
    }
    return pts;
  }
  const line = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  const body = pts => line(pts) + `L${W + 60} ${SEA_H}L-60 ${SEA_H}Z`;
  let seaEls = null, seaShown = null;
  const GLINTS = Array.from({ length: 11 }, (_, i) => ({ x: i * 223 + (i * 97) % 61, d: (i * 0.37) % 2.4 }));   // fixed, scattered sun sparkles
  function drawSea(seaY, t) {
    if (!seaEls) {
      const $ = id => document.getElementById(id);
      seaEls = { root: $('sea'), svg: $('sea-svg'), rays: $('sea-rays'), back: $('sea-back'), mid: $('sea-mid'), front: $('sea-front'),
        r1: $('sea-ripple1'), r2: $('sea-ripple2'), glow: $('sea-glow'), crest: $('sea-crest'), foam: $('sea-foam'), glints: $('sea-glints') };
      if (!seaEls.svg) return;
      seaEls.glints.innerHTML = GLINTS.map(g => `<circle r="2.6" fill="#fff" style="animation-delay:-${g.d.toFixed(2)}s"/>`).join('');
      seaEls.gl = [...seaEls.glints.children];
      seaEls.gl.forEach((c, i) => c.setAttribute('r', (2.6 + (i % 3) * 1.1).toFixed(1)));
    }
    if (!seaEls.svg) return;
    // the sea layer follows the same zoom as the canvas (stage zoom Z, plus any cinematic push-in on the ship)
    const px = sx(SB.state.ship.x), py = sy(SB.state.ship.y);
    const tf = cine.z === 1 ? `scale(${Z})` : `scale(${Z}) translate(${px.toFixed(1)}px,${py.toFixed(1)}px) scale(${cine.z.toFixed(4)}) translate(${(-px).toFixed(1)}px,${(-py).toFixed(1)}px)`;
    if (tf !== seaEls.tf) { seaEls.tf = tf; seaEls.root.style.transform = tf; }
    const show = seaY > -SEA_H && seaY < H + SEA_TOP, rays = seaY > -700 && seaY < H;
    if (show !== seaShown) { seaShown = show; seaEls.svg.style.display = show ? '' : 'none'; }
    seaEls.rays.style.display = rays ? '' : 'none';
    if (rays) seaEls.rays.style.transform = `translateY(${seaY.toFixed(1)}px)`;
    if (!show) return;
    seaEls.svg.style.transform = `translateY(${(seaY - SEA_TOP).toFixed(1)}px)`;
    const front = wave(LAYERS.front, t);
    seaEls.back.setAttribute('d', body(wave(LAYERS.back, t, 12)));
    seaEls.mid.setAttribute('d', body(wave(LAYERS.mid, t, 11)));
    seaEls.front.setAttribute('d', body(front));
    const crest = line(front);
    seaEls.crest.setAttribute('d', crest); seaEls.glow.setAttribute('d', crest); seaEls.foam.setAttribute('d', crest);
    seaEls.foam.style.strokeDashoffset = (cam.x + t * 38).toFixed(1);          // foam rides with the world and drifts along the crest
    seaEls.r1.setAttribute('d', line(wave(LAYERS.r1, t, 14)));
    seaEls.r1.style.strokeDashoffset = (cam.x * 0.9 - t * 22).toFixed(1); seaEls.r2.style.strokeDashoffset = (cam.x * 0.8 + t * 16).toFixed(1);
    seaEls.r2.setAttribute('d', line(wave(LAYERS.r2, t, 16)));
    // sparkles sit on the crest, anchored to the world (wrapping off-screen)
    GLINTS.forEach((g, i) => {
      const x = ((g.x - cam.x) % 2460 + 2460) % 2460 - 200, p = front[U_.clamp(Math.round((x + 60) / 9), 0, front.length - 1)];
      const c = seaEls.gl[i]; c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', (p[1] - 1.5).toFixed(1));
    });
  }

  /* ---------- the frame ---------- */
  W_.draw = function (S, t) {
    // never look further down than a strip of sand below the seabed
    if (decor) cam.y = Math.min(cam.y, -decor.seabedH * U + 190 - (H - vy()));
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    const shake = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
    ctx.translate(shake, 0);
    if (cine.z !== 1) { const px = sx(S.ship.x), py = sy(S.ship.y); ctx.translate(px, py); ctx.scale(cine.z, cine.z); ctx.translate(-px, -py); }
    drawBackground(t);
    if (!decor) return;
    if (S.gates.length) {   // finish lighthouse on a rock at sea level
      const fx = sx(S.gates[S.gates.length - 1].x + 760), lh = 330;
      if (fx > -300 && fx < W + 300) sprite('world/gates/finish-lighthouse', fx, sy(0) + lh * 0.12, A.wForH('world/gates/finish-lighthouse', lh), { h: lh, ay: 1 });
    }
    S.gates.forEach(g => drawGate(g, t));
    S.particlesBack.forEach(drawParticle);
    drawShip(S, t);
    S.tokens.filter(k => k.dragging).forEach(k => k.type === 'b' ? drawBalloon(k) : drawSandbag(k));
    S.free.forEach(drawParticle);
    // water surface drawn over everything below sea level
    drawSea(sy(0), t);
    S.particles.forEach(drawParticle);
    // foreground depth layers
    // depth vignette below sea level
    const depth = -cam.y / U;
    if (depth < -1) {
      const a = U_.clamp((-depth - 1) / 12, 0, 0.42);
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      v.addColorStop(0, 'rgba(0,12,40,0)'); v.addColorStop(1, `rgba(0,12,40,${a})`);
      ctx.fillStyle = v; ctx.fillRect(-20, 0, W + 40, H);
    }
  };
})(window.SB);
