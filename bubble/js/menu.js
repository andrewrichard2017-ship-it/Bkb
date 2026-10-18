// Bubble Odyssey: menus (a DOM overlay). Every screen works with touch, mouse, keyboard and the pad
// (D-pad/stick to move, ✕ select, ○ back). The career map is five world sections stacked bottom to top with
// the levels along a winding path; popups (level info, confirmations) sit on top of the screen under them.
(() => {
  'use strict';
  const BB = window.BB;
  const M = BB.menu = { screen: null, active: true, back: null, data: {}, ctx: { coop: false } };
  let root, cur = null, modal = null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = () => BB.main;
  const ICONS = {};

  M.init = () => {
    root = document.getElementById('menu');
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      BB.audio.init(); focus(b, false);
      if (b.dataset.sel !== undefined) { const r = b.getBoundingClientRect(); act(b, e.clientX < r.left + r.width / 2 ? 'left' : 'right'); } else act(b, 'ok');
    });
    makeIcons();
    const q = new URLSearchParams(location.search);
    M.show('title');
    if (q.get('join')) setTimeout(() => M.show('join', { code: q.get('join').toUpperCase() }), 300);
  };
  function makeIcons() {
    const S = BB.sprites; S.build(44, !!BB.settings.symbols);
    const url = cv => cv.toDataURL();
    const P = BB.SPRITE_PAD, K = BB.K;
    ICONS.color = S.color.map(url); ICONS.stone = url(S.stone); ICONS.bomb = url(S.bomb); ICONS.star = url(S.star); ICONS.ice = url(S.ice[1]); ICONS.cham = url(S.cham[3]); ICONS.crit = url(S.crit[4][0]);
    ICONS.rainbow = url(S.rainbow); ICONS.zap = url(S.zap); ICONS.fire = url(S.fire);
    const draw = fn => { const cv = document.createElement('canvas'); cv.width = cv.height = 116; const c = cv.getContext('2d'); c.translate(58, 58); fn(c); return cv.toDataURL(); };
    ICONS.aim = draw(c => { c.strokeStyle = '#ff5a6a'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 32, 0, 6.3); c.moveTo(-46, 0); c.lineTo(-16, 0); c.moveTo(16, 0); c.lineTo(46, 0); c.moveTo(0, -46); c.lineTo(0, -16); c.moveTo(0, 16); c.lineTo(0, 46); c.stroke(); c.fillStyle = '#ff5a6a'; c.beginPath(); c.arc(0, 0, 7, 0, 6.3); c.fill(); });
    ICONS.plus5 = draw(c => { c.drawImage(S.color[3], -44 * P, -44 * P, 88 * P, 88 * P); c.font = '700 40px ' + BB.FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 7; c.strokeStyle = 'rgba(15,5,35,0.8)'; c.strokeText('+5', 0, 3); c.fillStyle = '#fff'; c.fillText('+5', 0, 3); });
    ICONS.power = { bomb: ICONS.bomb, fire: ICONS.fire, rainbow: ICONS.rainbow, zap: ICONS.zap, aim: ICONS.aim, plus5: ICONS.plus5 };
    void K;
  }
  const img = (src, cls = '') => `<img class="ico ${cls}" src="${src}" alt="">`;

  // ---------------------------------------------------------------- navigation
  function items() { const scope = modal || root; return [...scope.querySelectorAll('[data-act]:not([disabled])')].filter(e => e.offsetParent !== null); }
  function focus(e, scroll = true) { if (cur) cur.classList.remove('focus'); cur = e; if (e) { e.classList.add('focus'); if (scroll) e.scrollIntoView({ block: e.classList.contains('node') ? 'center' : 'nearest', behavior: 'smooth' }); } }
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
    if (best) { focus(best); BB.audio.sfx('select'); }
  }
  function act(e, how) {
    const fn = M.acts[e.dataset.act]; if (!fn) return;
    BB.audio.sfx(how === 'ok' && e.dataset.sel === undefined ? 'confirm' : 'select');
    fn(e, how);
  }
  M.update = () => {
    const ev = BB.input.menu;
    if (!ev.length || !M.active) return;
    for (const { a } of ev) {
      if (a === 'up') move(0, -1); else if (a === 'down') move(0, 1);
      else if (a === 'left' || a === 'right') { if (cur && cur.dataset.sel !== undefined && items().includes(cur)) act(cur, a); else move(a === 'left' ? -1 : 1, 0); }
      else if (a === 'l1' || a === 'r1') { if (cur && cur.dataset.sel !== undefined) act(cur, a === 'l1' ? 'left' : 'right'); }
      else if (a === 'ok') { if (cur && items().includes(cur)) act(cur, 'ok'); else move(0, 1); }
      else if (a === 'back') { const b = modal ? M.closeModal : M.back; if (b) { BB.audio.sfx('back'); b(); } }
      else if (a === 'start' && M.startBtn && !modal) M.startBtn();
    }
  };

  function render(html, o = {}) {
    modal = null;
    root.innerHTML = html; root.className = 'show ' + (o.cls || '');
    M.active = true; M.back = o.back || null; M.startBtn = o.start || null;
    cur = null;
    const f = o.focus ? root.querySelector(o.focus) : null;
    focus(f || items()[0], !!f);
  }
  M.modal = (html, o = {}) => {
    M.closeModal(true);
    root.insertAdjacentHTML('beforeend', `<div class="modal"><div class="panel pop">${html}</div></div>`);
    modal = root.querySelector('.modal');
    modal.addEventListener('click', e => { if (e.target === modal) M.closeModal(); });
    M.modalBack = o.back || null;
    cur = null; const f = o.focus ? modal.querySelector(o.focus) : null; focus(f || items()[0], false);
  };
  M.closeModal = quiet => {
    if (!modal) return;
    modal.remove(); modal = null;
    if (quiet !== true) { cur = null; const f = M.lastFocus && root.contains(M.lastFocus) ? M.lastFocus : items()[0]; focus(f, false); if (M.modalBack) M.modalBack(); }
  };
  M.hide = () => { root.className = ''; root.innerHTML = ''; M.active = false; cur = null; modal = null; };
  M.show = (name, data = {}) => { M.screen = name; M.data = data; SCREENS[name](data); };

  const btn = (label, a, extra = '', cls = '') => `<button class="mi ${cls}" data-act="${a}" ${extra}>${label}</button>`;
  const sel = (a, label, extra = '') => `<button class="mi selector" data-act="${a}" data-sel ${extra}><span>◀</span><b>${label}</b><span>▶</span></button>`;
  const starStr = n => `<span class="st on">${'★'.repeat(n)}</span><span class="st">${'★'.repeat(3 - n)}</span>`;
  const starTable = coop => coop ? BB.save.coop : BB.save.stars;
  const unlocked = (n, coop) => n === 1 || (starTable(coop)[n - 1] || 0) > 0;
  const totalStars = coop => Object.values(starTable(coop)).reduce((a, b) => a + b, 0);
  const frontier = coop => { let n = 1; while (n < BB.LEVEL_COUNT && unlocked(n + 1, coop)) n++; return n; };
  const coins = () => `<span class="coin">🪙 ${BB.fmt(BB.save.coins)}</span>`;
  const myName = () => BB.settings.name || 'Bubbler';
  M.myName = myName; M.frontier = frontier; M.unlocked = unlocked;
  const padStatus = () => BB.input.padCount ? `<span class="pad on">🎮 ${BB.input.padCount} controller${BB.input.padCount > 1 ? 's' : ''} connected</span>` : '<span class="pad">🎮 Controllers work too: pair one, then press any button</span>';
  const goalLine = s => s.goal === 'clear' ? 'Clear every bubble' : s.goal === 'rescue' ? `Free all ${BB.buildLevel(s).critters} Blips` : `Defeat ${BB.WORLDS[s.world].boss.name} (${s.hp} HP)`;
  const goalIcon = s => s.goal === 'clear' ? ICONS.color[1] : s.goal === 'rescue' ? ICONS.crit : ICONS.bomb;

  // ---------------------------------------------------------------- screens
  const SCREENS = {
    title() {
      G().backdrop(BB.highestWorld());
      BB.audio.music('title');
      const ts = totalStars(false);
      render(`<div class="title">
        <h1 class="logo"><span class="l1">${'BUBBLE'.split('').map((ch, i) => `<i style="--i:${i}">${ch}</i>`).join('')}</span><span class="l2">ODYSSEY</span></h1>
        <p class="tag">Aim. Bounce. Pop. Fifty levels across five worlds.</p>
        <div class="col menu-col">
          ${btn(`▶ CAREER <small>Level ${frontier(false)} · ★ ${ts}</small>`, 'career', '', 'primary')}
          ${btn('👥 CO-OP · SAME SCREEN', 'coop')}
          ${btn('🌐 ONLINE CO-OP', 'online')}
          ${btn(`♾️ ENDLESS <small>Best ${BB.fmt(BB.save.endless)}</small>`, 'endless')}
          <div class="row tight">${btn('🛒 SHOP', 'shop', '', 'half')}${btn('❓ HOW TO PLAY', 'howto', '', 'half')}</div>
          ${btn('⚙️ SETTINGS', 'settings')}
        </div>
        <div class="foot">${coins()} · ${padStatus()}</div></div>`, { cls: 'center' });
      clearInterval(M.padTimer);
      M.padTimer = setInterval(() => { const f = root.querySelector('.foot'); if (f && M.screen === 'title') f.innerHTML = coins() + ' · ' + padStatus(); else clearInterval(M.padTimer); }, 1000);
    },

    map(d) {
      const coop = !!M.ctx.coop, fr = frontier(coop);
      const focusN = d.focus || fr;
      G().backdrop(Math.floor((focusN - 1) / 10));
      const DECO = { meadow: ['🌼', '🌳', '🦋', '🌷', '🐞'], reef: ['🐠', '🐚', '🐙', '🦀', '🫧'], candy: ['🍭', '🍬', '🧁', '🍩', '🍫'], caves: ['💎', '🦇', '🔮', '🕯️', '⛏️'], nebula: ['🪐', '⭐', '🚀', '🌙', '☄️'] };
      const worlds = BB.WORLDS.map((w, wi) => {
        const pts = [];
        for (let i = 0; i < 10; i++) pts.push({ n: wi * 10 + i + 1, x: 50 + Math.sin(i * 1.15 + wi * 2) * 30, y: 1020 - 70 - i * 88 });
        const path = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');
        const rnd = BB.rng(wi + 3);
        const deco = Array.from({ length: 9 }, (_, k) => `<span class="deco" style="left:${(k % 2 ? 72 : 4) + rnd() * 22}%;top:${6 + k * 10 + rnd() * 5}%;font-size:${26 + rnd() * 26}px;transform:rotate(${(rnd() - 0.5) * 40}deg)">${DECO[w.id][k % 5]}</span>`).join('');
        const nodes = pts.map((p, i) => {
          const n = p.n, st = starTable(coop)[n] || 0, lock = !unlocked(n, coop), boss = i === 9;
          const cls = ['node', boss ? 'boss' : '', lock ? 'locked' : '', n === fr && !st ? 'current' : '', st ? 'done' : ''].join(' ');
          return `<button class="mi ${cls}" style="left:${p.x}%;top:${p.y}px" data-act="level" data-n="${n}" ${lock ? 'disabled' : ''}>
            <b>${boss ? '👑' : n}</b>${boss ? `<em>${n}</em>` : ''}${lock ? '<i class="lk">🔒</i>' : ''}<span class="nstars">${lock ? '' : starStr(st)}</span></button>`;
        }).join('');
        const wStars = pts.reduce((s, p) => s + (starTable(coop)[p.n] || 0), 0);
        return `<section class="world w-${w.id}" data-w="${wi}">
          ${deco}
          <svg class="trail" viewBox="0 0 100 1020" preserveAspectRatio="none"><path d="${path}" /></svg>
          ${nodes}
          <div class="wname"><b>World ${wi + 1} · ${esc(w.name)}</b><small>${esc(w.blurb)}</small><span>★ ${wStars} / 30</span></div>
        </section>`;
      }).reverse().join('');
      render(`<div class="map">
        <div class="mapbar">${btn('◀', 'title', '', 'icon')}<h2>${coop ? 'CO-OP CAREER' : 'CAREER'}</h2><div class="chips"><span>★ ${totalStars(coop)} / 150</span>${coop ? '' : `<span>${coins()}</span>`}</div>${coop ? '' : btn('🛒', 'shop', '', 'icon')}</div>
        <div class="mapscroll">${worlds}</div></div>`,
      { back: () => M.show(coop ? 'coop' : 'title'), focus: `.node[data-n="${focusN}"]`, cls: 'full' });
      const node = root.querySelector(`.node[data-n="${focusN}"]`);
      if (node) node.scrollIntoView({ block: 'center' });
      const sc = root.querySelector('.mapscroll');
      sc.addEventListener('scroll', () => {
        const mid = sc.scrollTop + sc.clientHeight / 2;
        for (const s of sc.querySelectorAll('.world')) if (mid >= s.offsetTop && mid < s.offsetTop + s.offsetHeight) { G().backdrop(+s.dataset.w); break; }
      }, { passive: true });
    },

    shop() {
      const inv = BB.save.inv;
      const today = new Date().toDateString(), gift = BB.save.gift !== today;
      const card = k => { const i = BB.POWER_INFO[k]; return `<div class="shopcard">${img(ICONS.power[k], 'big')}<div><b>${i.name}</b><small>${i.blurb}</small><em>You have ${inv[k] || 0}</em></div>${btn(`🪙 ${i.price}`, 'buy', `data-k="${k}" ${BB.save.coins < i.price ? 'disabled' : ''}`, 'buy')}</div>`; };
      render(`<div class="panel wide">
        <div class="hdr"><h2>SHOP</h2><div class="chips"><span>${coins()}</span></div></div>
        <p class="sub">Power-ups are used during a level: tap one at the bottom of the screen (or press 1–6) and your next shot becomes it. Earn coins by winning levels; new stars earn extra.</p>
        <div class="shopgrid">${BB.POWER_KEYS.map(card).join('')}</div>
        <div class="row">${btn(gift ? '🎁 FREE DAILY GIFT · 50 COINS' : '🎁 Gift collected · come back tomorrow', 'gift', gift ? '' : 'disabled', gift ? 'primary' : '')}${BB.ads.canReward() ? btn('📺 WATCH AN AD · 40 COINS', 'adCoins') : ''}${btn('BACK', 'shopBack')}</div></div>`,
      { back: () => M.acts.shopBack(), cls: 'center' });
    },

    coop() {
      render(`<div class="panel">
        <div class="hdr"><h2>CO-OP · SAME SCREEN</h2></div>
        <p class="sub">Two launchers, one board. You share the shots, the score and the fever ring, and either of you can finish the level.</p>
        <ul class="tips">
          <li><b>Touch:</b> each player drags on their own half of the screen and lets go to shoot.</li>
          <li><b>Keyboard:</b> Player 1 <b>A D</b> aim, <b>W</b> shoot, <b>S</b> swap. Player 2 <b>← →</b> aim, <b>↑</b> shoot, <b>↓</b> swap.</li>
          <li><b>Controllers:</b> one each (or one pad plus the keyboard).</li>
        </ul>
        <div class="col">${btn(`▶ CO-OP CAREER <small>Level ${frontier(true)} · ★ ${totalStars(true)}</small>`, 'coopCareer', '', 'primary')}${btn(`♾️ CO-OP ENDLESS <small>Best ${BB.fmt(BB.save.endlessCoop)}</small>`, 'coopEndless')}${btn('BACK', 'title')}</div></div>`,
      { back: () => M.show('title'), cls: 'center' });
    },

    online() {
      render(`<div class="panel">
        <div class="hdr"><h2>ONLINE CO-OP</h2></div>
        <p class="sub">Team up with a mate on another phone, tablet or computer. One of you hosts and sends the link (or the 5-letter code); you share one board, each with your own launcher.</p>
        <div class="col">${btn('🏠 HOST A GAME', 'host', '', 'primary')}${btn('🔑 JOIN WITH A CODE', 'joinScreen')}${btn('BACK', 'title')}</div>
        <p class="sub small">Your name: <b>${esc(myName())}</b> · change it in Settings. Levels you can pick come from the host's co-op career.</p></div>`, { back: () => M.show('title'), cls: 'center' });
    },
    hosting(d) {
      const link = BB.net.inviteLink();
      render(`<div class="panel">
        <div class="hdr"><h2>INVITE A MATE</h2></div>
        <p class="sub">Send this link. When they open it they join your game.</p>
        <div class="code">${esc(BB.net.code || '…')}</div>
        <input class="link" readonly value="${esc(link)}" />
        <div class="row">${navigator.share ? btn('SHARE LINK', 'share') : ''}${btn('COPY LINK', 'copy')}${btn('CANCEL', 'leave')}</div>
        <p class="status">${esc(d.status || 'Waiting for your mate to join…')}</p></div>`, { back: () => M.acts.leave(), cls: 'center' });
    },
    join(d) {
      render(`<div class="panel">
        <div class="hdr"><h2>JOIN A GAME</h2></div>
        <p class="sub">Type the code your mate sent you (or just open their link).</p>
        <input id="code" class="codein" maxlength="6" autocomplete="off" spellcheck="false" value="${esc(d.code || '')}" placeholder="CODE" />
        <div class="row">${btn('JOIN', 'join', 'id="go"', 'primary')}${btn('BACK', 'online')}</div>
        <p class="status">${esc(d.status || '')}</p></div>`, { back: () => { BB.net.leave(); M.show('online'); }, focus: '#go', cls: 'center' });
      const inp = root.querySelector('#code');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') M.acts.join(); e.stopPropagation(); });
      if (d.code && d.auto !== false) M.acts.join();
    },
    lobby() {
      const N = BB.net, L = N.lobby, host = N.role === 'host', me = host ? 0 : 1;
      const pc = i => `<div class="pcard p${i + 1}"><h3>${esc(L.names[i] || '…')}${i === me ? ' (YOU)' : ''}</h3><small>${i === 0 ? 'HOST · LEFT LAUNCHER' : 'GUEST · RIGHT LAUNCHER'}</small></div>`;
      const lvl = BB.level(L.level), mode = L.mode === 'endless' ? '♾️ CO-OP ENDLESS' : '🗺️ CO-OP CAREER';
      const what = L.mode === 'endless' ? 'Rows keep coming. Survive together.' : `Level ${L.level} · ${esc(BB.WORLDS[lvl.world].name)} · ${goalLine(lvl)}`;
      render(`<div class="panel wide">
        <div class="hdr"><h2>ONLINE LOBBY</h2><div class="chips"><span>${N.connected ? '● CONNECTED' : '○ WAITING'}</span><span>${esc(N.code || '')}</span></div></div>
        <div class="two">${pc(0)}${pc(1)}</div>
        <div class="row">${host ? sel('lobbyMode', mode) + (L.mode === 'endless' ? '' : sel('lobbyLevel', 'LEVEL ' + L.level)) : `<div class="selector ro"><b>${mode}${L.mode === 'endless' ? '' : ' · LEVEL ' + L.level}</b></div>`}</div>
        <p class="sub">${what}</p>
        <div class="row">${host ? btn('▶ START', 'lobbyStart', `id="go" ${N.connected ? '' : 'disabled'}`, 'primary') : '<p class="status">Waiting for the host to start…</p>'}${btn('LEAVE', 'leave')}</div></div>`,
      { back: () => M.acts.leave(), focus: host ? '#go' : null, start: host ? () => M.acts.lobbyStart() : null, cls: 'center' });
    },

    howto() {
      const row = (ic, name, text) => `<tr><td>${img(ic)}</td><td><b>${name}</b><br>${text}</td></tr>`;
      render(`<div class="panel wide howto">
        <div class="hdr"><h2>HOW TO PLAY</h2></div>
        <div class="two">
          <div>
            <h3>The basics</h3>
            <ul class="tips">
              <li><b>Aim and shoot.</b> Drag on the screen and let go (or point and click). Bounce shots off the walls.</li>
              <li><b>Match 3 or more</b> of the same colour to pop them.</li>
              <li><b>Drop them.</b> Anything no longer hanging from the top falls off, and drops score double.</li>
              <li><b>Swap</b> your bubble with the next one by tapping the launcher.</li>
              <li><b>Combos:</b> pop something with shot after shot for a bigger multiplier.</li>
              <li><b>Fever ring:</b> busy shots fill the ring round your launcher. When it's full your next shot is a free power-up.</li>
              <li>Don't let bubbles reach the <b>dashed line</b>, and don't run out of shots. Shots you don't need are worth 100 each.</li>
            </ul>
            <h3>Goals</h3>
            <table>${row(ICONS.color[1], 'Clear', 'Pop or drop every bubble, including the rows still to come.')}${row(ICONS.crit, 'Rescue', 'Free every Blip by popping or dropping its bubble.')}${row(ICONS.bomb, 'Boss', 'Every 10th level. Each popped bubble hurts the boss, drops hurt double.')}</table>
          </div>
          <div>
            <h3>Special bubbles</h3>
            <table>
              ${row(ICONS.stone, 'Stone', "Can't be popped. Knock away what holds it up.")}
              ${row(ICONS.ice, 'Ice', 'Cracks on its first match, pops on the second.')}
              ${row(ICONS.bomb, 'Bomb', 'Pop anything next to it and it blows up two rings around.')}
              ${row(ICONS.star, 'Star', 'Hit it and every bubble of your colour pops.')}
              ${row(ICONS.cham, 'Chameleon', 'Changes colour after every shot.')}
            </table>
            <h3>Power-ups</h3>
            <table>${BB.POWER_KEYS.map(k => row(ICONS.power[k], BB.POWER_INFO[k].name, BB.POWER_INFO[k].blurb)).join('')}</table>
            <h3>Controls</h3>
            <ul class="tips"><li><b>Keyboard:</b> ← → aim (Shift for fine), ↑ or Space shoot, ↓ swap, 1–6 power-ups, Esc pause.</li><li><b>Controller:</b> stick aim, ✕ shoot, ○ swap, △ pick a power-up, L1 +5 shots, R1 Laser Sight, Options pause.</li></ul>
          </div>
        </div>
        <div class="row">${btn('BACK', 'title')}</div></div>`, { back: () => M.show('title'), cls: 'center' });
    },

    settings(d) {
      const S = BB.settings, onOff = v => v ? 'ON' : 'OFF', pct = v => Math.round(v * 100) + '%';
      render(`<div class="panel">
        <div class="hdr"><h2>SETTINGS</h2></div>
        <div class="col">
          ${sel('setMusic', 'MUSIC · ' + onOff(S.music))}
          ${sel('setMusicVol', 'MUSIC VOLUME · ' + pct(S.musicVolume))}
          ${sel('setVol', 'SOUND VOLUME · ' + pct(S.volume))}
          ${sel('setVibe', 'VIBRATION · ' + onOff(S.vibrate))}
          ${sel('setSymbols', 'COLOUR-BLIND SYMBOLS · ' + onOff(S.symbols))}
          ${sel('setGuide', 'AIM LINE · ' + (S.guide === 'long' ? 'FULL (EASY)' : 'NORMAL'))}
          ${btn('NAME · ' + esc(myName()), 'setName')}
          ${btn(d.confirmReset ? '⚠️ TAP AGAIN TO WIPE ALL PROGRESS' : 'RESET PROGRESS', 'reset', '', d.confirmReset ? 'danger' : '')}
          ${btn('BACK', 'settingsBack')}
        </div></div>`, { back: () => M.acts.settingsBack(), focus: d.focus, cls: 'center' });
    },

    pause() {
      const g = G().game, online = G().online();
      render(`<div class="panel small-panel">
        <div class="hdr"><h2>PAUSED</h2></div>
        ${online ? '<p class="sub">You\'re playing online, so the game keeps going.</p>' : ''}
        <div class="col">${btn('▶ RESUME', 'resume', '', 'primary')}${online || !g ? '' : btn('↻ RESTART', 'restart')}${btn('⚙️ SETTINGS', 'pauseSettings')}${btn(online ? 'LEAVE GAME' : 'QUIT', 'quit')}</div></div>`,
      { back: () => M.acts.resume(), cls: 'center dim' });
    },

    results(d) {
      const r = d.result, rec = d.rec || { coins: 0 }, g = G().game, online = G().online(), host = !online || BB.net.role === 'host';
      const career = r.mode === 'career', next = career && r.won && r.level < BB.LEVEL_COUNT;
      const world = career ? BB.WORLDS[BB.level(r.level).world] : null;
      const title = r.won ? (r.level === BB.LEVEL_COUNT ? 'YOU BEAT THE ODYSSEY!' : 'LEVEL COMPLETE!') : r.mode === 'endless' ? 'GAME OVER' : r.reason === 'shots' ? 'OUT OF SHOTS' : 'TOO LOW!';
      let revive = '';
      if (!r.won && career && !online && !r.coop) {
        const k = r.reason === 'shots' ? 'shots' : 'line', price = k === 'shots' ? 40 : 60;
        revive = btn(k === 'shots' ? `➕ 5 MORE SHOTS · 🪙 ${price}` : `💥 BLAST THE BOTTOM ROWS · 🪙 ${price}`, 'revive', `data-k="${k}" data-price="${price}" ${BB.save.coins < price ? 'disabled' : ''}`, 'primary');
        // one free continue per game for watching an ad
        if (BB.ads.canReward() && g && !g.adRevived) revive += btn(`📺 WATCH AN AD · ${k === 'shots' ? '5 MORE SHOTS' : 'BLAST THE ROWS'} FREE`, 'adRevive', `data-k="${k}"`, 'primary');
      }
      const doubler = rec.coins && !online && BB.ads.canReward() ? btn(`📺 WATCH AN AD · DOUBLE YOUR COINS (+${rec.coins} 🪙)`, 'adDouble') : '';
      const buttons = host ? [
        next ? btn('▶ NEXT LEVEL', 'next', 'id="go"', 'primary') : '',
        revive,
        doubler,
        btn(r.mode === 'endless' ? '↻ PLAY AGAIN' : '↻ RETRY', 'retry', r.won || !revive ? 'id="go2"' : ''),
        btn(online ? 'LOBBY' : career ? '🗺️ MAP' : 'MENU', 'resultsBack'),
      ].join('') : `<p class="status">Waiting for the host…</p>${btn('LEAVE', 'leave')}`;
      render(`<div class="panel results ${r.won ? 'win' : 'lose'}">
        <div class="hdr"><h2>${title}</h2>${career ? `<div class="chips"><span>Level ${r.level}</span><span>${esc(world.name)}</span></div>` : ''}</div>
        ${career ? `<div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < r.stars ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.35}s">★</span>`).join('')}</div>` : ''}
        <div class="pay">
          <div><span>Score</span><b>${BB.fmt(r.score)}</b></div>
          ${r.combo > 1 ? `<div><span>Best combo</span><b>x${r.combo}</b></div>` : ''}
          ${r.freed ? `<div><span>Blips freed</span><b>${r.freed}</b></div>` : ''}
          ${rec.newBest ? '<div class="gold"><span>New best!</span><b>🏆</b></div>' : ''}
          ${rec.coins ? `<div class="gold"><span>Coins</span><b>+${rec.coins} 🪙</b></div>` : ''}
        </div>
        <div class="row">${buttons}</div></div>`,
      { back: host ? () => M.acts.resultsBack() : null, focus: '#go, #go2', cls: 'center dim', start: next && host ? () => M.acts.next() : null });
      if (career && r.won) for (let i = 0; i < r.stars; i++) BB.audio.sfx('star', { n: i, delay: 0.3 + i * 0.35 });
      void g;
    },
  };

  // ---------------------------------------------------------------- results
  M.gameOver = (result, game) => {
    const online = G().online();
    const rec = G().record(result);
    if (online && BB.net.role === 'host') BB.net.sendResults(result);
    M.show('results', { result, rec });
    void game;
  };

  // ---------------------------------------------------------------- actions
  const players1 = () => [{ name: myName() }];
  const players2 = () => [{ name: 'Player 1' }, { name: 'Player 2' }];
  const startLevel = n => { M.ctx.level = n; G().start({ mode: 'career', level: n, players: M.ctx.coop ? players2() : players1() }); };
  M.acts = {
    title: () => M.show('title'),
    career: () => { M.ctx.coop = false; M.show('map'); },
    coop: () => M.show('coop'),
    coopCareer: () => { M.ctx.coop = true; M.show('map'); },
    coopEndless: () => { M.ctx.coop = true; G().start({ mode: 'endless', players: players2(), world: Math.floor(Math.random() * 5) }); },
    endless: () => { M.ctx.coop = false; G().start({ mode: 'endless', players: players1(), world: Math.floor(Math.random() * 5) }); },
    level: e => {
      const n = +e.dataset.n, s = BB.level(n), coop = !!M.ctx.coop, st = starTable(coop)[n] || 0, best = (coop ? BB.save.coopBest : BB.save.best)[n] || 0;
      const L = BB.buildLevel(s), K = BB.K, has = k => { let f = false; L.board.each(v => { if (v.k === k) f = true; }); for (const row of L.queue) for (const v of row) if (v && v.k === k) f = true; return f; };
      const specials = [[K.STONE, 'stone', 'Stone'], [K.ICE, 'ice', 'Ice'], [K.BOMB, 'bomb', 'Bombs'], [K.STAR, 'star', 'Stars'], [K.CHAM, 'cham', 'Chameleons']].filter(([k]) => has(k));
      M.lastFocus = e;
      M.modal(`<div class="hdr"><h2>LEVEL ${n}</h2><div class="chips"><span>${esc(BB.WORLDS[s.world].name)}</span></div></div>
        <div class="goal">${img(goalIcon(s), 'big')}<div><b>${goalLine(s)}</b><small>${Math.round(s.shots * (coop ? 1.15 : 1))} shots · ${s.col} colours${s.push ? ` · a new row every ${s.push} shots` : ''}</small></div></div>
        ${specials.length ? `<div class="specials">${specials.map(([, ic, name]) => `<span>${img(ICONS[ic])}${name}</span>`).join('')}</div>` : ''}
        ${s.tip ? `<p class="sub tipline">💡 ${esc(s.tip)}</p>` : ''}
        <div class="bigstars small">${[0, 1, 2].map(i => `<span class="${i < st ? 'on' : ''}">★</span>`).join('')}</div>
        <p class="sub center">${best ? 'Best ' + BB.fmt(best) + ' · ' : ''}★★ ${BB.fmt(s.stars[0])} · ★★★ ${BB.fmt(s.stars[1])}</p>
        <div class="row">${btn('▶ PLAY', 'play', `id="play" data-n="${n}"`, 'primary')}${btn('BACK', 'closeModal')}</div>`, { focus: '#play' });
    },
    play: e => { const n = +e.dataset.n; M.closeModal(true); startLevel(n); },
    closeModal: () => M.closeModal(),
    shop: () => { M.shopFrom = M.screen === 'map' ? 'map' : 'title'; M.show('shop'); },
    shopBack: () => M.show(M.shopFrom === 'map' ? 'map' : 'title'),
    buy: e => {
      const k = e.dataset.k, p = BB.POWER_INFO[k].price;
      if (BB.save.coins < p) return;
      BB.save.coins -= p; BB.save.inv[k] = (BB.save.inv[k] || 0) + 1; BB.saveProgress(); BB.audio.sfx('coin');
      SCREENS.shop(); focus(root.querySelector(`[data-act="buy"][data-k="${k}"]`) || items()[0], false);
    },
    adCoins: () => BB.ads.rewarded(() => { BB.save.coins += 40; BB.saveProgress(); BB.audio.sfx('coin'); if (M.screen === 'shop') SCREENS.shop(); }),
    gift: () => { BB.save.gift = new Date().toDateString(); BB.save.coins += 50; BB.saveProgress(); BB.audio.sfx('coin'); SCREENS.shop(); },
    howto: () => M.show('howto'),
    settings: () => { M.settingsFrom = 'title'; M.show('settings'); },
    pauseSettings: () => { M.settingsFrom = 'pause'; M.show('settings'); },
    settingsBack: () => { BB.saveSettings(); if (M.settingsFrom === 'pause' && G().game) M.show('pause'); else M.show('title'); },
    setMusic: () => { BB.settings.music = !BB.settings.music; BB.audio.levels(); M.show('settings', { focus: '[data-act=setMusic]' }); },
    setMusicVol: (e, how) => { BB.settings.musicVolume = Math.round(Math.max(0, Math.min(1, BB.settings.musicVolume + (how === 'left' ? -0.1 : 0.1))) * 10) / 10; BB.audio.levels(); M.show('settings', { focus: '[data-act=setMusicVol]' }); },
    setVol: (e, how) => { BB.settings.volume = Math.round(Math.max(0, Math.min(1, BB.settings.volume + (how === 'left' ? -0.1 : 0.1))) * 10) / 10; BB.audio.levels(); BB.audio.sfx('pop', { n: 3 }); M.show('settings', { focus: '[data-act=setVol]' }); },
    setVibe: () => { BB.settings.vibrate = !BB.settings.vibrate; M.show('settings', { focus: '[data-act=setVibe]' }); },
    setSymbols: () => { BB.settings.symbols = !BB.settings.symbols; BB.view.dirty = true; makeIcons(); M.show('settings', { focus: '[data-act=setSymbols]' }); },
    setGuide: () => { BB.settings.guide = BB.settings.guide === 'long' ? 'normal' : 'long'; M.show('settings', { focus: '[data-act=setGuide]' }); },
    setName: () => { const n = prompt('Your name (shown to your mate online)', BB.settings.name || ''); if (n !== null) { BB.settings.name = n.trim().slice(0, 14); BB.saveSettings(); } M.show('settings', { focus: '[data-act=setName]' }); },
    reset: () => { if (!M.data.confirmReset) return M.show('settings', { confirmReset: true, focus: '[data-act=reset]' }); BB.resetProgress(); BB.render.showToast('Progress wiped'); M.show('settings'); },
    resume: () => G().resume(),
    restart: () => { const c = G().cfg; G().start(c); },
    quit: () => { const coop = M.ctx.coop, game = G().game, mode = game && game.mode; G().quit(); M.show(mode === 'career' ? 'map' : coop ? 'coop' : 'title'); },
    next: () => {
      const r = M.data.result; if (!r) return;
      if (G().online()) return BB.net.next(r.level + 1);
      BB.ads.midgame(() => startLevel(r.level + 1));
    },
    retry: () => {
      if (G().online()) return BB.net.next(M.data.result.mode === 'endless' ? 0 : M.data.result.level);
      const cfg = Object.assign({}, G().cfg, G().cfg.mode === 'endless' ? { world: Math.floor(Math.random() * 5) } : {});
      BB.ads.midgame(() => G().start(cfg));
    },
    revive: e => {
      const price = +e.dataset.price, g = G().game; if (!g || BB.save.coins < price) return;
      BB.save.coins -= price; BB.saveProgress(); BB.audio.sfx('coin');
      M.hide(); g.revive(e.dataset.k);
    },
    adRevive: e => {
      const g = G().game, k = e.dataset.k; if (!g || g.adRevived) return;
      BB.ads.rewarded(() => { if (G().game !== g || g.state !== 'lost') return; g.adRevived = true; M.hide(); g.revive(k); });
    },
    adDouble: e => {
      const rec = M.data.rec; if (!rec || !rec.coins || rec.doubled) return;
      BB.ads.rewarded(() => {
        if (rec.doubled) return; rec.doubled = true;
        BB.save.coins += rec.coins; BB.saveProgress(); BB.audio.sfx('coin');
        BB.render.showToast(`+${rec.coins} 🪙 coins doubled!`, '#ffe14f');
        e.disabled = true; e.textContent = '✔ COINS DOUBLED';
      });
    },
    resultsBack: () => {
      if (G().online()) { BB.net.toLobby(); return; }
      const r = M.data.result; G().quit();
      BB.ads.midgame(() => { if (r && r.mode === 'career') M.show('map', { focus: r.won ? Math.min(BB.LEVEL_COUNT, r.level + 1) : r.level }); else M.show(M.ctx.coop ? 'coop' : 'title'); });
    },
    // ---- online ----
    online: () => M.show('online'),
    host: async () => {
      M.show('hosting', { status: 'Setting up…' });
      try { await BB.net.host(myName()); if (M.screen === 'hosting') M.show('hosting'); }
      catch (err) { M.show('online'); BB.render.showToast('Could not host: ' + (err.message || err.type || err), '#ffb3c0'); }
    },
    joinScreen: () => M.show('join'),
    join: async () => {
      const inp = root.querySelector('#code'); const code = (inp ? inp.value : M.data.code || '').trim().toUpperCase();
      if (code.length < 4) { M.show('join', { code, status: 'Type the 5-letter code.', auto: false }); return; }
      M.show('join', { code, status: 'Connecting…', auto: false });
      try { await BB.net.join(code, myName()); }
      catch (err) { M.show('join', { code, status: err.message || String(err), auto: false }); }
    },
    share: () => { navigator.share({ title: 'Bubble Odyssey', text: 'Pop bubbles with me! Code ' + BB.net.code, url: BB.net.inviteLink() }).catch(() => {}); },
    copy: () => {
      const l = BB.net.inviteLink();
      const done = () => BB.render.showToast('Link copied');
      if (navigator.clipboard) navigator.clipboard.writeText(l).then(done, () => { root.querySelector('.link').select(); document.execCommand('copy'); done(); });
      else { root.querySelector('.link').select(); document.execCommand('copy'); done(); }
    },
    leave: () => { BB.net.leave(); if (G().game) G().quit(); M.show('online'); },
    lobbyMode: () => { const L = BB.net.lobby; L.mode = L.mode === 'endless' ? 'career' : 'endless'; BB.net.updateLobby(); M.show('lobby'); },
    lobbyLevel: (e, how) => {
      const L = BB.net.lobby, max = frontier(true);
      L.level = ((L.level - 1 + (how === 'left' ? -1 : 1) + max) % max) + 1;
      BB.net.updateLobby(); M.show('lobby'); focus(root.querySelector('[data-act=lobbyLevel]'), false);
    },
    lobbyStart: () => BB.net.startGame(),
  };
})();
