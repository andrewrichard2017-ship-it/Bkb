// Fighter definitions: appearance, tale-of-the-tape details, attributes and punch data.
(() => {
  'use strict';
  const BK = window.BK;

  BK.FIGHTERS = {
    michael: {
      name: 'MICHAEL McDONAGH', short: 'McDONAGH', corner: 'RED CORNER', cornerColor: '#b3202a',
      skin: '#e3b08a', skinShade: '#c48b66', hair: '#3a2718',
      top: 'tank', topColor: '#f1ede2', topShade: '#cfc8b6',
      // vest stains, in torso space (waist at y=0, shoulders near y=-80)
      stains: [[-10, -48, 9, 6, 'rgba(142,104,48,0.5)'], [14, -30, 6, 8, 'rgba(120,70,40,0.42)'],
               [-4, -14, 11, 5, 'rgba(160,130,60,0.38)'], [18, -58, 5, 4, 'rgba(110,60,40,0.5)'],
               [2, -62, 4, 3, 'rgba(150,40,40,0.35)'], [-18, -30, 5, 7, 'rgba(130,100,50,0.35)']],
      pants: '#4d525c', pantsShade: '#3b3f47', pantsStripe: '#e8e8e8',
      boots: '#c9ad7f', bootSole: '#6d5a3e', desertBoots: true,
      wraps: '#c1272d', wrapShade: '#8e1a1f',
      sleeves: 'none', bald: false, legs: 'track', shoes: 'desert', fist: 'wraps', head: 'hair',
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
      sleeves: 'long', bald: true, legs: 'jeans', shoes: 'shoe', fist: 'bare', head: 'bald',
      tape: { AGE: '34', HEIGHT: '5\'11"', WEIGHT: '15st 6lb', REACH: '72"', RECORD: '19-4-1 (12 KO)', STYLE: 'Counter puncher' },
      attr: { POWER: 90, SPEED: 72, CHIN: 86, STAMINA: 76 },
    },
  };

  BK.REF_LOOK = {
    skin: '#e6b995', skinShade: '#c99a78', hair: '#b9b5ae',
    top: 'shirt', topColor: '#f3f1ec', topShade: '#d6d2c8', stains: [],
    pants: '#1c1c20', pantsShade: '#131316', pantsStripe: null,
    boots: '#0f0f11', bootSole: '#050505',
    sleeves: 'short', legs: 'trousers', shoes: 'shoe', fist: 'glove', head: 'grey',
  };

  // Walks the ring card round between rounds.
  BK.CARD_LOOK = {
    skin: '#d9a07c', skinShade: '#b47f5d', hair: '#2a1d14',
    top: 'shirt', topColor: '#1b1b1f', topShade: '#121215', stains: [], bowtie: false, print: 'BKB',
    pants: '#1c1c20', pantsShade: '#131316', pantsStripe: null,
    boots: '#e8e4dc', bootSole: '#b8b2a6',
    sleeves: 'short', legs: 'trousers', shoes: 'shoe', fist: 'bare', head: 'hair',
  };

  // hand: which fist throws it. dmg is before attribute/stamina/counter modifiers.
  // through: share of damage that gets past a correct block.
  BK.PUNCHES = {
    jab:   { hand: 'front', dur: 0.30, hitAt: 0.11, dmg: 4.5, reach: 172, cost: 4,  stun: 0.20, snap: 0.22, through: 0.10, power: false },
    cross: { hand: 'rear',  dur: 0.44, hitAt: 0.20, dmg: 9.5, reach: 182, cost: 8,  stun: 0.32, snap: 0.38, through: 0.14, power: true },
    hook:  { hand: 'front', dur: 0.50, hitAt: 0.23, dmg: 12,  reach: 142, cost: 10, stun: 0.40, snap: 0.50, through: 0.35, power: true },
    upper: { hand: 'rear',  dur: 0.54, hitAt: 0.25, dmg: 14,  reach: 126, cost: 12, stun: 0.42, snap: 0.55, through: 0.45, power: true },
    // Finisher, only offered when the opponent is under 5% health. Can't be blocked, but can be slipped or missed.
    ko:    { hand: 'rear',  dur: 0.95, hitAt: 0.55, dmg: 40,  reach: 190, cost: 16, stun: 0.6,  snap: 0.9,  through: 1.0,  power: true },
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
