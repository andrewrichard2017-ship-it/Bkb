// Bubble Odyssey: ads and game-portal hooks. Off unless the page says which portal it's on, so the
// GitHub Pages copy never loads an ad script. tools/package.py writes window.BB_PORTAL into the portal
// build; ?portal=crazygames turns it on locally (the CrazyGames SDK then shows demo ads on localhost).
// Everything here is a safe no-op when ads are off: midgame() just runs its callback, rewarded() fails.
(() => {
  'use strict';
  const BB = window.BB;
  const q = new URLSearchParams(location.search);
  const portal = window.BB_PORTAL || q.get('portal') || '';
  const MIDGAME_GAP = 180;                            // seconds between break ads (the portal limits them too)
  const A = BB.ads = { portal, ready: false, showing: false, playing: false };
  let sdk = null, lastMid = performance.now() / 1000, games = 0;

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
        if (code && BB.menu && BB.menu.screen === 'title') BB.menu.show('join', { code: String(code).toUpperCase() });
        if (A.playing) sdk.game.gameplayStart();
      } catch (e) { console.warn('ads', e); }
    };
    document.head.appendChild(s);
  }

  // the portal wants to know when someone is actually playing (no ads mid-level, better stats)
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
      A.showing = false; BB.audio.mute(false);
      done(ok);
    };
    // if the ad never starts (blocked, nothing to show), don't leave the player stuck
    setTimeout(() => { if (!started) finish(false); }, 8000);
    try {
      sdk.ad.requestAd(kind, {
        adStarted: () => { started = true; BB.audio.mute(true); },
        adFinished: () => finish(true),
        adError: () => finish(false),
      });
    } catch (e) { finish(false); }
  }

  // a break ad between games: next level, retry, back to the map. At most one every few minutes and
  // never in the first couple of games, so new players get to enjoy it first.
  A.midgame = then => {
    games++;
    const now = performance.now() / 1000;
    if (!A.ready || A.showing || games < 3 || now - lastMid < MIDGAME_GAP) return then();
    lastMid = now;
    show('midgame', () => then());
  };
  // an ad the player chooses to watch for a reward; onReward only runs if they watched it through
  A.rewarded = onReward => {
    if (!A.canReward()) { BB.render.showToast('No ad available right now', '#ffb3c0'); return; }
    show('rewarded', ok => { if (ok) onReward(); else BB.render.showToast('No ad available right now, try again later', '#ffb3c0'); });
  };
})();
