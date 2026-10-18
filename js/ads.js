// Ads and game-portal hooks. Off unless the page says which portal it's on, so the GitHub Pages copy never
// loads an ad script. tools/package.py writes window.BK_PORTAL into the portal build; ?portal=crazygames
// turns it on locally (the CrazyGames SDK then shows demo ads on localhost).
// Everything here is a safe no-op when ads are off: midgame() just runs its callback, rewarded() fails.
(() => {
  'use strict';
  const BK = window.BK;
  const portal = window.BK_PORTAL || new URLSearchParams(location.search).get('portal') || '';
  const MIDGAME_GAP = 180;                            // seconds between break ads (the portal limits them too)
  const A = BK.ads = { portal, ready: false, showing: false, playing: false };
  let sdk = null, lastMid = performance.now() / 1000, fights = 0;

  if (portal === 'crazygames') {
    const s = document.createElement('script');
    s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    s.onload = async () => {
      try {
        await window.CrazyGames.SDK.init();
        sdk = window.CrazyGames.SDK;
        A.ready = sdk.environment !== 'disabled';
        if (A.playing) sdk.game.gameplayStart();
      } catch (e) { console.warn('ads', e); }
    };
    document.head.appendChild(s);
  }

  const toast = text => { BK.pad.toast = 3; BK.pad.toastText = text; };
  // the portal wants to know when someone is actually playing (no ads mid-fight, better stats)
  A.gameplay = on => {
    if (on === A.playing) return;
    A.playing = on;
    if (sdk) try { on ? sdk.game.gameplayStart() : sdk.game.gameplayStop(); } catch (e) { /* ignore */ }
  };
  A.happy = () => { if (sdk) try { sdk.game.happytime(); } catch (e) { /* ignore */ } };
  A.canReward = () => A.ready && !A.showing;

  function show(kind, done) {
    A.showing = true;
    let started = false, ended = false;
    const finish = ok => {
      if (ended) return; ended = true;
      A.showing = false; BK.audio.mute(false);
      done(ok);
    };
    // if the ad never starts (blocked, nothing to show), don't leave the player stuck
    setTimeout(() => { if (!started) finish(false); }, 8000);
    try {
      sdk.ad.requestAd(kind, {
        adStarted: () => { started = true; BK.audio.mute(true); },
        adFinished: () => finish(true),
        adError: () => finish(false),
      });
    } catch (e) { finish(false); }
  }

  // a break ad between fights (rematch, next tournament fight, back to the menu). At most one every few
  // minutes and never after the first couple of fights, so new players get to enjoy it first.
  A.midgame = then => {
    fights++;
    const now = performance.now() / 1000;
    if (!A.ready || A.showing || fights < 3 || now - lastMid < MIDGAME_GAP) return then();
    lastMid = now;
    show('midgame', () => then());
  };
  // an ad the player chooses to watch for a reward; onReward only runs if they watched it through
  A.rewarded = onReward => {
    if (!A.canReward()) { toast('NO AD AVAILABLE RIGHT NOW'); return; }
    show('rewarded', ok => { if (ok) onReward(); else toast('NO AD AVAILABLE RIGHT NOW, TRY AGAIN LATER'); });
  };
})();
