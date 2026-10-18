// Tractor Tippin': the in-game HUD (DOM overlay, one panel per split-screen view): tips, Thrasher's noise
// meter, dents or the Tip-Off clock, boost, a "HONK!" prompt, the minimap and pop-up messages.
(() => {
  'use strict';
  const TT = window.TT, { clamp } = TT.math;
  const H = {};
  let root, panels = [], mapBg = null, mapT = 0;

  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const set = (P, k, v, fn) => { if (P.last[k] !== v) { P.last[k] = v; fn(v); } };

  H.init = () => { root = document.getElementById('hud'); };
  H.hide = () => { root.innerHTML = ''; panels = []; root.style.display = 'none'; TT.input.touch.enabled = false; document.getElementById('touch').classList.remove('show'); };
  H.setup = (views, game) => {
    root.innerHTML = ''; root.style.display = 'block'; panels = [];
    mapBg = drawMapBg(game);
    const story = game.mode === 'story', hunt = game.mode === 'hunt';
    for (const v of views) {
      const isTh = !!v.car.isThrasher, team = story || (hunt && !isTh);
      const p = el('div', 'view' + (isTh ? ' th' : '') + (team && !story ? ' both' : ''), root);
      const tl = el('div', 'tl', p);
      const tips = el('div', 'tips', tl, '<b>0</b><i></i>');
      el('label', '', tl, isTh ? 'CAUGHT' : team ? (game.humans > 1 || hunt ? 'TIPPED · TEAM' : 'TIPPED') : 'YOUR TIPS');
      const mine = el('div', 'mine', tl);
      const tc = el('div', 'thr', p, '<span></span><div><i></i></div><em></em>');
      const tr = el('div', 'tr', p);
      const dents = team ? el('div', 'dents', tr) : null;
      const clock = !story ? el('div', 'clock', tr) : null;
      const bl = el('div', 'bl', p);
      const boost = el('div', 'boost', bl, `<label>${isTh ? 'CHARGE' : 'BOOST'}</label><div><i></i></div>`);
      const prompt = el('div', 'prompt', p);
      const map = el('canvas', 'map', p);
      const exit = el('div', 'exit' + (isTh ? ' prey' : ''), p, '<b>▲</b><span>EXIT</span>');
      const msgs = el('div', 'msgs', p);
      const count = el('div', 'count', p);
      const who = game.humans > 1 ? el('div', 'who', p, isTh ? `${v.car.name} · THRASHER` : v.car.name) : null;
      if (who) who.style.color = isTh ? '#ff6a4a' : TT.PLAYER_COLORS[v.car.slot];
      const flash = el('div', 'hitflash', p);
      panels.push({ v, isTh, team, p, tips, tipsB: tips.querySelector('b'), tipsI: tips.querySelector('i'), mine, tc, tcI: tc.querySelector('i'), tcS: tc.querySelector('span'), tcE: tc.querySelector('em'), dents, clock, boost: boost.querySelector('i'), boostBox: boost, prompt, map, mctx: map.getContext('2d'), exit, exitB: exit.querySelector('b'), exitS: exit.querySelector('span'), msgs, count, flash, last: {} });
    }
    H.layout(views);
    const touch = TT.isTouch && !TT.input.padCount && views.length === 1;
    TT.input.touch.enabled = touch;
    document.getElementById('touch').classList.toggle('show', touch);
    const hb = document.querySelector('#touch [data-k=honk]');
    if (hb) hb.textContent = views.length === 1 && views[0].car.isThrasher ? 'ROAR' : 'HONK';
  };
  H.layout = views => {
    panels.forEach(P => {
      const R = P.v.rect;
      Object.assign(P.p.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
      P.p.classList.toggle('half', views.length > 1);
      const s = Math.round(clamp(Math.min(R.w, R.h) * 0.3, 90, 170)), d = devicePixelRatio || 1;
      P.map.style.width = P.map.style.height = s + 'px'; P.map.width = P.map.height = Math.round(s * d); P.mapS = s * d;
    });
  };
  const panelOf = i => panels.find(P => P.v.index === i);

  H.message = (i, text, o = {}) => {
    const P = panelOf(i); if (!P) return;
    const m = el('div', 'msg' + (o.big ? ' big' : ''), P.msgs, text);
    if (o.color) m.style.color = o.color;
    if (o.hold) m.style.animationDuration = (1.8 + o.hold) + 's';
    while (P.msgs.children.length > 3) P.msgs.firstChild.remove();
    setTimeout(() => m.remove(), (1.8 + (o.hold || 0)) * 1000);
  };
  H.all = (text, o) => panels.forEach(P => H.message(P.v.index, text, o));
  H.countdown = n => panels.forEach(P => { const c = P.count; c.textContent = n ? n : 'GO!'; c.className = 'count'; void c.offsetWidth; c.className = 'count show' + (n ? '' : ' go'); });
  H.hit = i => { const P = panelOf(i); if (!P) return; P.flash.className = 'hitflash'; void P.flash.offsetWidth; P.flash.className = 'hitflash go'; };

  function honkLabel(word = 'HONK') {
    const t = performance.now() / 1000;
    if (TT.input.padActive(t)) return `✕ ${word}!`;
    if (TT.input.touch.enabled) return `${word}!`;
    return `SPACE · ${word}!`;
  }
  const bump = P => { P.tips.classList.remove('bump'); void P.tips.offsetWidth; P.tips.classList.add('bump'); };
  // pointing arrow: rotate the ▲ towards (x, z) from where this view's camera faces
  const point = (P, from, x, z) => { const ang = Math.atan2(x - from.x, z - from.z) - P.v.camYaw; P.exitB.style.transform = `rotate(${(-ang * 180 / Math.PI).toFixed(1)}deg)`; };

  // the HUD for whoever's driving Thrasher (Thrasher Hunt)
  function thrasherPanel(P, game, th) {
    const caught = game.players.filter(p => p.caught).length, loose = game.players.filter(p => p.active);
    set(P, 'tips', caught, x => { P.tipsB.textContent = x; bump(P); });
    set(P, 'goal', '/' + game.players.length, x => { P.tipsI.textContent = x; });
    const got = game.players.filter(p => p.escaped).length;
    set(P, 'mine', got ? `${got} got away!` : `${loose.length} still loose · tipped ${game.teamTips}/${game.goal}`, x => { P.mine.textContent = x; });
    set(P, 'clock', TT.fmtTime(Math.ceil(game.timeLeft)), x => { P.clock.textContent = x; P.clock.classList.toggle('low', game.timeLeft < 15); });
    const ready = th.state === 'chase' && th.roarCD <= 0, waking = th.state === 'sleep' || th.state === 'wake';
    set(P, 'thr', waking ? 'WAKING UP…' : ready ? 'ROAR READY' : `ROAR IN ${Math.ceil(th.roarCD)}`, x => { P.tcE.textContent = x; P.tc.classList.toggle('awake', ready); });
    set(P, 'thrIco', '😡', x => { P.tcS.textContent = x; });
    set(P, 'thrK', waking ? 0 : Math.round((1 - clamp(th.roarCD / 6, 0, 1)) * 50), x => { P.tcI.style.width = (x * 2) + '%'; P.tcI.style.background = x >= 50 ? '#ff3b2f' : '#ffb13b'; });
    set(P, 'boost', Math.round(th.boost / th.spec.boostTime * 40), x => { P.boost.style.width = (x * 2.5) + '%'; });
    set(P, 'boosting', th.boosting, x => P.boostBox.classList.toggle('on', x));
    let pr = '', cls = '';
    if (waking) { pr = 'GET READY TO CHASE…'; cls = 'warn'; }
    else if (game.state === 'play') {
      const tipping = loose.some(p => game.tractors.some(t => t.state === 'sleep' && Math.hypot(t.x - p.x, t.z - p.z) < 14 && Math.hypot(t.x - th.x, t.z - th.z) < 24));
      if (ready && tipping) { pr = honkLabel('ROAR'); cls = 'honk'; }
      else if (game.gateOpen) { pr = `THE GATE'S OPEN! STOP THEM! ${Math.ceil(game.gateT)}`; cls = 'bad'; }
    }
    set(P, 'prompt', pr + '|' + cls, () => { P.prompt.textContent = pr; P.prompt.className = 'prompt ' + cls + (pr ? ' show' : ''); });
    // arrow to the nearest runner
    const prey = th.target && th.target.active ? th.target : null;
    set(P, 'exitOn', !!prey && !waking, x => P.exit.classList.toggle('show', x));
    if (prey) { set(P, 'prey', prey.name.toUpperCase() + ' · ' + Math.round(Math.hypot(prey.x - th.x, prey.z - th.z) / 5) * 5 + 'M', x => { P.exitS.textContent = x; }); point(P, th, prey.x, prey.z); }
  }


  H.update = (dt, views, game) => {
    const th = game.thrasher, hunt = game.mode === 'hunt';
    mapT -= dt; const drawMap = mapT <= 0; if (drawMap) mapT = 0.08;
    for (const P of panels) {
      const v = P.v, car = v.car;
      if (P.isTh) { thrasherPanel(P, game, th); if (drawMap) map(P, game); continue; }
      // tips
      if (P.team) {
        set(P, 'tips', game.teamTips, x => { P.tipsB.textContent = x; bump(P); });
        set(P, 'goal', game.gateOpen ? '✓' : '/' + game.goal, x => { P.tipsI.textContent = x; P.tips.classList.toggle('done', x === '✓'); });
        set(P, 'mine', game.humans > 1 || hunt ? `you ${car.tips}` + (car.pumpkins ? ` · 🎃 ${car.pumpkins}` : '') : car.pumpkins ? `🎃 ${car.pumpkins} smashed` : '', x => { P.mine.textContent = x; });
      } else {
        set(P, 'tips', car.tips, x => { P.tipsB.textContent = x; bump(P); });
        const other = game.players.find(p => p !== car);
        set(P, 'mine', other ? `${other.name}: ${other.tips}` : `best ${TT.save.best['tipoff-' + game.level.id] || 0}`, x => { P.mine.textContent = x; });
      }
      if (P.clock) set(P, 'clock', TT.fmtTime(Math.ceil(game.timeLeft)), x => { P.clock.textContent = x; P.clock.classList.toggle('low', game.timeLeft < 15); });
      // Thrasher's meter
      const k = clamp(game.alarm / game.threshold, 0, 1);
      const label = th.state === 'sleep' ? (hunt ? 'ABOUT TO WAKE…' : k > 0.66 ? 'STIRRING…' : k > 0.33 ? 'SNORING' : 'FAST ASLEEP') : th.state === 'wake' ? 'WAKING UP!' : th.state === 'chase' ? (th.target === car ? 'COMING FOR YOU!' : 'ON THE HUNT') : th.state === 'gloat' ? 'GOT ONE!' : th.state === 'search' ? 'LOOKING FOR YOU' : 'GOING BACK TO BED';
      set(P, 'thr', label, x => { P.tcE.textContent = (th.human && game.humans > 1 ? th.name.toUpperCase() + ' (THRASHER)' : 'THRASHER') + ' · ' + x; P.tc.classList.toggle('awake', th.awake && th.state !== 'home'); });
      set(P, 'thrIco', th.awake ? (th.state === 'home' ? '😪' : '😡') : k > 0.66 ? '😠' : '😴', x => { P.tcS.textContent = x; });
      set(P, 'thrK', Math.round((th.awake && th.state !== 'home' ? 1 : k) * 50), x => { P.tcI.style.width = (x * 2) + '%'; P.tcI.style.background = x > 33 ? '#ff3b2f' : x > 22 ? '#ffb13b' : '#5fd35f'; });
      // dents
      if (P.dents) set(P, 'dents', car.dents + (car.caught ? 'c' : ''), () => { let h = ''; for (let i = 0; i < game.maxDents; i++) h += `<i class="${i < game.maxDents - car.dents ? 'on' : ''}"></i>`; P.dents.innerHTML = h; });
      // boost
      set(P, 'boost', Math.round(car.boost / car.spec.boostTime * 40), x => { P.boost.style.width = (x * 2.5) + '%'; });
      set(P, 'boosting', car.boosting, x => P.boostBox.classList.toggle('on', x));
      // prompt
      let pr = '', cls = '';
      if (car.caught) { pr = 'CAUGHT! ' + (game.players.some(p => p.active && p !== car) ? (hunt ? 'THE OTHERS CAN STILL ESCAPE' : 'YOUR MATE CAN STILL ESCAPE') : ''); cls = 'bad'; }
      else if (car.escaped) { pr = game.players.some(p => p.active) ? (hunt ? 'ESCAPED! WAITING FOR THE OTHERS…' : 'ESCAPED! WAITING FOR YOUR MATE…') : 'ESCAPED!'; cls = 'good'; }
      else if (game.state === 'play') {
        let inRange = false, close = false;
        for (const t of game.tractors) {
          if (t.state !== 'sleep') continue;
          const d = Math.hypot(t.x - car.x, t.z - car.z);
          if (d < car.spec.hornR) inRange = true;
          if (d < 15) close = true;
        }
        if (inRange) { pr = honkLabel(); cls = 'honk'; }
        else if (close && Math.abs(car.vf) > TT.SNEAK) { pr = 'EASY… SNEAK UP SLOWLY'; cls = 'warn'; }
        else if (game.gateOpen && P.team) { pr = `GATE SHUTS IN ${Math.ceil(game.gateT)} · GET OUT!`; cls = 'good'; }
      }
      set(P, 'prompt', pr + '|' + cls, () => { P.prompt.textContent = pr; P.prompt.className = 'prompt ' + cls + (pr ? ' show' : ''); });
      // arrow to the gate
      const showExit = P.team && game.gateOpen && car.active;
      set(P, 'exitOn', showExit, x => P.exit.classList.toggle('show', x));
      if (showExit) point(P, car, game.world.gate.x, -game.world.H - 6);
      if (drawMap) map(P, game);
    }
  };

  // ---- minimap ----
  function drawMapBg(game) {
    const w = game.world, S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), ext = w.H + 6, k = S / (ext * 2), X = x => (x + ext) * k, Z = z => (ext - z) * k;
    g.fillStyle = 'rgba(28,40,22,0.85)'; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(70,95,50,0.9)'; g.fillRect(X(-w.H), Z(w.H), w.H * 2 * k, w.H * 2 * k);
    g.strokeStyle = 'rgba(140,110,70,0.9)'; g.lineWidth = 3;
    for (const tr of w.tracks) { g.beginPath(); tr.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); }
    g.fillStyle = 'rgba(190,170,80,0.85)';
    for (const f of w.fields) g.fillRect(X(f.x - f.w / 2), Z(f.z + f.d / 2), f.w * k, f.d * k);
    g.fillStyle = 'rgba(70,50,30,0.9)';
    for (const m of w.muds) { g.beginPath(); g.arc(X(m.x), Z(m.z), m.r * k, 0, Math.PI * 2); g.fill(); }
    if (w.pond) { g.fillStyle = '#3a6ea8'; g.beginPath(); g.arc(X(w.pond.x), Z(w.pond.z), w.pond.r * k, 0, Math.PI * 2); g.fill(); }
    for (const b of w.boxes) { g.fillStyle = b.kind === 'barn' ? '#c0392b' : b.kind === 'house' ? '#e8dcc0' : '#8a7a5a'; g.fillRect(X(b.x - b.hw), Z(b.z + b.hd), b.hw * 2 * k, b.hd * 2 * k); }
    g.fillStyle = '#9ab'; g.beginPath(); g.arc(X(w.silo.x), Z(w.silo.z), w.silo.r * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(20,45,20,0.9)';
    for (const c of w.circles) if (c.kind === 'tree') { g.beginPath(); g.arc(X(c.x), Z(c.z), 1.6 * k, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#c9a26b'; g.lineWidth = 2; g.strokeRect(X(-w.H), Z(w.H), w.H * 2 * k, w.H * 2 * k);
    return { cv, ext, k, S };
  }
  function map(P, game) {
    const c = P.mctx, s = P.mapS, B = mapBg, w = game.world, f = s / B.S;
    const X = x => (x + B.ext) * B.k * f, Z = z => (B.ext - z) * B.k * f, t = performance.now() / 1000;
    c.clearRect(0, 0, s, s);
    c.drawImage(B.cv, 0, 0, s, s);
    // gate
    const g = w.gate;
    c.fillStyle = game.gateOpen ? (Math.floor(t * 3) % 2 ? '#4dff7a' : '#1fae4a') : '#6b4a2a';
    c.fillRect(X(g.x - g.w / 2), Z(g.z) - 3 * f, g.w * B.k * f, 6 * f);
    // pumpkins
    if (w.pumpkins.length) { c.fillStyle = '#ff8a1a'; for (const p of w.pumpkins) if (p.alive) c.fillRect(X(p.x) - f, Z(p.z) - f, 2.4 * f, 2.4 * f); }
    // tractors
    for (const tr of game.tractors) {
      const x = X(tr.x), z = Z(tr.z);
      if (tr.state === 'tipped' || tr.state === 'tipping') { c.strokeStyle = '#999'; c.lineWidth = 1.6 * f; c.beginPath(); c.moveTo(x - 3 * f, z - 3 * f); c.lineTo(x + 3 * f, z + 3 * f); c.moveTo(x + 3 * f, z - 3 * f); c.lineTo(x - 3 * f, z + 3 * f); c.stroke(); }
      else { c.fillStyle = tr.state === 'sleep' ? '#ffffff' : '#ffd23a'; c.beginPath(); c.arc(x, z, 3.2 * f, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = f; c.stroke(); }
    }
    // Thrasher
    const th = game.thrasher;
    tri(c, X(th.x), Z(th.z), th.a, (P.isTh ? 8 : 7) * f * (th.hunting && !P.isTh ? 1 + 0.15 * Math.sin(t * 10) : 1), th.awake ? '#ff3b2f' : '#a33', f);
    // players
    for (const p of game.players) if (!p.escaped || p.z > -w.H - 10) tri(c, X(p.x), Z(p.z), p.a, (p === P.v.car ? 6 : 5) * f, game.humans > 1 || game.mode === 'hunt' ? TT.PLAYER_COLORS[p.slot % TT.PLAYER_COLORS.length] : '#ffcf3a', f);
  }
  function tri(c, x, y, a, r, col, f) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 1.2 * f;
    c.beginPath(); c.moveTo(0, -r * 1.2); c.lineTo(r * 0.8, r * 0.8); c.lineTo(-r * 0.8, r * 0.8); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  TT.hud = H;
})();
