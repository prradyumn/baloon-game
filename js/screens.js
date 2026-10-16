/* Sky Balloon — title, voyage map, level intro, results, pause. (Teaching happens in play: see SB.hud.coach.) */
(function (SB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = SB.assets, U_ = SB.util, AU = SB.audio, S = SB.state;
  const open = (id, on) => $(id).classList.toggle('open', on);
  const LV_ART = { 1: 'how-add-balloon', 2: 'how-add-sandbag', 3: 'how-add-sandbag', 5: 'how-remove-sandbag', 6: 'how-zero-pair', 7: 'how-zero-pair', 8: 'how-zero-pair' };

  const SC = SB.screens = {
    current: 'title', paused: false,
    title() {
      SC.current = 'title'; document.body.dataset.screen = 'title';
      ['screen-map', 'screen-results', 'screen-pause', 'screen-intro'].forEach(id => open(id, false));
      open('screen-title', true);
      SB.game.load({ id: 0, world: '', name: '', min: -6, max: 10, start: { b: 4, s: 1 }, crate: { b: 0, s: 0 }, gates: [], intro: [] }, { demo: true });
      gsap.killTweensOf(['#title-logo', '#title-tag', '#title-play', '.cast', '.cast img']);
      const tl = gsap.timeline();
      tl.fromTo('#title-logo', { y: -120, scale: 0.6, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(1.6)' })
        .fromTo('#cast-pilot', { y: 90, scale: 0.7, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)' }, '-=0.45')
        .fromTo('#title-tag', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4 }, '-=0.4')
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
      SB.LEVELS.forEach(l => {
        const locked = l.id > next && !unlockAll, done = !!prog[l.id], cur = l.id === next;
        const b = document.createElement('button');
        b.className = 'node' + (locked ? ' locked' : '') + (done ? ' done' : '') + (cur ? ' current' : '');
        b.style.left = (l.map[0] / 1920 * 100) + '%'; b.style.top = (l.map[1] / 1080 * 100) + '%';
        const art = locked ? 'node-locked' : done ? 'node-done' : cur ? 'node-current' : 'node-open';
        b.innerHTML = `<img src="${A.url('ui/map-and-results/' + art)}" alt=""><span class="nn">${locked ? '' : l.id}</span>` +
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
      if (l.id === 1 && !retry) SB.game.arrival(() => SC.introCard(l)); else SC.introCard(l);
    },
    introCard(l) {
      $('in-level').textContent = `Level ${l.id} · ${l.world}`;
      $('in-name').textContent = l.name;
      $('in-tip').innerHTML = l.intro.map(s => `<p>${s}</p>`).join('');
      const art = LV_ART[l.id];
      $('in-art').src = A.url(art ? 'ui/screens/' + art : 'characters/navigator-poses/nav-map');
      $('in-art').className = art ? '' : 'nav';
      open('screen-intro', true);
      gsap.fromTo('#in-card', { y: 60, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' });
      AU.say(l.intro.join(' ').replace(/\(\+1\)/g, 'positive 1').replace(/\(−1\)/g, 'negative 1').replace(/\(−(\d+)\)/g, 'negative $1').replace(/\(\+(\d+)\)/g, 'positive $1'));
      $('in-go').onclick = () => {
        AU.unlock(); AU.stopVoice();
        gsap.to('#in-card', { y: 40, opacity: 0, duration: 0.25, onComplete: () => open('screen-intro', false) });
        SB.game.begin();
        setTimeout(() => SB.hud.coachNew(l), 700);       // the gate plaque and number line show the target; new tools get the coach hand
      };
    },
    play(l) { SC.intro(l); },
    results(l, stars) {
      document.body.dataset.screen = 'results';
      $('res-title').textContent = stars === 3 ? 'Perfect flight!' : stars === 2 ? 'Great flying!' : 'You made it!';
      const used = l.mode === 'plan' ? S.tries : S.moves;
      $('res-moves').innerHTML = `${l.mode === 'plan' ? 'Tries' : 'Moves'} <b>${used}</b> <span>best ${l.par}</span> &nbsp;·&nbsp; Shells <b>${S.coins}</b>`;
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
      $('title-play').onclick = () => { AU.unlock(); AU.play('click'); Object.keys(U_.store.get('progress', {})).length ? SC.map() : SC.intro(SB.LEVELS[0]); };
      $('map-home').onclick = () => SC.title();
      $('res-next').onclick = () => SC.intro(SB.LEVELS.find(x => x.id === S.level.id + 1));
      $('res-retry').onclick = () => SC.intro(S.level);
      $('res-map').onclick = () => SC.map();
      $('cut-skip').onclick = () => SB.game.skipArrival();
      $('btn-pause').onclick = () => { if (SC.current !== 'play') return; SC.paused = true; gsap.globalTimeline.pause(); AU.stopVoice(); open('screen-pause', true); };
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
