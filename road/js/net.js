// Road Rumble: online races for two over WebRTC (PeerJS). The host runs the race (pack, cops, results);
// the guest drives their own bike and sends its state; hits that cross between the two are sent as events.
// Both sides build the same road and traffic from the race seed, so traffic never needs sending.
(() => {
  'use strict';
  const RR = window.RR;
  const PREFIX = 'roadrumble-v1-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const SEND_HZ = 20;

  const N = RR.net = {
    active: false, role: null, code: '', peer: null, conn: null, connected: false,
    lobby: { track: 0, level: 1, bikes: ['viper', 'viper'], names: ['', ''] }, sendT: 0, race: null,
  };

  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'lib/peerjs.min.js?v=1';
      s.onload = () => res(); s.onerror = () => rej(new Error('could not load the network library'));
      document.head.appendChild(s);
    });
  }
  // ?peerhost=localhost&peerport=9000 points at a self-hosted PeerJS server (testing)
  function peerOpts() {
    const q = new URLSearchParams(location.search), o = { debug: 1 };
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 9000); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1'; }
    return o;
  }
  const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  N.inviteLink = () => { const u = new URL(location.href); u.search = ''; const q = new URLSearchParams(location.search); for (const k of ['peerhost', 'peerport', 'peerpath', 'peersecure']) if (q.get(k)) u.searchParams.set(k, q.get(k)); u.searchParams.set('join', N.code); return u.toString(); };

  function status(text) { if (RR.menu.screen === 'hosting') RR.menu.show('hosting', { status: text }); else if (RR.menu.screen === 'join') RR.menu.show('join', { code: N.code, status: text, auto: false }); else RR.hud.message(0, text, { color: '#64b5f6' }); }

  N.host = async (name) => {
    await loadLib();
    N.leave();
    N.role = 'host'; N.active = true; N.lobby = { track: 0, level: 1, bikes: [RR.career.bike || 'viper', 'viper'], names: [name, ''] };
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
      p.on('error', err => { clearTimeout(timer); if (!N.connected) rej(err.type === 'peer-unavailable' ? new Error('no race with code ' + code) : err); });
    });
  };

  function attach(conn, onOpen) {
    N.conn = conn;
    conn.on('open', () => {
      N.connected = true; N.lastRx = performance.now();
      clearInterval(N.beat);
      // heartbeat: WebRTC can take a long time to notice a closed tab
      N.beat = setInterval(() => {
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
    const g = RR.game, race = g.race && !g.attract ? g.race : null;
    if (N.role === 'host') {
      if (race) { // the guest's rider carries on as a computer rider
        for (const r of race.riders) if (r.remote) { if (r.crash) r.remount(); r.remote = false; r.human = false; r.view = null; r.ai = { pref: 3.6, targetD: r.d, laneT: 0, prey: null, preyT: 0, cd: 0, skill: 1, aggro: 0.5 }; }
        RR.hud.message(0, 'YOUR MATE DISCONNECTED', { big: true, color: '#64b5f6', hold: 3 });
      } else { N.lobby.names[1] = ''; if (RR.menu.screen === 'lobby') RR.menu.show('hosting', { status: 'Your mate left. Waiting for someone to join…' }); }
      N.conn = null;
    } else {
      N.leave();
      if (race) RR.hud.message(0, 'THE HOST LEFT', { big: true, color: '#64b5f6', hold: 3 });
      setTimeout(() => { if (RR.game.race && !RR.game.attract) RR.menu.acts.quit(); else RR.menu.show('online'); }, race ? 2500 : 0);
    }
  }
  function send(m) { if (N.conn && N.conn.open) try { N.conn.send(m); } catch (e) { /* closed */ } }
  N.send = send;
  N.leave = () => {
    N.connected = false; clearInterval(N.beat);
    if (N.conn) { try { N.conn.close(); } catch (e) { /* ignore */ } N.conn = null; }
    if (N.peer) { try { N.peer.destroy(); } catch (e) { /* ignore */ } N.peer = null; }
    N.active = false; N.role = null;
  };

  // ---- lobby ----
  N.updateLobby = () => send({ t: N.role === 'host' ? 'lobby' : 'pick', lobby: N.lobby, bike: N.lobby.bikes[1] });
  N.startRace = () => {
    if (N.role !== 'host' || !N.connected) return;
    const L = N.lobby, seed = Math.floor(Math.random() * 100000);
    send({ t: 'start', track: L.track, level: L.level, bikes: L.bikes, names: L.names, seed });
    begin(L.track, L.level, L.bikes, L.names, seed);
  };
  function begin(track, level, bikes, names, seed) {
    const host = N.role === 'host';
    const humans = [
      { name: names[0] || 'Host', bikeId: bikes[0], look: RR.PLAYER_LOOKS[0], view: host ? 0 : null, remote: !host, slot: 0 },
      { name: names[1] || 'Guest', bikeId: bikes[1], look: RR.PLAYER_LOOKS[1], view: host ? null : 0, remote: host, slot: 1 },
    ];
    N.ready = false;
    RR.menu.startOnline({ trackIndex: track, level: level - 1, mode: 'online', role: N.role, humans, seed, packSize: 10 }).then(race => {
      N.race = race; race.net = N; race.hold = true;
      for (const r of race.riders) if (r.remote) r.net = { cur: null, age: 0 };
      if (host) { N.holdT = 0; if (N.guestReady) go(); } else send({ t: 'ready' });
    });
  }
  function go() { if (!N.race || !N.race.hold) return; N.race.hold = false; send({ t: 'go' }); }

  // ---- messages ----
  function onData(m) {
    N.lastRx = performance.now();
    const race = N.race && RR.game.race === N.race ? N.race : null;
    switch (m.t) {
      case 'hello': N.lobby.names[1] = m.name || 'Guest'; send({ t: 'lobby', lobby: N.lobby }); RR.menu.show('lobby'); RR.audio.sfx('confirm'); break;
      case 'full': N.leave(); RR.menu.show('join', { code: N.code, status: 'That race already has two riders.', auto: false }); break;
      case 'lobby': N.lobby = m.lobby; if (RR.menu.screen === 'lobby' || RR.menu.screen === 'join') RR.menu.show('lobby'); break;
      case 'pick': N.lobby.bikes[1] = m.bike; send({ t: 'lobby', lobby: N.lobby }); if (RR.menu.screen === 'lobby') RR.menu.show('lobby'); break;
      case 'start': N.guestReady = false; begin(m.track, m.level, m.bikes, m.names, m.seed); break;
      case 'ready': N.guestReady = true; go(); break;
      case 'go': if (race) { race.hold = false; } else N.pendingGo = true; break;
      case 'snap': if (race) applySnap(race, m); break;
      case 'me': if (race) { const r = race.riders.find(x => x.remote && x.human); if (r && r.net) { r.net.cur = m.st; r.net.age = 0; r.finishedRemote = m.st.fin; } } break;
      case 'hit': if (race) { const att = race.byId.get(m.a), tgt = race.byId.get(m.b); if (tgt) { if (m.i.steal) tgt.weapon = null; race.netHit(att, tgt, m.i); } } break;
      case 'weapon': if (race) { const r = race.byId.get(m.r); if (r && !r.remote) { r.weapon = m.w; race.emit('weapon', { who: r, w: m.w }); } } break;
      case 'busted': if (race) { const r = race.byId.get(m.r); if (r && !r.remote) { r.out = 'busted'; race.emit('busted', { who: r }); } } break;
      case 'ev': if (race) relayed(race, m); break;
      case 'results': if (race) { race.over = true; RR.menu.raceOver(m.results, race); } break;
    }
  }

  // ---- in the race ----
  N.tick = (dt, race) => {
    if (race !== N.race) return;
    if (race.hold && N.pendingGo) { race.hold = false; N.pendingGo = false; }
    if (race.hold && N.role === 'host') { N.holdT += dt; if (N.holdT > 12) go(); }
    N.sendT -= dt;
    if (N.sendT > 0 || !N.connected) return;
    N.sendT = 1 / SEND_HZ;
    if (N.role === 'host') {
      const r = [];
      for (const x of race.riders) if (!x.remote) r.push([x.id, x.packState()]);
      send({ t: 'snap', time: Math.round(race.time * 1000) / 1000, state: race.state, r });
    } else {
      const me = race.riders.find(x => !x.remote && x.human);
      if (me) send({ t: 'me', st: me.packState() });
    }
  };
  function applySnap(race, m) {
    // keep the guest's clock (and so the traffic) in step with the host's
    const diff = m.time - race.time;
    if (Math.abs(diff) > 0.4) race.time = m.time; else race.time += diff * 0.1;
    if (m.state === 'race' && race.state === 'countdown' && race.time > -0.2) { race.state = 'race'; race.emit('go'); }
    for (const [id, st] of m.r) {
      const r = race.byId.get(id);
      if (!r || !r.remote) continue;
      if (!r.net) r.net = { cur: null, age: 0 };
      r.net.cur = st; r.net.age = 0; r.finishedRemote = st.fin;
      if (r.cop) r.siren = st.siren;
    }
  }
  N.sendHit = (att, tgt, info) => send({ t: 'hit', a: att.id, b: tgt.id, i: info });
  N.sendWeapon = (r, w) => send({ t: 'weapon', r: r.id, w });
  N.sendBusted = r => send({ t: 'busted', r: r.id });
  // host -> guest: things the guest should hear and see that happened on the host
  const RELAY = new Set(['hit', 'crash', 'finish', 'copGo', 'nitro', 'steal', 'busted', 'raceOver', 'shoot', 'gun', 'blaze', 'frenzy', 'smash', 'pickup']);
  N.relayEvent = e => {
    if (!N.connected || !RELAY.has(e.type) || e.net) return;
    if (e.type === 'raceOver') { send({ t: 'results', results: e.results }); return; }
    const m = { t: 'ev', type: e.type, who: e.who ? e.who.id : null };
    if (e.tgt) m.tgt = e.tgt.id;
    if (e.by) m.by = e.by.id;
    if (e.prey) m.prey = e.prey.id;
    if (e.info) m.info = { sfx: e.info.sfx, side: e.info.side, kind: e.info.kind };
    if (e.side) m.side = e.side;
    if (e.cause) m.cause = e.cause;
    if (e.place) m.place = e.place;
    if (e.w) m.w = e.w;
    send(m);
  };
  function relayed(race, m) {
    const who = race.byId.get(m.who), tgt = m.tgt !== undefined ? race.byId.get(m.tgt) : null;
    const mine = r => r && !r.remote;
    // the guest already handled anything involving its own rider
    if (mine(who) || mine(tgt)) {
      if (m.type === 'crash' && m.by !== undefined && mine(race.byId.get(m.by))) race.emit('crash', { who, cause: m.cause, by: race.byId.get(m.by), net: true });
      return;
    }
    const e = { who, net: true };
    if (tgt) e.tgt = tgt;
    if (m.by !== undefined) e.by = race.byId.get(m.by);
    if (m.prey !== undefined) e.prey = race.byId.get(m.prey);
    if (m.info) e.info = m.info;
    if (m.side) e.side = m.side;
    if (m.cause) e.cause = m.cause;
    if (m.place) e.place = m.place;
    if (m.w) e.w = m.w;
    race.emit(m.type, e);
  }
})();
