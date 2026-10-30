/* Sky Balloon — title, voyage map, level intro, results, pause. (Teaching happens in play: see SB.hud.coach.) */
(function (SB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = SB.assets, U_ = SB.util, AU = SB.audio, S = SB.state;
  const open = (id, on) => $(id).classList.toggle('open', on);
  const LV_ART = { 1: 'how-add-balloon', 2: 'how-add-sandbag', 3: 'how-add-sandbag', 5: 'how-remove-sandbag', 6: 'how-zero-pair', 7: 'how-zero-pair', 8: 'how-zero-pair' };

  const introSpeech = l => l.intro.join(' ').replace(/\(\+1\)/g, 'positive 1').replace(/\(−1\)/g, 'negative 1').replace(/\(−(\d+)\)/g, 'negative $1').replace(/\(\+(\d+)\)/g, 'positive $1');

  const SC = SB.screens = {
    current: 'title', paused: false,
    title() {
      SC.current = 'title'; document.body.dataset.screen = 'title';
      ['screen-map', 'screen-results', 'screen-pause', 'screen-intro'].forEach(id => open(id, false));
      open('screen-title', true);
      SB.game.load({ id: 0, world: '', name: '', min: -6, max: 10, start: { b: 4, s: 1 }, crate: { b: 0, s: 0 }, gates: [], intro: [] }, { demo: true });
      gsap.killTweensOf(['#title-logo', '#title-play', '.cast', '.cast img']);
      const tl = gsap.timeline();
      tl.fromTo('#title-logo', { y: -120, scale: 0.6, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.6)' })
        .fromTo('#cast-pilot', { y: 90, scale: 0.7, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' }, '-=0.45')
        .fromTo('#title-play', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.4)' }, '-=0.2');
      gsap.to('#title-logo', { y: -10, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1 });
      // the pilot bobs gently and now and then cheers; the sea line breathes
      gsap.to('#cast-pilot img', { y: -14, rotation: -2, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.1 });
      castPoses(); titleSea();
    },
    map() {
      SC.current = 'map'; document.body.dataset.screen = 'map';
      ['screen-title', 'screen-results', 'screen-pause', 'screen-intro'].forEach(id => open(id, false));
      open('screen-map', true); AU.stopVoice();
      const prog = U_.store.get('progress', {}), box = $('map-nodes'); box.innerHTML = '';
      let next = 1; SB.LEVELS.forEach(l => { if (prog[l.id]) next = Math.max(next, l.id + 1); });
      const unlockAll = new URLSearchParams(location.search).has('unlock');
      mapScene(prog); mapSea();
      SB.LEVELS.forEach(l => {
        const locked = l.id > next && !unlockAll, done = !!prog[l.id], cur = l.id === next;
        const b = document.createElement('button');
        b.className = 'node' + (locked ? ' locked' : '') + (done ? ' done' : '') + (cur ? ' current' : '');
        b.style.left = (l.map[0] / 1920 * 100) + '%'; b.style.top = (l.map[1] / 1080 * 100) + '%';
        b.setAttribute('aria-label', locked ? `Level ${l.id}, locked` : `Level ${l.id}: ${l.name}`);
        b.innerHTML = `<span class="nb">${locked ? LOCK : `<span class="nn">${l.id}</span>`}</span>` +
          `<span class="ns">${[1, 2, 3].map(i => `<img src="${A.url(i <= (prog[l.id] || 0) ? 'world/pickups/star' : 'world/pickups/star-empty')}" alt="">`).join('')}</span>` +
          `<span class="nl">${l.name}</span>`;
        if (!locked) b.onclick = () => { AU.unlock(); AU.play('click'); SC.intro(l); };
        box.appendChild(b);
      });
      gsap.fromTo('#map-nodes .node', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(2.2)' });
      const cur = box.querySelector('.current');
      if (cur) gsap.to(cur, { y: -10, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      const sc = $('map-scroll');
      if (SB.layout.mode === 'port') { const lvl = SB.LEVELS.find(l => l.id === next) || SB.LEVELS[0]; sc.scrollLeft = Math.max(0, lvl.map[0] - 540); }
      else sc.scrollLeft = 0;
    },
    intro(l) {
      const retry = SC.current === 'play' && S.level && S.level.id === l.id;
      SC.current = 'play'; document.body.dataset.screen = 'play';
      ['screen-map', 'screen-results', 'screen-title'].forEach(id => open(id, false));
      SB.game.load(l);
      // level 1 opens with the airship arriving (not on a retry); the intro card follows the landing
      if (l.id === 1 && !retry) SB.game.arrival(() => SC.handoff(l)); else SC.introCard(l);
    },
    /** After the arrival scene: one continuous shot into play. The HUD builds in, the guide line draws to the gate,
        the intro is spoken (in place of the intro card), the ship sets off, then the coach hand shows the first tool. */
    handoff(l) {
      SB.hud.buildIn();
      SB.world.revealGuide(0.55);
      // the navigator reads the intro (voice only, no panel); the coach hand follows once it has been said (9 s at most)
      setTimeout(() => {
        let done = false; const coach = () => { if (!done) { done = true; clearTimeout(cap); setTimeout(() => SB.hud.coachNew(l), 500); } };
        const cap = setTimeout(coach, 9000);
        AU.say(introSpeech(l), { onEnd: coach });
      }, 450);
      setTimeout(() => SB.game.begin(), 1500);
    },
    introCard(l) {
      $('in-level').textContent = l.world === l.name ? `Level ${l.id}` : `Level ${l.id} · ${l.world}`;
      $('in-name').textContent = l.name;
      $('in-tip').innerHTML = l.intro.map(s => `<p>${s}</p>`).join('');
      const art = LV_ART[l.id];
      $('in-art').src = A.url(art ? 'ui/screens/' + art : 'characters/navigator-poses/nav-map');
      $('in-art').className = art ? '' : 'nav';
      open('screen-intro', true);
      gsap.fromTo('#in-card', { y: 60, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' });
      AU.say(introSpeech(l));
      $('in-go').onclick = () => {
        AU.unlock(); AU.stopVoice();
        gsap.to('#in-card', { y: 40, opacity: 0, duration: 0.25, onComplete: () => open('screen-intro', false) });
        SB.game.begin();
        setTimeout(() => SB.hud.coachNew(l), 700);       // the gate plaque and number line show the target; new tools get the coach hand
      };
    },
    play(l) { SC.intro(l); },
    results(l, stars) {
      document.body.dataset.screen = 'results'; SB.hud.quiet();
      $('res-title').textContent = stars === 3 ? 'Perfect flight!' : stars === 2 ? 'Great flying!' : 'You made it!';
      const used = l.mode === 'plan' ? S.tries : S.moves;
      $('res-moves').innerHTML = `${l.mode === 'plan' ? 'Tries' : 'Moves'} <b>${used}</b> <span>best ${l.par}</span>`;
      $('res-ncert').textContent = l.ncert;
      $('res-next').style.display = SB.LEVELS.find(x => x.id === l.id + 1) ? '' : 'none';
      $('res-stars').innerHTML = [1, 2, 3].map(i => `<img src="${A.url(i <= stars ? 'world/pickups/star' : 'world/pickups/star-empty')}" alt="">`).join('');
      open('screen-results', true);
      const tl = gsap.timeline();
      tl.fromTo('#res-card', { y: 80, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.7)' })
        .fromTo('#res-art', { scale: 0.6, rotation: -6 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' }, '-=0.3');
      $('res-stars').querySelectorAll('img').forEach((im, i) => {
        tl.fromTo(im, { scale: 0, rotation: -60 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(3)', onStart: () => i < stars && AU.play('star') }, '-=0.15');
      });
      confetti();
      AU.say(`${$('res-title').textContent} ${stars} star${stars > 1 ? 's' : ''}.`);
    },
    init() {
      // first time: straight into level 1, where the coach hand teaches by doing; afterwards the voyage map
      $('title-play').onclick = () => {
        AU.unlock(); AU.play('click');
        // Play always opens with the story, then carries on: the voyage map if they have played before, else level 1
        SB.story.play(() => Object.keys(U_.store.get('progress', {})).length ? SC.map() : SC.intro(SB.LEVELS[0]));
      };
      $('map-home').onclick = () => SC.title();
      $('res-next').onclick = () => SC.intro(SB.LEVELS.find(x => x.id === S.level.id + 1));
      $('res-retry').onclick = () => SC.intro(S.level);
      $('res-map').onclick = () => SC.map();
      $('cut-skip').onclick = () => SB.game.skipArrival();
      $('btn-pause').onclick = () => { if (SC.current !== 'play') return; SC.paused = true; gsap.globalTimeline.pause(); AU.stopVoice(); AU.engine(0); open('screen-pause', true); };
      $('pause-resume').onclick = () => { SC.paused = false; gsap.globalTimeline.resume(); open('screen-pause', false); };
      $('pause-restart').onclick = () => { $('pause-resume').onclick(); SC.intro(S.level); };
      $('pause-map').onclick = () => { $('pause-resume').onclick(); SC.map(); };
      $('btn-hint').onclick = () => { if (SC.current === 'play') SB.hud.hint(); };
      $('btn-sound').onclick = () => { $('btn-sound').textContent = AU.toggle() ? 'Sound: on' : 'Sound: off'; };
      document.querySelectorAll('.screen button').forEach(b => b.addEventListener('pointerdown', () => { AU.unlock(); AU.play('click'); }));
    }
  };

  /** Title pilot: waves most of the time, cheers briefly every few seconds. */
  let poseTimer = null;
  function castPoses() {
    clearTimeout(poseTimer);
    const pilot = $('cast-pilot').querySelector('img');
    const rest = () => { pilot.src = A.url('characters/pilot-poses/pilot-wave'); };
    rest();
    const tick = () => {
      if (SC.current !== 'title') return;
      pilot.src = A.url('characters/pilot-poses/pilot-cheer');
      gsap.fromTo(pilot.parentNode, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      setTimeout(rest, 900);
      poseTimer = setTimeout(tick, 3600);
    };
    poseTimer = setTimeout(tick, 2600);
  }
  /** The cover's sea line: two soft wave bands (svg 1920×260), moving slowly while the title is open. */
  let seaTick = null;
  function titleSea() {
    if (seaTick) gsap.ticker.remove(seaTick);
    const back = $('title-sea-back'), front = $('title-sea-front'), t0 = performance.now();
    const band = (base, a1, l1, w1, a2, l2, w2, t) => {
      let d = 'M0 260';
      for (let x = 0; x <= 1920; x += 24) d += `L${x} ${(base + a1 * Math.sin(x / l1 + t * w1) + a2 * Math.sin(x / l2 - t * w2)).toFixed(1)}`;
      return d + 'L1920 260Z';
    };
    seaTick = () => {
      if (SC.current !== 'title') { gsap.ticker.remove(seaTick); seaTick = null; return; }
      const t = (performance.now() - t0) / 1000;
      back.setAttribute('d', band(52, 7, 310, 0.35, 3, 120, 0.6, t));
      front.setAttribute('d', band(84, 9, 260, 0.5, 4, 97, 0.9, t));
    };
    seaTick(); gsap.ticker.add(seaTick);
  }

  /* ---------- voyage map: the play scene's sky and sea (svg 1920×1080), one island per level ---------- */
  const HORIZON = 300;
  const LOCK = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z"/></svg>';
  const cloud = (x, y, s, o, d) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><g class="mcl" style="animation-duration:${d}s;animation-delay:-${d / 3}s" fill="#fff">` +
    '<rect x="0" y="0" width="190" height="52" rx="26"/><circle cx="64" cy="4" r="36"/><circle cx="118" cy="12" r="28"/></g></g>';
  const palm = x => `<g transform="translate(${x} 2)"><path d="M0 0C6-40-4-78 14-116" stroke="#b47c46" stroke-width="11" fill="none" stroke-linecap="round"/>` +
    `<g transform="translate(14 -116)" fill="#3fb456">${[18, -30, -150, 162, -92].map(a => `<path transform="rotate(${a})" d="M0 0C18-24 50-24 70-4C46-12 22-10 0 0Z"/>`).join('')}` +
    '<circle cx="-5" cy="6" r="6" fill="#8a5a2b"/><circle cx="6" cy="8" r="6" fill="#9b6833"/></g></g>';
  const coral = (x, c) => `<path transform="translate(${x} 4)" d="M0 0V-34M0-16L-14-30M0-24L12-42" stroke="${c}" stroke-width="8" stroke-linecap="round" fill="none"/>`;
  const rock = (x, s, c = '#9aa7c6') => `<g transform="translate(${x} 6) scale(${s})"><path d="M-22 4C-24-16-6-28 8-24C24-20 26 0 20 6Z" fill="${c}"/><path d="M-10-16C-4-22 4-22 8-20" stroke="#fff" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
  const grass = '<path d="M-98 4C-92-26 92-28 100 2C82 20-80 22-98 4Z" fill="#79d063"/><path d="M-70-9C-40-23 30-23 62-13" stroke="#a6e98b" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>';
  const base = (edge, top) => `<ellipse cy="18" rx="176" ry="56" fill="#c4f6f8" opacity=".55"/><ellipse cy="18" rx="130" ry="40" fill="${edge}"/><ellipse cy="8" rx="130" ry="38" fill="${top}"/>`;
  const SAND = base('#e0b86c', '#f8e1a6');
  const ISLE = {
    'Sunny Shore': () => SAND + grass + palm(92) + rock(-108, .8),
    'Coral Isle': () => SAND + grass + coral(-104, '#ff7aa8') + coral(-82, '#ffa040') + coral(98, '#c46cf0') + rock(118, .7),
    'Storm Peaks': () => SAND + '<g transform="translate(110 6)"><path d="M-80 0L-12-150L18-108L40-134L92 0Z" fill="#8f9bc0"/><path d="M-12-150L18-108L40-134L92 0L8 0Z" fill="#6f7ba0" opacity=".55"/>' +
      '<path d="M-12-150L-36-94L-22-102L-10-86L6-104L18-108Z" fill="#fff"/></g>' + rock(-110, .9, '#8f9bc0') +
      '<g transform="translate(60 -178)" fill="#aab3c9"><rect x="0" y="0" width="120" height="36" rx="18"/><circle cx="42" cy="2" r="24"/><circle cx="78" cy="8" r="18"/>' +
      '<path d="M58 34L46 56H58L50 76L72 48H60L66 34Z" fill="#ffd34d"/></g>',
    'Lagoon Edge': () => SAND + grass + '<ellipse cx="-58" cy="0" rx="36" ry="11" fill="#6fdcea"/>' + palm(96) + rock(-118, .7),
    'Zero-Pair Lagoon': () => base('#e0b86c', '#f8e1a6') + '<ellipse cy="8" rx="96" ry="26" fill="#7fe3ee"/><ellipse cy="10" rx="96" ry="26" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>' +
      '<path d="M-130 8C-126-12-104-24-84-28L-96 8Z" fill="#79d063"/>' + palm(112),
    'Deep Trench': l => base('#2c3560', '#4b5687') + '<g transform="translate(96 6)"><path d="M-36 0L-14-124L8-62L22-96L48 0Z" fill="#3a4575"/><path d="M-14-124L-4-80L8-62Z" fill="#6876ad"/></g>' +
      '<circle cx="-40" cy="-2" r="6" fill="#7ff0ff"/><circle cx="-22" cy="4" r="4" fill="#7ff0ff" opacity=".8"/>' +
      (l.id === SB.LEVELS.length ? '<g transform="translate(-110 6)"><circle cy="-128" r="26" fill="#ffe27a" opacity=".45"/><path d="M-16 0L-11-110H11L16 0Z" fill="#fff"/>' +
        '<path d="M-14.5-30H14.5L13.4-56H-13.4ZM-12.2-82H12.2L11.3-104H-11.3Z" fill="#ef4f45"/><rect x="-14" y="-140" width="28" height="30" rx="4" fill="#ffd34d"/><path d="M-18-140H18L0-158Z" fill="#ef4f45"/></g>' : rock(-112, .9, '#3a4575'))
  };
  /** Draws the whole scene; called on every map visit so the route shows progress. */
  function mapScene(prog) {
    const L = SB.LEVELS, pt = l => ({ x: l.map[0], y: l.map[1] });
    // route: gentle waves along each row, a wide sweep where it turns back
    let route = '';
    for (let i = 0; i < L.length - 1; i++) {
      const a = pt(L[i]), b = pt(L[i + 1]), dy = i % 2 ? -46 : 46;
      const d = Math.abs(a.x - b.x) < 50 ? `M${a.x} ${a.y}C${a.x + 250} ${a.y} ${b.x + 250} ${b.y} ${b.x} ${b.y}`
        : `M${a.x} ${a.y}C${a.x + (b.x - a.x) / 3} ${a.y + dy} ${a.x + (b.x - a.x) * 2 / 3} ${b.y - dy} ${b.x} ${b.y}`;
      route += `<path d="${d}" stroke="${prog[L[i].id] ? '#ffd34d' : '#fff'}" stroke-opacity="${prog[L[i].id] ? 1 : .7}"/>`;
    }
    const isles = L.map(l => {
      const s = 0.86 + 0.14 * (l.map[1] - 520) / 340;   // nearer rows a touch bigger
      return `<g transform="translate(${l.map[0]} ${l.map[1] + 44}) scale(${s.toFixed(3)})">${(ISLE[l.world] || ISLE['Sunny Shore'])(l)}</g>`;
    }).join('');
    let glints = '';
    for (let i = 0; i < 22; i++) {
      const x = (i * 397 + 140) % 1880, y = HORIZON + 60 + ((i * 263) % 700);
      glints += `<path class="glint" style="animation-delay:-${(i * 0.37 % 3.2).toFixed(2)}s" transform="translate(${x} ${y})" d="M0 0q12-6 24 0t24 0"/>`;
    }
    $('map-scene').innerHTML =
      '<defs><linearGradient id="msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3ee"/><stop offset=".55" stop-color="#93cdf4"/><stop offset="1" stop-color="#eaf5e4"/></linearGradient>' +
      `<linearGradient id="msea" gradientUnits="userSpaceOnUse" x1="0" y1="${HORIZON}" x2="0" y2="1080"><stop offset="0" stop-color="#a6eef3"/><stop offset=".1" stop-color="#6ad8ea"/>` +
      '<stop offset=".5" stop-color="#34b0da"/><stop offset="1" stop-color="#1478b4"/></linearGradient></defs>' +
      `<rect width="1920" height="${HORIZON + 20}" fill="url(#msky)"/>` +
      cloud(150, 150, 1, .9, 46) + cloud(1210, 100, .7, .7, 58) + cloud(1440, 180, .9, .85, 50) + cloud(1700, 70, .6, .6, 40) +
      `<path d="M300 ${HORIZON + 4}C360 ${HORIZON - 22} 470 ${HORIZON - 22} 540 ${HORIZON + 4}ZM1420 ${HORIZON + 4}C1470 ${HORIZON - 16} 1560 ${HORIZON - 16} 1610 ${HORIZON + 4}Z" fill="#8fbfd6" opacity=".55"/>` +
      '<path id="map-wave" fill="url(#msea)"/><path id="map-crest" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/>' +
      `<g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".55">${glints}</g>` +
      `<g fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray=".1 30">${route}</g>` + isles;
  }
  /** The horizon breathes like the play sea while the map is open. */
  let mapTick = null;
  function mapSea() {
    if (mapTick) gsap.ticker.remove(mapTick);
    const body = $('map-wave'), crest = $('map-crest'), t0 = performance.now();
    mapTick = () => {
      if (SC.current !== 'map') { gsap.ticker.remove(mapTick); mapTick = null; return; }
      const t = (performance.now() - t0) / 1000;
      let d = '';
      for (let x = 0; x <= 1920; x += 24) d += `${x ? 'L' : 'M'}${x} ${(HORIZON + 6 * Math.sin(x / 260 + t * 0.6) + 3 * Math.sin(x / 97 - t * 1.1)).toFixed(1)}`;
      crest.setAttribute('d', d); body.setAttribute('d', d + 'L1920 1080L0 1080Z');
    };
    mapTick(); gsap.ticker.add(mapTick);
  }

  function confetti() {
    const box = $('confetti'); box.innerHTML = '';
    const keys = ['world/pickups/star', 'world/pickups/shell-coin', 'fx/flight/sparkle-burst', 'world/pickups/sky-gem'];
    const st = SB.layout.stage;
    for (let i = 0; i < 26; i++) {
      const im = document.createElement('img'); im.src = A.url(U_.pick(keys)); im.style.width = U_.rnd(26, 46) + 'px';
      box.appendChild(im);
      gsap.fromTo(im, { x: st.w / 2 + U_.rnd(-80, 80), y: st.h * 0.45, scale: 0.3, rotation: 0 },
        { x: '+=' + U_.rnd(-st.w * 0.45, st.w * 0.45), y: '+=' + U_.rnd(-st.h * 0.45, st.h * 0.1), scale: 1, rotation: U_.rnd(-360, 360), duration: U_.rnd(0.9, 1.5), ease: 'power3.out' });
      gsap.to(im, { opacity: 0, y: '+=200', duration: 1.2, delay: 1.3, ease: 'power1.in', onComplete: () => im.remove() });
    }
  }
})(window.SB);
