/* Sky Balloon — the cockpit HUD (deliberately minimal):
   altimeter number line (with the gap to the gate) · equation pill · the token buttons this level has unlocked ·
   navigator bubble (mistakes and asked-for hints only) · coach hand for new tools.
   Integers are always written the NCERT way: (+3), (−3), 0. */
(function (SB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = SB.assets, U_ = SB.util, AU = SB.audio, S = SB.state, W_ = SB.world;
  const { fmt, br } = U_;
  const NAV = { point: 'nav-point', think: 'nav-think', happy: 'nav-thumbs-up', alarm: 'nav-alarm', cheer: 'nav-cheer', shrug: 'nav-shrug', map: 'nav-map', wave: 'nav-wave' };
  let lv = null, planVal = 0, navTimer = null, relevant = {}, avail = {}, gapKey = '', coaching = null, coachQueue = [];
  const BTN = { addB: 'btn-add-b', addS: 'btn-add-s', takeB: 'btn-take-b', takeS: 'btn-take-s', pair: 'pairbtn' };
  const DIR = { addB: 1, takeB: -1, addS: -1, takeS: 1, pair: 0 };   // which way each tool moves the ship (for the preview)
  const COACH = {
    addB: 'Tap Add to add a balloon: + (+1) takes us UP!',
    addS: 'Tap Add to add a sandbag: + (−1) takes us DOWN!',
    takeB: 'Tap Take away to remove a balloon: − (+1) takes us DOWN!',
    takeS: 'Tap Take away to remove a sandbag: − (−1) takes us UP!',
    pair: 'Tap to add a zero pair: (+1) + (−1) = 0. Then take one away!'
  };

  const num = n => `<b class="n ${n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero'}">${br(n)}</b>`;
  const colorEq = txt => txt.replace(/\((\+\d+|−\d+)\)|(?<![\d)])\b0\b/g, m => num(m === '0' ? 0 : +m.slice(1, -1).replace('−', '-')));
  const speakable = t => t.replace(/<[^>]+>/g, '').replace(/\(\+(\d+)\)/g, 'positive $1').replace(/\(−(\d+)\)/g, 'negative $1').replace(/−/g, 'minus');

  const HUD = SB.hud = {
    init() {
      const act = (tool, fn) => () => { if (SB.game.actions[fn]()) HUD.used(tool); };
      $('btn-add-b').onclick = act('addB', 'addBalloon');
      $('btn-take-b').onclick = act('takeB', 'takeBalloon');
      $('btn-add-s').onclick = act('addS', 'addSandbag');
      $('btn-take-s').onclick = act('takeS', 'takeSandbag');
      $('pairbtn').onclick = act('pair', 'addPair');
      // hovering a tool previews where it takes the ship (the coach shows the same for a new tool)
      Object.entries(BTN).forEach(([t, id]) => {
        $(id).addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') HUD.preview(DIR[t]); });
        $(id).addEventListener('pointerleave', () => HUD.preview(coaching ? DIR[coaching] : 0));
      });
      $('plan-dec').onclick = () => { planVal--; renderPlan(); };
      $('plan-inc').onclick = () => { planVal++; renderPlan(); };
      $('plan-go').onclick = () => { if (planVal !== 0 || SB.game.net() === (S.gates[S.gi] || {}).h) SB.game.planMove(planVal); };
      $('nav').onclick = () => hideNav();
      document.querySelectorAll('#hud button').forEach(b => b.addEventListener('pointerdown', () => {
        AU.unlock(); AU.play('click');
        gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
      }));
    },
    onLoad(level) {
      lv = level; planVal = 0;
      // a button shows when its tool is unlocked (SB.TOOL_LEVEL) AND this level can use it; a crate top-up can reveal an Add button later
      const c0 = level.crate || {}, st = level.start || {}, plan = level.mode === 'plan';
      relevant = plan ? {} : { addB: c0.b > 0, addS: c0.s > 0, takeB: st.b > 0 || c0.b > 0 || !!c0.pair,
        takeS: st.s > 0 || c0.s > 0 || !!c0.pair || !!(level.gulls && level.gulls.length) };
      avail = {}; Object.entries(SB.TOOL_LEVEL).forEach(([t, from]) => { avail[t] = !plan && level.id >= from; });
      hideCoach(); coachQueue = []; gapKey = ''; $('alt-gap').innerHTML = '';
      document.body.classList.toggle('plan-mode', level.mode === 'plan');
      document.body.classList.toggle('pair-mode', !!(level.crate && level.crate.pair));
      buildAltimeter(level);
      const h0 = SB.game.net();
      $('eq-line').innerHTML = `<span class="eq-start">Start at height ${num(h0)}</span>`;
      HUD.update(); renderPlan(); hideNav(true);
    },
    update() {
      if (!lv) return;
      const n = SB.game.net(), c = S.crate;
      $('pod-b-count').textContent = '×' + c.b; $('pod-s-count').textContent = '×' + c.s;
      const hasB = SB.game.attached('b').length > 0, hasS = SB.game.attached('s').length > 0;
      setBtn('btn-add-b', c.b > 0, avail.addB && (relevant.addB || c.b > 0)); setBtn('btn-add-s', c.s > 0, avail.addS && (relevant.addS || c.s > 0));
      setBtn('btn-take-b', hasB, avail.takeB && (relevant.takeB || hasB)); setBtn('btn-take-s', hasS, avail.takeS && (relevant.takeS || hasS));
      ['b', 's'].forEach(t => {
        const add = !$(`btn-add-${t}`).hidden, take = !$(`btn-take-${t}`).hidden;
        $(`pod-${t}`).hidden = !add && !take;
        $(`pod-${t}-count`).hidden = !add;                       // the crate count only matters while you can add from it
        $(`pod-${t}`).classList.toggle('empty', add && c[t] <= 0);
      });
      $('dock').classList.toggle('solo', document.querySelectorAll('#dock .pod:not([hidden]) .op-btn:not([hidden])').length === 1);
    },
    frame() {
      if (!lv) return;
      const h = -S.ship.y / W_.U;
      $('alt-ship').style.transform = `translateY(${altY(h)}px)`;
      const g = S.gates[S.gi];
      $('alt-target').style.opacity = g ? 1 : 0;
      if (g) { $('alt-target').style.transform = `translateY(${altY(g.h)}px)`; $('alt-target-val').textContent = fmt(g.h); }
      // waiting at a gate at the wrong height: show the steps still to go, so they can be counted
      const n = SB.game.net(), gap = g && S.phase === 'hold' && n !== g.h && S.planPending == null;
      const key = gap ? n + '|' + g.h : '';
      if (key !== gapKey) { gapKey = key; drawGap(gap ? n : 0, gap ? g.h : 0); }
      if (coaching) placeCoach();
      const pv = $('alt-ghost');
      if (S.preview && g !== undefined) { pv.className = S.preview > 0 ? 'up show' : 'down show'; pv.style.transform = `translateY(${altY(n + S.preview)}px)`; }
      else pv.className = '';
    },
    /** Show which way the next move goes: +1 up, −1 down, 0 off (chevrons at the ship, a ghost on the number line). */
    preview(dir) { S.preview = dir || 0; },
    /** Is this tool unlocked in the current level? */
    canUse: t => !!avail[t],
    /** Unlock a tool early because the ship needs it now; the coach hand shows it. */
    unlock(t) { if (avail[t]) return; avail[t] = true; relevant[t] = true; HUD.update(); HUD.coach(t, true); },
    /** Coach the tools this level introduces (once per player), one after another. */
    coachNew(level) {
      const seen = U_.store.get('coached', {});
      coachQueue = Object.keys(SB.TOOL_LEVEL).filter(t => SB.TOOL_LEVEL[t] === level.id && avail[t] && !seen[t]);
      if (coachQueue.length) HUD.coach(coachQueue.shift());
    },
    /** Pointing hand + short caption over a tool's button, until the child uses it. */
    coach(t, force) {
      const b = $(BTN[t]); if (!b || (!force && b.offsetParent === null)) return;
      coaching = t; b.classList.add('is-new'); HUD.preview(DIR[t]);
      $('coach-tip').innerHTML = colorEq(COACH[t]);
      const c = $('coach'); c.classList.add('show'); placeCoach();
      gsap.fromTo(c, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' });
      AU.play('star'); AU.say(speakable(COACH[t]));
    },
    used(t) {
      if (coaching !== t) return;
      const seen = U_.store.get('coached', {}); seen[t] = true; U_.store.set('coached', seen);
      hideCoach();
      if (coachQueue.length) setTimeout(() => HUD.coach(coachQueue.shift()), 900);
    },
    /** Bring the HUD in piece by piece (after the arrival scene): number line, buttons, top buttons, equation. */
    buildIn() {
      const tl = gsap.timeline();
      tl.from('#altimeter', { x: -180, opacity: 0, duration: 0.55, ease: 'power3.out' })
        .from('#dock .pod:not([hidden])', { y: 170, opacity: 0, duration: 0.5, stagger: 0.09, ease: 'back.out(1.6)' }, 0.09)
        .from('#topbar > *', { y: -120, opacity: 0, duration: 0.45, stagger: 0.09, ease: 'back.out(1.8)' }, 0.18)
        .from('#eqbar .eq-pill', { y: 60, scale: 0.85, opacity: 0, duration: 0.45, ease: 'back.out(2)' }, 0.27);
    },
    /** Waited a while at a gate: invite a hint instead of giving one. */
    nudgeHint() { gsap.fromTo('#btn-hint', { scale: 1 }, { scale: 1.18, duration: 0.25, yoyo: true, repeat: 5, ease: 'sine.inOut' }); },
    /** The integer sentence for the last move, e.g. (+2) + (−1) = (+1). opVal is the token value moved. */
    equation(before, op, after, note, opVal, pair) {
      const rhs = pair ? `${num(1)} + ${num(-1)}` : (opVal === 0 ? '0' : num(opVal));
      $('eq-line').innerHTML = `${num(before)} <i class="op">${op}</i> ${pair ? '[' + rhs + ']' : rhs} <i class="op">=</i> ${num(after)} <span class="eq-note">${note}</span>`;
      gsap.fromTo('#eq-line > *', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.04, ease: 'back.out(2.5)' });
      HUD.update();
      clearTimeout(S._sayT);
      S._sayT = setTimeout(() => AU.say(`${speakable(br(before))} ${op === '+' ? 'plus' : 'minus'} ${pair ? 'zero' : speakable(br(opVal))} equals ${U_.words(after)}.`), 350);
    },
    gatePassed(g, start) {
      const m = g.h - start;
      $('eq-line').innerHTML = `${num(start)} <i class="op">+</i> ${num(m)} <i class="op">=</i> ${num(g.h)} <span class="eq-note">Start + Movement = Target</span>`;
      gsap.fromTo('#eq-line > *', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'back.out(2.5)' });
      HUD.toast(`${fmt(g.h)} ✓`);
      setTimeout(HUD.update, 900);
      // voice only: the equation pill already shows Start + Movement = Target
      AU.say(speakable(m === 0 ? 'Perfect! No movement needed.' : `Great! We moved ${br(m)} from ${br(start)} to ${br(g.h)}.`));
    },
    deny(which, msg) {
      const el = { b: 'btn-add-b', s: 'btn-add-s', tb: 'btn-take-b', ts: 'btn-take-s', pair: 'pairbtn' }[which];
      if (el) gsap.fromTo($(el), { x: -8 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.5, 0.3)' });
      AU.play('bump'); AU.say(speakable(msg)); return false;    // a shake and a voice line, no bubble
    },
    hint() {
      const g = S.gates[S.gi]; if (!g || !lv) return;
      const n = SB.game.net(), d = g.h - n, c = S.crate;
      const hasB = SB.game.attached('b').length, hasS = SB.game.attached('s').length;
      let msg;
      if (d === 0) msg = 'We are at the right height. Hold steady!';
      else if (lv.mode === 'plan') msg = `Movement needed = ${br(g.h)} − ${br(n)}. Count the steps on the height bar!`;
      else {
        const addB = c.b && avail.addB, addS = c.s && avail.addS, tkS = hasS && avail.takeS, tkB = hasB && avail.takeB;
        const ways = (d > 0
          ? [addB && 'add a balloon (+1)', tkS && 'take away a sandbag − (−1)', !addB && !tkS && c.pair && 'add a zero pair, then take away its sandbag']
          : [addS && 'add a sandbag (−1)', tkB && 'take away a balloon − (+1)', !addS && !tkB && c.pair && 'add a zero pair, then take away its balloon']).filter(Boolean);
        // no token can move us that way yet: the crate is topped up when we reach the gate (game.js topUp)
        msg = `Go ${d > 0 ? 'UP' : 'DOWN'} ${Math.abs(d)}` + (ways.length ? ': ' + ways.join(' or ') + '.' : '. We need spare tokens from the crate!');
      }
      HUD.navSay(msg, 'think');
    },
    planWrong(at, want) {
      HUD.navSay(`We are at ${br(at)}, but the gate is ${br(want)}. Movement needed = ${br(want)} − ${br(at)}. Try again!`, 'think');
      planVal = 0; renderPlan(); S.segStart = at; HUD.update();
    },
    navSay(text, pose = 'point', ms = 5200) {
      $('nav-text').innerHTML = colorEq(text);
      $('nav-img').src = A.url('characters/navigator-poses/' + (NAV[pose] || 'nav-point'));
      const nav = $('nav');
      document.body.classList.add('nav-on');
      if (!nav.classList.contains('show')) { nav.classList.add('show'); gsap.fromTo(nav, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' }); }
      else gsap.fromTo('#nav-bubble', { scale: 0.94 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
      clearTimeout(navTimer); navTimer = setTimeout(hideNav, ms);
      AU.say(speakable(text));
    },
    /** Clear the bubbles (the results card opens over a quiet scene). */
    quiet() { hideNav(true); hideCoach(); },
    toast(text) {
      const t = $('toast'); t.innerHTML = `<span>${colorEq(text)}</span>`;
      gsap.killTweensOf(t);
      gsap.timeline().fromTo(t, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' }).to(t, { opacity: 0, y: -30, duration: 0.35, delay: 0.7 }).set(t, { y: 0 });
    },
    /** stage-pixel point of the Add button (new tokens fly in from here) */
    podPoint(type) {
      const el = type === 'b' ? $('btn-add-b') : type === 's' ? $('btn-add-s') : $('pairbtn');
      const r = el.getBoundingClientRect(), st = $('stage').getBoundingClientRect(), k = SB.layout.scale;
      return { x: (r.left + r.width / 2 - st.left) / k, y: (r.top + r.height / 2 - st.top) / k };
    }
  };

  function setBtn(id, on, show = true) { const b = $(id); b.disabled = !on; b.hidden = !show; }
  function hideCoach() {
    if (coaching) { const b = $(BTN[coaching]); if (b) b.classList.remove('is-new'); }
    coaching = null; $('coach').classList.remove('show'); HUD.preview(0);
  }
  /** Hand points down onto the button from above (its fingertip is at 46,84 of the 96px icon); caption above the hand. */
  function placeCoach() {
    const b = $(BTN[coaching]); if (!b || b.offsetParent === null) return;
    const st = $('stage').getBoundingClientRect(), k = SB.layout.scale, r = b.getBoundingClientRect();
    const cx = (r.left + r.width / 2 - st.left) / k, top = (r.top - st.top) / k, imgH = (b.querySelector('img') || b).getBoundingClientRect().height / k;
    const hand = $('coach-hand'), tip = $('coach-tip'), W = SB.layout.stage.w;
    const handTop = top + imgH * 0.3 - 84;
    hand.style.left = (cx - 46) + 'px'; hand.style.top = handTop + 'px';
    const tw = tip.offsetWidth, tx = U_.clamp(cx - tw / 2, 20, W - tw - 20);
    tip.style.left = tx + 'px'; tip.style.top = (handTop - tip.offsetHeight - 26) + 'px';   // room for the hand's tap bounce
  }
  /* the steps still to go between the ship and the gate, drawn on the number line */
  function drawGap(n, target) {
    const box = $('alt-gap'); box.innerHTML = '';
    if (n === target) return;
    const dir = Math.sign(target - n);
    for (let h = n + dir; h !== target + dir; h += dir) {
      const i = document.createElement('i'); i.style.top = altY(h) + 'px'; i.style.animationDelay = (Math.abs(h - n) * 0.08) + 's'; box.appendChild(i);
    }
    if (lv.mode !== 'plan') {                 // in plan mode, working out the movement is the task
      const b = document.createElement('b'), d = target - n;
      b.className = d > 0 ? 'pos' : 'neg'; b.textContent = fmt(d); b.style.top = altY((n + target) / 2) + 'px'; box.appendChild(b);
    }
  }
  function hideNav(instant) {
    clearTimeout(navTimer); document.body.classList.remove('nav-on');
    const nav = $('nav'); if (!nav.classList.contains('show')) return;
    if (instant === true) { nav.classList.remove('show'); return; }
    gsap.to(nav, { opacity: 0, y: -14, duration: 0.25, onComplete: () => nav.classList.remove('show') });
  }
  function renderPlan() {
    $('plan-val').innerHTML = planVal === 0 ? '<b class="n zero">0</b>' : num(planVal);
    gsap.fromTo('#plan-val', { scale: 1.2 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
  }

  /* ---------- altimeter: the vertical number line ---------- */
  let range = { min: -4, max: 10 }, trackTop = 0, trackH = 600;
  function altY(h) { return trackTop + (range.max - U_.clamp(h, range.min - 0.4, range.max + 0.4)) / (range.max - range.min) * trackH; }
  function buildAltimeter(level) {
    range = { min: level.min, max: level.max };
    const el = $('altimeter'), H = el.clientHeight, inset = 34;   // room for the + / − caps (matches --tt in the CSS)
    trackTop = inset + 12; trackH = H - 2 * (inset + 12);
    el.style.setProperty('--tt', inset + 'px');
    el.style.setProperty('--zero', ((altY(0) - inset) / (H - 2 * inset) * 100).toFixed(1) + '%');   // the track turns from warm to cool at 0
    const box = $('alt-ticks'); box.innerHTML = '';
    const step = 2;                            // label every second step (0 is always labelled); the target has its own marker
    for (let h = level.max; h >= level.min; h--) {
      const t = document.createElement('div');
      t.className = 'tick' + (h === 0 ? ' zero' : h > 0 ? ' pos' : ' neg') + ((h % step) ? ' minor' : '');
      t.style.top = altY(h) + 'px';
      t.innerHTML = `<i></i><span>${fmt(h)}</span>`;
      box.appendChild(t);
    }
  }
  SB.layout.onChange.push((m, changed) => { if (changed && lv) buildAltimeter(lv); });
})(window.SB);
