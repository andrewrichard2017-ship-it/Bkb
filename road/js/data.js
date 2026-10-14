// Road Rumble: bikes, riders, weapons, tracks and the career ladder.
(() => {
  'use strict';
  const RR = window.RR;

  RR.ROAD_HALF = 7.2;                 // half width of the tarmac (two lanes each way, 3.6 m)
  RR.LANES = [-5.4, -1.8, 1.8, 5.4];  // lane centres; negative = oncoming side
  RR.G = 9.8;

  // top: top speed m/s, accel: m/s^2 off the line, handling: steering multiplier,
  // weight: shoves harder / gets shoved less, armor: crash damage multiplier, nitro: boosts per race.
  RR.BIKES = [
    { id: 'rust', name: 'Rustbucket 350', cls: 'RAT', price: 0, top: 47, accel: 9.5, handling: 0.88, weight: 0.9, armor: 1.0, nitro: 0,
      style: 'rat', paint: 0x8a5a32, trim: 0x2b2b2b, blurb: 'Held together with tape and prayer. Gets you to the next race. Usually.' },
    { id: 'viper', name: 'Viper 600', cls: 'SPORT', price: 3500, top: 56, accel: 11, handling: 1.0, weight: 0.9, armor: 1.0, nitro: 0,
      style: 'sport', paint: 0xc62828, trim: 0xf2f2f2, blurb: 'Light, quick and twitchy. The starter sport bike every rasher owns once.' },
    { id: 'banshee', name: 'Banshee 750', cls: 'SPORT', price: 7000, top: 61, accel: 12.5, handling: 1.06, weight: 1.0, armor: 0.95, nitro: 0,
      style: 'sport', paint: 0x1565c0, trim: 0xffd54f, blurb: 'Screams like its name. Sharp in the bends, strong to the redline.' },
    { id: 'kodiak', name: 'Kodiak 1100', cls: 'MUSCLE', price: 9500, top: 60, accel: 11.5, handling: 0.86, weight: 1.45, armor: 0.7, nitro: 0,
      style: 'cruiser', paint: 0x2e3b40, trim: 0xd0d0d0, blurb: 'A tank with wheels. Slow to turn, but it shoves riders into traffic and shrugs off crashes.' },
    { id: 'phantom', name: 'Phantom 1000', cls: 'SUPER', price: 15000, top: 67, accel: 14, handling: 1.1, weight: 1.05, armor: 0.9, nitro: 3,
      style: 'super', paint: 0x6a1b9a, trim: 0x111111, blurb: 'Race-bred superbike with three nitro shots. Hold on tight.' },
    { id: 'wraith', name: 'Wraith 1300', cls: 'SUPER', price: 24000, top: 74, accel: 15.5, handling: 1.15, weight: 1.1, armor: 0.85, nitro: 4,
      style: 'super', paint: 0x151515, trim: 0x39ff14, blurb: 'The fastest thing on two wheels. Four nitro shots. Nothing catches it.' },
  ];
  RR.bike = id => RR.BIKES.find(b => b.id === id) || RR.BIKES[0];
  RR.COP_BIKE = { id: 'cop', name: 'Police 1200', cls: 'POLICE', top: 66, accel: 14, handling: 1.05, weight: 1.3, armor: 0.6, nitro: 0,
    style: 'cop', paint: 0xf4f4f4, trim: 0x0d1b3d };

  // Attacks: wind = wind-up seconds, hit = strike window, rec = recovery, reach = sideways metres.
  RR.ATTACKS = {
    punch: { dmg: 7, push: 0.7, reach: 1.8, wind: 0.09, hit: 0.1, rec: 0.18, sfx: 'punch' },
    kick: { dmg: 9, push: 3.4, reach: 2.05, wind: 0.15, hit: 0.12, rec: 0.28, sfx: 'kick', bike: 2 },
  };
  RR.WEAPONS = {
    chain: { name: 'CHAIN', dmg: 15, push: 1.0, reach: 2.6, wind: 0.16, hit: 0.13, rec: 0.3, sfx: 'chain' },
    club: { name: 'CLUB', dmg: 13, push: 1.3, reach: 2.3, wind: 0.13, hit: 0.12, rec: 0.25, sfx: 'club' },
    crowbar: { name: 'CROWBAR', dmg: 17, push: 1.1, reach: 2.25, wind: 0.18, hit: 0.12, rec: 0.3, sfx: 'metal' },
    pipe: { name: 'PIPE', dmg: 15, push: 1.4, reach: 2.4, wind: 0.17, hit: 0.12, rec: 0.3, sfx: 'metal' },
    bat: { name: 'BAT', dmg: 14, push: 1.5, reach: 2.4, wind: 0.15, hit: 0.12, rec: 0.27, sfx: 'club' },
    baton: { name: 'BATON', dmg: 12, push: 1.0, reach: 2.2, wind: 0.12, hit: 0.12, rec: 0.24, sfx: 'club' },
    // picked up from the glowing crates on the road: three shells, each blast knocks a rider off
    shotgun: { name: 'SHOTGUN', ranged: true, ammo: 3, dmg: 30, push: 4, reach: 30, wind: 0.07, hit: 0.05, rec: 0.55, sfx: 'shotgun' },
  };
  // Specials. Turbo Blaze: built by riding fast, air time and riding clean; unstoppable for a few seconds.
  // Frenzy: built by taking damage and by hitting riders and police; a machine gun for ten seconds.
  RR.SPECIALS = { blazeTime: 4, blazeTop: 1.45, frenzyTime: 10, gunRate: 0.085, gunDmg: 4.5, gunRange: 48 };

  // The pack. skill scales their pace, aggro how often they pick fights.
  RR.RIVALS = [
    { name: 'Duke', skill: 0.97, aggro: 0.75, weapon: 'club', jacket: 0x1b1b1b, helmet: 0xb71c1c, legs: 0x263238 },
    { name: 'Roxy', skill: 1.02, aggro: 0.5, weapon: 'chain', jacket: 0xec407a, helmet: 0xf5f5f5, legs: 0x212121 },
    { name: 'Mad Dog', skill: 0.93, aggro: 1.0, weapon: 'crowbar', jacket: 0x556b2f, helmet: 0x3e2723, legs: 0x3e3e2e },
    { name: 'Lucky', skill: 1.0, aggro: 0.3, weapon: null, jacket: 0x2e7d32, helmet: 0xffeb3b, legs: 0x1a237e },
    { name: 'Jett', skill: 1.05, aggro: 0.4, weapon: null, jacket: 0xfbc02d, helmet: 0x111111, legs: 0x111111 },
    { name: 'Bones', skill: 0.95, aggro: 0.85, weapon: 'chain', jacket: 0xeeeeee, helmet: 0x111111, legs: 0x111111 },
    { name: 'Tank', skill: 0.9, aggro: 0.9, weapon: 'pipe', jacket: 0x6d4c41, helmet: 0x8d6e63, legs: 0x3e2723 },
    { name: 'Lola', skill: 0.99, aggro: 0.6, weapon: 'bat', jacket: 0x7b1fa2, helmet: 0xce93d8, legs: 0x212121 },
    { name: 'Rico', skill: 0.96, aggro: 0.55, weapon: 'club', jacket: 0xef6c00, helmet: 0x212121, legs: 0x37474f },
    { name: 'Spike', skill: 0.98, aggro: 0.85, weapon: 'chain', jacket: 0x0d47a1, helmet: 0x90caf9, legs: 0x102027 },
    { name: 'Viv', skill: 1.03, aggro: 0.45, weapon: null, jacket: 0x00897b, helmet: 0xe0f2f1, legs: 0x263238 },
    { name: 'Sarge', skill: 0.95, aggro: 0.7, weapon: 'crowbar', jacket: 0x4e5b31, helmet: 0x33691e, legs: 0x3b3b2b },
  ];
  RR.PLAYER_LOOKS = [
    { jacket: 0x161616, helmet: 0xff6f00, legs: 0x1f2a44, tag: 0xffb300 },
    { jacket: 0x0f3d5e, helmet: 0x00e5ff, legs: 0x1b1b1b, tag: 0x00e5ff },
  ];
  RR.TAUNTS = {
    hit: ['Outta my way!', 'Eat that!', 'Too slow!', 'Move it!', 'Ha!', 'Nighty night!'],
    knock: ['See ya!', 'Enjoy the gravel!', 'Road rash!', 'Bye bye!', 'Taste the tarmac!'],
  };

  // Themes: colours, light and what grows by the road.
  RR.THEMES = {
    coast: {
      skyTop: 0x2f6db5, skyHorizon: 0xf6cfa0, fog: 0xe7c9a6, fogNear: 120, fogFar: 1500, sunDir: [-0.55, 0.32, -0.75], sun: 0xffe0b0, sunI: 3.2,
      hemiSky: 0xbcd4f0, hemiGround: 0x6b5a40, hemiI: 1.1, grass: 0x8a9a4a, grass2: 0xb7a565, dirt: 0xa08b62, rock: 0x9b8a74,
      relief: 18, hills: 40, sea: true, night: false,
    },
    forest: {
      skyTop: 0x3d78c4, skyHorizon: 0xcfe0ee, fog: 0xb9cad8, fogNear: 90, fogFar: 1150, sunDir: [0.45, 0.55, -0.6], sun: 0xfff1d6, sunI: 3.0,
      hemiSky: 0xcfe2f5, hemiGround: 0x2f3d24, hemiI: 1.2, grass: 0x4c6b32, grass2: 0x36552a, dirt: 0x6e5a3e, rock: 0x7d7f80,
      relief: 34, hills: 90, sea: false, snow: true, night: false,
    },
    valley: {
      skyTop: 0x2a74d8, skyHorizon: 0xd8ecf8, fog: 0xcde3f1, fogNear: 140, fogFar: 1700, sunDir: [0.3, 0.85, -0.35], sun: 0xffffff, sunI: 3.4,
      hemiSky: 0xd6ebff, hemiGround: 0x4f6b2a, hemiI: 1.15, grass: 0x6f9c3a, grass2: 0x98b24c, dirt: 0x8d7148, rock: 0x8f8679,
      relief: 14, hills: 45, sea: false, night: false,
    },
    desert: {
      skyTop: 0x3a6fb0, skyHorizon: 0xffb977, fog: 0xf0b88a, fogNear: 160, fogFar: 1900, sunDir: [0.75, 0.18, -0.62], sun: 0xffc27a, sunI: 3.4,
      hemiSky: 0xffd9b0, hemiGround: 0x8a4a2a, hemiI: 1.0, grass: 0xc98b55, grass2: 0xd9a066, dirt: 0xb8764a, rock: 0xa4553a,
      relief: 10, hills: 30, sea: false, night: false, jumps: 1.8,
    },
    city: {
      skyTop: 0x0b1030, skyHorizon: 0xd8743f, fog: 0x3a2d44, fogNear: 70, fogFar: 1000, sunDir: [-0.3, 0.12, -0.9], sun: 0xffa060, sunI: 1.3,
      hemiSky: 0x7f8fd0, hemiGround: 0x3a2c30, hemiI: 1.5, grass: 0x4a4a52, grass2: 0x55555e, dirt: 0x5c5a5e, rock: 0x6a6870,
      relief: 9, hills: 0, sea: false, night: true, jumps: 1.2,
    },
  };

  RR.TRACKS = [
    { id: 'coast', name: 'Coast Highway', theme: 'coast', seed: 1101, blurb: 'Cliff-top tarmac over the ocean. Guard rail on your right, a long drop beyond it.' },
    { id: 'forest', name: 'Redwood Pass', theme: 'forest', seed: 2203, blurb: 'Climbing switchbacks through the pines. Trees right to the edge of the road.' },
    { id: 'valley', name: 'Vineyard Valley', theme: 'valley', seed: 3307, blurb: 'Rolling hills and farm traffic. Fast, open and wide.' },
    { id: 'desert', name: 'Canyon Run', theme: 'desert', seed: 4409, blurb: 'Long straights, big crests and red rock. Get the jumps right.' },
    { id: 'city', name: 'Downtown', theme: 'city', seed: 5503, blurb: 'Night, neon and rush-hour traffic. The cops patrol every block.' },
  ];

  // Career ladder: five levels, qualify (top 3) on every track to move up.
  RR.LEVELS = [
    { length: 5000, pace: 0.86, cops: 1, traffic: 0.8, prize: 1000 },
    { length: 6000, pace: 0.91, cops: 1, traffic: 0.95, prize: 1600 },
    { length: 7000, pace: 0.95, cops: 2, traffic: 1.05, prize: 2400 },
    { length: 8000, pace: 0.99, cops: 2, traffic: 1.15, prize: 3400 },
    { length: 9000, pace: 1.03, cops: 3, traffic: 1.25, prize: 4800 },
  ];
  RR.PRIZE_SHARE = [1, 0.7, 0.5, 0.35, 0.25, 0.15];  // places 1-6 get paid
  RR.QUALIFY = 3;
  // Which bikes the pack rides at each level.
  RR.PACK_BIKES = [['rust', 'rust', 'rust', 'viper'], ['rust', 'viper', 'viper'], ['viper', 'banshee', 'kodiak'], ['banshee', 'kodiak', 'phantom'], ['banshee', 'phantom', 'wraith', 'kodiak']];
})();
