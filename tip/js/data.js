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
      radius: 1.2, mass: 1, iris: '#3b7fe0', irisLight: '#9ad0ff', stats: { speed: 1, accel: 1, handling: 0.55, horn: 0.55, sneak: 0.8 },
      body: 'stock', paint: '#d4141c', decal: 'bolt', num: '88', hood: 'TIPPIN\' OIL', horn: 'beep',
    },
    sunny: {
      id: 'sunny', name: 'Sunny', kind: 'Blue sports coupe',
      blurb: 'Smart, quick and sure-footed. Runs the motel in town and won\'t stand for any nonsense, but she loves a night out tipping.',
      top: 21, accel: 12, rev: 9, brake: 24, grip: 7, turn: 2.8, hornR: 10, hornAlarm: 15, boostMul: 1.45, boostTime: 3.2,
      radius: 1.2, mass: 1, iris: '#2a9a9a', irisLight: '#9ae8e0', stats: { speed: 0.85, accel: 0.85, handling: 0.8, horn: 0.6, sneak: 0.8 },
      body: 'sports', paint: '#5aaee8', horn: 'beep', unlock: null,
    },
    pepe: {
      id: 'pepe', name: 'Pepe', kind: 'Little yellow bubble car',
      blurb: 'Tiny, nippy and very excited about everything. So small and quiet the tractors barely notice him, but his horn is a squeak.',
      top: 15.5, accel: 11, rev: 9, brake: 22, grip: 8, turn: 3.2, hornR: 8, hornAlarm: 9, boostMul: 1.5, boostTime: 3,
      radius: 0.95, mass: 0.7, iris: '#8a5a2a', irisLight: '#e0b080', stats: { speed: 0.4, accel: 0.75, handling: 0.95, horn: 0.4, sneak: 1 },
      body: 'bubble', paint: '#f4c518', horn: 'toot', unlock: { tips: 20, text: 'Tip 20 tractors' },
    },
    groovy: {
      id: 'groovy', name: 'Groovy', kind: 'Flower-power camper van',
      blurb: 'Laid back, man. Slow off the mark and wallows round corners, but his horn plays a tune the whole county can hear.',
      top: 15, accel: 7, rev: 8, brake: 18, grip: 6.5, turn: 2.2, hornR: 14, hornAlarm: 20, boostMul: 1.4, boostTime: 3,
      radius: 1.4, mass: 1.4, iris: '#6a8a3a', irisLight: '#c8e090', stats: { speed: 0.35, accel: 0.25, handling: 0.45, horn: 1, sneak: 0.5 },
      body: 'van', paint: '#5a9a50', paint2: '#9ccf8a', horn: 'tune', mood: 'sleepy', unlock: { escape: 'cornfield', text: 'Escape Moonlit Cornfield' },
    },
    marshal: {
      id: 'marshal', name: 'Marshal', kind: '1949 police cruiser',
      blurb: 'The law round here. A siren that reaches right across the field, and solid as a rock when Thrasher comes knocking.',
      top: 19, accel: 10, rev: 10, brake: 24, grip: 7, turn: 2.5, hornR: 16, hornAlarm: 30, boostMul: 1.45, boostTime: 3,
      radius: 1.3, mass: 1.35, iris: '#3a5a9a', irisLight: '#a0c0f0', stats: { speed: 0.7, accel: 0.6, handling: 0.75, horn: 1, sneak: 0.4 },
      body: 'vintage', paint: '#16161a', roof: '#16161a', siren: true, horn: 'siren', len: 0.97, unlock: { escape: 'haybale', text: 'Escape Hay Bale Hollow' },
    },
    nippy: {
      id: 'nippy', name: 'Nippy', kind: 'Tiny forklift',
      blurb: 'Fastest tyre-changer in the business and the quickest off the line, but those little wheels top out early. Turns on a penny.',
      top: 14, accel: 15, rev: 12, brake: 26, grip: 9, turn: 3.6, hornR: 9, hornAlarm: 9, boostMul: 1.8, boostTime: 2.2,
      radius: 0.9, mass: 0.6, iris: '#3a6ab0', irisLight: '#a0c8ff', stats: { speed: 0.3, accel: 1, handling: 1, horn: 0.5, sneak: 1 },
      body: 'forklift', paint: '#5a9be0', horn: 'toot', mood: 'happy', unlock: { escape: 'mud', text: 'Escape Muddy Bottoms' },
    },
    bigmo: {
      id: 'bigmo', name: 'Big Mo', kind: 'Big red truck',
      blurb: 'A gentle giant with the loudest air horn in the state. Takes an age to get going, but nothing pushes him around.',
      top: 15, accel: 6, rev: 7, brake: 16, grip: 7, turn: 2.0, hornR: 18, hornAlarm: 32, boostMul: 1.4, boostTime: 3,
      radius: 1.8, mass: 2.6, iris: '#6a4a2a', irisLight: '#e0b890', stats: { speed: 0.35, accel: 0.15, handling: 0.4, horn: 1, sneak: 0.2 },
      body: 'truck', paint: '#c8201c', horn: 'air', mood: 'happy', unlock: { escape: 'barn', text: 'Escape Thrasher\'s Barn' },
    },
    chatter: {
      id: 'chatter', name: 'Chatter', kind: 'Race commentator',
      blurb: 'Never stops talking. Raced for years before he took the microphone, and he\'s still got it on the straights.',
      top: 21.5, accel: 12, rev: 8, brake: 24, grip: 5.8, turn: 2.6, hornR: 10, hornAlarm: 15, boostMul: 1.45, boostTime: 3.4,
      radius: 1.2, mass: 1, iris: '#7a4a2a', irisLight: '#e0b080', stats: { speed: 0.9, accel: 0.85, handling: 0.6, horn: 0.6, sneak: 0.7 },
      body: 'stock', paint: '#e8e2d2', decal: 'swoosh', decalCols: ['#ff7a1a', '#2a7ad8', '#9adf3a'], num: '00', hood: 'ON AIR', hoodCol: '#d42020', horn: 'tune', mood: 'happy', unlock: { race: 'any', text: 'Finish a race' },
    },
    ace: {
      id: 'ace', name: 'Ace', kind: 'Old 1950s racing legend',
      blurb: 'Won three championships before anyone here was born. Not the fastest any more, but nobody drives the dirt like Ace.',
      top: 21, accel: 11, rev: 9, brake: 24, grip: 8.5, turn: 2.7, hornR: 10, hornAlarm: 15, boostMul: 1.45, boostTime: 3.4,
      radius: 1.3, mass: 1.25, iris: '#2a4a8a', irisLight: '#9ab8f0', stats: { speed: 0.8, accel: 0.75, handling: 0.95, horn: 0.6, sneak: 0.7 },
      body: 'vintage', paint: '#1d2c66', num: '7', badge: 'Ace', horn: 'low', unlock: { win: 'butte', text: 'Win at Dusty Butte' },
    },
    longhorn: {
      id: 'longhorn', name: 'Longhorn', kind: 'Gold land yacht',
      blurb: 'Oil money, big hat, bigger horns. Long and heavy and wallows like a boat, but his horn rattles windows a mile off.',
      top: 20, accel: 9, rev: 8, brake: 20, grip: 5.5, turn: 2.2, hornR: 14, hornAlarm: 24, boostMul: 1.45, boostTime: 3.2,
      radius: 1.45, mass: 1.7, iris: '#6a5a2a', irisLight: '#e8d090', stats: { speed: 0.75, accel: 0.5, handling: 0.4, horn: 0.9, sneak: 0.45 },
      body: 'vintage', paint: '#c9a64a', metal: true, len: 1.12, fins: true, horns: true, badge: 'Longhorn', badgeCol: '#5a3a10', horn: 'low', unlock: { win: 'bowl', text: 'Win at Piston Bowl' },
    },
    blower: {
      id: 'blower', name: 'Blower', kind: 'Supercharged muscle car',
      blurb: 'All engine and no brakes. The fastest car on the farm in a straight line, and slides like a bar of soap everywhere else.',
      top: 25, accel: 14, rev: 8, brake: 20, grip: 4.5, turn: 2.5, hornR: 9, hornAlarm: 26, boostMul: 1.45, boostTime: 3.6,
      radius: 1.25, mass: 1.1, iris: '#8a2a1a', irisLight: '#f09a70', stats: { speed: 1, accel: 1, handling: 0.3, horn: 0.5, sneak: 0.3 },
      body: 'stock', paint: '#e2601a', blower: true, decal: 'flames', decalCols: ['#ffd23a', '#7a1a0a'], horn: 'tune', mood: 'sneaky', unlock: { win: 'country', text: 'Win on Country Run' },
    },
  };
  TT.CAR_IDS = Object.keys(TT.CARS);
  // has this car been unlocked on this device? (Rusty, Dash and Sunny you start with)
  TT.unlocked = id => {
    const c = TT.CARS[id], u = c && c.unlock, S = TT.save;
    if (!u) return true;
    if (u.tips) return (S.tipsTotal || 0) >= u.tips;
    if (u.escape) return (S.stars[u.escape] || 0) > 0;
    if (u.race) return (S.races || 0) > 0;
    if (u.win) return !!(S.raceWins || {})[u.win];
    return true;
  };
  TT.PLAYER_COLORS = ['#ffcf3a', '#3ae0ff', '#ff7ad9', '#9dff6a']; // by slot (2 and 3 are computer drivers in the hunt)

  // How a sleeping tractor reacts: drive faster than SNEAK within WAKE_R and it wakes up grumpy (no tip).
  TT.SNEAK = 7.5;
  TT.WAKE_R = 8;
  TT.TRACTOR_R = 1.6;

  TT.THEMES = {
    dusk: { sky: ['#1e2a5c', '#f2995a', '#3a2a2a'], fog: '#b9785f', fogD: 0.0065, moon: '#ffd9a0', moonSize: 26, moonPos: [-0.55, 0.12, -0.83], light: ['#ffc591', 1.3], hemi: ['#8ea6d8', '#4a3a26', 0.85], exposure: 0.95, stars: 0.25, grass: ['#5b7a34', '#6f8a3a'], night: false },
    night: { sky: ['#040818', '#1f3466', '#0b1020'], fog: '#18264a', fogD: 0.0075, moon: '#eef4ff', moonSize: 18, moonPos: [0.45, 0.42, -0.78], light: ['#a9c2ff', 1.5], hemi: ['#4c66a8', '#1d2a18', 0.85], exposure: 1.25, stars: 1, grass: ['#3d5a2c', '#4b6b33'], night: true },
    mist: { sky: ['#0c1428', '#45577a', '#1a2234'], fog: '#3e4d68', fogD: 0.0125, moon: '#e6eeff', moonSize: 20, moonPos: [-0.3, 0.35, -0.88], light: ['#b8c8e8', 1.3], hemi: ['#6a7fa8', '#26301e', 1.0], exposure: 1.25, stars: 0.4, grass: ['#3f5a33', '#4c6a3a'], night: true },
    harvest: { sky: ['#0b0618', '#4a2a55', '#140a14'], fog: '#2d1d3a', fogD: 0.0075, moon: '#ffb055', moonSize: 34, moonPos: [0.6, 0.2, -0.77], light: ['#ffc48a', 1.5], hemi: ['#7058a0', '#2a2214', 0.85], exposure: 1.25, stars: 0.9, grass: ['#4a5a2a', '#5a6a30'], night: true },
    desert: { sky: ['#2a3a8a', '#ffb070', '#5a3a2a'], fog: '#e8a878', fogD: 0.0035, moon: '#fff2c0', moonSize: 22, moonPos: [0.55, 0.22, -0.8], light: ['#ffe0b0', 2.2], hemi: ['#a8c0ff', '#a07050', 1.1], exposure: 0.95, stars: 0.1, grass: ['#c8905a', '#b87a48'], night: false, desert: true },
    stadium: { sky: ['#03050f', '#141c3a', '#05060c'], fog: '#0c1226', fogD: 0.004, moon: '#eef4ff', moonSize: 14, moonPos: [0.3, 0.5, -0.8], light: ['#dde6ff', 2.0], hemi: ['#8090c0', '#303030', 1.3], exposure: 1.15, stars: 0.6, grass: ['#3a6a2a', '#447a30'], night: true },
    halloween: { sky: ['#0d0318', '#5a1f4a', '#1a0812'], fog: '#2a1230', fogD: 0.0105, moon: '#ffa23a', moonSize: 38, moonPos: [-0.5, 0.26, -0.83], light: ['#ffb070', 1.35], hemi: ['#7a4aa0', '#1e1a10', 0.9], exposure: 1.3, stars: 0.8, grass: ['#3a4628', '#46522c'], night: true, spooky: true },
  };

  // size: half-width of the fenced farm in metres. goal: tips to open the gate. bonus: tips for the second star.
  // wake: how much noise Thrasher sleeps through. tSpeed: Thrasher's top speed.
  TT.LEVELS = [
    { id: 'pasture', name: 'Sundown Pasture', theme: 'dusk', seed: 1101, size: 75, tractors: 8, goal: 6, bonus: 8, wake: 110, tSpeed: 14.5, corn: 1, bales: 10, mud: 2, trees: 10, pond: false, recover: 40,
      blurb: 'Your first time out. Creep up slowly, honk, and the tractors go right over. Then get back out the gate before Thrasher wakes up.' },
    { id: 'cornfield', name: 'Moonlit Cornfield', theme: 'night', seed: 2207, size: 85, tractors: 10, goal: 8, bonus: 10, wake: 100, tSpeed: 15.5, corn: 5, bales: 10, mud: 3, trees: 12, pond: false, recover: 40,
      blurb: 'Tall corn everywhere. Hide in it if Thrasher comes looking, but he can mow straight through.' },
    { id: 'haybale', name: 'Hay Bale Hollow', theme: 'night', seed: 3319, size: 90, tractors: 12, goal: 9, bonus: 12, wake: 95, tSpeed: 16.5, corn: 2, bales: 45, mud: 3, trees: 14, pond: false, recover: 35,
      blurb: 'Bales stacked all over the place. Duck behind them; Thrasher smashes straight through.' },
    { id: 'mud', name: 'Muddy Bottoms', theme: 'mist', seed: 4421, size: 90, tractors: 12, goal: 10, bonus: 12, wake: 90, tSpeed: 17, corn: 2, bales: 14, mud: 12, trees: 16, pond: true, recover: 35,
      blurb: 'Fog, a duck pond and mud everywhere. Mud slows you right down, and Thrasher\'s big wheels don\'t care.' },
    { id: 'barn', name: "Thrasher's Barn", theme: 'harvest', seed: 5531, size: 105, tractors: 16, goal: 13, bonus: 16, wake: 80, tSpeed: 18, corn: 4, bales: 24, mud: 5, trees: 18, pond: true, recover: 30,
      blurb: 'The big one. Harvest moon, the biggest herd in the county, and Thrasher sleeps with one eye open.' },
  ];
  TT.HALLOWEEN = { id: 'haunted', name: 'Haunted Harvest', theme: 'halloween', seed: 3110, size: 90, tractors: 12, goal: 9, bonus: 12, wake: 95, tSpeed: 16.5, corn: 2, bales: 8, mud: 3, trees: 6, pond: false, recover: 30,
    pumpkins: 46, ghosts: true, halloween: true,
    blurb: 'Halloween special! Ghost tractors in the pumpkin patch, bats round the moon, and Pumpkin Thrasher on the prowl. Smash pumpkins for treats.' };
  TT.ALL_LEVELS = [...TT.LEVELS, TT.HALLOWEEN];

  // Race tracks. pts: the centre line (x, z), a closed loop drawn through these points. width: road width.
  // walls: solid barriers both sides (otherwise you can run wide onto the dirt). laps: laps per race.
  TT.TRACKS = [
    { id: 'butte', race: true, name: 'Dusty Butte', theme: 'desert', style: 'desert', laps: 3, width: 15, walls: false, seed: 701,
      pts: [[0, -120], [70, -118], [118, -80], [120, -10], [95, 45], [40, 60], [10, 100], [-40, 125], [-100, 110], [-125, 50], [-110, -10], [-70, -60], [-50, -110]],
      blurb: 'A dirt loop round a red rock butte out in the desert. Slide the bends, mind the cactus.' },
    { id: 'bowl', race: true, name: 'Piston Bowl', theme: 'stadium', style: 'stadium', laps: 4, width: 22, walls: true, seed: 702,
      pts: [[-90, -55], [90, -55], [135, -40], [150, 0], [135, 40], [90, 55], [-90, 55], [-135, 40], [-150, 0], [-135, -40]],
      blurb: 'The big oval under the floodlights, packed stands all round. Flat out, and don\'t touch the wall.' },
    { id: 'country', race: true, name: 'Country Run', theme: 'harvest', style: 'country', laps: 3, width: 14, walls: false, seed: 703,
      pts: [[0, -130], [60, -125], [110, -100], [125, -40], [90, 0], [120, 50], [100, 110], [40, 125], [0, 80], [-40, 120], [-105, 105], [-125, 40], [-90, -10], [-120, -70], [-80, -120]],
      blurb: 'Farm roads at night past the corn, the barns and a few sleeping tractors. Twisty, and the verges are soft.' },
  ];
  TT.level = id => TT.ALL_LEVELS.find(l => l.id === id) || TT.TRACKS.find(l => l.id === id) || TT.LEVELS[0];
  TT.RACE_FIELD = 6; // cars on the grid

  TT.TIPOFF_TIME = 150;  // seconds in a Tip-Off
  TT.DENTS = 3;          // hits from Thrasher before you're caught (story)
  TT.HUNT_TIME = 180;    // seconds the runners have to escape in Thrasher Hunt
  TT.HUNT_DENTS = 2;     // hits before a runner is caught in Thrasher Hunt
  TT.GATE_TIME = 6;      // seconds the gate stays open; miss it and you have to tip another to open it again

  TT.LINES = {
    tip: ['TIPPED!', 'OVER SHE GOES!', 'TIMBER!', 'GOTCHA!', 'BOOM!'],
    combo: ['', '', 'DOUBLE TIP!', 'TRIPLE TIP!', 'MEGA TIP!', 'HERD TIPPED!'],
    wary: ['TOO LOUD! IT WOKE UP', 'SLOW DOWN, IT SAW YOU', 'SHHH! CREEP UP SLOWLY'],
    wake: ['THRASHER\'S AWAKE!', 'UH OH… THRASHER!', 'RUN!'],
    hit: ['OUCH!', 'DENTED!', 'WHAM!'],
    halloweenTip: ['BOO!', 'SPOOKED!', 'GHOSTED!', 'TIPPED!'],
  };
})();
