// Road Rumble: ads and game-portal hooks. Off unless the page says which portal it's on, so the GitHub Pages
// copy never loads an ad script. tools/package.py writes window.RR_PORTAL into the portal build;
// ?portal=crazygames turns it on locally (the CrazyGames SDK then shows demo ads on localhost).
// Everything here is a safe no-op when ads are off: midgame() just runs its callback, rewarded() fails.
(() => {
  'use strict';
  const RR = window.RR;
  const portal = window.RR_PORTAL || new URLSearchParams(location.search).get('portal') || '';
  const MIDGAME_GAP = 180;                            // seconds between break ads (the portal limits them too)
  const A = RR.ads = { portal, ready: false, showing: false, playing: false };
  let sdk = null, lastMid = performance.now() / 1000, races = 0;

  if (portal === 'crazygames') {
    const s = document.createElement('script');
    s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    s.onload = async () => {
      try {
        await window.CrazyGames.SDK.init();
        sdk = window.CrazyGames.SDK;
        A.ready = sdk.environment !== 'disabled';
        // an online invite opened on CrazyGames arrives as an invite param, not ?join=
        const code = sdk.game.getInviteParam && sdk.game.getInviteParam('join');
        if (code && RR.menu && RR.menu.screen === 'title') RR.menu.show('join', { code: String(code).toUpperCase() });
        if (A.playing) sdk.game.gameplayStart();
      } catch (e) { console.warn('ads', e); }
    };
    document.head.appendChild(s);
  }

  let toastEl = null, toastT = 0;
  const toast = text => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:99;padding:10px 18px;border-radius:10px;background:rgba(10,10,14,.88);color:#fff;font:600 18px "Barlow Condensed",Arial,sans-serif;letter-spacing:.04em;pointer-events:none;transition:opacity .3s';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.style.opacity = '1';
    clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = '0'; }, 2600);
  };
  // the portal wants to know when someone is actually racing (no ads mid-race, better stats)
  A.gameplay = on => {
    if (on === A.playing) return;
    A.playing = on;
    if (sdk) try { on ? sdk.game.gameplayStart() : sdk.game.gameplayStop(); } catch (e) { /* ignore */ }
  };
  A.happy = () => { if (sdk) try { sdk.game.happytime(); } catch (e) { /* ignore */ } };
  A.invite = code => { if (!sdk || !sdk.game.inviteLink) return null; try { return sdk.game.inviteLink({ join: code }); } catch (e) { return null; } };
  A.canReward = () => A.ready && !A.showing;

  function show(kind, done) {
    A.showing = true;
    let started = false, ended = false;
    const finish = ok => {
      if (ended) return; ended = true;
      A.showing = false; RR.audio.setMuted(false);
      done(ok);
    };
    // if the ad never starts (blocked, nothing to show), don't leave the player stuck
    setTimeout(() => { if (!started) finish(false); }, 8000);
    try {
      sdk.ad.requestAd(kind, {
        adStarted: () => { started = true; RR.audio.setMuted(true); },
        adFinished: () => finish(true),
        adError: () => finish(false),
      });
    } catch (e) { finish(false); }
  }

  // a break ad between races (continue, race again). At most one every few minutes, never after the first
  // couple of races, and never online (the other rider would be left waiting).
  A.midgame = then => {
    races++;
    const now = performance.now() / 1000;
    if (!A.ready || A.showing || (RR.net && RR.net.active) || races < 3 || now - lastMid < MIDGAME_GAP) return then();
    lastMid = now;
    show('midgame', () => then());
  };
  // an ad the player chooses to watch for a reward; onReward only runs if they watched it through
  A.rewarded = onReward => {
    if (!A.canReward()) { toast('No ad available right now'); return; }
    show('rewarded', ok => { if (ok) onReward(); else toast('No ad available right now, try again later'); });
  };
})();
