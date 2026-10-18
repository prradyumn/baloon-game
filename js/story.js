/* Sky Balloon — story intro: "The Night the Zero Light Went Out".
   Six scenes on ONE continuous vertical world: the camera rides a giant number line like Bela's lift,
   from the sky (+) through sea level (0) into the deep (−), so the story itself teaches the number line.
   Clean frames (one subject, one line of words); GSAP drives every move. It plays straight through: each scene
   moves on once its animation and its narration (assets/audio/story/s1…s6.ogg) are both done. Skip leaves at any time. */
(function (SB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = SB.assets, AU = SB.audio, U_ = SB.util, fmt = U_.fmt;

  const SCENES = [
    { text: 'Sunny Shore, where the sky meets the sea.' },
    { text: 'The Zero Light marks sea level: 0.', sub: 'Above it is positive. Below it is negative.' },
    { text: 'Then Captain Gusto grabbed it… just for fun!' },
    { text: 'Oops! It shattered, above and below zero.' },
    { text: 'Balloons lift us: (+1). Sandbags sink us: (−1).' },
    { text: 'Fly through each gate at its exact height.', sub: 'Bring the Zero Light back!' }
  ];
  /* layout per orientation (stage px). TOP: the world's top edge is height +TOP. */
  const GEO = {
    land: { step: 84, lineX: 150, lhX: 1420, lhW: 380, blimpW: 500, shipX: 560, gateX: 1010, cut: 360, ship: 1,
            shards: [[640, 5, 'shard-small-arc'], [930, 2, 'shard-medium'], [700, -3, 'shard-sliver'], [1060, -4, 'shard-small-arc']] },
    port: { step: 96, lineX: 96, lhX: 935, lhW: 310, blimpW: 420, shipX: 300, gateX: 585, cut: 300, ship: 0.8,
            shards: [[330, 5, 'shard-small-arc'], [600, 2, 'shard-medium'], [380, -3, 'shard-sliver'], [700, -4, 'shard-small-arc']] }
  };
  const TOP = 18, LAMP_Y = 0.21, BLIMP_GEM = [0.89, 0.47];

  let g, W, H, root, world, cam, focus, scene = -1, tl = null, auto = null, onDone = null, seaTick = null, bubbleT = 0, playing = false, voice = null;
  const yOf = h => (TOP - h) * g.step;                 // world y of a height
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const img = (key, cls) => `<img class="${cls || ''}" src="${A.url(key)}" alt="">`;
  const hOf = (key, w) => A.hForW(key, w);

  /* integers in captions: (+1) orange, (−1) blue, 0 gold; "positive"/"negative" tinted too */
  function words(text) {
    return text.split(' ').map(w => {
      let cls = 'w';
      if (/\(\+\d+\)/.test(w) || /^positive/i.test(w)) cls += ' pos';
      else if (/\(−\d+\)/.test(w) || /^negative/i.test(w)) cls += ' neg';
      else if (/^0[.,:]?$/.test(w)) cls += ' zero';
      return `<span class="${cls}">${w}</span>`;
    }).join(' ');
  }

  function build() {
    const mode = SB.layout.mode; g = GEO[mode]; W = SB.layout.stage.w; H = SB.layout.stage.h;
    root = $('screen-story'); root.innerHTML = ''; root.className = 'screen open';
    const y0 = yOf(0), worldH = (TOP + 16) * g.step;   // deep enough that the camera never sees past the bottom
    world = el('div', 'st-world'); world.id = 'st-world';
    world.style.height = worldH + 'px';
    world.style.background = `linear-gradient(#4fa8ea 0px, #8fd0f4 ${yOf(9)}px, #d6eefa ${yOf(3)}px, #f4f9fb ${y0 - 2}px, #a7e6f1 ${y0}px, #4bb3da ${yOf(-3)}px, #17679f ${yOf(-8)}px)`;
    root.appendChild(world);

    // dusk plate, horizon on sea level
    const dw = W * 1.2, dh = dw / 1.5, dusk = el('img', 'st-dusk'); dusk.src = A.url('story/dusk-sky'); dusk.id = 'st-dusk';
    Object.assign(dusk.style, { width: dw + 'px', height: dh + 'px', left: (W - dw) / 2 + 'px', top: (y0 - dh / 2) + 'px' });
    world.appendChild(dusk);
    // a few soft clouds
    const clouds = el('div', 'st-clouds', [[0.12, 7.5, 200], [0.62, 10.5, 160], [0.8, 4.2, 140], [0.35, 12, 180]]
      .map(([x, h, w], i) => `<i class="stc" style="left:${x * W}px;top:${yOf(h)}px;width:${w}px;animation-delay:-${i * 9}s"></i>`).join(''));
    world.appendChild(clouds);

    // the number line (draws itself in scene 2)
    const line = el('div', 'st-line'); line.id = 'st-line'; line.style.left = g.lineX + 'px';
    line.innerHTML = `<i class="st-track" style="top:${yOf(9)}px;height:${yOf(-6) - yOf(9)}px"></i>` +
      Array.from({ length: 16 }, (_, i) => 9 - i).map(h => `<div class="st-tick ${h > 0 ? 'pos' : h < 0 ? 'neg' : 'zero'}" data-h="${h}" style="top:${yOf(h)}px"><i></i><span>${fmt(h)}</span></div>`).join('') +
      `<i class="st-mark" id="st-mark"></i>`;
    // scene 2 teaching layer: the sky half warms (positive), the sea half cools (negative), sea level is 0
    const wpos = el('div', 'st-wash pos'); wpos.id = 'st-wash-pos'; Object.assign(wpos.style, { top: yOf(11) + 'px', height: y0 - yOf(11) + 'px' });
    const wneg = el('div', 'st-wash neg'); wneg.id = 'st-wash-neg'; Object.assign(wneg.style, { top: y0 + 'px', height: yOf(-9) - y0 + 'px' });
    world.appendChild(wpos); world.appendChild(wneg);
    world.appendChild(line);
    const lx = W * (mode === 'land' ? 0.43 : 0.47);
    const big = (id, cls, h, arrow, word, small) => { const b = el('div', 'st-big ' + cls, `<span class="arw">${arrow}</span><span class="txt"><strong>${word}</strong><small>${small}</small></span>`);
      b.id = id; Object.assign(b.style, { left: lx + 'px', top: yOf(h) + 'px' }); world.appendChild(b); };
    big('st-big-pos', 'pos', 3.4, '▲', 'Positive', 'above sea level (+)');
    big('st-big-neg', 'neg', -3.2, '▼', 'Negative', 'below sea level (−)');
    const zb = el('div', 'st-zero-badge', '<strong>0</strong><small>sea level</small>'); zb.id = 'st-zero-badge';
    Object.assign(zb.style, { left: lx + 'px', top: y0 + 'px' }); world.appendChild(zb);

    // sea level glow line
    const zero = el('div', 'st-zero'); zero.id = 'st-zero'; zero.style.top = y0 + 'px'; zero.style.transformOrigin = `${g.lhX}px 50%`;
    world.appendChild(zero);

    // lighthouse (bottom on the waterline), its beam and the Zero Crystal in the lamp
    const lhH = hOf('story/lighthouse-lit', g.lhW), lamp = { x: g.lhX, y: y0 - lhH * (1 - LAMP_Y) };
    const lh = el('div', 'st-lh', img('story/lighthouse-lit', 'lit') + img('story/lighthouse-dark', 'dark'));
    lh.id = 'st-lh'; Object.assign(lh.style, { left: g.lhX - g.lhW / 2 + 'px', top: y0 - lhH + 'px', width: g.lhW + 'px', height: lhH + 'px' });
    world.appendChild(lh);
    const beam = el('div', 'st-beam'); beam.id = 'st-beam'; Object.assign(beam.style, { left: lamp.x + 'px', top: lamp.y + 'px' }); world.appendChild(beam);
    const cw = g.lhW * 0.2, crystal = el('img', 'st-crystal'); crystal.id = 'st-crystal'; crystal.src = A.url('story/zero-crystal');
    Object.assign(crystal.style, { width: cw + 'px', left: lamp.x - cw / 2 + 'px', top: lamp.y - cw / 2 + 'px' }); world.appendChild(crystal);

    // Captain Gusto's blimp (its crystal patch is hidden until he has grabbed it)
    const bh = hOf('story/gusto-flyaway', g.blimpW), blimp = el('div', 'st-blimp', img('story/gusto-flyaway'));
    blimp.id = 'st-blimp'; Object.assign(blimp.style, { width: g.blimpW + 'px', height: bh + 'px' }); world.appendChild(blimp);
    world.appendChild(Object.assign(el('div'), { id: 'st-shards' }));

    // the little airship for the balloon / sandbag demo
    const ship = el('div', 'st-ship', img('characters/pilot-poses/pilot-steer', 'pilot') + img('vessel/gondola/gondola-body', 'body') +
      img('tokens/balloons/balloon-idle', 'bal') + '<i class="rope"></i>' + img('tokens/sandbags/sandbag-idle', 'bag'));
    ship.id = 'st-ship'; ship.style.left = g.shipX - 115 + 'px'; ship.style.setProperty('--k', g.ship); world.appendChild(ship);
    // a gate at +1 (the first gate of level 1)
    const gh = 3.4 * g.step, gw = A.wForH('world/gates/gate-ring', gh), gate = el('div', 'st-gate', img('world/gates/gate-ring') + '<b>+1</b>');
    gate.id = 'st-gate'; Object.assign(gate.style, { left: g.gateX - gw / 2 + 'px', top: yOf(1) - gh * 0.555 + 'px', width: gw + 'px', height: gh + 'px' });
    world.appendChild(gate);
    const guide = el('i', 'st-guide'); guide.id = 'st-guide'; Object.assign(guide.style, { left: g.shipX + 120 * g.ship + 'px', top: yOf(1) + 'px', width: Math.max(40, g.gateX - gw * 0.3 - g.shipX - 120 * g.ship) + 'px' });
    world.appendChild(guide);

    // the sea surface: two soft bands and a bright crest, drawn over everything below 0
    const sea = el('div', 'st-sea', `<svg width="${W}" height="150" viewBox="0 0 ${W} 150" preserveAspectRatio="none"><defs><linearGradient id="stg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6fbff" stop-opacity=".75"/><stop offset=".35" stop-color="#7fd6ea" stop-opacity=".35"/><stop offset="1" stop-color="#3aa7d4" stop-opacity="0"/></linearGradient></defs>
      <path id="st-sea-back" fill="#d6f6fb" fill-opacity=".5"/><path id="st-sea-front" fill="url(#stg)"/><path id="st-sea-crest" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".95"/></svg>`);
    sea.style.top = y0 - 40 + 'px'; world.appendChild(sea);
    world.appendChild(Object.assign(el('div'), { id: 'st-bubbles' }));

    // screen-fixed layers
    root.appendChild(el('div', 'st-vignette'));
    root.appendChild(Object.assign(el('div'), { id: 'st-cutins' }));
    root.appendChild(Object.assign(el('div', 'st-height', '<small>Height</small><b id="st-hval"></b>'), { id: 'st-height' }));
    root.appendChild(Object.assign(el('div', 'st-caption'), { id: 'st-caption' }));
    root.appendChild(Object.assign(el('div', 'st-dots', SCENES.map(() => '<i></i>').join('')), { id: 'st-dots' }));
    const skip = Object.assign(el('button', 'pill-btn ghost st-skip', 'Skip ›'), { id: 'st-skip' }); root.appendChild(skip);
    skip.onclick = e => { e.stopPropagation(); AU.play('click'); finish(); };

    // initial state
    gsap.set('#st-line .st-tick', { opacity: 0 });
    gsap.set(['#st-wash-pos', '#st-wash-neg', '#st-big-pos', '#st-big-neg', '#st-zero-badge'], { opacity: 0 });
    gsap.set('#st-line .st-track', { scaleY: 0 });
    gsap.set(['#st-mark', '#st-height'], { opacity: 0 });
    gsap.set(zero, { scaleX: 0 }); gsap.set(beam, { opacity: 0 });
    gsap.set('#st-lh .dark', { opacity: 0 });
    gsap.set(blimp, { x: -900, y: yOf(8), clipPath: blimpClip(true) });
    gsap.set(ship, { opacity: 0 }); gsap.set('#st-ship .bal, #st-ship .rope, #st-ship .bag', { opacity: 0 });
    gsap.set([gate, guide], { opacity: 0 });
    cam = { h: 8.6 }; focus = { h: 8.6, follow: true }; camera.under = undefined;
    shipAt(0);
    camera();
  }
  /** Hide (or show) the crystal patch at the front of the blimp art. */
  const blimpClip = hide => hide ? 'polygon(0 0, 100% 0, 100% 29%, 79% 29%, 79% 67%, 100% 67%, 100% 100%, 0 100%)'
                                 : 'polygon(0 0, 100% 0, 100% 29%, 100% 29%, 100% 67%, 100% 67%, 100% 100%, 0 100%)';
  function shipAt(h) { const s = $('st-ship'); s.style.top = yOf(h) - 197 + 'px'; s.dataset.h = h; }   // gondola rides on the waterline

  /* camera + the height read-out; focus is what the read-out (and the marker) reports */
  function camera() {
    gsap.set(world, { y: H * 0.52 - yOf(cam.h) });   // through GSAP, so the shake (x) and the camera (y) share one transform
    if (focus.follow) focus.h = cam.h;
    const v = Math.round(focus.h), b = $('st-hval');
    if (b && b.dataset.v !== String(v)) { b.dataset.v = v; b.textContent = fmt(v); b.className = v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'; gsap.fromTo(b, { scale: 1.25 }, { scale: 1, duration: 0.25 }); }
    const m = $('st-mark'); if (m) m.style.top = yOf(focus.h) + 'px';
    const under = cam.h < -0.6;
    if (under !== camera.under) { if (camera.under !== undefined) AU.play(under ? 'dive' : 'surface'); camera.under = under; }
  }
  const camTo = (h, duration, ease = 'power2.inOut') => gsap.to(cam, { h, duration, ease, onUpdate: camera });

  /* caption: words rise in one by one */
  function caption(i) {
    const c = $('st-caption'), s = SCENES[i];
    c.innerHTML = `<span class="line">${words(s.text)}</span>` + (s.sub ? `<span class="sub">${words(s.sub)}</span>` : '');
    gsap.fromTo(c.querySelectorAll('.w'), { y: 26, opacity: 0, rotation: 3 }, { y: 0, opacity: 1, rotation: 0, duration: 0.5, stagger: 0.07, ease: 'back.out(2)' });
    [...$('st-dots').children].forEach((d, k) => d.className = k < i ? 'done' : k === i ? 'on' : '');
  }
  /* narration for scene i; done() runs when it ends (or after a reading-time estimate if sound is off or the clip fails) */
  function narrate(i, done) {
    if (voice) { voice.onended = voice.onerror = null; voice.pause(); }
    const s = SCENES[i], est = 1200 + (s.text + ' ' + (s.sub || '')).split(' ').length * 330;
    let fired = false; const end = () => { if (!fired) { fired = true; clearTimeout(cap); done(); } };
    const cap = setTimeout(end, AU.on ? 14000 : est);            // safety net
    if (!AU.on) return;
    voice = new Audio(`assets/audio/story/s${i + 1}.ogg`);
    voice.onended = end; voice.onerror = () => { clearTimeout(cap); setTimeout(end, est); };
    voice.play().catch(() => { clearTimeout(cap); setTimeout(end, est); });
  }
  /* a round character cut-in (side: 'l' or 'r'), returns the element */
  function cutin(key, side, top, extra = '') {
    const d = el('div', 'st-cutin ' + side + ' ' + extra, `<i></i>${img(key)}`);
    d.style.setProperty('--s', g.cut + 'px'); d.style.top = top + 'px';
    $('st-cutins').appendChild(d);
    gsap.fromTo(d, { scale: 0, rotation: side === 'r' ? 14 : -14 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.2)' });
    gsap.fromTo(d.querySelector('img'), { y: 60 }, { y: 0, duration: 0.7, ease: 'back.out(1.6)', delay: 0.08 });
    return d;
  }
  const cutout = d => d && gsap.to(d, { scale: 0, duration: 0.35, ease: 'back.in(2)', onComplete: () => d.remove() });
  function badge(x, h, n) {
    const b = el('b', 'st-badge ' + (n > 0 ? 'pos' : 'neg'), U_.br(n));
    Object.assign(b.style, { left: x + 'px', top: yOf(h) + 'px' }); $('st-shards').appendChild(b);
    gsap.fromTo(b, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
    const t = document.querySelector(`#st-line .st-tick[data-h="${n}"]`); if (t) t.classList.add('hit');
    return b;
  }
  function flash(x, y, size = 260) {
    const f = el('i', 'st-flash'); Object.assign(f.style, { left: x - size / 2 + 'px', top: y - size / 2 + 'px', width: size + 'px', height: size + 'px' });
    world.appendChild(f); gsap.fromTo(f, { scale: 0.2, opacity: 1 }, { scale: 1.4, opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => f.remove() });
  }

  /* ---------- the six scenes ---------- */
  const lampPos = () => { const lh = $('st-lh'); return { x: g.lhX, y: lh.offsetTop + lh.offsetHeight * LAMP_Y }; };
  const blimpGem = () => { const b = $('st-blimp'); return { x: gsap.getProperty(b, 'x') + b.offsetWidth * BLIMP_GEM[0], y: gsap.getProperty(b, 'y') + b.offsetHeight * BLIMP_GEM[1] }; };

  const SCENE_FX = [
    // 1. establish: drift down through the sky
    () => gsap.timeline()
      .add(() => AU.play('whoosh'))
      .to('#st-height', { opacity: 1, duration: 0.6 }, 0.4)
      .add(camTo(5.4, 5.2, 'sine.inOut'), 0),

    // 2. sea level is 0; above it positive, below it negative — three beats, each landing on its words
    () => {
      const t = gsap.timeline(), ticks = h => [...document.querySelectorAll('#st-line .st-tick')].filter(tk => h(+tk.dataset.h));
      const pos = ticks(h => h > 0).sort((a, b) => a.dataset.h - b.dataset.h), neg = ticks(h => h < 0).sort((a, b) => b.dataset.h - a.dataset.h);
      const ride = (to, d, ease = 'power2.inOut') => gsap.to(focus, { h: to, duration: d, ease, onUpdate: camera });
      // beat 1 — "The Zero Light marks sea level: zero." The camera centres on sea level; the light lays a glowing 0 line.
      t.add(camTo(0.4, 1.4), 0)
        .to('#st-beam', { opacity: 1, duration: 0.3 }, 0.2)
        .fromTo('#st-beam', { scaleX: 1 }, { scaleX: -1, duration: 0.7, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.2)
        .add(() => AU.play('star'), 0.3)
        .to('#st-beam', { opacity: 0.35, duration: 0.5 }, 1.6)
        .to('#st-zero', { scaleX: 1, duration: 1.2, ease: 'power3.out' }, 1.2)
        .add(() => AU.play('gate'), 1.3)
        .to('#st-line .st-track', { scaleY: 1, duration: 0.9, ease: 'power2.out' }, 1.4)
        .to(ticks(h => h !== 0), { opacity: 0.35, duration: 0.5, stagger: 0.02 }, 1.6)
        .fromTo(ticks(h => h === 0), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, 2.5)
        .fromTo('#st-zero-badge', { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.6)' }, 2.6)
        .add(() => { AU.play('pair'); focus.follow = false; focus.h = 0; camera(); }, 2.6)
        .to('#st-mark', { opacity: 1, duration: 0.3 }, 2.6)
        .fromTo('#st-zero', { boxShadow: '0 0 22px 8px rgba(255,214,90,.55)' }, { boxShadow: '0 0 44px 18px rgba(255,214,90,.95)', duration: 0.45, yoyo: true, repeat: 1 }, 2.7)
      // beat 2 — "Above it is positive." The sky half warms; +1…+9 light up going up; the marker climbs to +3.
        .fromTo('#st-wash-pos', { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.9, ease: 'power2.out' }, 4.0)
        .fromTo('#st-big-pos', { opacity: 0, y: 40, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' }, 4.05)
        .to(pos, { opacity: 1, duration: 0.25, stagger: 0.07, onStart() { pos.forEach(tk => tk.classList.add('lit')); } }, 4.1)
        .add(() => AU.play('inflate'), 4.2)
        .add(ride(3, 1.1, 'back.out(1.4)'), 4.3)
      // beat 3 — "Below it is negative." The sea half cools; −1…−6 light up going down; the marker dives through 0 to −3.
        .fromTo('#st-wash-neg', { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.9, ease: 'power2.out' }, 6.0)
        .fromTo('#st-big-neg', { opacity: 0, y: -40, scale: 0.6 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' }, 6.05)
        .to(neg, { opacity: 1, duration: 0.25, stagger: 0.07, onStart() { neg.forEach(tk => tk.classList.add('lit')); } }, 6.1)
        .add(() => AU.play('hook'), 6.2)
        .add(ride(-3, 1.4), 6.3)
      // and back to sea level: 0 sits between them
        .add(ride(0, 0.8, 'back.out(1.6)'), 8.0)
        .add(() => AU.play('pair'), 8.6);
      return t;
    },

    // 3. Captain Gusto swoops in, grabs the crystal; the light goes out and dusk falls
    () => {
      const t = gsap.timeline(), lamp = lampPos(), bw = g.blimpW, bh = $('st-blimp').offsetHeight;
      const hoverX = lamp.x - 50 - bw * BLIMP_GEM[0], hoverY = lamp.y - bh * BLIMP_GEM[1];
      let cut;
      t.add(() => { focus.follow = true; }, 0)
        .to(['#st-wash-pos', '#st-wash-neg', '#st-big-pos', '#st-big-neg', '#st-zero-badge'], { opacity: 0, duration: 0.6 }, 0)
        .add(camTo(4.2, 1.2), 0)
        .add(() => AU.play('whoosh'), 0)
        .to('#st-blimp', { x: hoverX, y: hoverY, duration: 1.6, ease: 'power3.out' }, 0)
        .fromTo('#st-blimp', { rotation: -8 }, { rotation: 0, duration: 1.6, ease: 'back.out(2)' }, 0)
        .add(() => { flash(lamp.x, lamp.y, 200); AU.play('pair'); }, 1.6)
        .to('#st-crystal', { x: -50, y: 0, scale: 0.8, duration: 0.35, ease: 'power2.in' }, 1.6)   // into Gusto's grip (50px left of the lamp)
        .add(() => { gsap.set('#st-crystal', { opacity: 0 }); gsap.set('#st-blimp', { clipPath: blimpClip(false) }); }, 1.95)
        .add(() => { cut = cutin('story/gusto-grab', 'r', H * (SB.layout.mode === 'land' ? 0.2 : 0.56)); }, 2.0)
        // the light goes out
        .to('#st-lh .dark', { opacity: 1, duration: 0.5 }, 2.6).to('#st-lh .lit', { opacity: 0, duration: 0.5 }, 2.6)
        .to('#st-beam', { opacity: 0, duration: 0.3 }, 2.6)
        .to('#st-zero', { opacity: 0.25, duration: 0.6 }, 2.6)
        .to('#st-dusk', { opacity: 0.92, duration: 1.4, ease: 'power1.inOut' }, 2.7)
        .add(() => AU.play('drop'), 2.6)
        // he zooms off, high and to the right
        .add(() => { AU.play('whoosh'); cutout(cut); }, 3.9)
        .to('#st-blimp', { x: W * 0.56, y: yOf(7.4) - bh / 2, duration: 1.3, ease: 'power2.inOut' }, 3.9);
      return t;
    },

    // 4. oops: the crystal slips, cracks, and shards fly to their heights; we follow one down below zero
    () => {
      const t = gsap.timeline(); let cut, a, b2;
      t.add(() => { cut = cutin('story/gusto-oops', 'r', H * (SB.layout.mode === 'land' ? 0.16 : 0.56)); AU.play('bump'); }, 0.1)
        .add(() => {   // hand the crystal from the blimp art to the crystal sprite
          const gem = blimpGem(), c = $('st-crystal'), w = c.offsetWidth * 1.15;
          gsap.set('#st-blimp', { clipPath: blimpClip(true) });
          gsap.set(c, { x: 0, y: 0, scale: 1, opacity: 1, left: gem.x - w / 2, top: gem.y - w / 2, width: w });
        }, 0.6)
        .to('#st-crystal', { y: g.step * 1.2, rotation: 40, duration: 0.55, ease: 'power2.in' }, 0.62)
        .add(() => {   // crack!
          const c = $('st-crystal'), x = c.offsetLeft + c.offsetWidth / 2, y = c.offsetTop + c.offsetHeight / 2 + g.step * 1.2;
          gsap.set(c, { opacity: 0 }); flash(x, y, 320); AU.play('pop'); AU.play('pair'); W_shake();
          g.shards.forEach(([sx, sh, key], i) => {
            const s = el('img', 'st-shard'); s.src = A.url('story/' + key); const sw = 64 + (i % 2) * 18;
            Object.assign(s.style, { width: sw + 'px', left: x - sw / 2 + 'px', top: y - sw / 2 + 'px' }); $('st-shards').appendChild(s);
            const dx = sx - x, dy = yOf(sh) - y, up = sh > 0;
            gsap.to(s, { x: dx, duration: 1.1, ease: 'power1.out', delay: i * 0.08 });
            gsap.to(s, { y: dy, duration: 1.1, ease: up ? 'back.out(1.4)' : 'power2.in', delay: i * 0.08 });
            gsap.to(s, { rotation: (i % 2 ? 1 : -1) * (260 + i * 70), duration: 1.1, ease: 'power2.out', delay: i * 0.08,
              onComplete: () => { badge(sx + sw * 0.8, sh, sh); AU.play('coin'); if (!up) AU.play('splash');
                gsap.to(s, { y: dy - 8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }); } });
            AU.play('release');
          });
        }, 1.17)
        .add(() => cutout(cut), 2.4)
        .to('#st-blimp', { x: W + 300, duration: 1.4, ease: 'power2.in' }, 2.3)
        .add(camTo(-2.8, 2.2), 2.9)   // follow the deepest pieces under the sea
        .add(() => { a = cutin('story/pilot-surprised', 'l', H * (SB.layout.mode === 'land' ? 0.36 : 0.52)); }, 4.6)
        .add(() => { b2 = cutin('story/navigator-worried', 'r', H * (SB.layout.mode === 'land' ? 0.36 : 0.52)); }, 4.9)
        .add(() => { SCENE_FX.leftovers = [a, b2]; }, 5.0);
      return t;
    },

    // 5. the tools: a balloon lifts us one step, a sandbag brings us back down
    () => {
      const t = gsap.timeline(), ship = $('st-ship');
      t.add(() => (SCENE_FX.leftovers || []).forEach(cutout), 0)
        .add(camTo(0.9, 1.6), 0)
        .to('#st-dusk', { opacity: 0.25, duration: 1.6 }, 0.2)
        .add(() => { focus.follow = false; gsap.to(focus, { h: 0, duration: 0.6, onUpdate: camera }); }, 1.2)
        .fromTo(ship, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(1.8)' }, 1.3)
        .add(() => AU.play('surface'), 1.4)
        // + (+1): a balloon
        .fromTo('#st-ship .bal', { opacity: 0, y: -140, scale: 0.4 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' }, 2.3)
        .to('#st-ship .rope', { opacity: 1, duration: 0.2 }, 2.6)
        .add(() => { AU.play('inflate'); tokenBadge('+ (+1)', 'pos'); }, 2.4)
        .to(ship, { y: -g.step, duration: 0.8, ease: 'back.out(1.6)', onUpdate: () => { focus.h = -gsap.getProperty(ship, 'y') / g.step; camera(); } }, 2.9)
        // + (−1): a sandbag
        .fromTo('#st-ship .bag', { opacity: 0, y: 120, scale: 0.4 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, 4.1)
        .add(() => { AU.play('hook'); tokenBadge('+ (−1)', 'neg'); }, 4.2)
        .to(ship, { y: 0, duration: 0.8, ease: 'back.out(1.4)', onUpdate: () => { focus.h = -gsap.getProperty(ship, 'y') / g.step; camera(); } }, 4.7);
      return t;
    },

    // 6. the mission: a gate at +1, the guide line draws to it, the heroes are ready
    () => {
      const t = gsap.timeline(); let a, b2;
      t.fromTo('#st-gate', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, 0.2)
        .add(() => AU.play('star'), 0.3)
        .fromTo('#st-guide', { opacity: 1, scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.out' }, 0.8)
        .add(() => { a = cutin('story/pilot-determined', 'l', H * (SB.layout.mode === 'land' ? 0.47 : 0.62), 'edge'); AU.play('pair'); }, 1.4)
        .add(() => { b2 = cutin('story/navigator-point', 'r', H * (SB.layout.mode === 'land' ? 0.47 : 0.62), 'edge'); }, 1.75);
      return t;
    }
  ];
  function tokenBadge(text, cls) {
    const ship = $('st-ship'), b = el('b', 'st-badge ' + cls, text);
    Object.assign(b.style, { left: ship.offsetLeft + 250 + 'px', top: ship.offsetTop + gsap.getProperty(ship, 'y') + 40 + 'px' });
    $('st-shards').appendChild(b);
    gsap.timeline().fromTo(b, { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }).to(b, { y: -40, opacity: 0, duration: 0.6, delay: 0.9 }).add(() => b.remove());
  }
  function W_shake() { gsap.fromTo('#st-world', { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.4, 0.3)' }); }

  /* ---------- flow ---------- */
  /* one scene: caption + animation + narration; when both are done, hold a beat and carry on (no taps needed) */
  function show(i) {
    scene = i; clearTimeout(auto);
    caption(i);
    let animDone = false, voiceDone = false;
    const maybeNext = () => {
      if (!animDone || !voiceDone || !playing || scene !== i) return;
      const last = i === SCENES.length - 1;
      auto = setTimeout(() => last ? finish() : show(i + 1), last ? 1400 : 700);
    };
    tl = SCENE_FX[i]();
    tl.eventCallback('onComplete', () => { tl = null; animDone = true; maybeNext(); });
    setTimeout(() => narrate(i, () => { voiceDone = true; maybeNext(); }), 250);
  }
  function finish() {
    if (!playing) return;
    playing = false; clearTimeout(auto); if (tl) tl.kill();
    if (voice) { voice.onended = voice.onerror = null; voice.pause(); voice = null; }
    gsap.ticker.remove(seaTick); clearInterval(bubbleT); AU.stopVoice();
    U_.store.set('storySeen', true);
    gsap.to(root, { opacity: 0, duration: 0.6, ease: 'power1.in', onComplete: () => { root.className = 'screen'; root.innerHTML = ''; gsap.set(root, { opacity: 1 }); const cb = onDone; onDone = null; if (cb) cb(); } });
  }

  SB.story = {
    get seen() { return !!U_.store.get('storySeen', false); },
    /** Play the story, then call done (e.g. start level 1). */
    play(done) {
      onDone = done; playing = true; scene = -1;
      SB.screens.current = 'story'; document.body.dataset.screen = 'story';
      ['screen-title', 'screen-map', 'screen-intro', 'screen-results', 'screen-pause'].forEach(id => $(id) && $(id).classList.remove('open'));
      AU.stopVoice(); AU.engine(0);
      build();
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.5 });
      // the sea breathes while the story plays; bubbles rise whenever we are under water
      const t0 = performance.now();
      seaTick = () => {
        const t = (performance.now() - t0) / 1000, band = (base, a1, l1, w1, a2, l2, w2) => {
          let d = 'M0 150'; for (let x = 0; x <= W; x += 24) d += `L${x} ${(base + a1 * Math.sin(x / l1 + t * w1) + a2 * Math.sin(x / l2 - t * w2)).toFixed(1)}`;
          return d + `L${W} 150Z`;
        };
        const front = band(40, 7, 230, 1.2, 3, 90, 1.9), back = band(30, 5, 310, 0.8, 2, 120, 1.3);
        const fb = $('st-sea-front'); if (!fb) return;
        $('st-sea-back').setAttribute('d', back); fb.setAttribute('d', front);
        $('st-sea-crest').setAttribute('d', front.replace(/^M0 150L/, 'M').replace(/L\d+ 150Z$/, ''));
      };
      gsap.ticker.add(seaTick);
      bubbleT = setInterval(() => {
        if (!cam || cam.h > -0.4) return;
        const b = el('i', 'st-bubble'), s = 8 + Math.random() * 16;
        Object.assign(b.style, { left: Math.random() * W + 'px', top: yOf(cam.h) + H * (0.2 + Math.random() * 0.3) + 'px', width: s + 'px', height: s + 'px' });
        $('st-bubbles').appendChild(b); setTimeout(() => b.remove(), 3000);
      }, 140);
      setTimeout(() => show(0), 350);
    }
  };
})(window.SB);
