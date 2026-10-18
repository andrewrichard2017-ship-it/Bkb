// Bubble Odyssey: boot, the main loop, starting and ending games, saving progress and coins, turning game
// events into effects, sound and rumble, the player actions the HUD and controls call, and the floating
// bubbles behind the menus.
(() => {
  'use strict';
  const BB = window.BB, { clamp } = BB.math;
  const G = BB.main = { game: null, attract: true, paused: false, t: 0, fx: new BB.FX(), cfg: null };
  let canvas, last = 0;
  const decor = [];

  function boot() {
    canvas = document.getElementById('game');
    BB.render.init(canvas); BB.input.init(canvas); BB.menu.init();
    addEventListener('resize', () => BB.render.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.game && !G.attract && !G.paused && !G.online()) G.pause(); });
    G.backdrop(BB.highestWorld());
    for (let i = 0; i < 14; i++) decor.push(newDecor(true));
    document.getElementById('loading').style.display = 'none';
    requestAnimationFrame(loop);
  }
  G.online = () => !!(BB.net && BB.net.active && G.game && G.game.role);
  G.backdrop = w => { const world = BB.WORLDS[clamp(w, 0, 4)]; BB.bg.set(world.id); };
  BB.highestWorld = () => { let n = 1; while (n < BB.LEVEL_COUNT && (BB.save.stars[n] || 0) > 0) n++; return Math.floor((n - 1) / 10); };

  function loop(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000) || 0.016); last = ts; G.t += dt;
    BB.input.update(G.t, dt);
    BB.menu.update();
    const g = G.game;
    if (g && !G.attract) {
      if (!G.paused || G.online()) {
        g.update(dt);
        g.pushAnim = Math.max(0, (g.pushAnim || 0) - dt * 4);
        g.bossHurt = Math.max(0, (g.bossHurt || 0) - dt * 2.5);
        g.bossRoar = Math.max(0, (g.bossRoar || 0) - dt * 1.8);
        for (const s of g.shots) { if (s.power === 'fire') { G.fx.flame(s.x, s.y); G.fx.flame(s.x, s.y); } else if (Math.random() < 0.7) G.fx.trail(s.x, s.y, s.power ? '#ffffff' : (BB.PAL[s.color] || BB.PAL[0]).glow); }
        G.fx.update(dt);
      }
      if (BB.net) BB.net.tick(dt, g);
      BB.render.frame(g, G.fx, G.t, dt);
    } else drawAttract(dt);
    if (BB.input.toast) { BB.render.showToast(BB.input.toast); BB.input.toast = null; }
    requestAnimationFrame(loop);
  }

  // ---- the floating bubbles behind the menus ----
  function newDecor(anywhere) {
    const V = BB.view;
    return { x: Math.random() * V.W, y: anywhere ? Math.random() * V.H : V.H + 80, r: 9 + Math.random() * 24, v: 18 + Math.random() * 30, c: Math.floor(Math.random() * 6), ph: Math.random() * 6.3, k: Math.random() < 0.12 ? BB.K.CRIT : 0 };
  }
  function drawAttract(dt) {
    const ctx = BB.render.ctx(), V = BB.view;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.clearRect(0, 0, V.W, V.H);
    BB.bg.draw(ctx, dt);
    BB.sprites.build(48 * V.dpr, !!BB.settings.symbols);
    const P = BB.SPRITE_PAD;
    for (let i = 0; i < decor.length; i++) {
      const d = decor[i];
      d.y -= d.v * dt; if (d.y < -100) decor[i] = newDecor(false);
      const x = d.x + Math.sin(G.t * 0.8 + d.ph) * 14, s = d.r / 48;
      ctx.globalAlpha = 0.75;
      ctx.drawImage(BB.sprites.forCell({ c: d.c, k: d.k }, G.t, i), x - 48 * P * s, d.y - 48 * P * s, 96 * P * s, 96 * P * s);
    }
    ctx.globalAlpha = 1;
    V.dirty = true;
    BB.render.drawToastOnly(dt);
  }

  // ---- games ----
  G.start = cfg => {
    G.fx.clear();
    const game = new BB.Game(cfg);
    if (cfg.world !== undefined) game.spec.world = cfg.world;
    G.game = game; G.cfg = cfg; G.attract = false; G.paused = false;
    game.pushAnim = 0; game.bossHurt = 0; game.bossRoar = 0;
    game.on(onEvent);
    const world = BB.WORLDS[game.spec.world] || BB.WORLDS[0];
    BB.bg.set(world.id); BB.audio.music(world.id);
    BB.view.dirty = true;
    BB.menu.hide();
    if (cfg.mode === 'career' && !cfg.role && game.spec.tip) game.introT = 3.4;
    BB.ads.gameplay(true);
    return game;
  };
  G.quit = keepNet => {
    if (!keepNet && BB.net && BB.net.active) BB.net.leave();
    G.game = null; G.attract = true; G.paused = false; G.fx.clear(); BB.ads.gameplay(false);
    G.backdrop(BB.highestWorld()); BB.audio.music('title');
  };
  G.pause = () => { if (!G.game || G.attract || G.game.state === 'won' || G.game.state === 'lost') return; G.paused = true; BB.ads.gameplay(false); BB.menu.show('pause'); };
  G.resume = () => { G.paused = false; BB.ads.gameplay(true); BB.menu.hide(); };

  // ---- player actions (the controls and the HUD call these) ----
  const playable = () => G.game && !G.attract && !G.paused && !BB.menu.active;
  G.aim = (p, a) => { if (G.game) G.game.aim(p, a); };
  G.fire = p => { if (playable()) G.game.fire(p); };
  G.swap = p => { if (playable()) G.game.swap(p); };
  G.hudTap = id => {
    if (!G.game) return;
    if (id === 'pause') return G.paused ? G.resume() : G.pause();
    if (!playable()) return;
    if (id.startsWith('swap:')) { const p = G.game.players[+id.slice(5)]; if (p && !p.remote) G.game.swap(p); return; }
    if (id.startsWith('pw:')) G.usePower(id.slice(3));
  };
  G.usePower = k => {
    const g = G.game, p = g.players[0];
    if (g.coop || (g.state !== 'play' && g.state !== 'intro')) return;
    const inv = BB.save.inv, info = BB.POWER_INFO[k];
    if (p.power === k && p.powerFrom === 'inv') { g.arm(p, k); return; }   // put it back
    if (p.power && p.powerFrom === 'fever') { BB.render.showToast('Use your fever power-up first!'); return; }
    if (k === 'aim' && p.aimShots > 0) { BB.render.showToast('Laser Sight is already on'); return; }
    if (!inv[k]) {
      if (BB.save.coins < info.price) { BB.render.showToast(`A ${info.name} costs ${info.price} coins (you have ${BB.save.coins})`, '#ffb3c0'); BB.audio.sfx('back'); return; }
      BB.save.coins -= info.price; inv[k] = 1; BB.saveProgress();
      BB.render.showToast(`Bought a ${info.name} for ${info.price} coins`, '#ffe14f'); BB.audio.sfx('coin');
    }
    if (k === 'plus5') { inv.plus5--; BB.saveProgress(); g.addShots(5); return; }
    if (k === 'aim') { inv.aim--; BB.saveProgress(); p.aimShots = 10; BB.render.showToast('Laser Sight on for 10 shots', '#ff8a9a'); BB.audio.sfx('rainbow'); return; }
    g.arm(p, k);
  };
  G.cyclePower = () => {
    const g = G.game; if (!g || g.coop) return;
    const p = g.players[0], list = ['bomb', 'fire', 'rainbow', 'zap'];
    if (p.power && p.powerFrom === 'fever') return;
    const i = p.power ? list.indexOf(p.power) : -1;
    for (let j = i + 1; j < list.length; j++) if (BB.save.inv[list[j]] > 0) { g.arm(p, list[j]); return; }
    if (p.power) g.arm(p, p.power);
  };

  // ---- saving results ----
  G.record = r => {
    const S = BB.save;
    let coins = 0, newBest = false;
    if (r.mode === 'career') {
      const stars = r.coop ? S.coop : S.stars, best = r.coop ? S.coopBest : S.best, prev = stars[r.level] || 0;
      if (r.won) coins = 10 + 15 * Math.max(0, r.stars - prev) + (prev === 0 ? 20 : 0);
      if (r.score > (best[r.level] || 0) && r.won) { best[r.level] = r.score; newBest = true; }
      stars[r.level] = Math.max(prev, r.stars);
    } else {
      const key = r.coop ? 'endlessCoop' : 'endless';
      coins = Math.floor(r.score / 400);
      if (r.score > S[key]) { S[key] = r.score; newBest = true; }
    }
    S.coins += coins;
    BB.saveProgress();
    return { coins, newBest };
  };

  // ---- game events -> effects and sound ----
  const COMBO_WORDS = ['', '', 'NICE!', 'GREAT!', 'AWESOME!', 'AMAZING!', 'INCREDIBLE!', 'UNSTOPPABLE!'];
  let bounceT = 0;
  function onEvent(e, game) {
    const fx = G.fx, A = BB.audio, mine = e.p && !e.p.remote;
    switch (e.type) {
      case 'fire':
        A.sfx(e.shot.power === 'fire' ? 'fire' : 'shoot');
        if (mine) BB.input.rumble(0.15, 0.3, 40, e.p.slot);
        if (e.shot.fromInv && !game.coop && !e.net) { const k = e.shot.power; if (BB.save.inv[k] > 0) { BB.save.inv[k]--; BB.saveProgress(); } }
        break;
      case 'bounce': if (G.t - bounceT > 0.05) { bounceT = G.t; A.sfx('bounce'); } break;
      case 'swap': A.sfx('swap'); break;
      case 'arm': A.sfx(e.k ? 'confirm' : 'back'); break;
      case 'shots': fx.text(BB.WIDTH / 2, BB.LINE_Y - 2, `+${e.n} SHOTS`, { size: 1.6, col: '#7dff9a' }); A.sfx('coin'); break;
      case 'burn': for (const q of e.pops) { fx.pop(q.x, q.y, q.color, q.k); if (q.k === BB.K.CRIT) { fx.blip(q.x, q.y, q.color); A.sfx('free'); } } if (e.pops.length) A.sfx('pop', { n: Math.min(3, e.pops.length) }); break;
      case 'land': landFx(e, game); break;
      case 'push':
        game.pushAnim = 1; A.sfx('push');
        if (game.boss) { game.bossRoar = 1; A.sfx('roar'); }
        break;
      case 'fever': {
        const names = { bomb: 'BOMB', fire: 'FIREBALL', rainbow: 'RAINBOW', zap: 'LIGHTNING' };
        fx.banner('FEVER!', { sub: (game.coop ? e.p.name + ' gets a ' : 'Next shot: ') + names[e.power], col: '#ff7ac8', y: 13 });
        fx.sparkle(e.p.x, e.p.y, 16, '#ffe14f', 2);
        A.sfx('fever'); BB.input.rumble(0.4, 0.6, 160, e.p.slot);
        break;
      }
      case 'win':
        e.res.drops.forEach((d, i) => fx.drop(d, Math.min(1.2, d.r * 0.06 + Math.random() * 0.1)));
        if (e.res.drops.length) A.sfx('drop', { n: 8 });
        fx.banner(game.goal === 'boss' ? 'BOSS DEFEATED!' : game.goal === 'rescue' ? 'ALL FREE!' : 'CLEARED!', { col: '#7dff9a', life: 2.2, y: 11 });
        A.sfx('win'); BB.input.rumble(0.5, 0.8, 300);
        if (game.boss) { game.bossHurt = 1; for (let i = 0; i < 4; i++) fx.boom(6 + Math.random() * 10, -3 + Math.random() * 2); }
        break;
      case 'bonus':
        fx.text(e.p.x, e.p.y - 2.5, '+100', { size: 0.9, col: '#ffe14f' });
        fx.sparkle(2 + Math.random() * (BB.WIDTH - 4), 2 + Math.random() * 16, 10, BB.PAL[Math.floor(Math.random() * 6)].light, 2.4);
        A.sfx('bonus');
        break;
      case 'lose':
        fx.banner(e.reason === 'shots' ? 'OUT OF SHOTS' : 'TOO LOW!', { col: '#ff6a85', life: 2, y: 12 });
        A.sfx('lose'); BB.input.rumble(0.7, 0.4, 260);
        break;
      case 'revive': BB.ads.gameplay(true); fx.banner('KEEP GOING!', { col: '#7dff9a', life: 1.2 }); A.sfx('confirm'); break;
      case 'over':
        BB.ads.gameplay(false);
        if (e.result.won && (e.result.stars === 3 || game.boss)) BB.ads.happy();
        setTimeout(() => { if (G.game === game) BB.menu.gameOver(e.result, game); }, e.result.won ? 600 : 1300); break;
    }
  }
  function landFx(e, game) {
    const fx = G.fx, A = BB.audio, res = e.res, lx = res.x, ly = res.y;
    const byDist = list => list.slice().sort((a, b) => Math.hypot(a.x - lx, a.y - ly) - Math.hypot(b.x - lx, b.y - ly));
    const burned = res.power === 'fire';
    if (!burned) byDist(res.pops).forEach((q, i) => {
      const d = Math.min(0.6, i * 0.022);
      fx.pop(q.x, q.y, q.color, q.k, d);
      if (q.k === BB.K.CRIT) { fx.blip(q.x, q.y, q.color); A.sfx('free', { delay: d }); }
    });
    for (const q of res.cracks) fx.crack(q.x, q.y);
    if (res.cracks.length) A.sfx('crack');
    for (const b of res.booms) if (!burned) fx.boom(b.x, b.y);
    if (res.booms.length) A.sfx('boom');
    if (res.zap) { for (const r of res.zap) if (r >= 0) fx.zap(game.board.y(r), 0.5, BB.WIDTH - 0.5); A.sfx('zap'); }
    if (res.star) { fx.sparkle(lx, ly, 24, '#ffe14f', 3); A.sfx('rainbow'); }
    if (res.power === 'rainbow' && res.pops.length) fx.sparkle(lx, ly, 14, '#ffffff', 2);
    byDist(res.drops).forEach((q, i) => { fx.drop(q, Math.min(0.3, i * 0.012)); if (q.k === BB.K.CRIT) { fx.blip(q.x, q.y, q.color); A.sfx('free', { delay: 0.1 }); } });
    if (res.pops.length && !burned) A.sfx('pop', { n: res.pops.length, combo: e.combo });
    if (res.drops.length) A.sfx('drop', { n: res.drops.length });
    if (!res.pops.length && !res.drops.length && !res.cracks.length) A.sfx('stick');
    if (e.pts > 0) fx.text(lx, ly - 1, '+' + BB.fmt(e.pts), { size: e.pts >= 500 ? 1.5 : 1.05, col: e.mult > 1 ? '#ffe14f' : '#ffffff' });
    if (e.combo >= 2 && (res.pops.length || res.drops.length)) {
      fx.text(lx, ly + 0.6, `COMBO x${e.mult}`, { size: 0.8, col: '#9fe8ff', vy: -1.4 });
      if (e.combo >= 3) fx.banner(COMBO_WORDS[Math.min(e.combo, COMBO_WORDS.length - 1)], { col: '#ffe14f', life: 1.1, size: 2.2 });
      A.sfx('combo', { n: e.combo });
    }
    if (res.drops.length >= 8) fx.banner('AVALANCHE!', { col: '#9fe8ff', life: 1.3, size: 2.4, y: 14 });
    if (res.freed) { fx.text(lx, ly - 2.2, res.freed > 1 ? `${res.freed} BLIPS FREE!` : 'BLIP FREE!', { size: 1.0, col: '#ffb3e6' }); }
    if (game.boss && e.dmg > 0) {
      game.bossHurt = 1; A.sfx('bossHit', { delay: 0.3 });
      for (const q of res.pops.concat(res.drops).slice(0, 14)) fx.orb(q.x, q.y, BB.WIDTH / 2 + (Math.random() - 0.5) * 6, -2.6, q.color >= 0 ? q.color : 2);
      fx.text(BB.WIDTH / 2 + 5.5, -3.2, '-' + e.dmg, { size: 1.3, col: '#ff6a85' });
    }
    const n = res.pops.length + res.drops.length;
    if (n && e.p && !e.p.remote) BB.input.rumble(Math.min(1, n / 12), Math.min(1, n / 8), 60 + n * 6, e.p.slot);
    if (res.booms.length) BB.input.rumble(1, 1, 220, e.p ? e.p.slot : 0);
    if (game.board.lowest() >= game.board.limit - 2 && game.state === 'play') A.sfx('warn');
  }

  addEventListener('load', boot);
})();
