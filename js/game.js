/* Sky Balloon — game state, the integer actions, token physics, gates and scoring. */
(function (SB) {
  'use strict';
  const W_ = SB.world, U = W_.U, U_ = SB.util, AU = SB.audio;
  const { br, fmt } = U_;
  const MAX_B = 12, MAX_S = 10, V = 190, GAP = 1300;

  const S = SB.state = {
    level: null, ship: { x: 0, y: 0, vy: 0, vx: 0, tilt: 0 }, tokens: [], gates: [],
    particles: [], particlesBack: [], free: [],
    pose: 'steer', dt: 0, t: 0, moves: 0, tries: 0, gi: 0, phase: 'idle', crate: { b: 0, s: 0, pair: false },
    holdT: 0, gullsLeft: [], demo: false, coins: 0, dented: false
  };
  const net = () => S.tokens.reduce((n, k) => n + (k.attached && !k.deco ? (k.type === 'b' ? 1 : -1) : 0), 0);   // deco: arrival-scene balloons, not counted
  const attached = type => S.tokens.filter(k => k.attached && k.type === type);
  SB.game = { net, attached };

  /* ---------- rest positions on the ship ---------- */
  function relayout() {
    const { rimY, bottomY } = W_.ship;
    const bs = attached('b'), ss = attached('s');
    const ROWB = [5, 4, 3];
    let i = 0;
    for (let r = 0; r < ROWB.length && i < bs.length; r++) {
      const n = Math.min(ROWB[r], bs.length - i);
      for (let j = 0; j < n; j++, i++) {
        const k = bs[i];
        k.rx = (j - (n - 1) / 2) * 52 + 8 + (r % 2) * 14;
        k.ry = rimY - 96 - r * 52;
        k.ax = U_.clamp(k.rx * 0.55 + 10, -78, 82);
      }
    }
    ss.forEach((k, i) => {
      const row = i < 5 ? 0 : 1, n = row ? ss.length - 5 : Math.min(5, ss.length), j = row ? i - 5 : i;
      k.row = row;
      k.rx = (j - (n - 1) / 2) * 40 + (row ? 20 : 0);
      k.ry = bottomY - 2 + row * 52;
      k.ax = U_.clamp(k.rx, -64, 64);
    });
  }
  function makeToken(type, wx, wy) {
    return { type, attached: true, x: wx, y: wy, vx: 0, vy: 0, rx: 0, ry: 0, ax: 0, row: 0, scale: 1, alpha: 1, rot: 0, sqx: 1, sqy: 1, glow: false };
  }

  /* ---------- level setup ---------- */
  SB.game.load = function (lv, { demo = false } = {}) {
    S.level = lv; S.demo = demo; S.tokens = []; S.particles = []; S.particlesBack = []; S.free = [];
    S.moves = 0; S.tries = 0; S.gi = 0; S.coins = 0; S.phase = demo ? 'demo' : 'intro'; S.holdT = 0; S.pose = 'steer'; S.dented = false;
    S.planPending = null;
    const startH = lv.mode === 'plan' ? lv.startHeight : lv.start.b - lv.start.s;
    S.crate = lv.mode === 'plan' ? { b: 0, s: 0, pair: false } : { b: lv.crate.b, s: lv.crate.s, pair: !!lv.crate.pair };
    S.ship = { x: 0, y: -startH * U, vy: 0, vx: 0, tilt: 0 };
    const nb = lv.mode === 'plan' ? Math.max(0, startH) : lv.start.b, ns = lv.mode === 'plan' ? Math.max(0, -startH) : lv.start.s;
    for (let i = 0; i < nb; i++) S.tokens.push(makeToken('b', 0, 0));
    for (let i = 0; i < ns; i++) S.tokens.push(makeToken('s', 0, 0));
    relayout(); S.tokens.forEach(k => { k.x = S.ship.x + k.rx; k.y = S.ship.y + k.ry; });
    S.gates = (lv.gates || []).map((h, i, a) => ({ h, x: 1000 + i * GAP, passed: false, active: i === 0, last: i === a.length - 1, coin: true, coinTaken: false }));
    S.gullsLeft = (lv.gulls || []).slice();
    S.segStart = startH;
    W_.buildDecor(lv, (S.gates.length ? S.gates[S.gates.length - 1].x : 3000) + 900);
    W_.cam.x = S.ship.x; W_.cam.y = S.ship.y;
    restPose();
    if (!demo) SB.hud.onLoad(lv);
  };
  /* ---------- level 1 arrival, shot like a film opening ----------
     establishing shot as the airship sails in high with five balloons (title over the sky) → it lets them go one by one →
     the camera pushes in → slow-motion splashdown at sea level (0) → the pilot waves → pull back to the play view. */
  SB.game.arrival = function (done, lv = S.level) {
    const sh = S.ship, ship0 = { x: sh.x, y: sh.y }, cine = W_.cine, fx = [];
    S.scripted = true; S._px = S._py = null; S.pose = 'steer'; S.timeScale = 1;
    for (let i = 0; i < 5; i++) { const k = makeToken('b', 0, 0); k.deco = true; S.tokens.push(k); }
    relayout();
    sh.x = ship0.x - 1500; sh.y = -4.5 * U;
    S.tokens.forEach(k => { k.x = sh.x + k.rx; k.y = sh.y + k.ry; });
    W_.cam.x = sh.x + 60; W_.cam.y = sh.y; cine.z = 1.12;
    const title = document.getElementById('cut-title');
    title.querySelector('b').textContent = lv.world; title.querySelector('small').textContent = `Level ${lv.id} · ${lv.name}`;
    document.body.classList.add('cutscene');
    AU.play('whoosh');
    const tl = S._arrival = gsap.timeline({ onComplete: finish });
    // 1. establishing shot: sail in high while the camera eases back
    tl.to(cine, { z: 1, duration: 2.6, ease: 'sine.out' }, 0)
      .to(sh, { x: ship0.x - 260, duration: 2.6, ease: 'power1.inOut' }, 0)
      .to(sh, { y: -1.4 * U, duration: 2.6, ease: 'sine.inOut' }, 0)
      .fromTo(title, { opacity: 0, y: 24, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power2.out' }, 0.45)
      .add(() => AU.play('star'), 0.6)
      .to(title, { opacity: 0, y: -16, duration: 0.6, ease: 'power1.in' }, 2.15)
      .add(() => { S.pose = 'pull-rope'; }, 1.9);
    // 2. let the balloons go, one by one
    for (let i = 0; i < 5; i++) tl.add(() => { const k = S.tokens.find(t => t.deco); if (k) { release(k); AU.play('release'); } }, 2.1 + i * 0.22);
    // 3. push in and come down to the sea; slow motion for the splash
    tl.to(cine, { z: 1.34, duration: 1.3, ease: 'power2.inOut' }, 2.5)
      .to(sh, { x: ship0.x, duration: 1.3, ease: 'power2.out' }, 2.6)
      .to(sh, { y: ship0.y, duration: 1.0, ease: 'power2.in' }, 2.7)
      .add(() => {
        fx.push(gsap.to(tl, { timeScale: 0.32, duration: 0.12 }), gsap.to(S, { timeScale: 0.32, duration: 0.12 }));
        fx.push(gsap.to(tl, { timeScale: 1, duration: 0.6, delay: 0.55, ease: 'power1.in' }), gsap.to(S, { timeScale: 1, duration: 0.6, delay: 0.55, ease: 'power1.in' }));
      }, 3.55)
      .add(() => {
        splash(sh.x - 40); splash(sh.x + 50); W_.cam.shake = 9; S.pose = 'cheer';
      }, 3.7)
    // 4. a wave to the camera, then pull back to the play view
      .add(() => { S.pose = 'wave'; }, 4.4)
      .to(cine, { z: 1, duration: 1.1, ease: 'power2.inOut' }, 4.75)
      .to({}, { duration: 0.15 });
    function finish() {
      fx.forEach(t => t.kill()); S.timeScale = 1; cine.z = 1; gsap.set(title, { opacity: 0 });
      S.tokens = S.tokens.filter(k => !k.deco); relayout();
      S.scripted = false; S._arrival = null; sh.x = ship0.x; sh.y = ship0.y; sh.vx = 0; sh.vy = 140;   // a little bob after landing
      document.body.classList.remove('cutscene'); setTimeout(restPose, 600);
      done();
    }
  };
  SB.game.skipArrival = () => { if (S._arrival) { S._arrival.timeScale(1); S._arrival.progress(1); } };
  SB.game.begin = () => { if (S.phase === 'intro') { S.phase = 'fly'; AU.play('whoosh'); } };

  /* ---------- the integer actions ---------- */
  const canAct = () => S.phase === 'fly' || S.phase === 'hold';
  function after(before, opTxt, note, opVal) {
    SB.hud.equation(before, opTxt, net(), note, opVal);
    S.holdT = 0;
  }
  function spawnPoint(src, type) {
    if (src) return src;
    const p = SB.hud.podPoint(type);
    return W_.toWorld(p.x, p.y);
  }
  function pairFx(type) {     // the new token met an opposite one: (+1) + (−1) = 0
    const opp = type === 'b' ? attached('s').length : attached('b').length;
    const same = (type === 'b' ? attached('b').length : attached('s').length) - 1;
    if (opp <= same || S.level.id < 2) return;
    const x = S.ship.x + 170, y = S.ship.y - 40;
    S.particles.push({ kind: 'img', key: 'fx/zero-pair/pair-link', x, y, w: 120, age: 0, life: 1.4, fade: true, vy: -22 });
    S.particles.push({ kind: 'text', text: '(+1) + (−1) = 0', color: '#ffd65a', x, y: y - 56, vy: -26, age: 0, life: 1.6, fade: true, size: 30 });
    AU.play('pair');
  }
  const ACT = SB.game.actions = {
    addBalloon(src) {
      if (!canAct()) return false;
      if (S.crate.b <= 0) return SB.hud.deny('b', 'No balloons left in the crate.');
      if (attached('b').length >= MAX_B && !cancelOnePair()) return SB.hud.deny('b', 'All the balloon ropes are full!');
      const before = net(), p = spawnPoint(src, 'b'), k = makeToken('b', p.x, p.y);
      k.scale = 0.35; gsap.to(k, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      S.tokens.push(k); relayout(); S.crate.b--; S.moves++;
      AU.play('inflate'); flashPose('pull-rope');
      after(before, '+', 'Added a balloon', 1); pairFx('b');
      return true;
    },
    addSandbag(src) {
      if (!canAct()) return false;
      if (S.crate.s <= 0) return SB.hud.deny('s', 'No sandbags left in the crate.');
      if (attached('s').length >= MAX_S && !cancelOnePair()) return SB.hud.deny('s', 'All the hooks are full!');
      const before = net(), p = spawnPoint(src, 's'), k = makeToken('s', p.x, p.y);
      k.scale = 0.5; gsap.to(k, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      S.tokens.push(k); relayout(); S.crate.s--; S.moves++;
      AU.play('hook'); flashPose('scared');
      after(before, '+', 'Added a sandbag', -1); pairFx('s');
      return true;
    },
    takeBalloon(k) {
      if (!canAct()) return false;
      const list = attached('b');
      if (!list.length) return SB.hud.deny('tb', S.crate.pair ? 'No balloon to take away. Add a zero pair first!' : 'There is no balloon to take away.');
      k = k && k.attached ? k : list[list.length - 1];
      const before = net();
      release(k); S.moves++;
      AU.play('release'); flashPose('scared');
      after(before, '−', 'Took away a balloon', 1);
      return true;
    },
    takeSandbag(k) {
      if (!canAct()) return false;
      const list = attached('s');
      if (!list.length) return SB.hud.deny('ts', S.crate.pair ? 'No sandbag to take away. Add a zero pair first!' : 'There is no sandbag to take away.');
      k = k && k.attached ? k : list[list.length - 1];
      const before = net();
      release(k); S.moves++;
      AU.play('drop'); flashPose('cheer');
      after(before, '−', 'Took away a sandbag', -1);
      return true;
    },
    addPair(src) {
      if (!canAct() || !S.crate.pair) return false;
      if (attached('b').length >= MAX_B || attached('s').length >= MAX_S) return SB.hud.deny('pair', 'The ship is full!');
      const before = net(), p = spawnPoint(src, 'pair');
      const b = makeToken('b', p.x, p.y), s = makeToken('s', p.x + 30, p.y + 40);
      b.glow = s.glow = true; setTimeout(() => { b.glow = s.glow = false; }, 1500);
      b.scale = s.scale = 0.4; gsap.to([b, s], { scale: 1, duration: 0.5, ease: 'back.out(3)' });
      S.tokens.push(b, s); relayout(); S.moves++;
      AU.play('pair');
      SB.hud.equation(before, '+', net(), 'Added a zero pair: it adds 0', 0, true);
      S.particles.push({ kind: 'img', key: 'fx/zero-pair/zero-ring', x: S.ship.x + 150, y: S.ship.y - 30, w: 90, grow: 0.6, age: 0, life: 0.9, fade: true });
      return true;
    }
  };
  /** Detach a token: balloons float away, sandbags fall (and splash if they hit the sea). */
  function release(k) {
    S.tokens.splice(S.tokens.indexOf(k), 1); relayout();
    const p = { kind: 'token', type: k.type, x: k.x, y: k.y, vx: S.ship.vx * 0.3, vy: k.type === 'b' ? -60 : 40, rot: k.rot, age: 0, life: 3, fade: false };
    p.update = dt => {
      if (p.type === 'b') { p.vy -= 240 * dt; p.x += Math.sin(p.age * 3) * 50 * dt; p.rot = Math.sin(p.age * 2.4) * 0.3; p.alpha = U_.clamp(2.6 - p.age, 0, 1); }
      else {
        const above = p.y < 0;
        p.vy += (p.y > 0 ? 160 : 1300) * dt; if (p.y > 0) p.vy *= 0.96; p.rot += dt * (p.y > 0 ? 0.4 : 2);
        if (above && p.y + p.vy * dt >= 0) splash(p.x);
        p.alpha = U_.clamp(3 - p.age, 0, 1);
      }
    };
    S.free.push(p);
    S.particles.push({ kind: 'img', key: 'fx/flight/cloud-puff', x: k.x + 10, y: k.y, w: 70, grow: 0.5, age: 0, life: 0.6, fade: true });
  }
  function cancelOnePair() {   // makes room on the ship; the height stays the same: (+1) + (−1) = 0
    const b = attached('b')[0], s = attached('s')[0];
    if (!b || !s) return false;
    [b, s].forEach(k => S.tokens.splice(S.tokens.indexOf(k), 1)); relayout();
    S.particles.push({ kind: 'frames', keys: ['fx/zero-pair/pair-merge-1', 'fx/zero-pair/pair-merge-2', 'fx/zero-pair/pair-merge-3'], fps: 6, x: S.ship.x + 170, y: S.ship.y - 20, w: 150, age: 0, life: 0.5 });
    S.particles.push({ kind: 'text', text: '(+1) + (−1) = 0', color: '#ffd65a', x: S.ship.x + 170, y: S.ship.y - 100, vy: -30, age: 0, life: 1.6, fade: true, size: 30 });
    AU.play('pair');
    return true;
  }
  function tidyPairs() { const n = Math.min(attached('b').length, attached('s').length); for (let i = 0; i < n; i++) setTimeout(cancelOnePair, 200 + i * 220); }
  function restPose() { S.pose = S.ship.y > 10 ? 'dive' : 'steer'; }
  function flashPose(p) { S.pose = S.ship.y > 10 && p !== 'cheer' ? 'dive' : p; clearTimeout(S._poseT); S._poseT = setTimeout(restPose, 1100); }
  function splash(x) {
    S.particles.push({ kind: 'frames', keys: ['fx/flight/splash-1', 'fx/flight/splash-2', 'fx/flight/splash-3', 'fx/flight/splash-4'], fps: 11, x, y: 10, ay: 0.85, w: 130, age: 0, life: 0.38 });
    AU.play('splash');
  }
  SB.game.splash = splash;

  /* ---------- plan mode: choose the whole movement at once ---------- */
  SB.game.planMove = function (m) {
    if (!canAct() || S.planPending != null) return;
    const g = S.gates[S.gi]; if (!g) return;
    const before = net(); S.tries++;
    const type = m > 0 ? 'b' : 's';
    for (let i = 0; i < Math.abs(m); i++) setTimeout(() => {
      const p = spawnPoint(null, type), k = makeToken(type, p.x, p.y); k.scale = 0.4; gsap.to(k, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      S.tokens.push(k); relayout(); AU.play(type === 'b' ? 'inflate' : 'hook');
    }, i * 110);
    S.planPending = before + m; S.moves++; S.holdT = 0;
    SB.hud.equation(before, '+', before + m, 'Movement set', m);
  };

  /* ---------- main update ---------- */
  SB.game.update = function (dt) {
    S.dt = dt; S.t += dt;
    const sh = S.ship, n = net(), ty = -n * U;
    if (S.scripted) { sh.vy = (sh.y - (S._py ?? sh.y)) / dt; sh.vx = (sh.x - (S._px ?? sh.x)) / dt; S._py = sh.y; S._px = sh.x; }   // the arrival scene moves the ship
    else { sh.vy += ((ty - sh.y) * 20 - sh.vy * 6.5) * dt; sh.y += sh.vy * dt; }   // springy, balloon-like
    sh.tilt = U_.clamp(-sh.vy * 0.0006 + (sh.vx > 5 ? 0.025 : 0), -0.13, 0.13);
    const wasUnder = sh.underwater; sh.underwater = sh.y > 12;
    if (wasUnder !== undefined && wasUnder !== sh.underwater && !S.demo) { splash(sh.x); if (!S._poseT || S.pose === 'steer' || S.pose === 'dive') restPose(); }
    const g = S.gates[S.gi];
    let target = 0;
    if (S.phase === 'fly' || S.phase === 'hold') {
      if (!g) { target = V * 1.2; S.phase = 'fly'; }
      else {
        const holdX = g.x - 330, settled = Math.abs(sh.y - ty) < 8 && Math.abs(sh.vy) < 50;
        const ok = n === g.h && settled && S.planPending == null;
        if (ok) target = V * 1.15;
        else if (sh.x < holdX) target = Math.min(V, (holdX - sh.x) * 1.6 + 10);
        S.phase = !ok && sh.x >= holdX - 40 ? 'hold' : 'fly';
        if (sh.x >= g.x - 10) {
          if (n === g.h) passGate(g);
          else { sh.x = g.x - 60; sh.vx = -170; AU.play('bump'); W_.cam.shake = 14; S.dented = true; flashPose('scared'); }
        }
      }
    } else if (S.phase === 'demo') target = 70;
    if (!S.scripted) { sh.vx += (target - sh.vx) * Math.min(1, dt * 3); sh.x += sh.vx * dt; }
    if (S.phase === 'hold') { S.holdT += dt; if (S.holdT > 4 && S.pose === 'steer') S.pose = 'telescope'; if (S.holdT > 9) { S.holdT = -5; SB.hud.nudgeHint(); } }
    if (S.phase === 'hold' && g && !S.demo && S.level.mode !== 'plan') topUp(g);
    if (!S.demo && S.phase === 'fly' && !g && S.gates.length && sh.x > S.gates[S.gates.length - 1].x + 520) complete();
    if (S.gullsLeft.length && sh.x > S.gullsLeft[0] && (S.phase === 'fly' || S.phase === 'hold')) { S.gullsLeft.shift(); gullDrop(); }
    // tokens spring to their places on the ship
    S.tokens.forEach(k => {
      if (k.dragging) return;
      const tx = sh.x + k.rx, tyy = sh.y + k.ry;
      k.vx += ((tx - k.x) * 70 - k.vx * 11) * dt; k.vy += ((tyy - k.y) * 70 - k.vy * 11) * dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.rot = U_.clamp(-k.vx * 0.0015, -0.35, 0.35) + Math.sin(S.t * 1.7 + k.rx * 0.1) * (k.type === 'b' ? 0.05 : 0.035);
      if (k.type === 'b') { const st = U_.clamp(-k.vy * 0.0006, -0.12, 0.12); k.sqy = 1 + st; k.sqx = 1 - st * 0.6; }
    });
    if (sh.underwater && Math.random() < dt * 5) S.particles.push({ kind: 'img', key: 'fx/flight/bubble-trail', x: sh.x + U_.rnd(-90, 90), y: sh.y - 30, vy: -80, w: U_.rnd(16, 26), age: 0, life: 1.5, fade: true });
    if (!sh.underwater && sh.vx > 60 && Math.random() < dt * 2.5) S.particlesBack.push({ kind: 'img', key: 'fx/flight/cloud-puff', x: sh.x - 150, y: sh.y - 4, vx: -60, w: 44, grow: 0.8, age: 0, life: 0.9, fade: true, alpha: 0.7 });
    [S.particles, S.particlesBack, S.free].forEach(arr => arr.forEach(p => {
      p.age += dt; if (p.update) p.update(dt);
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    }));
    S.particles = S.particles.filter(p => p.age < p.life); S.particlesBack = S.particlesBack.filter(p => p.age < p.life); S.free = S.free.filter(p => p.age < p.life);
    // camera
    const look = g ? -g.h * U : sh.y;
    const cy = U_.lerp(sh.y, look, 0.32);
    W_.cam.x += (sh.x + 60 - W_.cam.x) * Math.min(1, dt * 4);
    W_.cam.y += (cy - W_.cam.y) * Math.min(1, dt * 2.6);
    W_.cam.shake = Math.max(0, W_.cam.shake - dt * 40);
    // plan mode check once the ship settles
    if (S.planPending != null && Math.abs(sh.y + S.planPending * U) < 10 && Math.abs(sh.vy) < 40 && net() === S.planPending) {
      const want = g && g.h;
      if (g && S.planPending !== want) SB.hud.planWrong(S.planPending, want);
      S.planPending = null;
    }
    if (!S.demo) SB.hud.frame();
  };

  /** Safety net: if the tokens left can no longer reach the gate (e.g. balloons were taken away and thrown out),
      put exactly the missing tokens back in the crate so the level can't get stuck. Going UP needs a balloon to add
      or a sandbag to take away; going DOWN needs a sandbag to add or a balloon to take away. */
  function topUp(g) {
    const d = g.h - net(); if (!d || S.crate.pair) return;
    const H = SB.hud, up = d > 0;
    const [addT, takeT, addK, takeK] = up ? ['addB', 'takeS', 'b', 's'] : ['addS', 'takeB', 's', 'b'];
    const have = () => (H.canUse(addT) ? S.crate[addK] : 0) + (H.canUse(takeT) ? attached(takeK).length : 0);
    let need = Math.abs(d) - have(); if (need <= 0) return;
    // just in time: a token on board we may not take away yet (e.g. too high in level 1) → unlock Take away now
    if (!H.canUse(takeT) && attached(takeK).length) { H.unlock(takeT); need = Math.abs(d) - have(); if (need <= 0) return; }
    if (!H.canUse(addT)) H.unlock(addT);
    S.crate[addK] += need;
    SB.hud.update();
    const what = need > 1 ? `${need} spare ${up ? 'balloons' : 'sandbags'}` : `a spare ${up ? 'balloon' : 'sandbag'}`;
    SB.hud.navSay(`We can't reach ${br(g.h)} with the tokens we have left. Here is ${what} for the crate!`, 'wave');
  }
  function passGate(g) {
    g.passed = true; g.active = false; g.coinTaken = true; S.gi++; S.coins++;
    const nx = S.gates[S.gi]; if (nx) nx.active = true;
    AU.play('gate'); setTimeout(() => AU.play('coin'), 120);
    S.pose = 'cheer'; clearTimeout(S._poseT); S._poseT = setTimeout(restPose, 1300);
    const gy = -g.h * U;
    S.particles.push({ kind: 'img', key: 'fx/flight/ring-flash', x: g.x, y: gy, w: 180, grow: 1.2, age: 0, life: 0.6, fade: true });
    for (let i = 0; i < 12; i++) S.particles.push({ kind: 'img', key: 'fx/flight/sparkle-burst', x: g.x, y: gy + U_.rnd(-60, 60), vx: U_.rnd(-220, 220), vy: U_.rnd(-220, 140), w: U_.rnd(22, 40), rot: U_.rnd(0, 3), age: 0, life: 0.9, fade: true });
    S.particles.push({ kind: 'img', key: 'world/pickups/shell-coin', x: g.x, y: gy, vy: -260, w: 56, age: 0, life: 0.8, fade: true });
    SB.hud.gatePassed(g, S.segStart);
    S.segStart = g.h;
    if (S.level.mode === 'plan') setTimeout(tidyPairs, 400);
  }
  function gullDrop() {
    if (attached('s').length >= MAX_S && !cancelOnePair()) return;
    AU.play('gull');
    const sh = S.ship, before = net();
    S.particles.push({ kind: 'img', key: 'world/obstacles/seagull-flock', x: sh.x - 700, y: sh.y - 380, vx: 640, w: 220, age: 0, life: 2.4 });
    setTimeout(() => {
      const k = makeToken('s', S.ship.x + 40, S.ship.y - 360); S.tokens.push(k); relayout();
      flashPose('scared');
      SB.hud.equation(before, '+', net(), 'A gull dropped a sandbag!', -1);
      SB.hud.navSay('A gull added a sandbag: + (−1). Fix our height!', 'alarm');
    }, 1000);
  }
  function complete() {
    S.phase = 'done';
    const lv = S.level, used = lv.mode === 'plan' ? S.tries : S.moves;
    const slack = lv.mode === 'plan' ? 2 : Math.max(3, Math.round(lv.par * 0.25));   // longer levels allow a few more extra moves for 2 stars
    const stars = used <= lv.par ? 3 : used <= lv.par + slack ? 2 : 1;
    const prog = U_.store.get('progress', {});
    prog[lv.id] = Math.max(prog[lv.id] || 0, stars); U_.store.set('progress', prog);
    AU.play('win'); S.pose = 'cheer';
    setTimeout(() => SB.screens.results(lv, stars), 600);
  }
  SB.game.hitToken = function (wx, wy) {
    for (let i = S.tokens.length - 1; i >= 0; i--) {
      const k = S.tokens[i]; if (!k.attached) continue;
      const cy = k.type === 'b' ? k.y - W_.ship.BH * 0.56 : k.y + W_.ship.SH * 0.62;
      if (Math.hypot(wx - k.x, wy - cy) < (k.type === 'b' ? 36 : 30)) return k;
    }
    return null;
  };
  SB.game.relayout = relayout;
})(window.SB);
