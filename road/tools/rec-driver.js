// Plays Road Rumble for tools/record.js: a race on autopilot (the rival-rider AI steers the player's bike,
// set aggressive so it fights), with the full HUD and the chase camera. A 'versus' race with one rider, so
// the career save isn't touched. Options in the URL: ?track=0&bike=phantom&level=2&warm=14&clean=1
(() => {
  const RR = window.RR, G = RR.game, R = window.__rec, q = new URLSearchParams(location.search);

  // ?clean=1: no HUD or name tags, for cover art
  if (q.get('clean')) { const st = document.createElement('style'); st.textContent = '#hud, #touch { display: none !important; }'; document.head.appendChild(st); }
  R.warm = +(q.get('warm') || 4.6);                   // the countdown (4.6 s); more to start mid-race
  R.setup = async () => {
    await document.fonts.ready;
    while (!G.ready) { window.__step(1000 / 30); await window.__sleep(20); }
    RR.menu.hide();
    let race = null;
    G.startRace({ trackIndex: +(q.get('track') || 0), level: +(q.get('level') || 2), mode: 'versus', seed: +(q.get('seed') || 7), packSize: 12,
      humans: [{ name: 'Rider', bikeId: q.get('bike') || 'phantom', look: RR.PLAYER_LOOKS[0], view: 0, slot: 0 }] }).then(r => { race = r; });
    for (let i = 0; i < 1500 && !race; i++) { window.__step(1000 / 30); await window.__sleep(20); }
    const r = race.humans[0];
    r.ai = { pref: 3, targetD: r.d, laneT: 0, prey: null, preyT: 0, cd: 0, skill: 1.08, aggro: 1 };
    const step = r.step.bind(r);
    r.step = dt => { if (!r.crash && !r.out && !r.finished) r.aiControl(dt); step(dt); };
  };
})();
