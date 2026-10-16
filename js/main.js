/* Sky Balloon — boot, game loop, drag & drop input. */
(function (SB) {
  'use strict';
  const $ = id => document.getElementById(id);
  const W_ = SB.world, S = SB.state, L = SB.layout;
  const playing = () => SB.screens.current === 'play' && (S.phase === 'fly' || S.phase === 'hold');
  const shown = id => { const b = $(id); return !!b && b.offsetParent !== null; };

  /* pull a token off the ship = take it away */
  function worldDrag(e) {
    if (!playing() || S.level.mode === 'plan') return;
    const p = L.toStage(e), w = W_.toWorld(p.x, p.y), k = SB.game.hitToken(w.x, w.y);
    if (!k || !shown(k.type === 'b' ? 'btn-take-b' : 'btn-take-s')) return;    // only once Take away is unlocked
    SB.audio.unlock();
    k.dragging = true; const ox = w.x - k.x, oy = w.y - k.y;
    const move = ev => { const q = L.toStage(ev), ww = W_.toWorld(q.x, q.y); k.x = ww.x - ox; k.y = ww.y - oy; };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      k.dragging = false;
      const rx = S.ship.x + k.rx, ry = S.ship.y + k.ry;
      if (Math.hypot(k.x - rx, k.y - ry) > 110 && SB.game.actions[k.type === 'b' ? 'takeBalloon' : 'takeSandbag'](k)) SB.hud.used(k.type === 'b' ? 'takeB' : 'takeS');
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  async function boot() {
    L.init();
    await SB.assets.preload(p => { $('loader-bar').style.width = Math.round(p * 100) + '%'; });
    try { await Promise.race([document.fonts.load('700 40px Fredoka'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
    W_.init($('world'));
    L.onChange.push(() => W_.resize());
    SB.hud.init(); SB.screens.init();
    $('world').addEventListener('pointerdown', worldDrag);
    window.addEventListener('keydown', e => {
      if (SB.screens.current !== 'play') return;
      // keys press the on-screen buttons, so they follow the same unlocks
      const id = { ArrowUp: 'btn-add-b', ArrowDown: 'btn-add-s', KeyB: 'btn-take-b', KeyS: 'btn-take-s', KeyZ: 'pairbtn' }[e.code];
      if (id && shown(id)) $(id).onclick();
      if (e.code === 'Escape') $('btn-pause').click();
    });
    const speed = Math.max(1, +new URLSearchParams(location.search).get('speed') || 1);
    gsap.ticker.add((time, deltaMs) => {
      if (SB.screens.paused) return;
      const dt = Math.min(0.05, deltaMs / 1000) * (S.timeScale ?? 1);   // timeScale: slow motion in the arrival scene
      for (let i = 0; i < speed; i++) SB.game.update(dt);
      W_.draw(S, S.t);
    });
    gsap.to('#loader', { opacity: 0, duration: 0.45, onComplete: () => $('loader').remove() });
    const q = new URLSearchParams(location.search);
    if (q.has('level')) { SB.screens.intro(SB.LEVELS.find(l => l.id === +q.get('level')) || SB.LEVELS[0]); if (q.has('go')) { SB.game.skipArrival(); $('in-go').click(); } }
    else SB.screens.title();
  }
  window.addEventListener('DOMContentLoaded', () => boot().catch(err => {
    console.error(err);
    const l = $('loader'); if (l) l.querySelector('p').textContent = 'Something went wrong while loading. Please refresh.';
  }));
})(window.SB);
