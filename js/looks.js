// Fighter definitions: appearance, tale-of-the-tape details, attributes and punch data.
(() => {
  'use strict';
  const BK = window.BK;

  BK.FIGHTERS = {
    michael: {
      name: 'MICHAEL McDONAGH', short: 'McDONAGH', corner: 'RED CORNER', cornerColor: '#b3202a',
      skin: '#e3b08a', skinShade: '#c48b66', hair: '#3a2718',
      top: 'tank', topColor: '#f1ede2', topShade: '#cfc8b6',
      stains: [[-10, -170, 9, 6, 'rgba(142,104,48,0.5)'], [12, -150, 6, 8, 'rgba(120,70,40,0.42)'],
               [-4, -135, 11, 5, 'rgba(160,130,60,0.38)'], [16, -190, 5, 4, 'rgba(110,60,40,0.5)'],
               [0, -186, 4, 3, 'rgba(150,40,40,0.35)']],
      pants: '#4d525c', pantsShade: '#3b3f47', pantsStripe: '#e8e8e8',
      boots: '#c9ad7f', bootSole: '#6d5a3e', desertBoots: true,
      wraps: '#c1272d', wrapShade: '#8e1a1f',
      sleeves: null, bald: false,
      // tale of the tape
      tape: { AGE: '27', HEIGHT: '6\'1"', WEIGHT: '14st 2lb', REACH: '75"', RECORD: '11-0 (9 KO)', STYLE: 'Pressure fighter' },
      attr: { POWER: 78, SPEED: 88, CHIN: 80, STAMINA: 86 },
    },
    baldy: {
      name: 'BALDY CAN BOX', short: 'BALDY', corner: 'BLUE CORNER', cornerColor: '#23386b',
      skin: '#d9a07c', skinShade: '#b47f5d', hair: null,
      top: 'hoodie', topColor: '#6e4a2c', topShade: '#523620',
      stains: [],
      pants: '#3d5d8f', pantsShade: '#2c466c', pantsStripe: null,
      boots: '#1e1e21', bootSole: '#050505', desertBoots: false,
      wraps: null, wrapShade: null,
      sleeves: '#6e4a2c', bald: true,
      tape: { AGE: '34', HEIGHT: '5\'11"', WEIGHT: '15st 6lb', REACH: '72"', RECORD: '19-4-1 (12 KO)', STYLE: 'Counter puncher' },
      attr: { POWER: 90, SPEED: 72, CHIN: 86, STAMINA: 76 },
    },
  };

  // hand: which fist throws it. dmg is before attribute/stamina/counter modifiers.
  // through: share of damage that gets past a correct block.
  BK.PUNCHES = {
    jab:   { hand: 'front', dur: 0.30, hitAt: 0.11, dmg: 4.5, reach: 172, cost: 4,  stun: 0.20, snap: 0.22, through: 0.10, power: false },
    cross: { hand: 'rear',  dur: 0.44, hitAt: 0.20, dmg: 9.5, reach: 182, cost: 8,  stun: 0.32, snap: 0.38, through: 0.14, power: true },
    hook:  { hand: 'front', dur: 0.50, hitAt: 0.23, dmg: 12,  reach: 142, cost: 10, stun: 0.40, snap: 0.50, through: 0.35, power: true },
    upper: { hand: 'rear',  dur: 0.54, hitAt: 0.25, dmg: 14,  reach: 126, cost: 12, stun: 0.42, snap: 0.55, through: 0.45, power: true },
  };
  BK.PUNCH_NAMES = { jab: 'JAB', cross: 'CROSS', hook: 'HOOK', upper: 'UPPERCUT' };

  BK.JUDGES = ['D. HARRIGAN', 'P. OKAFOR', 'S. LINDQVIST'];

  // Between-round advice, chosen from how the round went.
  BK.CORNER_TIPS = {
    lowAccuracy: ['"You\'re loading up and missing. Jab first, then let the big ones go."', '"Stop headhunting from the outside. Get closer before you throw the hook."'],
    lowStamina: ['"Breathe! You\'re punched out. Pick your shots this round."', '"Your hands are dropping. Tie him up and get your wind back."'],
    losing: ['"He\'s timing you. Slip the cross and come back over the top."', '"Keep that guard up and make him miss. Then make him pay."'],
    winning: ['"That\'s it! Same again. He doesn\'t like the jab."', '"He\'s hurt. Stay patient and the finish will come."'],
    even: ['"Close round. Double up the jab and win the exchanges."', '"Use the ring, don\'t stand in front of him."'],
  };
})();
