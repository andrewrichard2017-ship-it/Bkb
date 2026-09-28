// Fight flow: title -> tale of the tape -> rounds -> knockdowns / corner -> result.
(() => {
  'use strict';
  const BK = window.BK, ctx = BK.ctx, W = BK.W, H = BK.H;
  const { clamp } = BK;

  const g = BK.game = {
    state: 'title', stateT: 0, paused: false, t: 0,
    round: 1, totalRounds: 3, clock: BK.ROUND_LEN, roundLog: [], result: null, tip: '',
    slowmo: 0, stop: 0, kd: null, recorded: false,
  };
  // Build both fighters from the menu picks. Same man in both corners gets his alternate colours.
  g.setupFighters = cpuKey => {
    const s = BK.settings, ok = k => BK.FIGHTERS[k];
    if (!ok(s.player)) s.player = 'michael';
    if (!ok(s.cpu)) s.cpu = 'johnjoe';
    const ck = cpuKey || s.cpu;
    g.p1 = new BK.Fighter(s.player, 0);
    g.p2 = new BK.Fighter(ck, 1, ck === s.player);
    g.ai = new BK.AI(g.p2, g.p1);
  };
  // Two players: blue corner is a person on a second controller (or the keyboard) instead of the CPU.
  g.twoPlayer = false;
  g.togglePlayers = () => { BK.settings.players = BK.settings.players === 2 ? 1 : 2; BK.saveSettings(); g.twoPlayer = BK.settings.players === 2; };
  g.isHuman = f => f.side === 0 || g.twoPlayer;
  g.cycleFighter = which => {
    const o = BK.FIGHTER_ORDER, s = BK.settings;
    s[which] = o[(o.indexOf(s[which]) + 1) % o.length];
    BK.saveSettings(); g.setupFighters();
  };
  g.setupFighters();
  g.twoPlayer = BK.settings.players === 2;
  g.ref = new BK.Referee();

  const setState = s => { g.state = s; g.stateT = 0; BK.ui.focusPt = null; g.showControls = false; };
  // Freeze-frame on impact: the world holds for a few frames so hits land with weight.
  g.hitstop = d => { g.stop = Math.max(g.stop, d); };
  const IDLE = { mx: 0, my: 0 };

  // ---------- transitions ----------
  g.toTitle = () => {
    g.paused = false; BK.getup.stop(); BK.audio.hush(); g.tour = null; g.twoPlayer = BK.settings.players === 2;
    g.setupFighters(); g.p1.resetFight(); g.p2.resetFight(); g.ref.reset(); BK.fx.clear();
    setState('title');
  };
  g.toTape = () => { g.twoPlayer = BK.settings.players === 2 && !g.tour; g.setupFighters(g.tour ? g.tour.order[g.tour.index] : null); BK.fx.clear(); g.result = null; setState('tape'); };

  // ---------- tournament ----------
  // Fight everyone else in turn. Health carries over between fights, +10 after each win. Lose and you're out.
  g.startTournament = () => {
    g.twoPlayer = false; // tournaments are you against the field
    const me = BK.settings.player;
    g.tour = { order: BK.TOUR_ORDER.filter(k => k !== me), index: 0, hp: 100 };
    setState('ladder');
  };
  g.tourNext = () => {
    const t = g.tour;
    t.hp = Math.min(100, Math.max(1, g.p1.hp) + 10);
    t.index++;
    if (t.index >= t.order.length) {
      BK.record.champs = (BK.record.champs || 0) + 1; BK.saveRecord();
      setState('champion'); g.p1.celebrate = true; BK.audio.roar(1); BK.audio.bell(3);
    } else setState('ladder');
  };
  g.startFight = () => {
    g.totalRounds = BK.settings.rounds; g.round = 1; g.roundLog = []; g.result = null; g.recorded = false;
    g.p1.resetFight(); g.p2.resetFight(); g.ai.reset(); BK.fx.clear();
    if (g.tour) { g.p1.hp = g.p1.ghostHp = g.tour.hp; } // tournament: carry your health in
    BK.replay.clear(); g.pendingReplay = null;
    g.ref.reset();
    setState('walkout');
    BK.walkout.start(g);
  };
  g.beginRound = () => beginRound();
  function beginRound() {
    g.p1.resetRound(); g.p2.resetRound(); g.ref.reset();
    g.clock = BK.ROUND_LEN; g.kd = null; g.clapped = false; g.pendingReplay = null;
    g.refTalkT = BK.rnd(6, 45); g.refTalks = 0; // first line at a random point in the round
    BK.replay.clear();
    for (const f of [g.p1, g.p2]) f.sweat *= 0.6; // towelled off in the corner
    BK.input.releaseAll();
    setState('roundIntro');
  }
  // Recovery between rounds for both fighters; the corner scene adds one boost on top.
  const recover = (f, hp) => {
    f.hp = Math.min(f.maxHp, f.hp + hp); f.ghostHp = f.hp;
    f.stamina = f.maxSta; f.damage = Math.max(0, f.damage - 0.08);
  };
  g.workCorner = () => {
    if (g.twoPlayer) { // red corner picks, then blue
      g.cpuBoost = null;
      BK.corner.start(g.p1, g.p2, null, () => { BK.corner.start(g.p2, g.p1, null, () => g.nextRound()); });
    } else {
      g.cpuBoost = BK.pick(Object.keys(BK.CORNER_BOOSTS)); // the CPU's corner decides too
      BK.corner.start(g.p1, g.p2, g.cpuBoost, () => g.nextRound());
    }
    setState('cornerGame');
  };
  g.nextRound = () => {
    if (g.state === 'corner' && !g.twoPlayer) g.cpuBoost = BK.pick(Object.keys(BK.CORNER_BOOSTS)); // skipped the scene
    if (g.cpuBoost) BK.applyBoost(g.p2, g.cpuBoost);
    recover(g.p1, 22);
    recover(g.p2, g.twoPlayer ? 22 : 22 * [0.85, 1, 1.15][BK.settings.difficulty]);
    g.cpuBoost = null; BK.corner.active = false;
    g.round++;
    beginRound();
  };
  g.pause = () => { if (['fight', 'knockdown', 'roundIntro'].includes(g.state) && !BK.replay.active) { g.paused = true; BK.input.releaseAll(); } };
  g.resume = () => { g.paused = false; g.showControls = false; BK.ui.focusPt = null; };
  g.togglePause = () => { if (g.paused) g.resume(); else { g.pause(); BK.ui.focusPt = null; } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) g.pause(); });

  // ---------- knockdowns ----------
  const idx = f => (f === g.p1 ? 0 : 1);
  // At zero health it's a coin toss: down he goes, or he's out on his feet. Out on his feet he can't defend
  // himself for OOF_LEN seconds (every hit bleeds him more) and then the referee steps in for a standing count.
  // A super always puts him down, and so does a knockdown that would be the third of the round (a TKO).
  const OOF_LEN = BK.OOF_LEN = 15;
  g.onZeroHp = (victim, attacker, how) => {
    if (g.state !== 'fight') return;
    if (victim.oof) return; // already gone: he just soaks it up until the ref steps in
    const superHit = BK.PUNCHES[how] && BK.PUNCHES[how].super;
    if (!superHit && victim.kdRound < 2 && Math.random() < 0.5) outOnFeet(victim, attacker);
    else g.onKnockdown(victim, attacker, how);
  };
  function outOnFeet(victim, attacker) {
    victim.oof = { t: 0 };
    victim.hp = 0; victim.punch = null; victim.blocking = false; victim.slip = null; victim.grab = null; victim.stagger = 0;
    victim.maxSta = Math.max(50, victim.maxSta - 5); // costs him 5% of his stamina for the rest of the fight
    victim.stamina = Math.min(victim.stamina, victim.maxSta);
    victim.blood = Math.min(1, victim.blood + 0.1);
    BK.fx.blood(victim.headX, victim.headY, attacker.dir, victim.sy, 2.5);
    BK.fx.popup('OUT ON HIS FEET!', victim.sx, victim.sy - 330 * victim.fs, '#e2584f', 58);
    victim.grunt('down', true);
    g.slowmo = 0.7; BK.cam.shake = 18;
    BK.audio.thump(); BK.audio.roar(1);
    BK.vibrate([60, 40, 90], victim.side);
  }
  function standingCount(victim) {
    const attacker = victim === g.p1 ? g.p2 : g.p1;
    victim.kdTotal++; victim.kdRound++; attacker.stats.kd++; // scored as a knockdown
    victim.punch = null; victim.blocking = false;
    g.kd = { victim, attacker, t: 0, count: 0, next: 1.2, rising: false, resumeAt: 0, tko: false, getUpAt: cpuGetUpAt(victim), standing: true };
    g.ref.victim = victim; g.ref.mode = 'count';
    BK.fx.popup('STANDING COUNT', victim.sx, victim.sy - 330 * victim.fs, BK.PAL.bone, 56);
    BK.audio.roar(0.6);
    setState('knockdown');
  }
  // CPU: always beats the first two counts; after that it's a bonus
  function cpuGetUpAt(victim) {
    if (g.isHuman(victim)) return 99;
    const later = [0.75, 0.5, 0.3, 0.15][Math.min(3, victim.kdTotal - 3)];
    const chance = victim.kdTotal <= 2 ? 1 : later * [0.85, 1, 1.12][BK.settings.difficulty];
    return Math.random() < chance ? Math.floor(BK.rnd(3, 9.99)) : 99;
  }
  g.onKnockdown = (victim, attacker, how) => {
    if (g.state !== 'fight') return;
    const replay = { at: g.t + 1.25, tHit: g.t, v: idx(victim), a: idx(attacker) };
    const superHit = BK.PUNCHES[how] && BK.PUNCHES[how].super;
    if (superHit) { g.flashT = 0.25; BK.vibrate([120, 60, 200]); } // super punch: extra flash, then a normal count
    g.pendingReplay = replay;
    victim.knockDown();
    attacker.stats.kd++;
    const tko = victim.kdRound >= 3;
    g.kd = { victim, attacker, t: 0, count: 0, next: 1.5, rising: false, resumeAt: 0, tko, getUpAt: 99 };
    g.slowmo = 1.1;
    BK.cam.shake = superHit ? 30 : 22;
    BK.audio.thump(); BK.audio.roar(0.9);
    BK.vibrate([80, 40, 120], victim.side);
    BK.fx.popup(tko ? 'THIRD KNOCKDOWN!' : 'DOWN!', victim.sx, victim.sy - 330 * victim.fs, BK.PAL.blood, 64);
    g.ref.victim = victim;
    if (tko) g.ref.waveOff(); else g.ref.mode = 'count';
    g.kd.getUpAt = cpuGetUpAt(victim);
    setState('knockdown');
  };
  function rise() {
    const kd = g.kd, v = kd.victim;
    kd.rising = true; kd.resumeAt = kd.t + 1.7;
    v.getUp(Math.max(20, 58 - 13 * (v.kdTotal - 1)));
    BK.audio.roar(0.5);
    if (kd.standing) { v.oof = null; v.rising = false; } // shakes his head clear and puts his hands up
    BK.fx.popup(kd.standing ? `CLEARS HIS HEAD AT ${kd.count}` : `UP AT ${kd.count}`, v.sx, v.sy - 330 * v.fs, BK.PAL.brass, 54);
  }
  function updateKnockdown(dt) {
    const kd = g.kd, v = kd.victim, a = kd.attacker;
    kd.t += dt;
    const corner = a.steer(v.u < 0.5 ? 0.9 : 0.1, 0.84);
    a.update(dt, kd.t > 0.6 ? corner : IDLE, v);
    v.update(dt, IDLE, a);
    g.ref.update(dt, g.p1, g.p2);
    if (kd.tko) { if (kd.t > 2.6) stoppage('TKO', 'Three knockdowns in the round'); return; }
    if (!kd.rising) {
      if (kd.t >= kd.next) {
        kd.next += 1.05; kd.count++;
        g.ref.countGesture();
        if (!BK.audio.clip(`count-${kd.count}`)) BK.audio.say(String(kd.count));
        if (kd.count === 1 && g.isHuman(v)) BK.getup.start(v, rise);
        if (!g.isHuman(v) && kd.count === kd.getUpAt) rise();
        if (kd.count >= 10 && !kd.rising) {
          if (kd.standing) { v.oof = null; v.knockDown(); stoppage('KNOCKOUT', 'Counted out on his feet'); return; } // and down he goes
          stoppage('KNOCKOUT', 'Counted out'); return;
        }
      }
    } else if (kd.t >= kd.resumeAt) {
      BK.getup.stop();
      g.ref.mode = 'follow'; g.ref.victim = null; g.ref.box();
      BK.fx.popup('BOX!', g.ref.sx, g.ref.sy - 300 * g.ref.fs, BK.PAL.bone, 56);
      setState('fight'); g.stateT = 1; // skip the FIGHT! banner
    }
  }
  function stoppage(method, how) {
    const v = g.kd.victim, w = g.kd.attacker;
    v.ko = true; v.rising = false; v.liftTarget = 0;
    BK.getup.stop();
    w.celebrate = true;
    g.ref.mode = 'wave';
    g.slowmo = 0.8;
    BK.audio.bell(4); BK.audio.roar(1);
    finish({ winner: w, method, detail: `${how}  ·  ROUND ${g.round}  ·  ${BK.fmtClock(BK.ROUND_LEN - g.clock)}` });
    setState('fightOver');
  }

  // ---------- referee chatter ----------
  // Recorded lines, at random moments, never more than twice a round. None at the moment: to add one, put the
  // mp3 in audio/, add [text, name] here and the name to CLIPS in audio.js.
  const REF_LINES = [];
  const REF_PER_ROUND = 2;
  function refChatter(dt) {
    if (!REF_LINES.length || g.refTalks >= REF_PER_ROUND) return;
    g.refTalkT -= dt;
    if (g.refTalkT > 0 || g.p1.clinch) return;
    // don't repeat the last line straight away
    const lines = REF_LINES.filter(l => l[1] !== g.lastRefLine);
    const clip = BK.pick(lines.length ? lines : REF_LINES)[1];
    BK.audio.clip(clip);
    g.lastRefLine = clip; g.refTalks++;
    g.refTalkT = BK.rnd(18, 40);
  }


  // ---------- rounds & scoring (10-point must system) ----------
  function scoreRound() {
    const a = g.p1, b = g.p2;
    const log = { dmg: [a.roundDmg, b.roundDmg], landed: [a.roundLanded, b.roundLanded], kd: [a.kdRound, b.kdRound], cards: [] };
    for (let j = 0; j < 3; j++) {
      let s;
      if (log.kd[0] !== log.kd[1]) {
        const diff = Math.abs(log.kd[0] - log.kd[1]);
        s = log.kd[0] < log.kd[1] ? [10, Math.max(6, 9 - diff)] : [Math.max(6, 9 - diff), 10];
      } else {
        const edge = (log.dmg[0] - log.dmg[1]) + 0.6 * (log.landed[0] - log.landed[1]) + BK.rnd(-5, 5);
        s = edge > 3 ? [10, 9] : edge < -3 ? [9, 10] : [10, 10];
        s = [s[0] - log.kd[0], s[1] - log.kd[1]]; // both went down: each still loses the point
      }
      log.cards.push(s);
    }
    g.roundLog.push(log);
    return log;
  }
  // Super punch: offered when the other man is under 8% health. It forces a knockdown (with a count).
  g.superReadyFor = f => { const o = f === g.p1 ? g.p2 : g.p1; return g.state === 'fight' && !g.paused && !f.down && !f.clinch && f.superAvailable(o); };
  g.koReadyFor = f => g.isHuman(f) && g.superReadyFor(f);
  g.koReady = () => g.koReadyFor(g.p1);
  g.onKoPunch = (f, type) => {
    g.slowmo = Math.max(g.slowmo, 0.55);
    BK.cam.kick = 0.08;
    BK.audio.roar(0.7);
    BK.fx.popup(`${BK.PUNCHES[type].label || 'SUPER PUNCH'}!`, f.headX, f.headY - 70, BK.PAL.brass, 58);
  };

  // ---------- clinch ----------
  const CLINCH_LEN = 2.6;
  g.startClinch = (holder, held) => {
    for (const f of [holder, held]) { f.punch = null; f.grab = null; f.slip = null; f.blocking = false; }
    holder.clinch = { partner: held, role: 'holder', t: 0 };
    held.clinch = { partner: holder, role: 'held', t: 0 };
    g.clinchT = 0;
    BK.fx.popup('CLINCH!', (holder.sx + held.sx) / 2, holder.headY - 60, BK.PAL.bone, 44);
    BK.audio.punch('blocked');
  };
  function breakClinch() {
    const a = g.p1, b = g.p2;
    if (!a.clinch) return;
    const dir = Math.sign(b.sx - a.sx) || 1;
    a.clinch = null; b.clinch = null;
    a.knock = -dir * 0.3; b.knock = dir * 0.3;
    g.ref.box();
    BK.fx.popup('BREAK!', g.ref.sx, g.ref.sy - 300 * g.ref.fs, BK.PAL.bone, 50);
  }
  function updateClinch(dt) {
    const a = g.p1, b = g.p2;
    if (!a.clinch) return;
    g.clinchT += dt;
    // hold them chest to chest
    const z = (a.z + b.z) / 2, mid = (a.sx + b.sx) / 2, gap = 84 * BK.depthScale(z) * 1.38;
    const sgn = Math.sign(b.sx - a.sx) || 1, w = BK.ringR(z) - BK.ringL(z);
    a.z += (z - a.z) * Math.min(1, dt * 8); b.z += (z - b.z) * Math.min(1, dt * 8);
    a.u = clamp(((mid - sgn * gap / 2) - BK.ringL(z)) / w, BK.U_MIN, BK.U_MAX);
    b.u = clamp(((mid + sgn * gap / 2) - BK.ringL(z)) / w, BK.U_MIN, BK.U_MAX);
    if (g.clinchT > CLINCH_LEN) breakClinch();
  }
  g.cardTotals = () => [0, 1, 2].map(j => g.roundLog.reduce((t, r) => [t[0] + r.cards[j][0], t[1] + r.cards[j][1]], [0, 0]));

  function cornerTip(log) {
    const T = BK.CORNER_TIPS, s = g.p1.stats;
    let k = 'even';
    if (g.p1.stamina < 35) k = 'lowStamina';
    else if (s.thrown > 10 && s.landed / s.thrown < 0.3) k = 'lowAccuracy';
    else if (log.dmg[0] - log.dmg[1] > 8) k = 'winning';
    else if (log.dmg[1] - log.dmg[0] > 8) k = 'losing';
    return BK.pick(T[k]);
  }

  function endRound() {
    BK.audio.bell(1);
    g.p1.clinch = g.p2.clinch = null; g.p1.grab = g.p2.grab = null;
    const log = scoreRound();
    g.tip = cornerTip(log);
    setState('roundEnd');
  }

  function decide() {
    const tot = g.cardTotals();
    let a = 0, b = 0;
    tot.forEach(([x, y]) => { if (x > y) a++; else if (y > x) b++; });
    const d = 3 - a - b;
    let winner = null, method;
    if (a === 3 || b === 3) method = 'UNANIMOUS DECISION';
    else if ((a === 2 && b === 1) || (b === 2 && a === 1)) method = 'SPLIT DECISION';
    else if ((a === 2 && d === 1) || (b === 2 && d === 1)) method = 'MAJORITY DECISION';
    else method = a === b && d === 1 ? 'SPLIT DRAW' : d === 3 ? 'DRAW' : 'MAJORITY DRAW';
    if (a > b && a >= 2) winner = g.p1; else if (b > a && b >= 2) winner = g.p2;
    if (!winner && !method.includes('DRAW')) method = 'DRAW';
    const cards = tot.map(([x, y]) => `${x}-${y}`).join(',  ');
    finish({ winner, method, detail: `SCORECARDS  ${cards}` });
    if (winner) winner.celebrate = true;
  }

  function finish(result) {
    g.result = result;
    if (g.recorded || g.twoPlayer) return;
    g.recorded = true;
    const r = BK.record;
    if (!result.winner) r.d++;
    else if (result.winner === g.p1) { r.w++; if (!result.method.includes('DECISION')) r.ko++; } else r.l++;
    BK.saveRecord();
  }

  // ---------- update ----------
  function separate(a, b) {
    if (a.down || b.down || Math.abs(a.z - b.z) > 0.14) return;
    const minD = 94 * (a.fs + b.fs) / 2, dx = b.sx - a.sx, d = Math.abs(dx);
    if (d < minD) {
      const push = (minD - d) / 2, sgn = dx === 0 ? 1 : Math.sign(dx);
      a.u = clamp(a.u - sgn * push / (BK.ringR(a.z) - BK.ringL(a.z)), BK.U_MIN, BK.U_MAX);
      b.u = clamp(b.u + sgn * push / (BK.ringR(b.z) - BK.ringL(b.z)), BK.U_MIN, BK.U_MAX);
    }
  }

  function update(dt) {
    g.stateT += dt;
    const { p1, p2, ref } = g;
    switch (g.state) {
      case 'title':
      case 'tape':
      case 'ladder':
      case 'champion':
        p1.update(dt, IDLE, p2); p2.update(dt, IDLE, p1);
        break;
      case 'walkout':
        BK.walkout.update(dt);
        break;
      case 'roundIntro':
        p1.update(dt, IDLE, p2); p2.update(dt, IDLE, p1); ref.update(dt, p1, p2);
        BK.input.player(); if (g.twoPlayer) BK.input.player2();
        const len = introLn();
        if (g.stateT > len - 0.3 && !g.rang) { g.rang = true; BK.audio.bell(1); }
        if (g.stateT > len) { g.rang = false; setState('fight'); g.ai.reset(); }
        break;
      case 'fight': {
        const i1 = BK.input.player(), i2 = g.twoPlayer ? BK.input.player2() : g.ai.input(dt);
        p1.update(dt, i1, p2);
        if (g.state === 'fight') p2.update(dt, i2, p1);
        if (p1.clinch) updateClinch(dt); else separate(p1, p2);
        ref.update(dt, p1, p2);
        if (g.state !== 'fight') break;
        for (const f of [p1, p2]) if (f.oof && (f.oof.t += dt) >= OOF_LEN) { standingCount(f); break; }
        if (g.state !== 'fight') break;
        g.clock -= dt;
        refChatter(dt);
        if (g.clock <= 10 && !g.clapped) { g.clapped = true; BK.audio.tick(false); setTimeout(() => BK.audio.tick(false), 150); setTimeout(() => BK.audio.tick(false), 300); }
        if (g.clock <= 0) { g.clock = 0; endRound(); }
        break;
      }
      case 'knockdown':
        BK.input.player(); if (g.twoPlayer) BK.input.player2();
        updateKnockdown(dt);
        break;
      case 'roundEnd': {
        const c1 = p1.steer(0.08, 0.06), c2 = p2.steer(0.92, 0.06);
        const moveIn = g.stateT > 0.8;
        p1.update(dt, moveIn ? c1 : IDLE, p2); p2.update(dt, moveIn ? c2 : IDLE, p1);
        ref.update(dt, p1, p2);
        if (g.stateT > 2.4) {
          if (g.round >= g.totalRounds) { decide(); setState('decision'); } else setState('corner');
        }
        break;
      }
      case 'cornerGame':
        BK.corner.update(dt);
        // falls through
      case 'corner':
      case 'decision':
      case 'result':
      case 'fightOver':
        p1.update(dt, IDLE, p2); p2.update(dt, IDLE, p1); ref.update(dt, p1, p2);
        if (g.state === 'decision' && g.stateT > 2.8) setState('result');
        if (g.state === 'fightOver' && g.stateT > 3.4) setState('result');
        break;
    }
  }

  function updateCamera(dt) {
    const c = BK.cam, { p1, p2 } = g;
    const s = g.state;
    if (s === 'title' || s === 'tape' || s === 'ladder' || s === 'champion') { c.tx = W / 2; c.ty = 520; c.tz = 1.12 + Math.sin(g.t * 0.25) * 0.04; }
    else if (s === 'walkout') BK.walkout.camera(c);
    else if (s === 'knockdown' && g.kd) {
      const v = g.kd.victim;
      c.tx = v.sx - v.dir * 100 * v.fs; c.ty = v.sy - 120; c.tz = g.kd.t < 1.4 ? 1.5 : 1.25;
    } else if (s === 'fightOver' && g.result) {
      const w = g.result.winner; c.tx = w.sx; c.ty = w.sy - 170; c.tz = 1.4;
    } else if (s === 'corner' || s === 'cornerGame' || s === 'result' || s === 'decision') { c.tx = W / 2; c.ty = H / 2; c.tz = 1; }
    else {
      const dist = Math.abs(p1.sx - p2.sx);
      c.tx = (p1.sx + p2.sx) / 2; c.ty = (p1.sy + p2.sy) / 2 - 150;
      c.tz = clamp(1.34 - dist / 1100, 1.0, 1.28);
    }
    // Out on your feet (one player only; a shared two-player screen stays clear): the view rocks and swims.
    const dazed = !g.twoPlayer && !BK.replay.active && p1.oof && ['fight', 'knockdown'].includes(s);
    g.daze = (g.daze || 0) + ((dazed ? 1 : 0) - (g.daze || 0)) * Math.min(1, dt * (dazed ? 2.5 : 1.5));
    const k = g.daze;
    c.roll = k > 0.01 ? (Math.sin(g.t * 1.3) * 0.028 + Math.sin(g.t * 3.1) * 0.006) * k : 0;
    c.tz *= 1 + 0.05 * k; c.ty += Math.sin(g.t * 0.9) * 12 * k; c.tx += Math.sin(g.t * 0.7) * 14 * k;
  }

  // ---------- input hooks ----------
  let triedFullscreen = false;
  function goFullscreen() {
    if (triedFullscreen) return; triedFullscreen = true;
    try {
      const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req || document.fullscreenElement) return;
      const pr = req.call(el, { navigationUI: 'hide' });
      if (pr && pr.then) pr.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* optional */ } }).catch(() => {});
    } catch (e) { /* fullscreen is optional */ }
  }
  g.onTap = (x, y) => {
    BK.audio.init();
    if (BK.replay.active) { BK.replay.skip(); return true; }
    if (g.state === 'walkout') { BK.walkout.skip(); return true; }
    if (g.state === 'title') goFullscreen();
    if (BK.ui.tap(x, y)) return true;
    if (g.state === 'knockdown' && !g.paused) { BK.getup.tap(x, y, false); return true; }
    if (g.state === 'cornerGame') return BK.corner.tap(x, y, false);
    return false;
  };
  g.onKey = k => {
    BK.audio.init();
    if (BK.replay.active) { BK.replay.skip(); return; }
    if (g.state === 'walkout') { BK.walkout.skip(); return; }
    if (k === 'escape' || k === 'p') { if (g.showControls && !g.paused) { g.showControls = false; return; } g.togglePause(); return; }
    if (g.paused) { if (k === 'enter') g.resume(); return; }
    if (g.state === 'knockdown' && (k === ' ' || k === 'enter')) { BK.getup.tap(0, 0, true); return; }
    if (g.state === 'cornerGame') { BK.corner.key(k); return; }
    if (k !== 'enter' && k !== ' ') return;
    if (g.state === 'title') g.toTape();
    else if (g.state === 'tape') g.startFight();
    else if (g.state === 'corner') g.workCorner();
    else if (g.state === 'result') { if (g.tour) (g.result.winner === g.p1 ? g.tourNext() : g.toTitle()); else g.toTape(); }
    else if (g.state === 'ladder') g.toTape();
    else if (g.state === 'champion') g.toTitle();
  };
  g.controlsActive = () => g.state === 'fight' && !g.paused && !BK.replay.active;

  // ---------- ring card walker (from round 2) ----------
  const CARD_WALK = 2.6;
  const introLn = () => (g.round > 1 ? CARD_WALK + 0.6 : 1.6);
  const cardPose = BK.rig.make();
  function cardWalker() {
    if (g.state !== 'roundIntro' || g.round < 2 || g.stateT > CARD_WALK) return null;
    const k = g.stateT / CARD_WALK, u = BK.lerp(0.06, 0.94, k), z = 0.86, ph = g.stateT * 9;
    BK.rig.copy(BK.POSES.cardHold, cardPose);
    cardPose.ffX += Math.sin(ph) * 16; cardPose.ffY -= Math.max(0, Math.cos(ph)) * 8;
    cardPose.rfX -= Math.sin(ph) * 16; cardPose.rfY -= Math.max(0, -Math.cos(ph)) * 8;
    cardPose.py -= Math.abs(Math.sin(ph)) * 3;
    return {
      look: BK.CARD_LOOK, sx: BK.toScreenX(u, z), sy: BK.toScreenY(z), z, fs: BK.depthScale(z) * 1.3, dir: 1,
      pose: cardPose, st: { damage: 0, dazed: false, blink: false, sweat: 0 }, flash: 0,
      extra: () => {
        BK.draw.rr(-50, -376, 138, 78, 8); BK.draw.fillOut('#f4efe4', 4);
        BK.draw.text('ROUND', 19, -354, BK.FONT.ui(20), BK.PAL.ink);
        BK.draw.text(String(g.round), 19, -320, BK.FONT.display(40), BK.PAL.blood);
      },
    };
  }

  // ---------- render ----------
  const dazeBuf = document.createElement('canvas'), dazeCtx = dazeBuf.getContext('2d');
  function render() {
    const sc = BK.screen, v = BK.view, hud = BK.hud;
    ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
    ctx.fillStyle = BK.PAL.arena; ctx.fillRect(0, 0, sc.w, sc.h);
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);

    const ex = BK.audio.excitement;
    const stage = (drawEnts, drawBehind) => {
      BK.arena.drawBackdrop(g.t, ex);
      BK.arena.drawRing();
      BK.fx.drawDecals();
      if (typeof drawBehind === 'function') drawBehind();
      BK.arena.drawBackRopes();
      drawEnts();
      BK.arena.drawFrontRopes();
      BK.arena.drawFrontRow(g.t, ex);
      BK.arena.drawAtmosphere(g.t);
    };
    if (BK.replay.active) {
      BK.replay.drawWorld(stage, g.t);
      hud.vignette();
      BK.ui.begin();
      BK.replay.drawOverlay();
      ctx.restore();
      return;
    }
    ctx.save();
    BK.applyCamera();
    const ents = [g.p1, g.p2];
    if (!['title', 'tape'].includes(g.state)) ents.push(g.ref);
    const card = cardWalker();
    const snaps = ents.map(e => (e.snapshot ? e.snapshot() : e)).concat(card ? [card] : []).sort((a, b) => a.z - b.z);
    stage(() => {
      snaps.filter(e => e.z >= 0).forEach(e => BK.drawFigure(e));
      BK.fx.drawParticles();
    }, () => snaps.filter(e => e.z < 0).forEach(e => BK.drawFigure(e))); // walking the aisle, behind the ropes
    if (g.state === 'walkout') BK.walkout.drawWorld();
    BK.fx.drawPopups();
    ctx.restore();
    if (g.daze > 0.01) { // double vision: a blurred copy of the world drifting over itself
      // (blurred cheaply: shrunk to a quarter and stretched back, rather than a costly blur filter)
      const k = g.daze, dpr = sc.dpr, cw = BK.canvas.width, ch = BK.canvas.height;
      const bw = Math.max(1, cw >> 2), bh = Math.max(1, ch >> 2);
      if (dazeBuf.width !== bw || dazeBuf.height !== bh) { dazeBuf.width = bw; dazeBuf.height = bh; }
      dazeCtx.drawImage(BK.canvas, 0, 0, bw, bh);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.5 * k;
      ctx.drawImage(dazeBuf, Math.sin(g.t * 1.9) * 16 * k * dpr, Math.cos(g.t * 1.4) * 7 * k * dpr, cw, ch);
      ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#2a0706'; ctx.fillRect(0, 0, cw, ch); // dark red wash
      ctx.restore();
    }

    hud.vignette();
    if (g.flashT > 0) { ctx.fillStyle = `rgba(255,250,235,${g.flashT * 3})`; ctx.fillRect(-W, -H, W * 3, H * 3); }
    BK.ui.begin();
    const s = g.state, T = g.stateT;
    if (s === 'walkout') BK.walkout.drawHud();
    else if (s === 'title') hud.title(g);
    else if (s === 'tape') hud.tape(g);
    else if (s === 'corner') hud.corner(g);
    else if (s === 'cornerGame') BK.corner.draw(g);
    else if (s === 'result') hud.result(g);
    else if (s === 'ladder') hud.ladder(g);
    else if (s === 'champion') hud.champion(g);
    else {
      hud.draw(g);
      // from round 2 the card walker announces the round first, then the banner lands
      const bannerT = g.round > 1 ? T - (CARD_WALK - 0.3) : T;
      if (s === 'roundIntro' && bannerT > 0) hud.banner(g.round === g.totalRounds && g.round > 1 ? 'FINAL ROUND' : `ROUND ${g.round}`, g.round === 1 ? 'PROTECT YOURSELF AT ALL TIMES' : null, Math.min(1, bannerT * 4));
      if (s === 'fight' && T < 0.7) hud.banner('FIGHT!', null, 1 - T / 0.7, BK.PAL.brass, 150);
      if (s === 'roundEnd') hud.banner(g.round >= g.totalRounds ? 'FINAL BELL' : `END OF ROUND ${g.round}`, null, Math.min(1, T * 4), BK.PAL.bone, 100);
      if (s === 'decision') hud.banner('TO THE SCORECARDS', 'THE JUDGES HAVE THEIR SAY', Math.min(1, T * 3), BK.PAL.bone, 96);
      if (s === 'fightOver') hud.banner(g.result.method === 'TKO' ? 'T.K.O.' : 'K.O.!', `${g.result.winner.look.name} WINS`, Math.min(1, T * 3), '#e2584f', 170);
      if (s === 'knockdown' && g.kd) {
        const kd = g.kd;
        if (kd.tko) hud.banner('STOPPED!', 'THE REFEREE WAVES IT OFF', Math.min(1, kd.t * 3), '#e2584f', 130);
        else if (kd.count > 0 && !kd.rising) hud.count(kd.count, kd.standing ? 'STANDING COUNT' : g.isHuman(kd.victim) ? null : `${kd.victim.look.short} IS DOWN`);
        else if (kd.count === 0) hud.banner(kd.standing ? 'STANDING COUNT' : 'KNOCKDOWN!', kd.standing ? 'THE REFEREE STEPS IN' : null, Math.min(1, kd.t * 4), '#e2584f', 120);
        BK.getup.draw();
      }
    }
    if (g.paused) { BK.ui.begin(); hud.pause(g); }
    BK.ui.drawCursor();
    if (BK.pad.toast > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, BK.pad.toast * 2);
      BK.draw.rr(W / 2 - 260, 120, 520, 56, 14); ctx.fillStyle = 'rgba(16,12,11,0.92)'; ctx.fill(); ctx.strokeStyle = BK.PAL.brass; ctx.lineWidth = 2; ctx.stroke();
      BK.draw.text(BK.pad.toastText, W / 2, 149, BK.FONT.ui(26), BK.PAL.bone);
      ctx.restore();
    }
    ctx.restore();

    if (g.controlsActive()) BK.input.draw(g.p1);
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    BK.pad.update(real, g.t);
    if (BK.replay.active) BK.replay.update(real);
    else if (!g.paused) {
      g.t += real;
      g.slowmo = Math.max(0, g.slowmo - real);
      g.flashT = Math.max(0, (g.flashT || 0) - real);
      const frozen = g.stop > 0;
      g.stop = Math.max(0, g.stop - real);
      const scale = frozen ? 0 : g.slowmo > 0 ? 0.3 : 1;
      update(real * scale);
      BK.getup.update(real);
      BK.fx.update(real * scale);
      if (['fight', 'knockdown', 'fightOver'].includes(g.state)) BK.replay.record(g.t, g);
      const pr = g.pendingReplay;
      if (pr && g.t >= pr.at) {
        g.pendingReplay = null;
        const over = g.state === 'fightOver';
        BK.replay.start(pr.tHit, pr.v, pr.a, () => { if (over && g.state === 'fightOver') g.stateT = Math.min(g.stateT, 1.6); });
      }
    }
    BK.audio.update(real);
    BK.arena.update(real, BK.audio.excitement);
    updateCamera(real);
    BK.updateCamera(real);
    render();
    requestAnimationFrame(frame);
  }

  BK.resize();
  const fonts = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('40px "Anton"'), document.fonts.load('600 20px "Barlow Condensed"'), document.fonts.load('500 20px "Barlow Condensed"')]).catch(() => {})
    : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => requestAnimationFrame(t => { last = t; frame(t); }));
})();
