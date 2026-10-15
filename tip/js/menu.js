// Tractor Tippin': menus (DOM overlay). Every screen works with the pad (D-pad/stick + ✕/○), keyboard and touch.
(() => {
  'use strict';
  const TT = window.TT, { clamp } = TT.math;
  const M = { screen: null, active: true, back: null, data: {}, ctx: {} };
  let root, G;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  M.init = () => {
    root = document.getElementById('menu'); G = TT.game;
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      TT.audio.init(); focus(b);
      if (b.dataset.sel !== undefined) { const r = b.getBoundingClientRect(); act(b, e.clientX < r.left + r.width / 2 ? 'left' : 'right'); }
      else act(b, 'ok');
    });
    const params = new URLSearchParams(location.search);
    M.show('title');
    if (params.get('join')) setTimeout(() => M.show('join', { code: params.get('join').toUpperCase() }), 300);
  };

  // ---------------------------------------------------------------- navigation
  let cur = null;
  function items() { return [...root.querySelectorAll('[data-act]:not([disabled])')].filter(e => e.offsetParent !== null); }
  function focus(e) { if (cur) cur.classList.remove('focus'); cur = e; if (e) { e.classList.add('focus'); e.scrollIntoView({ block: 'nearest' }); } }
  function move(dx, dy) {
    const list = items(); if (!list.length) return;
    if (!cur || !list.includes(cur)) return focus(list[0]);
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bd = 1e9;
    for (const e of list) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect(), px = b.left + b.width / 2 - ax, py = b.top + b.height / 2 - ay;
      const along = px * dx + py * dy; if (along <= 4) continue;
      const d = along + (Math.abs(px * dy) + Math.abs(py * dx)) * 2.2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { focus(best); TT.audio.sfx('select', { vol: 0.5 }); }
  }
  function act(e, how) {
    const fn = M.acts[e.dataset.act]; if (!fn) return;
    if (how === 'ok') TT.audio.sfx(e.dataset.sel !== undefined ? 'select' : 'confirm', { vol: 0.6 });
    else TT.audio.sfx('select', { vol: 0.5 });
    fn(e, how);
  }
  M.update = () => {
    if (!M.active && G.game && !G.attract && TT.input.players.some(p => p.pause)) { G.togglePause(true); M.show('pause'); return; }
    const ev = TT.input.menu;
    if (!ev.length || !M.active) return;
    TT.audio.init();
    for (const { a, who } of ev) {
      if (M.onWho && M.onWho(a, who)) continue;
      if (a === 'up') move(0, -1); else if (a === 'down') move(0, 1);
      else if (a === 'left' || a === 'right') { if (cur && cur.dataset.sel !== undefined) act(cur, a); else move(a === 'left' ? -1 : 1, 0); }
      else if (a === 'l1' || a === 'r1') { if (cur && cur.dataset.sel !== undefined) act(cur, a === 'l1' ? 'left' : 'right'); }
      else if (a === 'ok') { if (cur && items().includes(cur)) act(cur, 'ok'); else move(0, 1); }
      else if (a === 'back') { if (M.back) { TT.audio.sfx('back', { vol: 0.6 }); M.back(); } }
      else if (a === 'start' && M.startBtn) M.startBtn();
    }
  };

  // ---------------------------------------------------------------- screens
  function render(html, opts = {}) {
    root.innerHTML = html; root.className = 'show ' + (opts.cls || '');
    M.active = true; M.back = opts.back || null; M.onWho = opts.onWho || null; M.startBtn = opts.start || null;
    cur = null;
    const f = opts.focus ? root.querySelector(opts.focus) : items()[0];
    focus(f || items()[0]);
    if (opts.room) G.showRoom(opts.room); else G.hideRoom();
  }
  M.hide = () => { root.className = ''; root.innerHTML = ''; M.active = false; cur = null; G.hideRoom(); };
  const padStatus = () => {
    const n = TT.input.padCount;
    return n ? `<span class="pad on">🎮 ${n} controller${n > 1 ? 's' : ''} connected</span>` : `<span class="pad">🎮 Pair a PS5 controller over Bluetooth, then press any button</span>`;
  };
  const btn = (label, a, extra = '') => `<button class="mi" data-act="${a}" ${extra}>${label}</button>`;
  const sel = (a, label, extra = '') => `<button class="mi selector" data-act="${a}" data-sel ${extra}><span>◀</span><b>${label}</b><span>▶</span></button>`;
  const bar = (label, v) => `<div class="stat"><label>${label}</label><div><i style="width:${clamp(v, 0, 1) * 100}%"></i></div></div>`;
  const carStats = c => bar('SPEED', c.stats.speed) + bar('PICK-UP', c.stats.accel) + bar('GRIP', c.stats.handling) + bar('HORN', c.stats.horn) + bar('SNEAKY', c.stats.sneak);
  const starStr = n => `<span class="st">${'★'.repeat(n)}</span><span class="st off">${'★'.repeat(3 - n)}</span>`;
  const unlocked = i => i === 0 || (TT.save.stars[TT.LEVELS[i - 1].id] || 0) > 0;
  const totalStars = () => TT.ALL_LEVELS.reduce((s, l) => s + (TT.save.stars[l.id] || 0), 0);
  const nextCar = (id, dir) => { const ids = TT.CAR_IDS; return ids[(ids.indexOf(id) + dir + ids.length) % ids.length]; };
  const myName = () => TT.settings.name || 'Tipper';
  M.myName = myName;

  M.show = (name, data = {}) => { M.screen = name; M.data = data; SCREENS[name](data); };
  const SCREENS = {
    title() {
      const hw = `<button class="mi spooky${TT.isOctober ? ' hot' : ''}" data-act="halloween">🎃 HALLOWEEN SPECIAL</button>`;
      render(`<div class="title">
        <h1><span>TRACTOR</span> TIPPIN'</h1>
        <p class="tag">Sneak up. Honk. Run like heck.</p>
        <div class="col">
          ${TT.isOctober ? hw : ''}
          ${btn('PLAY', 'play1')}
          ${TT.isOctober ? '' : hw}
          ${btn('2 PLAYERS · SAME SCREEN', 'play2')}
          ${btn('PLAY ONLINE · INVITE A MATE', 'online')}
          ${btn('HOW TO PLAY', 'howto')}
          ${btn('SETTINGS', 'settings')}
        </div>
        <div class="foot">${padStatus()}</div></div>`, { cls: 'over-attract' });
      clearInterval(M.padTimer);
      M.padTimer = setInterval(() => { const f = root.querySelector('.foot'); if (f && M.screen === 'title') f.innerHTML = padStatus(); else clearInterval(M.padTimer); }, 1000);
    },

    // pick a vehicle (one or two players)
    pick() {
      const C = M.ctx;
      if (C.players === 1) {
        const c = TT.CARS[C.cars[0]];
        render(`<div class="panel side">
          <div class="hdr"><h2>PICK YOUR RIDE</h2></div>
          ${sel('pickCar', esc(c.name).toUpperCase(), 'data-p="0"')}
          <p class="kind">${esc(c.kind)}</p>
          <p class="blurb">${esc(c.blurb)}</p>
          ${carStats(c)}
          <div class="row">${btn('▶ NEXT', 'pickDone', 'id="go"')}${btn('BACK', 'title')}</div></div>`,
        { back: () => M.show('title'), focus: '#go', start: () => M.acts.pickDone(), room: [C.cars[0]], cls: 'room' });
      } else {
        const card = i => { const c = TT.CARS[C.cars[i]]; return `<div class="pcard p${i + 1}"><h3>PLAYER ${i + 1}</h3><small>${devLabel(i)}</small>
          ${sel('pickCar', esc(c.name).toUpperCase(), `data-p="${i}"`)}<p class="kind">${esc(c.kind)}</p>${carStats(c)}</div>`; };
        render(`<div class="panel wide low">
          <div class="hdr"><h2>PICK YOUR RIDES</h2></div>
          <p class="sub">Each player picks with their own controller (◀ ▶). You can both drive the same one.</p>
          <div class="two">${card(0)}${card(1)}</div>
          <div class="row">${btn('▶ NEXT', 'pickDone', 'id="go"')}${btn('BACK', 'title')}</div></div>`,
        { back: () => M.show('title'), focus: '#go', start: () => M.acts.pickDone(), room: C.cars.slice(0, 2), cls: 'room2',
          onWho: (a, who) => { if (who === 1 && (a === 'left' || a === 'right' || a === 'l1' || a === 'r1')) { C.cars[1] = nextCar(C.cars[1], a === 'left' || a === 'l1' ? -1 : 1); M.show('pick'); return true; } return false; } });
      }
    },

    // pick a farm and a mode
    levels() {
      const C = M.ctx, story = C.mode === 'story';
      const levels = TT.ALL_LEVELS;
      if (!levels.find(l => l.id === C.level)) C.level = levels[0].id;
      const card = (l, i) => {
        const hw = l === TT.HALLOWEEN, lock = story && !hw && !unlocked(i);
        const info = story ? (lock ? '🔒 Escape from the farm before' : `<span class="stars">${starStr(TT.save.stars[l.id] || 0)}</span> · tip ${l.goal} of ${l.tractors}`) : `BEST ${TT.save.best['tipoff-' + l.id] || 0} TIPS`;
        return `<button class="mi card th-${l.theme} ${l.id === C.level ? 'picked' : ''}" data-act="pickLevel" data-id="${l.id}" ${lock ? 'disabled' : ''}>
          <b>${hw ? '🎃 ' : ''}${esc(l.name)}</b><small>${esc(l.blurb)}</small><em>${info}</em></button>`;
      };
      const modeLabel = story ? (C.players > 1 ? 'TEAM UP · TIP \'EM AND ESCAPE' : 'STORY · TIP \'EM AND ESCAPE') : C.players > 1 ? 'TIP-OFF · MOST TIPS WINS' : 'TIP-OFF · SCORE ATTACK';
      const modeText = story ? `Tip enough tractors to open the gate, then get out before Thrasher catches you. He hits you ${TT.DENTS} times and you're caught.${C.players > 1 ? ' You\'re a team: tips count together, and only one of you has to get out.' : ''}` :
        `${TT.fmtTime(TT.TIPOFF_TIME)} on the clock. Thrasher's awake and hunting the whole time, and every time he hits you you lose 2 tips. Tractors get back up after a while.${C.players > 1 ? ' Most tips wins.' : ''}`;
      const L = TT.level(C.level);
      render(`<div class="panel wide">
        <div class="hdr"><h2>PICK A FARM</h2><div class="chips"><span>★ ${totalStars()} / ${levels.length * 3}</span></div></div>
        <div class="row tight">${sel('pickMode', modeLabel)}</div>
        <p class="sub">${modeText}</p>
        <div class="tracks">${levels.map(card).join('')}</div>
        <div class="row">${btn('▶ PLAY ' + esc(L.name.toUpperCase()), 'levelGo', 'id="go"')}${btn('BACK', 'pickBack')}</div></div>`,
      { back: () => M.acts.pickBack(), focus: '#go', start: () => M.acts.levelGo() });
    },

    online() {
      render(`<div class="panel">
        <div class="hdr"><h2>PLAY ONLINE</h2></div>
        <p class="sub">Host a game and send your mate the link (or the code). Each of you plays on your own device and controller. Team up to tip the farm and escape, or go head to head in a Tip-Off.</p>
        <div class="col">${btn('HOST A GAME', 'host')}${btn('JOIN WITH A CODE', 'joinScreen')}${btn('BACK', 'title')}</div>
        <p class="sub small">Your name: <b>${esc(myName())}</b> · change it in Settings.</p></div>`, { back: () => M.show('title') });
    },
    hosting(d) {
      const link = TT.net.inviteLink();
      render(`<div class="panel">
        <div class="hdr"><h2>INVITE A MATE</h2></div>
        <p class="sub">Send this link. When they open it they'll join your game.</p>
        <div class="code">${esc(TT.net.code || '…')}</div>
        <input class="link" readonly value="${esc(link)}" />
        <div class="row">${navigator.share ? btn('SHARE LINK', 'share') : ''}${btn('COPY LINK', 'copy')}${btn('CANCEL', 'leave')}</div>
        <p class="status">${esc(d.status || 'Waiting for your mate to join…')}</p></div>`, { back: () => M.acts.leave() });
    },
    join(d) {
      render(`<div class="panel">
        <div class="hdr"><h2>JOIN A GAME</h2></div>
        <p class="sub">Type the code your mate sent you (or just open their link).</p>
        <input id="code" class="codein" maxlength="6" autocomplete="off" spellcheck="false" value="${esc(d.code || '')}" placeholder="CODE" />
        <div class="row">${btn('JOIN', 'join', 'id="go"')}${btn('BACK', 'online')}</div>
        <p class="status">${esc(d.status || '')}</p></div>`, { back: () => { TT.net.leave(); M.show('online'); }, focus: '#go' });
      const inp = root.querySelector('#code');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') M.acts.join(); e.stopPropagation(); });
      if (d.code && d.auto !== false) M.acts.join();
    },
    lobby() {
      const L = TT.net.lobby, host = TT.net.role === 'host', me = host ? 0 : 1, lv = TT.level(L.level);
      const pc = i => { const c = TT.CARS[L.cars[i]]; return `<div class="pcard p${i + 1}"><h3>${esc(L.names[i] || '…')}${i === me ? ' (YOU)' : ''}</h3><small>${i === 0 ? 'HOST' : 'GUEST'}</small>
        ${i === me ? sel('lobbyCar', esc(c.name).toUpperCase()) : `<div class="selector ro"><b>${esc(c.name).toUpperCase()}</b></div>`}<p class="kind">${esc(c.kind)}</p></div>`; };
      const mode = L.mode === 'story' ? 'TEAM UP · TIP \'EM AND ESCAPE' : 'TIP-OFF · MOST TIPS WINS';
      render(`<div class="panel wide low">
        <div class="hdr"><h2>ONLINE LOBBY</h2><div class="chips"><span>${TT.net.connected ? '● CONNECTED' : '○ WAITING'}</span><span>${esc(TT.net.code || '')}</span></div></div>
        <div class="two">${pc(0)}${pc(1)}</div>
        <div class="row">${host ? sel('lobbyMode', mode) + sel('lobbyLevel', (lv.halloween ? '🎃 ' : '') + esc(lv.name.toUpperCase())) : `<div class="selector ro"><b>${mode} · ${esc(lv.name.toUpperCase())}</b></div>`}</div>
        <div class="row">${host ? btn('▶ START', 'lobbyStart', `id="go" ${TT.net.connected ? '' : 'disabled'}`) : '<p class="status">Waiting for the host to start…</p>'}${btn('LEAVE', 'leave')}</div></div>`,
      { back: () => M.acts.leave(), focus: host ? '#go' : null, start: host ? () => M.acts.lobbyStart() : null, room: L.cars.slice(0, 2), cls: 'room2' });
    },

    howto(d) {
      render(`<div class="panel wide howto">
        <div class="hdr"><h2>HOW TO PLAY</h2></div>
        <ul class="tips">
          <li><b>Creep up</b> on a sleeping tractor. Go faster than a crawl near one and it wakes up grumpy: no tip.</li>
          <li><b>Honk</b> when you're close (the HONK! prompt shows). Everything asleep in range jumps out of its skin and goes over on its back. Rusty's big horn reaches further, so he can get a few at once.</li>
          <li>Every honk, tip and boost makes noise. Fill <b>Thrasher's meter</b> and he wakes up and comes for you. Hide in the corn and keep still, or just outrun him; he can't turn tight.</li>
          <li>Tip enough to open the <b>gate</b>, then drive out through it. Thrasher hits you ${TT.DENTS} times and you're caught.</li>
          <li>Stars: ★ escape · ★ tip the bonus number · ★ don't get hit at all.</li>
        </ul>
        <div class="two">
          <div><h3>PS5 CONTROLLER</h3><table>
            <tr><td>R2 (or stick up)</td><td>Drive</td></tr><tr><td>L2 (or stick down)</td><td>Brake / reverse</td></tr><tr><td>Left stick / D-pad</td><td>Steer</td></tr>
            <tr><td>✕</td><td>HONK</td></tr><tr><td>○ or R1</td><td>Boost (hold)</td></tr><tr><td>□</td><td>Handbrake slide</td></tr>
            <tr><td>L1</td><td>Look behind</td></tr><tr><td>△</td><td>Change camera</td></tr><tr><td>Right stick</td><td>Look around</td></tr><tr><td>Options</td><td>Pause</td></tr></table></div>
          <div><h3>KEYBOARD</h3><table>
            <tr><td>W / ↑ · S / ↓</td><td>Drive · Brake / reverse</td></tr><tr><td>A D / ← →</td><td>Steer</td></tr><tr><td>Space</td><td>HONK</td></tr>
            <tr><td>Shift</td><td>Boost</td></tr><tr><td>L</td><td>Handbrake</td></tr><tr><td>B · C</td><td>Look behind · Camera</td></tr><tr><td>Esc</td><td>Pause</td></tr></table>
            <p class="sub small">Two on one keyboard: P1 WASD, F honk, G boost, Q handbrake · P2 arrows, . honk, / boost, , handbrake. With one controller plugged in, the pad is player 1 and the keyboard player 2.</p>
            <p class="sub small">Touch: drag on the left to steer; GAS, REVERSE, HONK and BOOST on the right.</p></div>
        </div>
        <div class="row">${btn('BACK', d.from === 'pause' ? 'pauseBack' : 'title')}</div></div>`, { back: () => d.from === 'pause' ? M.acts.pauseBack() : M.show('title'), cls: d.from === 'pause' ? 'dim' : '' });
    },

    settings() {
      const S = TT.settings;
      render(`<div class="panel">
        <div class="hdr"><h2>SETTINGS</h2></div>
        <div class="col">
          ${sel('setQuality', 'GRAPHICS: ' + S.quality.toUpperCase())}
          ${sel('setMusic', 'MUSIC: ' + (S.music ? Math.round(S.musicVolume * 10) : 'OFF'))}
          ${sel('setVolume', 'SOUND: ' + Math.round(S.volume * 10))}
          ${sel('setVibrate', 'RUMBLE: ' + (S.vibrate ? 'ON' : 'OFF'))}
          ${sel('setCamera', 'CAMERA: ' + ['CLOSE', 'FAR', 'HIGH'][S.camera % 3])}
          ${btn('NAME: ' + esc(myName()), 'setName')}
          ${btn('RESET STARS', 'resetProgress')}
          ${btn('BACK', 'title')}
        </div></div>`, { back: () => M.show('title') });
    },

    pause() {
      const online = TT.net && TT.net.active;
      render(`<div class="panel small-panel">
        <div class="hdr"><h2>PAUSED</h2></div>
        <div class="col">${btn('RESUME', 'resume')}${online ? '' : btn('START AGAIN', 'restart')}${btn('HOW TO PLAY', 'pauseHowto')}${btn('QUIT TO MENU', 'quit')}</div>
        ${online ? '<p class="sub small">Online: the game keeps going while this menu is open.</p>' : ''}</div>`, { back: () => M.acts.resume(), start: () => M.acts.resume(), cls: 'dim' });
    },

    results(d) {
      const r = d.r;
      render(`<div class="panel results ${r.win ? 'win' : 'lose'}">
        <div class="hdr"><h2>${esc(d.headline)}</h2></div>
        ${r.mode === 'story' ? `<div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < r.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.35}s">★</span>`).join('')}</div>` : ''}
        <div class="pay">${d.lines.map(l => `<div class="${l[2] || ''}"><span>${esc(l[0])}</span><b>${esc(l[1])}</b></div>`).join('')}</div>
        <div class="row">${d.buttons.map(b => btn(b[0], b[1], b[2] || '')).join('')}</div></div>`,
      { back: () => M.acts[d.buttons[d.buttons.length - 1][1]](), focus: '#go', cls: 'dim' });
    },
  };

  function devLabel(i) {
    const n = TT.input.padCount;
    if (n >= 2) return `🎮 Controller ${i + 1}`;
    if (n === 1) return i === 0 ? '🎮 Controller' : '⌨ Keyboard (arrows, Space honk)';
    return i === 0 ? '⌨ WASD · F honk · G boost' : '⌨ Arrows · . honk · / boost';
  }

  // ---------------------------------------------------------------- starting a game
  function humans() {
    const C = M.ctx;
    if (C.players === 1) return [{ slot: 0, car: C.cars[0], name: myName(), view: 0 }];
    return [{ slot: 0, car: C.cars[0], name: 'Player 1', view: 0 }, { slot: 1, car: C.cars[1], name: 'Player 2', view: 1 }];
  }
  function start(mode, levelId) {
    const cfg = { mode, level: TT.level(levelId), humans: humans(), role: 'solo' };
    M.last = { mode, levelId, ctx: JSON.parse(JSON.stringify(M.ctx)) };
    M.hide();
    return G.start(cfg);
  }
  M.startOnline = cfg => { M.hide(); M.last = { online: true }; return G.start(cfg); };

  // the end of a game: save, then show what happened
  M.gameOver = (r, game) => {
    if (M.screen === 'results' && M.active) return;
    G.togglePause(false); TT.hud.hide();
    const L = TT.level(r.level), lines = [], online = r.online;
    let headline = '', buttons = [];
    const me = online ? (TT.net.role === 'host' ? 0 : 1) : 0;
    if (r.mode === 'story') {
      headline = r.win ? (r.players.every(p => p.escaped) ? 'ESCAPED!' : 'ONE GOT AWAY!') : 'CAUGHT BY THRASHER!';
      lines.push(['Tractors tipped', `${r.tips} (needed ${r.goal})`, 'total']);
      lines.push([`Bonus star: tip ${r.bonus}`, r.tips >= r.bonus ? '★' : `${r.tips} / ${r.bonus}`, r.tips >= r.bonus ? 'gold' : '']);
      const dents = r.players.reduce((s, p) => s + p.dents, 0);
      lines.push(['Bonus star: no dents', dents ? `${dents} dent${dents > 1 ? 's' : ''}` : '★', dents ? '' : 'gold']);
      if (r.players.length > 1) for (const p of r.players) lines.push([p.name, `${p.tips} tipped · ${p.escaped ? 'escaped' : p.caught ? 'caught' : '—'}`]);
      if (r.pumpkins) lines.push(['Pumpkins smashed', String(r.pumpkins)]);
      lines.push(['Time', TT.fmtTime(r.time)]);
      if (r.win) {
        const prev = TT.save.stars[L.id] || 0;
        if (r.stars > prev) { TT.save.stars[L.id] = r.stars; lines.push([prev ? 'NEW BEST STARS!' : 'FARM COMPLETE!', '★'.repeat(r.stars), 'gold']); }
        TT.save.best[L.id] = Math.max(TT.save.best[L.id] || 0, r.tips);
        TT.saveProgress();
        setTimeout(() => TT.audio.sfx('win'), 200);
        for (let i = 0; i < r.stars; i++) setTimeout(() => TT.audio.sfx('star'), 650 + i * 350);
      } else setTimeout(() => TT.audio.sfx('lose', { vol: 0.6 }), 200);
      const idx = TT.LEVELS.findIndex(l => l.id === L.id), next = TT.LEVELS[idx + 1];
      if (online) buttons = [['BACK TO LOBBY', 'toLobby', 'id="go"'], ['LEAVE', 'leaveGame']];
      else buttons = [...(r.win && next ? [['▶ NEXT FARM', 'nextLevel', 'id="go"']] : []), [r.win ? 'PLAY AGAIN' : 'TRY AGAIN', 'restart', r.win && next ? '' : 'id="go"'], ['PICK A FARM', 'toLevels'], ['MENU', 'quit']];
    } else {
      if (r.players.length > 1) {
        headline = r.winner < 0 ? 'IT\'S A DRAW!' : `${r.players[r.winner].name.toUpperCase()} WINS!`;
        for (const p of r.players) lines.push([p.name + (p.slot === me && online ? ' (you)' : ''), `${p.tips} tips`, p.slot === r.winner ? 'gold' : '']);
        if (online) setTimeout(() => TT.audio.sfx(r.winner === me ? 'win' : r.winner < 0 ? 'star' : 'lose', { vol: 0.7 }), 200);
        else setTimeout(() => TT.audio.sfx('win'), 200);
      } else {
        const n = r.players[0].tips, key = 'tipoff-' + L.id, prev = TT.save.best[key] || 0;
        headline = `${n} TIPPED!`;
        lines.push(['Tractors tipped', String(n), 'total']);
        if (n > prev) { TT.save.best[key] = n; TT.saveProgress(); lines.push([prev ? `NEW BEST (was ${prev})` : 'NEW BEST!', '★', 'gold']); setTimeout(() => TT.audio.sfx('win'), 200); }
        else lines.push(['Best on this farm', String(prev)]);
      }
      if (r.pumpkins) lines.push(['Pumpkins smashed', String(r.pumpkins)]);
      buttons = online ? [['BACK TO LOBBY', 'toLobby', 'id="go"'], ['LEAVE', 'leaveGame']] : [['PLAY AGAIN', 'restart', 'id="go"'], ['PICK A FARM', 'toLevels'], ['MENU', 'quit']];
    }
    M.show('results', { r, lines, headline, buttons });
    TT.audio.music('calm');
  };

  // ---------------------------------------------------------------- actions
  const refocus = sel2 => focus(root.querySelector(sel2));
  M.acts = {
    title: () => M.show('title'),
    play1: () => { M.ctx = { players: 1, cars: [TT.settings.car || 'rusty'], mode: 'story', level: M.ctx.level || 'pasture' }; M.show('pick'); },
    play2: () => { M.ctx = { players: 2, cars: [TT.settings.car || 'rusty', TT.settings.car2 || 'dash'], mode: 'story', level: M.ctx.level || 'pasture' }; M.show('pick'); },
    halloween: () => { M.ctx = { players: 1, cars: [TT.settings.car || 'rusty'], mode: 'story', level: 'haunted', halloween: true }; M.show('pick'); },
    online: () => M.show('online'),
    howto: () => M.show('howto', {}),
    settings: () => M.show('settings'),
    pickCar: (e, how) => {
      const i = +e.dataset.p, C = M.ctx;
      C.cars[i] = nextCar(C.cars[i], how === 'left' ? -1 : 1);
      if (i === 0) TT.settings.car = C.cars[0]; else TT.settings.car2 = C.cars[1];
      TT.saveSettings(); M.show('pick'); refocus(`[data-act=pickCar][data-p="${i}"]`);
    },
    pickDone: () => { TT.saveSettings(); if (M.ctx.halloween) start('story', 'haunted'); else M.show('levels'); },
    pickBack: () => M.show('pick'),
    pickMode: () => { M.ctx.mode = M.ctx.mode === 'story' ? 'tipoff' : 'story'; M.show('levels'); refocus('[data-act=pickMode]'); },
    pickLevel: e => { M.ctx.level = e.dataset.id; M.show('levels'); refocus(`[data-act=pickLevel][data-id="${e.dataset.id}"]`); },
    levelGo: () => start(M.ctx.mode, M.ctx.level),
    // online
    host: async () => {
      M.show('hosting', { status: 'Connecting…' });
      try { await TT.net.host(myName()); M.show('hosting', {}); } catch (err) { M.show('hosting', { status: 'Could not start hosting: ' + (err.message || err) }); }
    },
    joinScreen: () => M.show('join', {}),
    join: async () => {
      const inp = root.querySelector('#code'); const code = (inp ? inp.value : M.data.code || '').trim().toUpperCase();
      if (!code) return;
      M.show('join', { code, status: 'Connecting…', auto: false });
      try { await TT.net.join(code, myName()); } catch (err) { M.show('join', { code, status: 'Could not join: ' + (err.message || err), auto: false }); }
    },
    share: () => { navigator.share({ title: 'Tractor Tippin\'', text: 'Come tractor tipping with me!', url: TT.net.inviteLink() }).catch(() => {}); },
    copy: () => { const l = TT.net.inviteLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => M.show('hosting', { status: 'Link copied. Waiting for your mate…' }), () => { const i = root.querySelector('.link'); i.select(); document.execCommand('copy'); }); },
    leave: () => { TT.net.leave(); M.show('online'); },
    lobbyCar: (e, how) => { const L = TT.net.lobby, me = TT.net.role === 'host' ? 0 : 1; L.cars[me] = nextCar(L.cars[me], how === 'left' ? -1 : 1); TT.settings.car = L.cars[me]; TT.saveSettings(); TT.net.updateLobby(); M.show('lobby'); refocus('[data-act=lobbyCar]'); },
    lobbyMode: () => { const L = TT.net.lobby; L.mode = L.mode === 'story' ? 'tipoff' : 'story'; TT.net.updateLobby(); M.show('lobby'); refocus('[data-act=lobbyMode]'); },
    lobbyLevel: (e, how) => { const L = TT.net.lobby, ids = TT.ALL_LEVELS.map(l => l.id); L.level = ids[(ids.indexOf(L.level) + (how === 'left' ? -1 : 1) + ids.length) % ids.length]; TT.net.updateLobby(); M.show('lobby'); refocus('[data-act=lobbyLevel]'); },
    lobbyStart: () => TT.net.startGame(),
    // settings
    setQuality: (e, how) => { const o = ['auto', 'high', 'medium', 'low']; TT.settings.quality = o[(o.indexOf(TT.settings.quality) + (how === 'left' ? -1 : 1) + 4) % 4]; TT.saveSettings(); G.applyQuality(); M.show('settings'); refocus('[data-act=setQuality]'); },
    setMusic: (e, how) => { const S = TT.settings; let v = S.music ? Math.round(S.musicVolume * 10) : 0; v = clamp(v + (how === 'left' ? -1 : 1), 0, 10); if (how === 'ok') v = S.music ? 0 : 5; S.music = v > 0; if (v) S.musicVolume = v / 10; TT.saveSettings(); TT.audio.levels(); M.show('settings'); refocus('[data-act=setMusic]'); },
    setVolume: (e, how) => { const S = TT.settings; S.volume = clamp(Math.round(S.volume * 10) + (how === 'left' ? -1 : 1), 0, 10) / 10; TT.saveSettings(); TT.audio.levels(); TT.audio.sfx('hornDash'); M.show('settings'); refocus('[data-act=setVolume]'); },
    setVibrate: () => { TT.settings.vibrate = !TT.settings.vibrate; TT.saveSettings(); if (TT.settings.vibrate) TT.input.rumble(0, 0.6, 0.6, 200); M.show('settings'); refocus('[data-act=setVibrate]'); },
    setCamera: (e, how) => { TT.settings.camera = (TT.settings.camera + (how === 'left' ? 2 : 1)) % 3; TT.saveSettings(); M.show('settings'); refocus('[data-act=setCamera]'); },
    setName: () => { const n = prompt('Your name (shown to online mates):', myName()); if (n !== null) { TT.settings.name = n.trim().slice(0, 14); TT.saveSettings(); } M.show('settings'); },
    resetProgress: () => { if (confirm('Wipe all your stars and best scores?')) TT.resetProgress(); M.show('settings'); },
    // in game
    resume: () => { M.hide(); G.togglePause(false); },
    pauseHowto: () => M.show('howto', { from: 'pause' }),
    pauseBack: () => M.show('pause'),
    restart: () => { const L = M.last; G.togglePause(false); if (!L || L.online) return M.acts.quit(); M.ctx = L.ctx; start(L.mode, L.levelId); },
    nextLevel: () => { const L = M.last, i = TT.LEVELS.findIndex(l => l.id === L.levelId), n = TT.LEVELS[i + 1]; if (!n) return M.acts.quit(); M.ctx = L.ctx; M.ctx.level = n.id; start(L.mode, n.id); },
    toLevels: () => { const L = M.last; if (L && L.ctx) { M.ctx = L.ctx; M.ctx.halloween = false; } G.clear(); G.startAttract().then(() => M.show('levels')); },
    quit: () => { G.togglePause(false); if (TT.net.active) TT.net.leave(); G.clear(); G.startAttract().then(() => M.show('title')); },
    toLobby: () => { G.clear(); G.startAttract().then(() => { if (TT.net.active && TT.net.connected) M.show('lobby'); else M.show('online'); }); },
    leaveGame: () => { TT.net.leave(); G.clear(); G.startAttract().then(() => M.show('online')); },
  };
  TT.menu = M;
})();
