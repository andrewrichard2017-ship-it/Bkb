// Bubble Odyssey: online co-op for two over WebRTC (PeerJS, vendored with Road Rumble in ../road/lib).
// The host runs the board: every shot (its own and the guest's) settles on the host, which sends back where
// it landed, what popped and the new board. The guest flies its own shots straight away so there's no lag
// on the trigger, parks them where they hit, and lets the host's answer put them in place.
(() => {
  'use strict';
  const BB = window.BB;
  const PREFIX = 'bubbleodyssey-v1-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const N = BB.net = { active: false, role: null, code: '', peer: null, conn: null, connected: false, lobby: { mode: 'career', level: 1, names: ['', ''] }, game: null, aimT: 0, lastAim: [0, 0] };
  const G = () => BB.main, M = () => BB.menu;

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

  N.host = async name => {
    await loadLib();
    N.leave();
    N.role = 'host'; N.active = true; N.lobby = { mode: 'career', level: M().frontier(true), names: [name, ''] };
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
      const timer = setTimeout(() => rej(new Error('No answer from ' + code + '. Check the code, and that the host is still waiting.')), 15000);
      p.on('open', () => { const conn = p.connect(PREFIX + code, { reliable: true, serialization: 'json' }); attach(conn, () => { clearTimeout(timer); res(); }); });
      p.on('error', err => { clearTimeout(timer); if (!N.connected) rej(err.type === 'peer-unavailable' ? new Error('No game with code ' + code + '.') : err); });
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
      if (N.role === 'guest') send({ t: 'hello', name: N.myName });
      if (onOpen) onOpen();
    });
    conn.on('data', onData);
    conn.on('close', () => lost());
    conn.on('error', () => lost());
  }
  function lost() {
    if (!N.connected) return;
    N.connected = false; clearInterval(N.beat);
    const inGame = G().game && G().game === N.game && !G().attract;
    if (N.role === 'host') {
      N.conn = null; N.lobby.names[1] = '';
      if (inGame) BB.render.showToast('Your mate disconnected. Carry on solo!', '#9fe8ff');
      else if (M().screen === 'lobby' || M().screen === 'results') M().show('hosting', { status: 'Your mate left. Waiting for someone to join…' });
    } else {
      N.leave();
      BB.render.showToast('The host left the game', '#9fe8ff');
      setTimeout(() => { if (G().game) G().quit(); M().show('online'); }, inGame ? 1800 : 0);
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

  // ---- lobby and starting ----
  N.updateLobby = () => { if (N.role === 'host') send({ t: 'lobby', lobby: N.lobby }); };
  N.startGame = () => { if (N.role === 'host' && N.connected) N.next(N.lobby.mode === 'endless' ? 0 : N.lobby.level); };
  // host: start (or restart) a game: level 0 means endless
  N.next = level => {
    if (N.role !== 'host') return;
    const L = N.lobby, mode = level ? 'career' : 'endless';
    if (level) L.level = level;
    const m = { t: 'start', mode, level, seed: (Math.random() * 1e9) >>> 0, world: Math.floor(Math.random() * 5), names: L.names };
    send(m); begin(m);
  };
  N.toLobby = () => { if (N.role !== 'host') return; G().quit(true); send({ t: 'lobby', lobby: N.lobby, show: true }); M().show('lobby'); };
  function begin(m) {
    const host = N.role === 'host';
    const players = [{ name: m.names[0] || 'Host', remote: !host }, { name: m.names[1] || 'Guest', remote: host }];
    const cfg = { mode: m.mode, level: m.level, seed: m.seed, players, role: N.role };
    if (m.mode === 'endless') cfg.world = m.world;
    const game = G().start(cfg);
    N.game = game;
    game.on(onGameEvent);
    if (host) send({ t: 'st', s: game.snapshot() });
  }
  N.sendResults = r => send({ t: 'results', r });

  // ---- what each side tells the other about its own game ----
  const slim = q => ({ r: q.r, c: q.c, x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100, color: q.color, k: q.k });
  const slimRes = res => ({ r: res.r, c: res.c, x: res.x, y: res.y, color: res.color, power: res.power, placed: res.placed, star: res.star, zap: res.zap, freed: res.freed,
    pops: res.pops.map(slim), cracks: res.cracks.map(slim), drops: res.drops.map(slim), booms: res.booms });
  function onGameEvent(e, game) {
    if (game !== N.game || !N.connected) return;
    if (N.role === 'host') {
      switch (e.type) {
        case 'fire': send({ t: 'fire', id: e.shot.id, s: e.p.slot, a: e.shot.angle, c: e.shot.color, pw: e.shot.power }); break;
        case 'land': if (e.revive) break; send({ t: 'land', id: e.shot.id, s: e.p ? e.p.slot : 0, res: slimRes(e.res), pts: e.pts, mult: e.mult, combo: e.combo, dmg: e.dmg, fever: e.fever ? [e.p.slot, e.fever] : null, pushed: N.pushes || 0, st: game.snapshot() }); N.pushes = 0; break;
        case 'push': N.pushes = (N.pushes || 0) + 1; break;
        case 'swap': case 'arm': send({ t: 'pl', pl: game.snapshot().pl }); break;
        case 'win': send({ t: 'win', res: { drops: e.res.drops.map(slim), pops: [], cracks: [], booms: [], freed: 0 }, pts: e.pts, sc: game.score }); break;
        case 'bonus': send({ t: 'bonus', s: e.p.slot, sl: game.shotsLeft, sc: game.score }); break;
        case 'lose': send({ t: 'lose', reason: e.reason }); break;
      }
    } else {
      const mine = e.p && !e.p.remote;
      if (e.type === 'fire' && mine && !e.net) send({ t: 'shoot', id: e.shot.id, a: e.shot.angle, c: e.shot.color, pw: e.shot.power });
      if (e.type === 'swap' && mine) send({ t: 'swap' });
    }
  }

  function onData(m) {
    N.lastRx = performance.now();
    const game = N.game && G().game === N.game ? N.game : null;
    const remote = game ? game.players.find(p => p.remote) : null;
    switch (m.t) {
      case 'ping': break;
      // lobby
      case 'hello': N.lobby.names[1] = m.name || 'Guest'; send({ t: 'lobby', lobby: N.lobby }); if (!game) M().show('lobby'); BB.audio.sfx('confirm'); break;
      case 'full': N.leave(); M().show('join', { code: N.code, status: 'That game already has two players.', auto: false }); break;
      case 'lobby': N.lobby = m.lobby; if (m.show && G().game) G().quit(true); if (m.show || M().screen === 'lobby' || M().screen === 'join') M().show('lobby'); break;
      case 'start': begin(m); break;
      // host -> guest
      case 'st': if (game) game.applyState(m.s, true); break;
      case 'pl': if (game) m.pl.forEach((v, i) => { const p = game.players[i]; if (p) [p.cur, p.next, p.power, p.powerFrom] = v; }); break;
      case 'fire': if (game && remote && remote.slot === m.s) game.spawnShot(remote, { id: m.id, angle: m.a, color: m.c, power: m.pw }); break;
      case 'land': if (game) {
        const shot = game.shots.find(s => s.id === m.id);
        if (shot) game.removeShot(shot);
        game.applyState(m.st);
        const p = game.players[shot ? shot.owner : m.s || 0];
        for (let i = 0; i < (m.pushed || 0); i++) game.emit('push', {});
        game.emit('land', { p, shot: shot || { power: m.res.power }, res: m.res, pts: m.pts, mult: m.mult, combo: m.combo, dmg: m.dmg, net: true });
        if (m.fever) game.emit('fever', { p: game.players[m.fever[0]], power: m.fever[1] });
      } break;
      case 'cancel': if (game) { const s = game.shots.find(x => x.id === m.id); if (s) game.removeShot(s); game.applyState(m.st); } break;
      case 'win': if (game) { for (const s of game.shots.slice()) game.removeShot(s); game.board.rows = []; game.score = m.sc; game.state = 'won'; game.emit('win', { res: m.res, pts: m.pts }); } break;
      case 'bonus': if (game) { game.shotsLeft = m.sl; game.score = m.sc; game.emit('bonus', { p: game.players[m.s] || game.players[0] }); } break;
      case 'lose': if (game) { for (const s of game.shots.slice()) game.removeShot(s); game.state = 'lost'; game.emit('lose', { reason: m.reason }); } break;
      case 'results': if (game) { game.state = m.r.won ? 'won' : 'lost'; game.result = m.r; M().gameOver(m.r, game); } break;
      // guest -> host
      case 'shoot': if (game && remote) {
        if (remote.flying) { remote.queued = m; break; }
        shootFor(game, remote, m);
      } break;
      case 'swap': if (game && remote) game.swap(remote); break;
      // both
      case 'aim': if (game && remote && !remote.flying) game.aim(remote, m.a); break;
    }
  }
  function shootFor(game, p, m) {
    game.aim(p, m.a);
    if (!m.pw && p.power) { p.power = null; p.powerFrom = null; }
    const shot = game.fire(p, { id: m.id, color: m.pw ? -1 : m.c });
    if (!shot) send({ t: 'cancel', id: m.id, st: game.snapshot() });
  }

  // every frame: share where we're aiming, and fire the guest's shot that arrived while its last one was still flying
  N.tick = (dt, game) => {
    if (!N.active || game !== N.game || !N.connected) return;
    N.aimT -= dt;
    const me = game.players.find(p => !p.remote);
    if (me && N.aimT <= 0 && Math.abs(me.angle - N.lastAim[0]) > 0.004) { N.aimT = 0.08; N.lastAim[0] = me.angle; send({ t: 'aim', a: Math.round(me.angle * 1000) / 1000 }); }
    if (N.role === 'host') { const r = game.players.find(p => p.remote); if (r && r.queued && !r.flying) { const m = r.queued; r.queued = null; shootFor(game, r, m); } }
  };
})();
