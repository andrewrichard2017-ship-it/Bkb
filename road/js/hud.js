// Road Rumble: the in-race HUD (DOM overlay, one panel per split-screen view).
(() => {
  'use strict';
  const RR = window.RR, { clamp } = RR.math;
  const H = {};
  let root, panels = [], T;

  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const hex = n => '#' + n.toString(16).padStart(6, '0');

  H.init = () => { root = document.getElementById('hud'); T = window.THREE; };
  H.hide = () => { root.innerHTML = ''; panels = []; root.style.display = 'none'; RR.input.touch.enabled = false; document.getElementById('touch').classList.remove('show'); };
  H.setup = (views, race) => {
    root.innerHTML = ''; root.style.display = 'block'; panels = [];
    for (const v of views) {
      const p = el('div', 'view', root);
      const top = el('div', 'top', p);
      const pos = el('div', 'pos', top, '<b>-</b><i></i><span></span>');
      const time = el('div', 'time', top);
      const prog = el('div', 'prog', p);
      const bar = el('div', 'track', prog);
      el('div', 'flag', bar);
      const dots = race.riders.map(r => {
        const d = el('div', 'dot' + (r === v.rider ? ' me' : r.human ? ' hum' : r.cop ? ' cop' : ''), bar);
        if (r.human) d.style.background = hex((r.look && r.look.tag) || 0xffffff);
        return d;
      });
      const bl = el('div', 'bl', p);
      const hp = el('div', 'meter', bl, '<label>RIDER</label><div><i></i></div>');
      const bk = el('div', 'meter bikem', bl, '<label>BIKE</label><div><i></i></div>');
      const wpn = el('div', 'weapon', bl);
      const nitro = el('div', 'nitro', bl);
      const spx = el('div', 'specials', p, '<div class="sm turbo"><label>TURBO</label><div><i></i></div><em></em></div><div class="sm frenzy"><label>FRENZY</label><div><i></i></div><em></em></div>');
      const sp = el('div', 'speedo', p, `<svg viewBox="0 0 120 70"><path class="arc" d="M10 64 A52 52 0 0 1 110 64" /><path class="rpm" d="M10 64 A52 52 0 0 1 110 64" /></svg><b>0</b><span>${RR.speedUnit()}</span><em>1</em>`);
      const rival = el('div', 'rival', p, '<label></label><div><i></i></div>');
      const cop = el('div', 'copwarn', p, 'POLICE');
      const msgs = el('div', 'msgs', p);
      const taunt = el('div', 'taunt', p);
      const count = el('div', 'count', p);
      const hint = el('div', 'hint', p);
      const flashL = el('div', 'flash l', p), flashR = el('div', 'flash r', p);
      const tags = [];
      for (let i = 0; i < 7; i++) tags.push(el('div', 'tag', p));
      if (v.rider.human && race.humans.length > 1) el('div', 'who', p, v.rider.name).style.color = hex(v.rider.look.tag || 0xffffff);
      panels.push({ v, p, pos, time, dots, hp: hp.querySelector('i'), bk: bk.querySelector('i'), wpn, nitro, sp, spB: sp.querySelector('b'), spE: sp.querySelector('em'), rpm: sp.querySelector('.rpm'), rival, rivalL: rival.querySelector('label'), rivalB: rival.querySelector('i'), cop, msgs, taunt, count, hint, flashL, flashR, tags, rivalHold: 0, last: {},
        tb: spx.querySelector('.turbo'), fz: spx.querySelector('.frenzy'), tbI: spx.querySelector('.turbo i'), fzI: spx.querySelector('.frenzy i'), tbE: spx.querySelector('.turbo em'), fzE: spx.querySelector('.frenzy em') });
    }
    H.layout(views);
    const touch = RR.isTouch && !RR.input.padCount && views.length === 1;
    RR.input.touch.enabled = touch;
    document.getElementById('touch').classList.toggle('show', touch);
  };
  H.layout = views => {
    panels.forEach(P => { const R = P.v.rect; Object.assign(P.p.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' }); P.p.classList.toggle('half', views.length > 1); });
  };
  const panelOf = i => panels.find(P => P.v.index === i);
  const set = (P, k, v, fn) => { if (P.last[k] !== v) { P.last[k] = v; fn(v); } };

  H.message = (i, text, o = {}) => {
    const P = panelOf(i); if (!P) return;
    if (o.taunt) { P.taunt.textContent = text; P.taunt.classList.remove('go'); void P.taunt.offsetWidth; P.taunt.classList.add('go'); return; }
    const m = el('div', 'msg' + (o.big ? ' big' : ''), P.msgs, text);
    if (o.color) m.style.color = o.color;
    m.style.animationDuration = (o.hold || 1.8) + 's';
    setTimeout(() => m.remove(), (o.hold || 1.8) * 1000);
    while (P.msgs.children.length > 3) P.msgs.firstChild.remove();
  };
  H.countdown = n => {
    for (const P of panels) { P.count.textContent = n ? n : 'GO!'; P.count.className = 'count show' + (n ? '' : ' go'); clearTimeout(P.countT); P.countT = setTimeout(() => { P.count.className = 'count'; }, n ? 900 : 1000); }
  };
  H.flash = (i, side) => { const P = panelOf(i); if (!P) return; const f = side > 0 ? P.flashL : P.flashR; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };

  const proj = { v: null };
  H.update = (dt, views, race) => {
    if (!proj.v) proj.v = new T.Vector3();
    const tr = race.track, L = tr.length;
    for (const P of panels) {
      const v = P.v, r = v.rider;
      set(P, 'pos', r.pos + '/' + race.order.length, () => {
        P.pos.querySelector('b').textContent = r.pos; P.pos.querySelector('i').textContent = RR.ordinal(r.pos).slice(-2).toUpperCase(); P.pos.querySelector('span').textContent = '/' + race.order.length;
      });
      set(P, 'time', race.time > 0 ? RR.fmtTime(r.finished ? r.finishTime : race.time) : '0:00.00', x => { P.time.textContent = x; });
      // progress strip
      race.riders.forEach((o, k) => {
        const f = clamp((o.progress - tr.startS) / L, 0, 1), d = P.dots[k];
        d.style.left = (f * 100).toFixed(2) + '%';
        d.style.opacity = o.cop && o.copState === 'parked' ? 0 : o.out ? 0.3 : 1;
      });
      // meters
      set(P, 'hp', Math.round(r.hp), x => { P.hp.style.width = x + '%'; P.hp.className = x < 25 ? 'low' : ''; });
      set(P, 'bk', Math.round(100 - r.dmg), x => { P.bk.style.width = x + '%'; P.bk.className = x < 30 ? 'low' : ''; });
      set(P, 'wpn', (r.frenzyT > 0 ? 'mg' : r.weapon || '') + r.ammo, () => { const x = r.frenzyT > 0 ? null : r.weapon; P.wpn.textContent = r.frenzyT > 0 ? 'MACHINE GUN' : x ? RR.WEAPONS[x].name + (x === 'shotgun' ? ' ×' + r.ammo : '') : 'FISTS'; P.wpn.classList.toggle('armed', !!x || r.frenzyT > 0); });
      // specials
      const dev = RR.input.deviceFor(v.index), keyT = dev === 'pad' ? 'D-PAD ↑' : dev === 'keys-wasd' ? '1' : dev === 'keys-arrows' ? 'NUM 7' : dev === 'touch' ? 'TAP' : 'T';
      const keyF = dev === 'pad' ? 'D-PAD ↓' : dev === 'keys-wasd' ? '2' : dev === 'keys-arrows' ? 'NUM 8' : dev === 'touch' ? 'TAP' : 'R';
      const tbState = r.blazeT > 0 ? 'on' : r.turbo >= 100 ? 'ready' : '', fzState = r.frenzyT > 0 ? 'on' : r.frenzy >= 100 ? 'ready' : '';
      set(P, 'tb', Math.round(r.blazeT > 0 ? r.blazeT / RR.SPECIALS.blazeTime * 100 : r.turbo) + tbState, () => { P.tbI.style.width = (r.blazeT > 0 ? r.blazeT / RR.SPECIALS.blazeTime * 100 : r.turbo) + '%'; P.tb.className = 'sm turbo ' + tbState; P.tbE.textContent = tbState === 'ready' ? keyT : tbState === 'on' ? r.blazeT.toFixed(1) : ''; });
      set(P, 'fz', Math.round(r.frenzyT > 0 ? r.frenzyT / RR.SPECIALS.frenzyTime * 100 : r.frenzy) + fzState, () => { P.fzI.style.width = (r.frenzyT > 0 ? r.frenzyT / RR.SPECIALS.frenzyTime * 100 : r.frenzy) + '%'; P.fz.className = 'sm frenzy ' + fzState; P.fzE.textContent = fzState === 'ready' ? keyF : fzState === 'on' ? r.frenzyT.toFixed(1) : ''; });
      set(P, 'nitro', r.bike.nitro ? r.nitro + '/' + r.bike.nitro + (r.nitroT > 0 ? '!' : '') : '', x => {
        P.nitro.innerHTML = r.bike.nitro ? 'NITRO ' + Array.from({ length: r.bike.nitro }, (_, i) => `<i class="${i < r.nitro ? 'on' : ''}"></i>`).join('') : '';
        P.nitro.classList.toggle('burn', r.nitroT > 0);
      });
      // speedo
      const info = RR.audio.engineInfo(v.index) || { rpm: 0, gear: 1 };
      set(P, 'sp', RR.speedText(r.crash ? 0 : r.v), x => { P.spB.textContent = x; });
      set(P, 'gear', info.gear, x => { P.spE.textContent = x; });
      const rf = clamp((info.rpm - 1000) / 10800, 0, 1);
      set(P, 'rpm', Math.round(rf * 60), x => { P.rpm.style.strokeDasharray = `${(x / 60 * 163).toFixed(1)} 200`; P.rpm.classList.toggle('red', x > 52); });
      // rival you're fighting
      let foe = null, fd = 7;
      for (const o of race.riders) {
        if (o === r || !o.active || (o.cop && o.copState === 'parked')) continue;
        const d = Math.hypot(o.s - r.s, (o.d - r.d) * 1.5);
        if (d < fd) { fd = d; foe = o; }
      }
      if (foe) { P.rivalHold = 1.5; P.foe = foe; } else P.rivalHold -= dt;
      const showFoe = P.rivalHold > 0 && P.foe && !r.crash;
      P.rival.classList.toggle('show', !!showFoe);
      if (showFoe) {
        set(P, 'foe', P.foe.name + (P.foe.weapon ? ' · ' + RR.WEAPONS[P.foe.weapon].name : ''), x => { P.rivalL.textContent = x; });
        set(P, 'foeHp', Math.round(P.foe.hp), x => { P.rivalB.style.width = x + '%'; });
      }
      // police
      const copNear = race.riders.some(o => o.cop && o.siren && Math.abs(o.s - r.s) < 220);
      P.cop.classList.toggle('show', copNear);
      // hints
      let hint = '';
      if (r.crash && r.crash.phase === 'run' && !r.out) hint = RR.input.deviceFor(v.index) === 'pad' ? 'MASH ✕ TO RUN BACK' : RR.input.touch.enabled ? 'TAP HIT TO RUN' : 'MASH UP TO RUN';
      else if (r.out === 'busted') hint = 'YOU\'RE NICKED';
      else if (r.out === 'wrecked') hint = 'YOUR BIKE IS SCRAP';
      else if (r.finished) hint = race.over ? '' : 'WAITING FOR THE OTHERS…';
      set(P, 'hint', hint, x => { P.hint.textContent = x; P.hint.classList.toggle('show', !!x); });
      // name tags over nearby riders
      let n = 0;
      const R = v.rect;
      for (const o of race.riders) {
        if (o === r || n >= P.tags.length) continue;
        if (o.cop && o.copState === 'parked') continue;
        const ds = o.progress - r.progress;
        if (ds < -12 || ds > 90) continue;
        const p = proj.v;
        if (o.crash) tr.pos(o.crash.r.s, o.crash.r.d, 1.6, p); else { tr.pos(o.s, o.d, 0, p); p.y = o.Y + 2.15; }
        p.project(v.cam);
        if (p.z > 1 || p.z < -1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) continue;
        const tg = P.tags[n++];
        const label = o.cop ? '★ POLICE' : o.name + (o.human ? '' : ' ' + o.pos);
        if (tg.textContent !== label) tg.textContent = label;
        tg.style.transform = `translate(${((p.x + 1) / 2 * R.w).toFixed(0)}px, ${((1 - p.y) / 2 * R.h).toFixed(0)}px) translate(-50%,-100%)`;
        tg.style.opacity = clamp(1 - Math.max(0, ds - 50) / 40, 0.15, 1);
        tg.className = 'tag show' + (o.human ? ' hum' : o.cop ? ' cop' : '');
        if (o.human) tg.style.color = hex(o.look.tag || 0xffffff); else tg.style.color = '';
      }
      for (; n < P.tags.length; n++) P.tags[n].className = 'tag';
    }
  };
  RR.hud = H;
})();
