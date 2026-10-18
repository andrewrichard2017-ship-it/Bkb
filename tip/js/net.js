// Tractor Tippin': online games for two over WebRTC (PeerJS, vendored with Road Rumble in ../road/lib).
// The host runs the farm (tractors, Thrasher, tips, the gate, the score); the guest drives its own car and
// sends where it is, its honks and the pumpkins it squashes. Both build the same farm from the level seed.
(() => {
  'use strict';
  const TT = window.TT;
  const PREFIX = 'tractortippin-v1-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const SNAP_HZ = 15, ME_HZ = 20;

  const N = TT.net = {
    active: false, role: null, code: '', peer: null, conn: null, connected: false,
    lobby: { mode: 'story', level: 'pasture', cars: ['rusty', 'dash'], names: ['', ''] }, sendT: 0, game: null,
  };

  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = '../road/lib/peerjs.min.js?v=1';
      s.onload = () => res(); s.onerror = () => rej(new Error('could not load the network library'));
      document.head.appendChild(s);
    });
  }
  // ?peerhost=127.0.0.1&peerport=9000 points at a self-hosted PeerJS server (testing)
  function peerOpts() {
    const q = new URLSearchParams(location.search), o = { debug: 1 };
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 9000); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1'; }
    return o;
  }
  const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  N.inviteLink = () => { const u = new URL(location.href); u.search = ''; const q = new URLSearchParams(location.search); for (const k of ['peerhost', 'peerport', 'peerpath', 'peersecure']) if (q.get(k)) u.searchParams.set(k, q.get(k)); u.searchParams.set('join', N.code); return u.toString(); };

  N.host = async (name) => {
    await loadLib();
    N.leave();
    N.role = 'host'; N.active = true; N.lobby = { mode: 'story', level: 'pasture', cars: [TT.settings.car || 'rusty', 'dash'], names: [name, ''], thrasher: 0 };
    for (let attempt = 0; attempt < 4; attempt++) {
      N.code = makeCode();
      try {
        await new Promise((res, rej) => {
          const p = N.peer = new Peer(PREFIX + N.code, peerOpts());
          p.on('open', res);
          p.on('error', err => { if (!N.connected) rej(err); else console.warn('peer', err); });
          p.on('connection', conn => {
            if (N.conn && N.conn.open) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); }); return; }
            attach(conn);
          });
          p.on('disconnected', () => { try { p.reconnect(); } catch (e) { /* closed */ } });
        });
        return N.code;
      } catch (err) {
        if (N.peer) { N.peer.destroy(); N.peer = null; }
        if (err.type !== 'unavailable-id') { N.active = false; throw err; }
      }
    }
    throw new Error('no free code, try again');
  };

  N.join = async (code, name) => {
    await loadLib();
    N.leave();
    N.role = 'guest'; N.active = true; N.code = code; N.myName = name;
    await new Promise((res, rej) => {
      const p = N.peer = new Peer(undefined, peerOpts());
      const timer = setTimeout(() => rej(new Error('no answer from ' + code + '. Check the code, and that the host is still waiting.')), 15000);
      p.on('open', () => {
        const conn = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        attach(conn, () => { clearTimeout(timer); res(); });
      });
      p.on('error', err => { clearTimeout(timer); if (!N.connected) rej(err.type === 'peer-unavailable' ? new Error('no game with code ' + code) : err); });
    });
  };

  function attach(conn, onOpen) {
    N.conn = conn;
    conn.on('open', () => {
      N.connected = true; N.lastRx = performance.now();
      clearInterval(N.beat);
      N.beat = setInterval(() => { // heartbeat: WebRTC can take a long time to notice a closed tab
        if (!N.connected) return clearInterval(N.beat);
        send({ t: 'ping' });
        if (performance.now() - N.lastRx > 7000) { try { conn.close(); } catch (e) { /* ignore */ } lost(); }
      }, 1000);
      if (N.role === 'guest') send({ t: 'hello', name: N.myName, car: TT.settings.car || 'dash' });
      if (onOpen) onOpen();
    });
    conn.on('data', onData);
    conn.on('close', () => lost());
    conn.on('error', () => lost());
  }
  function lost() {
    if (!N.connected) return;
    N.connected = false; clearInterval(N.beat);
    const G = TT.game, game = G.game && !G.attract && G.game === N.game ? G.game : null;
    if (N.role === 'host') {
      if (game && !game.over) {
        const p = game.players.find(x => x.remote);
        if (p) game.removePlayer(p);
        if (game.thrasher.controller === 'remote') game.thrasherToAI(); // nobody driving Thrasher now: he drives himself
        TT.hud.all('YOUR MATE DISCONNECTED', { big: true, color: '#64b5f6', hold: 3 });
      } else { N.lobby.names[1] = ''; if (TT.menu.screen === 'lobby') TT.menu.show('hosting', { status: 'Your mate left. Waiting for someone to join…' }); }
      N.conn = null;
    } else {
      N.leave();
      if (game) TT.hud.all('THE HOST LEFT', { big: true, color: '#64b5f6', hold: 3 });
      setTimeout(() => { if (TT.game.game && !TT.game.attract) TT.menu.acts.quit(); else TT.menu.show('online'); }, game ? 2500 : 0);
    }
  }
  function send(m) { if (N.conn && N.conn.open) try { N.conn.send(m); } catch (e) { /* closed */ } }
  N.send = send;
  N.leave = () => {
    N.connected = false; clearInterval(N.beat);
    if (N.conn) { try { N.conn.close(); } catch (e) { /* ignore */ } N.conn = null; }
    if (N.peer) { try { N.peer.destroy(); } catch (e) { /* ignore */ } N.peer = null; }
    N.active = false; N.role = null; N.game = null;
  };

  // ---- lobby ----
  N.updateLobby = () => send(N.role === 'host' ? { t: 'lobby', lobby: N.lobby } : { t: 'pick', car: N.lobby.cars[1] });
  N.startGame = () => {
    if (N.role !== 'host' || !N.connected) return;
    const L = N.lobby;
    send({ t: 'start', mode: L.mode, level: L.level, cars: L.cars, names: L.names, thrasher: L.thrasher || 0 });
    begin(L.mode, L.level, L.cars, L.names, L.thrasher || 0);
  };
  function begin(mode, level, cars, names, thrasher) {
    const host = N.role === 'host', mine = host ? 0 : 1;
    const who = i => ({ name: names[i] || (i ? 'Guest' : 'Host'), view: i === mine ? 0 : null, remote: i !== mine });
    let cfg;
    if (mode === 'hunt') { // one of us drives Thrasher, the other a car; the computer (on the host) drives the other car
      const r = 1 - thrasher, car = cars[r];
      cfg = { humans: [Object.assign({ slot: r, car }, who(r))], thrasher: Object.assign({ slot: thrasher }, who(thrasher)), ai: [car === 'rusty' ? 'dash' : 'rusty'] };
    } else cfg = { humans: [Object.assign({ slot: 0, car: cars[0] }, who(0)), Object.assign({ slot: 1, car: cars[1] }, who(1))] };
    N.guestReady = false; N.pendingGo = false;
    TT.menu.startOnline(Object.assign({ mode, level: TT.level(level), role: N.role }, cfg)).then(game => {
      N.game = game; game.net = N; game.hold = true; N.holdT = 0;
      if (host) { if (N.guestReady) go(); } else { send({ t: 'ready' }); if (N.pendingGo) { game.hold = false; N.pendingGo = false; } }
    });
  }
  function go() { if (!N.game || !N.game.hold) return; N.game.hold = false; send({ t: 'go' }); }

  // ---- messages ----
  function onData(m) {
    N.lastRx = performance.now();
    const game = N.game && TT.game.game === N.game ? N.game : null;
    switch (m.t) {
      case 'hello': N.lobby.names[1] = m.name || 'Guest'; if (m.car && TT.CARS[m.car]) N.lobby.cars[1] = m.car; send({ t: 'lobby', lobby: N.lobby }); TT.menu.show('lobby'); TT.audio.sfx('confirm'); break;
      case 'full': N.leave(); TT.menu.show('join', { code: N.code, status: 'That game already has two players.', auto: false }); break;
      case 'lobby': N.lobby = m.lobby; if (TT.menu.screen === 'lobby' || TT.menu.screen === 'join' || (TT.menu.screen === 'results' && !game)) TT.menu.show('lobby'); break;
      case 'pick': if (TT.CARS[m.car]) N.lobby.cars[1] = m.car; send({ t: 'lobby', lobby: N.lobby }); if (TT.menu.screen === 'lobby') TT.menu.show('lobby'); break;
      case 'start': if (TT.game.game && !TT.game.attract) TT.game.clear(); begin(m.mode, m.level, m.cars, m.names, m.thrasher || 0); break;
      case 'ready': N.guestReady = true; go(); break;
      case 'go': if (game) game.hold = false; else N.pendingGo = true; break;
      case 'snap': if (game) game.applySnapshot(m.s); break;
      case 'me': if (game) { const p = game.players.find(x => x.remote); if (p) { p.net = p.net || { cur: null, age: 0 }; p.net.cur = m.st; p.net.age = 0; } } break;
      case 'honk': if (game) { const p = game.players.find(x => x.remote); if (p && p.active) { game.emit('horn', { p, net: true }); game.honk(p, typeof m.x === 'number' ? { x: m.x, z: m.z } : null); } } break;
      case 'smash': if (game) { const pk = game.world.pumpkins[m.i], p = game.players.find(x => x.remote); if (pk && pk.alive) { game.world.smashPumpkin(pk); if (p) p.pumpkins++; game.emit('pumpkin', { pk, p, net: true }); } else if (p) p.pumpkins++; } break;
      case 'esc': if (game) { const p = game.players.find(x => x.remote); if (p) game.escape(p); } break;
      case 'thr': if (game && game.thrasher.controller === 'remote') { const th = game.thrasher; th.net = th.net || { cur: null, age: 0 }; th.net.cur = m.st; th.net.age = 0; } break;
      case 'roar': if (game && game.thrasher.controller === 'remote') game.roar(game.thrasher); break;
      case 'knock': if (game) { const p = game.players.find(x => !x.remote); if (p) p.knock(m.nx, m.nz, m.pw); } break;
      case 'ev': if (game) relayed(game, m); break;
      case 'results': if (game) { game.over = true; game.state = 'over'; TT.menu.gameOver(m.r, game); } break;
    }
  }

  // ---- in the game ----
  N.tick = (dt, game) => {
    if (game !== N.game) return;
    if (game.hold && N.role === 'host') { N.holdT += dt; if (N.holdT > 15) go(); }
    N.sendT -= dt;
    if (N.sendT > 0 || !N.connected) return;
    if (N.role === 'host') { N.sendT = 1 / SNAP_HZ; send({ t: 'snap', s: game.snapshot() }); }
    else {
      N.sendT = 1 / ME_HZ;
      const me = game.players.find(x => !x.remote);
      if (me) send({ t: 'me', st: me.netState() });
      if (game.thrasher.controller === 'local') send({ t: 'thr', st: game.thrasher.netState() }); // the guest is driving Thrasher
    }
  };
  N.sendHonk = p => send({ t: 'honk', x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });
  N.sendSmash = i => send({ t: 'smash', i });
  N.sendEscape = () => send({ t: 'esc' });
  N.sendRoar = () => send({ t: 'roar' });
  N.sendHit = (p, nx, nz, pw) => send({ t: 'knock', nx, nz, pw });
  // host -> guest: things the guest should hear and see that the host decided
  const RELAY = new Set(['tip', 'honkResult', 'hit', 'caught', 'escape', 'bale', 'pumpkin', 'wary', 'horn', 'boost', 'over', 'bigRoar']);
  const GUEST_OWN = new Set(['horn', 'boost', 'pumpkin', 'escape']);
  N.relayEvent = e => {
    if (!N.connected || N.role !== 'host' || !RELAY.has(e.type)) return;
    if (e.type === 'over') { send({ t: 'results', r: e.results }); return; }
    if (e.p && e.p.remote && GUEST_OWN.has(e.type)) return;
    const m = { t: 'ev', type: e.type };
    if (e.p) m.s = e.p.slot;
    if (e.tr) m.i = e.tr.i;
    if (e.b) m.i = N.game.world.bales.indexOf(e.b);
    if (e.pk) m.i = e.pk.i;
    if (e.n !== undefined) m.n = e.n;
    if (e.lost !== undefined) m.lost = e.lost;
    send(m);
  };
  function relayed(game, m) {
    const p = m.s !== undefined ? game.players.find(x => x.slot === m.s) : null;
    const e = { net: true, p };
    if (m.type === 'tip' || m.type === 'wary') e.tr = game.tractors[m.i];
    if (m.type === 'bale') { const b = game.world.bales[m.i]; if (!b || !b.alive) return; game.world.smashBale(b); e.b = b; }
    if (m.type === 'pumpkin') { const pk = game.world.pumpkins[m.i]; if (!pk || !pk.alive) return; game.world.smashPumpkin(pk); e.pk = pk; }
    if (m.type === 'escape' && p) { if (p.escaped) return; p.escaped = true; p.happyT = 99; }
    if (m.type === 'caught' && p) p.caught = true;
    if (m.type === 'tip' && p) p.happyT = 2.2;
    if (m.n !== undefined) e.n = m.n;
    if (m.lost !== undefined) e.lost = m.lost;
    game.emit(m.type, e);
  }
})();
