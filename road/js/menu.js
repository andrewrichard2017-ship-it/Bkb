// Road Rumble: menus (DOM overlay). Every screen works with the pad (D-pad/stick + ✕/○), keyboard and touch.
(() => {
  'use strict';
  const RR = window.RR, { clamp } = RR.math;
  const M = { screen: null, active: true, back: null, data: {} };
  let root, G;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = RR.fmtMoney;

  M.init = () => {
    root = document.getElementById('menu'); G = RR.game;
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      RR.audio.init(); focus(b); act(b, 'ok');
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
      const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const px = bx - ax, py = by - ay;
      const along = px * dx + py * dy; if (along <= 4) continue;
      const side = Math.abs(px * dy) + Math.abs(py * dx);
      const d = along + side * 2.2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { focus(best); RR.audio.sfx('select', { vol: 0.5 }); }
  }
  function act(e, how) {
    const a = e.dataset.act, fn = M.acts[a];
    if (!fn) return;
    if (how === 'ok') RR.audio.sfx(e.dataset.sel !== undefined ? 'select' : 'confirm', { vol: 0.6 });
    fn(e, how);
  }
  M.update = () => {
    if (!M.active && G.race && !G.attract && RR.input.players.some(p => p.pause)) { G.togglePause(true); M.show('pause'); return; }
    const ev = RR.input.menu;
    if (!ev.length) return;
    RR.audio.init();
    for (const { a, who } of ev) {
      // in a race only "start"/Options matters (pause); the rest is the pause menu
      if (!M.active) continue;
      if (M.onWho && M.onWho(a, who)) continue;
      if (a === 'up') move(0, -1); else if (a === 'down') move(0, 1);
      else if (a === 'left' || a === 'right') { if (cur && cur.dataset.sel !== undefined) act(cur, a); else move(a === 'left' ? -1 : 1, 0); }
      else if (a === 'l1' || a === 'r1') { if (cur && cur.dataset.sel !== undefined) act(cur, a === 'l1' ? 'left' : 'right'); }
      else if (a === 'ok') { if (cur && items().includes(cur)) act(cur, 'ok'); else move(0, 1); }
      else if (a === 'back') { if (M.back) { RR.audio.sfx('back', { vol: 0.6 }); M.back(); } }
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
    if (opts.garage) G.showGarage(opts.garage, opts.look); else G.hideGarage();
  }
  M.hide = () => { root.className = ''; root.innerHTML = ''; M.active = false; cur = null; G.hideGarage(); };
  const padStatus = () => {
    const n = RR.input.padCount;
    return n ? `<span class="pad on">🎮 ${n} controller${n > 1 ? 's' : ''} connected</span>` : `<span class="pad">🎮 Pair a controller over Bluetooth, then press any button</span>`;
  };
  const btn = (label, act, extra = '') => `<button class="mi" data-act="${act}" ${extra}>${label}</button>`;
  const stat = (label, v) => `<div class="stat"><label>${label}</label><div><i style="width:${clamp(v, 0, 1) * 100}%"></i></div></div>`;
  function bikeStats(b) {
    return stat('TOP SPEED', (b.top - 40) / 36) + stat('ACCELERATION', (b.accel - 8) / 8) + stat('HANDLING', (b.handling - 0.8) / 0.38) + stat('WEIGHT', (b.weight - 0.8) / 0.7) + stat('TOUGHNESS', (1.15 - b.armor) / 0.5)
      + `<div class="specline">${RR.speedText(b.top)} ${RR.speedUnit()} · ${b.cls}${b.nitro ? ` · ${b.nitro}× NITRO` : ''}</div>`;
  }

  M.show = (name, data = {}) => { M.screen = name; M.data = data; SCREENS[name](data); };
  const SCREENS = {
    title() {
      render(`<div class="title">
        <h1><span>ROAD</span> RUMBLE</h1>
        <p class="tag">Ride fast. Hit harder. Don't get nicked.</p>
        <div class="col">
          ${btn('CAREER', 'career')}
          ${btn('SHOOTOUT · EASY', 'shootout')}
          ${btn('2 PLAYERS · SAME SCREEN', 'versus')}
          ${btn('PLAY ONLINE · INVITE A MATE', 'online')}
          ${btn('HOW TO PLAY', 'howto')}
          ${btn('SETTINGS', 'settings')}
        </div>
        <div class="foot">${padStatus()}</div></div>`, { cls: 'over-attract' });
      clearInterval(M.padTimer);
      M.padTimer = setInterval(() => { const f = root.querySelector('.foot'); if (f && M.screen === 'title') f.innerHTML = padStatus(); else clearInterval(M.padTimer); }, 1000);
    },

    career() {
      const C = RR.career, lv = Math.min(C.level, 5), q = C.qualified[lv] || {};
      M.data.track = M.data.track ?? RR.TRACKS.findIndex(t => !q[t.id]);
      if (M.data.track < 0) M.data.track = 0;
      const bike = RR.bike(C.bike);
      render(`<div class="panel wide">
        <div class="hdr"><h2>CAREER</h2><div class="chips"><span>LEVEL ${lv}${C.level > 5 ? ' ★ CHAMPION' : ''}</span><span class="money">${money(C.money)}</span><span>${esc(bike.name)}</span></div></div>
        <p class="sub">Finish in the top ${RR.QUALIFY} on every road to move up a level. Prize money pays for faster bikes, repairs and fines.</p>
        <div class="tracks">${RR.TRACKS.map((t, i) => `<button class="mi card ${i === M.data.track ? 'picked' : ''} th-${t.theme}" data-act="pickTrack" data-i="${i}">
            <b>${esc(t.name)}</b><small>${esc(t.blurb)}</small><em>${q[t.id] ? '✓ QUALIFIED' : (RR.LEVELS[lv - 1].length / 1000).toFixed(0) + ' KM'}</em></button>`).join('')}</div>
        <div class="row">${btn('▶ RACE ' + esc(RR.TRACKS[M.data.track].name.toUpperCase()), 'careerRace', 'id="go"')}${btn('GARAGE · ' + money(C.money), 'garage')}${btn('BACK', 'title')}</div>
        <p class="sub small">Races: ${C.races} · Wins: ${C.wins} · Riders knocked off: ${C.knockoffs} · Busted: ${C.busted}</p></div>`,
      { back: () => M.show('title'), focus: '#go', start: () => M.acts.careerRace() });
    },

    garage(data) {
      const C = RR.career;
      const i = data.i ?? RR.BIKES.findIndex(b => b.id === C.bike);
      M.data.i = i;
      const b = RR.BIKES[i], owned = C.owned.includes(b.id), riding = C.bike === b.id;
      render(`<div class="panel side">
        <div class="hdr"><h2>GARAGE</h2><div class="chips"><span class="money">${money(C.money)}</span></div></div>
        <button class="mi selector" data-act="cycleBike" data-sel><span>◀</span><b>${esc(b.name)}</b><span>▶</span></button>
        <p class="blurb">${esc(b.blurb)}</p>
        ${bikeStats(b)}
        <div class="price">${riding ? 'YOU RIDE THIS' : owned ? 'OWNED' : money(b.price)}</div>
        <div class="row">${riding ? '' : owned ? btn('RIDE THIS', 'ride') : btn('BUY ' + money(b.price), 'buy', C.money < b.price ? 'disabled' : '')}${btn('BACK', 'career')}</div>
        <p class="sub small">${RR.BIKES.map(x => C.owned.includes(x.id) ? '●' : '○').join(' ')}</p></div>`,
      { back: () => M.show('career'), garage: b.id, look: RR.PLAYER_LOOKS[0], cls: 'garage' });
    },

    versus() {
      const D = M.data;
      D.bikes = D.bikes || ['viper', 'banshee']; D.track = D.track ?? 0; D.level = D.level ?? 1;
      const dev = i => ({ pad: `🎮 Controller ${i + 1}`, keys: i === 0 ? '⌨ Keyboard' : '⌨ Keyboard', 'keys-wasd': '⌨ WASD + F G H, Q nitro', 'keys-arrows': '⌨ Arrows + , . /  RShift nitro', touch: 'Touch' })[devFor(i)];
      const devFor = i => { const n = RR.input.padCount; if (n >= 2) return 'pad'; if (n === 1) return i === 0 ? 'pad' : 'keys'; return i === 0 ? 'keys-wasd' : 'keys-arrows'; };
      const pcard = i => { const b = RR.bike(D.bikes[i]); return `<div class="pcard p${i + 1}"><h3>PLAYER ${i + 1}</h3><small>${dev(i)}</small>
          <button class="mi selector" data-act="vsBike" data-p="${i}" data-sel><span>◀</span><b>${esc(b.name)}</b><span>▶</span></button>${bikeStats(b)}</div>`; };
      render(`<div class="panel wide">
        <div class="hdr"><h2>2 PLAYERS</h2></div>
        <p class="sub">Split screen against the pack. Each player picks a bike with their own controller (◀ ▶).</p>
        <div class="two">${pcard(0)}${pcard(1)}</div>
        <div class="row">
          <button class="mi selector" data-act="vsTrack" data-sel><span>◀</span><b>${esc(RR.TRACKS[D.track].name)}</b><span>▶</span></button>
          <button class="mi selector" data-act="vsLevel" data-sel><span>◀</span><b>LEVEL ${D.level}</b><span>▶</span></button>
        </div>
        <div class="row">${btn('▶ START', 'vsStart', 'id="go"')}${btn('BACK', 'title')}</div></div>`,
      { back: () => M.show('title'), focus: '#go', start: () => M.acts.vsStart(),
        onWho: (a, who) => { if (who === 1 && (a === 'left' || a === 'right' || a === 'l1' || a === 'r1')) { cycle(D.bikes, 1, a === 'left' || a === 'l1' ? -1 : 1); M.show('versus', D); return true; } return false; } });
    },

    shootout() {
      const D = M.data, best = RR.career.shoot || {};
      D.track = D.track ?? 0; D.bike = D.bike || 'banshee';
      const b = RR.bike(D.bike), t = RR.TRACKS[D.track];
      render(`<div class="panel">
        <div class="hdr"><h2>SHOOTOUT</h2><div class="chips"><span>BEST: ${best[t.id] || 0}</span></div></div>
        <p class="sub">Easy mode. No traffic, just the pack. Endless shotgun shells (□ / ○) and Frenzy is always ready (D-pad ↓). Knock off as many riders as you can before the finish line. Nobody can knock you off or nick you.</p>
        <div class="col">
          <button class="mi selector" data-act="shTrack" data-sel><span>◀</span><b>${esc(t.name)}</b><span>▶</span></button>
          <button class="mi selector" data-act="shCop" data-sel><span>◀</span><b>RIDE AS: ${D.cop ? 'POLICE' : 'BIKER'}</b><span>▶</span></button>
          ${D.cop ? '<div class="selector ro"><b>POLICE 1200 · SIREN ON</b></div>' : `<button class="mi selector" data-act="shBike" data-sel><span>◀</span><b>${esc(b.name)}</b><span>▶</span></button>`}
          ${btn('▶ START', 'shStart', 'id="go"')}
          ${btn('BACK', 'title')}
        </div></div>`, { back: () => M.show('title'), focus: '#go', start: () => M.acts.shStart() });
    },
    online() {
      render(`<div class="panel">
        <div class="hdr"><h2>PLAY ONLINE</h2></div>
        <p class="sub">Host a race and send your mate the link (or the code). You both need a connection to the internet; each of you plays on your own device and controller.</p>
        <div class="col">${btn('HOST A RACE', 'host')}${btn('JOIN WITH A CODE', 'joinScreen')}${btn('BACK', 'title')}</div>
        <p class="sub small">Your name: <b>${esc(myName())}</b> · change it in Settings.</p></div>`, { back: () => M.show('title') });
    },
    hosting(d) {
      const link = RR.net.inviteLink();
      render(`<div class="panel">
        <div class="hdr"><h2>INVITE A MATE</h2></div>
        <p class="sub">Send this link. When they open it they'll join your race.</p>
        <div class="code">${esc(RR.net.code || '…')}</div>
        <input class="link" readonly value="${esc(link)}" />
        <div class="row">${navigator.share ? btn('SHARE LINK', 'share') : ''}${btn('COPY LINK', 'copy')}${btn('CANCEL', 'leave')}</div>
        <p class="status">${esc(d.status || 'Waiting for your mate to join…')}</p></div>`, { back: () => M.acts.leave() });
    },
    join(d) {
      render(`<div class="panel">
        <div class="hdr"><h2>JOIN A RACE</h2></div>
        <p class="sub">Type the code your mate sent you (or just open their link).</p>
        <input id="code" class="codein" maxlength="6" autocomplete="off" spellcheck="false" value="${esc(d.code || '')}" placeholder="CODE" />
        <div class="row">${btn('JOIN', 'join', 'id="go"')}${btn('BACK', 'online')}</div>
        <p class="status">${esc(d.status || '')}</p></div>`, { back: () => { RR.net.leave(); M.show('online'); }, focus: '#go' });
      const inp = root.querySelector('#code');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') M.acts.join(); e.stopPropagation(); });
      if (d.code && d.auto !== false) M.acts.join();
    },
    lobby() {
      const L = RR.net.lobby, host = RR.net.role === 'host', me = host ? 0 : 1;
      const pc = i => { const b = RR.bike(L.bikes[i]); return `<div class="pcard p${i + 1}"><h3>${esc(L.names[i] || '…')}${i === me ? ' (YOU)' : ''}</h3><small>${i === 0 ? 'HOST' : 'GUEST'}</small>
        ${i === me ? `<button class="mi selector" data-act="lobbyBike" data-sel><span>◀</span><b>${esc(b.name)}</b><span>▶</span></button>` : `<div class="selector ro"><b>${esc(b.name)}</b></div>`}${bikeStats(b)}</div>`; };
      render(`<div class="panel wide">
        <div class="hdr"><h2>ONLINE LOBBY</h2><div class="chips"><span>${RR.net.connected ? '● CONNECTED' : '○ WAITING'}</span><span>${esc(RR.net.code || '')}</span></div></div>
        <div class="two">${pc(0)}${pc(1)}</div>
        <div class="row">
          ${host ? `<button class="mi selector" data-act="lobbyTrack" data-sel><span>◀</span><b>${esc(RR.TRACKS[L.track].name)}</b><span>▶</span></button>
          <button class="mi selector" data-act="lobbyLevel" data-sel><span>◀</span><b>LEVEL ${L.level}</b><span>▶</span></button>` : `<div class="selector ro"><b>${esc(RR.TRACKS[L.track].name)} · LEVEL ${L.level}</b></div>`}
        </div>
        <div class="row">${host ? btn('▶ START RACE', 'lobbyStart', `id="go" ${RR.net.connected ? '' : 'disabled'}`) : '<p class="status">Waiting for the host to start…</p>'}${btn('LEAVE', 'leave')}</div></div>`,
      { back: () => M.acts.leave(), focus: host ? '#go' : null, start: host ? () => M.acts.lobbyStart() : null });
    },

    howto() {
      render(`<div class="panel wide howto">
        <div class="hdr"><h2>HOW TO PLAY</h2></div>
        <div class="two">
          <div><h3>CONTROLLER</h3><table>
            <tr><td>R2 or ✕</td><td>Throttle</td></tr><tr><td>L2</td><td>Brake</td></tr><tr><td>Left stick / D-pad</td><td>Steer</td></tr>
            <tr><td>□ / ○</td><td>Punch or swing left / right</td></tr><tr><td>△</td><td>Kick (towards whoever's beside you)</td></tr>
            <tr><td>R1</td><td>Nitro (super bikes)</td></tr><tr><td>L1</td><td>Look behind</td></tr><tr><td>R3 / touchpad</td><td>Change camera</td></tr><tr><td>Options</td><td>Pause</td></tr></table></div>
          <div><h3>KEYBOARD</h3><table>
            <tr><td>W / ↑ · S / ↓</td><td>Throttle · Brake</td></tr><tr><td>A D / ← →</td><td>Steer</td></tr><tr><td>J / K</td><td>Hit left / right</td></tr>
            <tr><td>L</td><td>Kick</td></tr><tr><td>Space</td><td>Nitro</td></tr><tr><td>B · V</td><td>Look behind · Camera</td></tr><tr><td>Esc</td><td>Pause</td></tr></table>
            <p class="sub small">Two players on one keyboard: P1 WASD + F/G hit, H kick, Q nitro · P2 arrows + , . hit, / kick, Right Shift nitro.</p></div>
        </div>
        <ul class="tips">
          <li>Ride up alongside a rival and hit them until they come off. Kicks shove them sideways: into traffic or a tree is ideal.</li>
          <li>Punch someone just as they wind up a swing and you'll <b>steal their weapon</b>. Knock an armed rider off with your bare hands and you pick it up.</li>
          <li>Crash and you have to run back to your bike: <b>mash ✕</b> to run faster. If a cop reaches you first, you're <b>busted</b> (fine).</li>
          <li>Every crash damages the bike. At 0% it's wrecked and your race is over (repair bill).</li>
          <li>Lean into the bends: the faster you go, the harder the road pulls you to the outside. Crests throw you into the air.</li>
          <li>The left side of the road is oncoming traffic.</li>
        </ul>
        <div class="row">${btn('BACK', 'title')}</div></div>`, { back: () => M.show('title') });
    },

    settings() {
      const S = RR.settings;
      const sel = (act, label) => `<button class="mi selector" data-act="${act}" data-sel><span>◀</span><b>${label}</b><span>▶</span></button>`;
      render(`<div class="panel">
        <div class="hdr"><h2>SETTINGS</h2></div>
        <div class="col">
          ${sel('setQuality', 'GRAPHICS: ' + S.quality.toUpperCase())}
          ${sel('setUnits', 'SPEED: ' + (S.units === 'mph' ? 'MPH' : 'KM/H'))}
          ${sel('setMusic', 'MUSIC: ' + (S.music ? Math.round(S.musicVolume * 10) : 'OFF'))}
          ${sel('setVolume', 'SOUND: ' + Math.round(S.volume * 10))}
          ${sel('setVibrate', 'RUMBLE: ' + (S.vibrate ? 'ON' : 'OFF'))}
          ${btn('NAME: ' + esc(myName()), 'setName')}
          ${btn('RESET CAREER', 'resetCareer')}
          ${btn('BACK', 'title')}
        </div></div>`, { back: () => M.show('title') });
    },

    pause() {
      const online = RR.net && RR.net.active;
      render(`<div class="panel small-panel">
        <div class="hdr"><h2>PAUSED</h2></div>
        <div class="col">${btn('RESUME', 'resume')}${online ? '' : btn('RESTART', 'restart')}${btn('QUIT RACE', 'quit')}</div>
        ${online ? '<p class="sub small">Online: the race keeps going while this menu is open.</p>' : ''}</div>`, { back: () => M.acts.resume(), start: () => M.acts.resume(), cls: 'dim' });
    },

    results(d) {
      const rows = d.results.map(r => `<tr class="${r.human ? 'me' : ''}"><td>${r.out ? '—' : r.place}</td><td>${esc(r.name)}</td><td>${esc(r.bike)}</td><td>${r.out ? r.out.toUpperCase() : r.time ? RR.fmtTime(r.time) + (r.finished ? '' : '*') : ''}</td></tr>`).join('');
      render(`<div class="panel wide">
        <div class="hdr"><h2>${esc(d.headline)}</h2></div>
        <div class="two res"><table class="standings">${rows}</table>
        <div class="pay">${d.lines.map(l => `<div class="${l[2] || ''}"><span>${esc(l[0])}</span><b>${esc(l[1])}</b></div>`).join('')}</div></div>
        <div class="row">${btn('CONTINUE', 'afterResults', 'id="go"')}${d.retry ? btn('RACE AGAIN', 'restart') : ''}${d.reward && RR.ads.canReward() ? btn(esc(d.reward.label), 'adReward') : ''}</div></div>`,
      { back: () => M.acts.afterResults(), focus: '#go', start: () => M.acts.afterResults() });
    },
  };

  // ---------------------------------------------------------------- helpers
  function cycle(arr, i, dir) { const ids = RR.BIKES.map(b => b.id); arr[i] = ids[(ids.indexOf(arr[i]) + dir + ids.length) % ids.length]; }
  function myName() { return RR.settings.name || 'Rider'; }
  M.myName = myName;

  // ---------------------------------------------------------------- races from the menus
  function startCareer() {
    const C = RR.career, lv = Math.min(C.level, 5);
    M.last = { mode: 'career', track: M.data.track };
    M.hide();
    G.startRace({ trackIndex: M.data.track, level: lv - 1, mode: 'career', humans: [{ name: myName(), bikeId: C.bike, look: RR.PLAYER_LOOKS[0], view: 0, slot: 0 }], seed: C.races + 1, packSize: 10 });
  }
  function startShootout() {
    const D = M.data;
    M.last = { mode: 'shootout', data: D };
    M.hide();
    const look = D.cop ? { jacket: 0x14213d, helmet: 0xf5f5f5, legs: 0x101828, tag: 0x64b5f6 } : RR.PLAYER_LOOKS[0];
    G.startRace({ trackIndex: D.track, level: 0, mode: 'shootout', humans: [{ name: D.cop ? 'Officer ' + myName() : myName(), bikeId: D.cop ? 'cop' : D.bike, look, view: 0, slot: 0 }], seed: Date.now() % 997, packSize: 18 });
  }
  function startVersus() {
    const D = M.data;
    M.last = { mode: 'versus', data: D };
    M.hide();
    G.startRace({ trackIndex: D.track, level: D.level - 1, mode: 'versus', humans: [
      { name: 'P1', bikeId: D.bikes[0], look: RR.PLAYER_LOOKS[0], view: 0, slot: 0 }, { name: 'P2', bikeId: D.bikes[1], look: RR.PLAYER_LOOKS[1], view: 1, slot: 1 }], seed: Date.now() % 997, packSize: 10 });
  }
  M.startOnline = cfg => { M.hide(); M.last = { mode: 'online' }; return G.startRace(cfg); };

  // payouts and results after a race
  M.raceOver = (results, race) => {
    if (M.screen === 'results' && M.active) return;
    G.togglePause(false); RR.audio.setPaused(false); RR.hud.hide();
    const lines = [];
    let headline = 'RESULTS', reward = null;
    const humans = results.filter(r => r.human);
    if (race.mode === 'shootout') {
      const me = humans[0], id = RR.TRACKS[race.cfg.trackIndex].id, best = RR.career.shoot = RR.career.shoot || {};
      const prev = best[id] || 0, n = me.knockoffs;
      headline = `${n} KNOCKED OFF`;
      lines.push(['Riders knocked off', String(n), 'total']);
      lines.push(['Finished', RR.ordinal(me.place)]);
      if (n > prev) { best[id] = n; RR.saveCareer(); lines.push([prev ? `NEW BEST (was ${prev})` : 'NEW BEST!', '★', 'gold']); RR.audio.sfx('finish'); }
      else lines.push(['Best on this road', String(prev)]);
    } else if (race.mode === 'career') {
      const C = RR.career, me = humans[0], lv = Math.min(C.level, 5), L = RR.LEVELS[lv - 1], bike = RR.bike(C.bike);
      let total = 0, fee = 0;
      if (!me.out && me.place <= RR.PRIZE_SHARE.length) { const p = Math.round(L.prize * RR.PRIZE_SHARE[me.place - 1]); total += p; lines.push([RR.ordinal(me.place) + ' place prize', '+' + money(p)]); }
      else if (!me.out) lines.push([RR.ordinal(me.place) + ' place', 'no prize']);
      if (me.knockoffs) { const k = me.knockoffs * 100 * lv; total += k; lines.push([me.knockoffs + ' knocked off', '+' + money(k)]); }
      if (me.out === 'busted') { const f = 400 + 350 * lv; total -= f; fee = f; lines.push(['Police fine', '-' + money(f), 'bad']); C.busted++; }
      if (me.out === 'wrecked') { const f = Math.max(350, Math.round(bike.price * 0.22)); total -= f; fee = f; lines.push(['Repairs', '-' + money(f), 'bad']); }
      C.money = Math.max(0, C.money + total); C.races++; C.knockoffs += me.knockoffs;
      if (me.place === 1 && !me.out) C.wins++;
      const track = RR.TRACKS[race.cfg.trackIndex];
      const qual = !me.out && me.place <= RR.QUALIFY;
      C.qualified[lv] = C.qualified[lv] || {};
      if (qual) C.qualified[lv][track.id] = true;
      headline = me.out === 'busted' ? 'BUSTED' : me.out === 'wrecked' ? 'WRECKED' : qual ? `${RR.ordinal(me.place).toUpperCase()} · QUALIFIED` : `${RR.ordinal(me.place).toUpperCase()} · NOT QUALIFIED`;
      lines.push(['Total', (total >= 0 ? '+' : '-') + money(Math.abs(total)), 'total']);
      lines.push(['Bank', money(C.money)]);
      if (RR.TRACKS.every(t => C.qualified[lv][t.id]) && C.level <= 5) {
        C.level++;
        lines.push([C.level > 5 ? 'CHAMPION OF THE ROAD!' : `LEVEL ${C.level} UNLOCKED!`, '★', 'gold']);
        RR.audio.sfx('finish');
      }
      if (total > 0) setTimeout(() => RR.audio.sfx('cash'), 300);
      RR.saveCareer();
      // watch an ad (ads.js): double what you won, or the bill is paid for you
      if (total > 0) reward = { amount: total, label: `WATCH AN AD · DOUBLE IT (+${money(total)})`, line: 'Ad bonus' };
      else if (fee) reward = { amount: fee, label: `WATCH AN AD · ${me.out === 'busted' ? 'FINE' : 'REPAIRS'} PAID (+${money(fee)})`, line: me.out === 'busted' ? 'Fine paid back' : 'Repairs paid' };
      if (me.place === 1 && !me.out) RR.ads.happy();
    } else {
      for (const h of humans) lines.push([h.name, h.out ? h.out.toUpperCase() : RR.ordinal(h.place) + (h.knockoffs ? ` · ${h.knockoffs} KO` : '')]);
      const best = humans.filter(h => !h.out).sort((a, b) => a.place - b.place)[0];
      headline = best ? `${best.name} WINS THE BRAWL` : 'NOBODY FINISHED';
      if (humans.length === 2 && humans.every(h => !h.out) && humans[0].place !== humans[1].place) { /* headline already says who */ }
    }
    RR.ads.gameplay(false);
    M.show('results', { results, lines, headline, retry: race.mode !== 'online', reward });
    RR.audio.music('menu');
  };

  // ---------------------------------------------------------------- actions
  M.acts = {
    title: () => M.show('title'),
    career: () => M.show('career', {}),
    versus: () => M.show('versus', M.data.bikes ? M.data : {}),
    online: () => M.show('online'),
    howto: () => M.show('howto'),
    settings: () => M.show('settings'),
    garage: () => M.show('garage', {}),
    pickTrack: (e) => { M.data.track = +e.dataset.i; M.show('career', M.data); },
    careerRace: () => startCareer(),
    cycleBike: (e, how) => { const n = RR.BIKES.length; M.show('garage', { i: (M.data.i + (how === 'left' ? -1 : 1) + n) % n }); },
    buy: () => { const b = RR.BIKES[M.data.i], C = RR.career; if (C.money < b.price) return; C.money -= b.price; C.owned.push(b.id); C.bike = b.id; RR.saveCareer(); RR.audio.sfx('cash'); M.show('garage', { i: M.data.i }); },
    ride: () => { RR.career.bike = RR.BIKES[M.data.i].id; RR.saveCareer(); M.show('garage', { i: M.data.i }); },
    vsBike: (e, how) => { cycle(M.data.bikes, +e.dataset.p, how === 'left' ? -1 : 1); M.show('versus', M.data); focus(root.querySelector(`[data-act=vsBike][data-p="${e.dataset.p}"]`)); },
    vsTrack: (e, how) => { const n = RR.TRACKS.length; M.data.track = (M.data.track + (how === 'left' ? -1 : 1) + n) % n; M.show('versus', M.data); focus(root.querySelector('[data-act=vsTrack]')); },
    vsLevel: (e, how) => { M.data.level = clamp(M.data.level + (how === 'left' ? -1 : 1), 1, 5); M.show('versus', M.data); focus(root.querySelector('[data-act=vsLevel]')); },
    vsStart: () => startVersus(),
    shootout: () => M.show('shootout', M.last && M.last.mode === 'shootout' ? M.last.data : {}),
    shTrack: (e, how) => { const n = RR.TRACKS.length; M.data.track = (M.data.track + (how === 'left' ? -1 : 1) + n) % n; M.show('shootout', M.data); focus(root.querySelector('[data-act=shTrack]')); },
    shBike: (e, how) => { const a = [M.data.bike]; cycle(a, 0, how === 'left' ? -1 : 1); M.data.bike = a[0]; M.show('shootout', M.data); focus(root.querySelector('[data-act=shBike]')); },
    shCop: () => { M.data.cop = !M.data.cop; M.show('shootout', M.data); focus(root.querySelector('[data-act=shCop]')); },
    shStart: () => startShootout(),
    host: async () => {
      M.show('hosting', { status: 'Connecting…' });
      try { await RR.net.host(myName()); M.show('hosting', {}); } catch (err) { M.show('hosting', { status: 'Could not start hosting: ' + (err.message || err) }); }
    },
    joinScreen: () => M.show('join', {}),
    join: async () => {
      const inp = root.querySelector('#code'); const code = (inp ? inp.value : M.data.code || '').trim().toUpperCase();
      if (!code) return;
      M.show('join', { code, status: 'Connecting…', auto: false });
      try { await RR.net.join(code, myName()); } catch (err) { M.show('join', { code, status: 'Could not join: ' + (err.message || err), auto: false }); }
    },
    share: () => { navigator.share({ title: 'Road Rumble', text: 'Race me in Road Rumble!', url: RR.net.inviteLink() }).catch(() => {}); },
    copy: () => { const l = RR.net.inviteLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => M.show('hosting', { status: 'Link copied. Waiting for your mate…' }), () => { const i = root.querySelector('.link'); i.select(); document.execCommand('copy'); }); },
    leave: () => { RR.net.leave(); M.show('online'); },
    lobbyBike: (e, how) => { const L = RR.net.lobby, me = RR.net.role === 'host' ? 0 : 1; cycle(L.bikes, me, how === 'left' ? -1 : 1); RR.net.updateLobby(); M.show('lobby'); focus(root.querySelector('[data-act=lobbyBike]')); },
    lobbyTrack: (e, how) => { const L = RR.net.lobby, n = RR.TRACKS.length; L.track = (L.track + (how === 'left' ? -1 : 1) + n) % n; RR.net.updateLobby(); M.show('lobby'); focus(root.querySelector('[data-act=lobbyTrack]')); },
    lobbyLevel: (e, how) => { const L = RR.net.lobby; L.level = clamp(L.level + (how === 'left' ? -1 : 1), 1, 5); RR.net.updateLobby(); M.show('lobby'); focus(root.querySelector('[data-act=lobbyLevel]')); },
    lobbyStart: () => RR.net.startRace(),
    setQuality: (e, how) => { const o = ['auto', 'high', 'medium', 'low']; RR.settings.quality = o[(o.indexOf(RR.settings.quality) + (how === 'left' ? -1 : 1) + 4) % 4]; RR.saveSettings(); G.applyQuality(); M.show('settings'); focus(root.querySelector('[data-act=setQuality]')); },
    setUnits: () => { RR.settings.units = RR.settings.units === 'mph' ? 'kmh' : 'mph'; RR.saveSettings(); M.show('settings'); focus(root.querySelector('[data-act=setUnits]')); },
    setMusic: (e, how) => { const S = RR.settings; let v = S.music ? Math.round(S.musicVolume * 10) : 0; v = clamp(v + (how === 'left' ? -1 : 1), 0, 10); if (how === 'ok') v = S.music ? 0 : 5; S.music = v > 0; if (v) S.musicVolume = v / 10; RR.saveSettings(); RR.audio.applySettings(); M.show('settings'); focus(root.querySelector('[data-act=setMusic]')); },
    setVolume: (e, how) => { const S = RR.settings; S.volume = clamp(Math.round(S.volume * 10) + (how === 'left' ? -1 : 1), 0, 10) / 10; RR.saveSettings(); RR.audio.applySettings(); RR.audio.sfx('punch'); M.show('settings'); focus(root.querySelector('[data-act=setVolume]')); },
    setVibrate: () => { RR.settings.vibrate = !RR.settings.vibrate; RR.saveSettings(); if (RR.settings.vibrate) RR.input.rumble(0, 0.6, 0.6, 200); M.show('settings'); focus(root.querySelector('[data-act=setVibrate]')); },
    setName: () => { const n = prompt('Your name (shown to online mates):', myName()); if (n !== null) { RR.settings.name = n.trim().slice(0, 14); RR.saveSettings(); } M.show('settings'); },
    resetCareer: () => { if (confirm('Start your career again from nothing?')) { RR.resetCareer(); } M.show('settings'); },
    resume: () => { M.hide(); G.togglePause(false); },
    adReward: () => {
      const d = M.data, r = d.reward; if (!r) return;
      RR.ads.rewarded(() => {
        if (d.reward !== r) return;
        const C = RR.career; C.money += r.amount; RR.saveCareer(); RR.audio.sfx('cash');
        const lines = d.lines.filter(l => l[0] !== 'Bank').concat([[r.line, '+' + money(r.amount), 'gold'], ['Bank', money(C.money)]]);
        M.show('results', Object.assign({}, d, { lines, reward: null }));
      });
    },
    restart: () => {
      const L = M.last, fromResults = M.screen === 'results'; M.hide(); G.togglePause(false);
      if (!L) return;
      if (fromResults) RR.ads.midgame(() => go(L)); else go(L);   // no break ad from the pause menu
    },
    quit: () => { G.togglePause(false); RR.ads.gameplay(false); if (RR.net.active) RR.net.leave(); G.clearRace(); G.startAttract().then(() => M.show('title')); },
    afterResults: () => RR.ads.midgame(() => {
      const L = M.last;
      G.clearRace();
      if (L && L.mode === 'online' && RR.net.active) { G.startAttract().then(() => M.show('lobby')); return; }
      G.startAttract().then(() => M.show(L && ['career', 'versus', 'shootout'].includes(L.mode) ? L.mode : 'title', L && L.mode !== 'career' ? L.data || {} : {}));
    }),
  };
  function go(L) {
    if (L.mode === 'career') { M.data.track = L.track; startCareer(); } else if (L.mode === 'versus') { M.data = L.data; startVersus(); } else if (L.mode === 'shootout') { M.data = L.data; startShootout(); }
  }
  RR.menu = M;
})();
