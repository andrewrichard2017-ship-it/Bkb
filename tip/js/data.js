// Tractor Tippin': the cars you drive, the farms, sky themes and the things people shout.
(() => {
  'use strict';
  const TT = window.TT;

  // Speeds are in metres per second. hornR is how far the horn reaches; hornAlarm is how much each honk
  // wakes Thrasher. rev is top speed in reverse (Rusty drives backwards as well as forwards).
  TT.CARS = {
    rusty: {
      id: 'rusty', name: 'Rusty', kind: 'Rusty old tow truck',
      blurb: 'Best tractor tipper in the county. Big loud horn, grips like glue, and drives backwards as fast as forwards. Not quick, mind.',
      top: 16.5, accel: 9, rev: 15, brake: 20, grip: 8.5, turn: 2.5, hornR: 13, hornAlarm: 22, boostMul: 1.4, boostTime: 2.6,
      radius: 1.45, mass: 1.35, iris: '#7aa53a', stats: { speed: 0.45, accel: 0.5, handling: 0.85, horn: 1, sneak: 0.55 },
    },
    dash: {
      id: 'dash', name: 'Dash', kind: 'Number 88 race car',
      blurb: 'Fastest thing on four wheels and doesn\'t he know it. Little horn, so get close, and he slides about on the grass.',
      top: 23, accel: 13, rev: 8, brake: 24, grip: 5.2, turn: 2.75, hornR: 9, hornAlarm: 14, boostMul: 1.5, boostTime: 3.6,
      radius: 1.2, mass: 1, iris: '#3b7fe0', stats: { speed: 1, accel: 1, handling: 0.55, horn: 0.55, sneak: 0.8 },
    },
  };
  TT.CAR_IDS = Object.keys(TT.CARS);
  TT.PLAYER_COLORS = ['#ffcf3a', '#3ae0ff'];

  // How a sleeping tractor reacts: drive faster than SNEAK within WAKE_R and it wakes up grumpy (no tip).
  TT.SNEAK = 7.5;
  TT.WAKE_R = 8;
  TT.TRACTOR_R = 1.6;

  TT.THEMES = {
    dusk: { sky: ['#1e2a5c', '#f2995a', '#3a2a2a'], fog: '#b9785f', fogD: 0.0065, moon: '#ffd9a0', moonSize: 26, moonPos: [-0.55, 0.12, -0.83], light: ['#ffc591', 1.3], hemi: ['#8ea6d8', '#4a3a26', 0.85], exposure: 0.95, stars: 0.25, grass: ['#5b7a34', '#6f8a3a'], night: false },
    night: { sky: ['#040818', '#1f3466', '#0b1020'], fog: '#18264a', fogD: 0.0075, moon: '#eef4ff', moonSize: 18, moonPos: [0.45, 0.42, -0.78], light: ['#a9c2ff', 1.5], hemi: ['#4c66a8', '#1d2a18', 0.85], exposure: 1.25, stars: 1, grass: ['#3d5a2c', '#4b6b33'], night: true },
    mist: { sky: ['#0c1428', '#45577a', '#1a2234'], fog: '#3e4d68', fogD: 0.0125, moon: '#e6eeff', moonSize: 20, moonPos: [-0.3, 0.35, -0.88], light: ['#b8c8e8', 1.3], hemi: ['#6a7fa8', '#26301e', 1.0], exposure: 1.25, stars: 0.4, grass: ['#3f5a33', '#4c6a3a'], night: true },
    harvest: { sky: ['#0b0618', '#4a2a55', '#140a14'], fog: '#2d1d3a', fogD: 0.0075, moon: '#ffb055', moonSize: 34, moonPos: [0.6, 0.2, -0.77], light: ['#ffc48a', 1.5], hemi: ['#7058a0', '#2a2214', 0.85], exposure: 1.25, stars: 0.9, grass: ['#4a5a2a', '#5a6a30'], night: true },
    halloween: { sky: ['#0d0318', '#5a1f4a', '#1a0812'], fog: '#2a1230', fogD: 0.0105, moon: '#ffa23a', moonSize: 38, moonPos: [-0.5, 0.26, -0.83], light: ['#ffb070', 1.35], hemi: ['#7a4aa0', '#1e1a10', 0.9], exposure: 1.3, stars: 0.8, grass: ['#3a4628', '#46522c'], night: true, spooky: true },
  };

  // size: half-width of the fenced farm in metres. goal: tips to open the gate. bonus: tips for the second star.
  // wake: how much noise Thrasher sleeps through. tSpeed: Thrasher's top speed.
  TT.LEVELS = [
    { id: 'pasture', name: 'Sundown Pasture', theme: 'dusk', seed: 1101, size: 75, tractors: 6, goal: 4, bonus: 6, wake: 110, tSpeed: 11.5, corn: 1, bales: 10, mud: 2, trees: 10, pond: false, recover: 40,
      blurb: 'Your first time out. Creep up slowly, honk, and the tractors go right over. Then get back out the gate before Thrasher wakes up.' },
    { id: 'cornfield', name: 'Moonlit Cornfield', theme: 'night', seed: 2207, size: 85, tractors: 8, goal: 6, bonus: 8, wake: 100, tSpeed: 12.5, corn: 5, bales: 10, mud: 3, trees: 12, pond: false, recover: 40,
      blurb: 'Tall corn everywhere. Hide in it if Thrasher comes looking, but he can mow straight through.' },
    { id: 'haybale', name: 'Hay Bale Hollow', theme: 'night', seed: 3319, size: 90, tractors: 10, goal: 7, bonus: 10, wake: 95, tSpeed: 13.5, corn: 2, bales: 45, mud: 3, trees: 14, pond: false, recover: 35,
      blurb: 'Bales stacked all over the place. Duck behind them; Thrasher smashes straight through.' },
    { id: 'mud', name: 'Muddy Bottoms', theme: 'mist', seed: 4421, size: 90, tractors: 10, goal: 8, bonus: 10, wake: 90, tSpeed: 14, corn: 2, bales: 14, mud: 12, trees: 16, pond: true, recover: 35,
      blurb: 'Fog, a duck pond and mud everywhere. Mud slows you right down, and Thrasher\'s big wheels don\'t care.' },
    { id: 'barn', name: "Thrasher's Barn", theme: 'harvest', seed: 5531, size: 105, tractors: 14, goal: 11, bonus: 14, wake: 80, tSpeed: 15, corn: 4, bales: 24, mud: 5, trees: 18, pond: true, recover: 30,
      blurb: 'The big one. Harvest moon, the biggest herd in the county, and Thrasher sleeps with one eye open.' },
  ];
  TT.HALLOWEEN = { id: 'haunted', name: 'Haunted Harvest', theme: 'halloween', seed: 3110, size: 90, tractors: 10, goal: 7, bonus: 10, wake: 95, tSpeed: 13.5, corn: 2, bales: 8, mud: 3, trees: 6, pond: false, recover: 30,
    pumpkins: 46, ghosts: true, halloween: true,
    blurb: 'Halloween special! Ghost tractors in the pumpkin patch, bats round the moon, and Pumpkin Thrasher on the prowl. Smash pumpkins for treats.' };
  TT.ALL_LEVELS = [...TT.LEVELS, TT.HALLOWEEN];
  TT.level = id => TT.ALL_LEVELS.find(l => l.id === id) || TT.LEVELS[0];

  TT.TIPOFF_TIME = 150;  // seconds in a Tip-Off
  TT.DENTS = 3;          // hits from Thrasher before you're caught (story)

  TT.LINES = {
    tip: ['TIPPED!', 'OVER SHE GOES!', 'TIMBER!', 'GOTCHA!', 'BOOM!'],
    combo: ['', '', 'DOUBLE TIP!', 'TRIPLE TIP!', 'MEGA TIP!', 'HERD TIPPED!'],
    wary: ['TOO LOUD! IT WOKE UP', 'SLOW DOWN, IT SAW YOU', 'SHHH! CREEP UP SLOWLY'],
    wake: ['THRASHER\'S AWAKE!', 'UH OH… THRASHER!', 'RUN!'],
    hit: ['OUCH!', 'DENTED!', 'WHAM!'],
    halloweenTip: ['BOO!', 'SPOOKED!', 'GHOSTED!', 'TIPPED!'],
  };
})();
