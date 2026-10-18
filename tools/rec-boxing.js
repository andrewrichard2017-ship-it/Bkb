// Plays the boxing game for tools/record.js: the CPU fights both corners (the blue corner's AI drives the red
// corner too), straight into round 1 in the fight-night hall. Options in the URL: ?p1=michael&p2=bigjoe&hp=45&clean=1&zoom=2
// (hp: the blue corner's starting health, lower for an earlier knockdown).
(() => {
  const BK = window.BK, g = BK.game, R = window.__rec, q = new URLSearchParams(location.search);
  Object.assign(BK.settings, { player: q.get('p1') || 'michael', cpu: q.get('p2') || 'bigjoe', players: 1, difficulty: 2, rounds: 3, sound: false, arena: q.get('arena') || 'hall' });
  g.twoPlayer = false;
  g.isHuman = () => false;                            // red corner gets up on its own, no get-up minigame
  BK.input.draw = () => {};                           // no touch buttons in the footage
  if (q.get('clean')) for (const k of ['draw', 'banner', 'count']) BK.hud[k] = () => {};   // ?clean=1: no HUD, for cover art
  if (q.get('clean')) BK.fx.popup = () => {};
  // ?zoom=2: hold the camera in close on the fighters (cover art)
  if (q.get('zoom')) {
    const z = +q.get('zoom'), lift = +(q.get('lift') || 230);   // lift: how far above their feet to centre
    Object.defineProperty(BK.cam, 'tz', { get: () => z, set: () => {} });
    Object.defineProperty(BK.cam, 'ty', { get: () => (g.p1 ? (g.p1.sy + g.p2.sy) / 2 - lift : BK.H / 2), set: () => {} });
  }
  let ai1 = null, dt1 = 1 / 60;
  const setup = g.setupFighters;
  g.setupFighters = k => {
    setup(k); ai1 = new BK.AI(g.p1, g.p2);
    const o = g.ai.input.bind(g.ai); g.ai.input = d => { dt1 = d; return o(d); };
  };
  BK.input.player = () => (g.state === 'fight' && ai1 ? ai1.input(dt1) : { mx: 0, my: 0 });

  R.warm = 3.6;
  R.setup = async () => {
    await document.fonts.ready;
    for (let i = 0; i < 30; i++) window.__step(1000 / 30);
    g.toTape(); g.startFight(); g.beginRound();
    g.p2.hp = g.p2.ghostHp = +(q.get('hp') || 100);
  };
  R.tick = () => { if (g.state === 'corner') g.nextRound(); };
})();
