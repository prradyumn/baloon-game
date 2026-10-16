/* Sky Balloon — engine: assets, stage scaling, layout, utilities. */
window.SB = window.SB || {};
(function (SB) {
  'use strict';
  const SIZES = window.ASSET_SIZES || {};

  /* ---------- assets ---------- */
  const A = SB.assets = {
    images: {},
    url: k => 'assets/' + k + '.' + ((SIZES[k] || [])[2] || 'png'),
    size: k => SIZES[k] ? [SIZES[k][0], SIZES[k][1]] : [100, 100],
    hForW(k, w) { const [a, b] = A.size(k); return w * b / a; },
    wForH(k, h) { const [a, b] = A.size(k); return h * a / b; },
    img: k => A.images[k],
    preload(onP) {
      const keys = Object.keys(SIZES); let n = 0;
      return Promise.all(keys.map(k => new Promise(res => {
        const im = new Image();
        im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(fin); };
        im.onerror = fin;
        function fin() { n++; onP && onP(n / keys.length); A.images[k] = im; res(); }
        im.src = A.url(k);
      })));
    }
  };

  /* ---------- stage + HUD layout (single source of truth, stage pixels) ---------- */
  const STAGES = { land: { w: 1920, h: 1080 }, port: { w: 1080, h: 1920 } };
  const RECTS = {
    land: {
      'topbar':     { x: 1606, y: 26,  w: 284,  h: 84 },
      'altimeter':  { x: 44,   y: 168, w: 104,  h: 760 },
      'nav':        { x: 1300, y: 132, w: 590,  h: 176 },
      'eqbar':      { x: 250,  y: 950, w: 900,  h: 104 },
      'dock':       { x: 1170, y: 790, w: 720,  h: 264 },
      'pairbtn':    { x: 1458, y: 708, w: 344,  h: 84 },
      'toast':      { x: 460,  y: 330, w: 1000, h: 140 }
    },
    port: {
      'topbar':     { x: 772,  y: 34,  w: 284,  h: 84 },
      'altimeter':  { x: 26,   y: 190, w: 104,  h: 1000 },
      'nav':        { x: 150,  y: 140, w: 906,  h: 170 },
      'eqbar':      { x: 24,   y: 1440, w: 1032, h: 112 },
      'dock':       { x: 24,   y: 1574, w: 1032, h: 318 },
      'pairbtn':    { x: 368,  y: 1340, w: 344,  h: 84 },
      'toast':      { x: 60,   y: 560, w: 960,  h: 140 }
    }
  };
  // Where the ship sits on screen (fractions of the stage).
  const VIEW = { land: { sx: 0.4, sy: 0.5 }, port: { sx: 0.5, sy: 0.4 } };

  const L = SB.layout = {
    mode: null, scale: 1, stage: STAGES.land, view: VIEW.land, onChange: [],
    rect: id => RECTS[L.mode][id],
    fit() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const mode = vh / vw > 1.15 ? 'port' : 'land';
      const st = STAGES[mode], scale = Math.min(vw / st.w, vh / st.h);
      const stage = document.getElementById('stage');
      Object.assign(stage.style, { width: st.w + 'px', height: st.h + 'px',
        transform: `translate(${(vw - st.w * scale) / 2}px, ${(vh - st.h * scale) / 2}px) scale(${scale})` });
      const changed = mode !== L.mode;
      L.scale = scale;
      if (changed) {
        L.mode = mode; L.stage = st; L.view = VIEW[mode];
        stage.className = mode; document.body.dataset.mode = mode;
        for (const [id, r] of Object.entries(RECTS[mode])) {
          const el = document.getElementById(id); if (!el) continue;
          Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        }
      }
      L.onChange.forEach(fn => fn(mode, changed));
    },
    toStage(e) {
      const r = document.getElementById('stage').getBoundingClientRect();
      return { x: (e.clientX - r.left) / L.scale, y: (e.clientY - r.top) / L.scale };
    },
    init() { L.fit(); window.addEventListener('resize', L.fit); }
  };

  /* ---------- utilities ---------- */
  SB.util = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rnd: (a, b) => a + Math.random() * (b - a),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    /** +3, −3, 0 (zero has no sign — NCERT) */
    fmt: n => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0',
    /** bracketed for equations: (+3) (−3) 0 */
    br: n => n === 0 ? '0' : '(' + (n > 0 ? '+' + n : '−' + Math.abs(n)) + ')',
    words(n) {
      const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
      const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
      const k = Math.abs(n), w = k < 20 ? ONES[k] : TENS[Math.floor(k / 10)] + (k % 10 ? '-' + ONES[k % 10] : '');
      return n === 0 ? 'zero' : (n > 0 ? 'positive ' : 'negative ') + w;
    },
    store: {
      get(k, d) { try { const v = localStorage.getItem('sb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem('sb_' + k, JSON.stringify(v)); } catch (e) {} }
    }
  };
})(window.SB);
