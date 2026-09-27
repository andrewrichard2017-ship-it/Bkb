// Fighter definitions: appearance, tale-of-the-tape details, attributes and punch data.
(() => {
  'use strict';
  const BK = window.BK;

  // sway: how the SWAY/DUCK button moves them. 'lean' pulls the head back; 'duck' ducks and rolls under.
  // alt: colours used when both corners pick the same fighter.
  BK.FIGHTERS = {
    michael: {
      name: 'MICHAEL McD', short: 'McD', voice: { pitch: 125, formant: 1.0, breath: 0.25 },
      skin: '#e3b08a', skinShade: '#c48b66', hair: '#3a2718',
      top: 'tank', topColor: '#f1ede2', topShade: '#cfc8b6',
      // vest stains, in torso space (waist at y=0, shoulders near y=-80)
      stains: [[-10, -48, 9, 6, 'rgba(142,104,48,0.5)'], [14, -30, 6, 8, 'rgba(120,70,40,0.42)'],
               [-4, -14, 11, 5, 'rgba(160,130,60,0.38)'], [18, -58, 5, 4, 'rgba(110,60,40,0.5)'],
               [2, -62, 4, 3, 'rgba(150,40,40,0.35)'], [-18, -30, 5, 7, 'rgba(130,100,50,0.35)']],
      pants: '#4d525c', pantsShade: '#3b3f47', pantsStripe: '#e8e8e8',
      boots: '#c9ad7f', bootSole: '#6d5a3e',
      wraps: '#c1272d', wrapShade: '#8e1a1f',
      sleeves: 'none', legs: 'track', shoes: 'desert', fist: 'wraps', head: 'hair', sway: 'lean',
      alt: { topColor: '#2c2c31', topShade: '#1d1d21', pants: '#2f3f63', pantsShade: '#24314d', wraps: '#e8e4da', wrapShade: '#b9b4a8' },
      tape: { AGE: '27', HEIGHT: '6\'1"', WEIGHT: '14st 2lb', REACH: '75"', RECORD: '11-0 (9 KO)', STYLE: 'Pressure fighter' },
      attr: { POWER: 78, SPEED: 88, CHIN: 80, STAMINA: 86 },
    },
    johnjoe: {
      name: 'JOHN JOE', short: 'JOHN JOE', voice: { pitch: 104, formant: 0.95, breath: 0.3 },
      skin: '#d9a07c', skinShade: '#b47f5d', hair: null,
      top: 'hoodie', topColor: '#6e4a2c', topShade: '#523620',
      stains: [],
      pants: '#3d5d8f', pantsShade: '#2c466c', pantsStripe: null,
      boots: '#1e1e21', bootSole: '#050505',
      wraps: null, wrapShade: null,
      sleeves: 'long', legs: 'jeans', shoes: 'shoe', fist: 'bare', head: 'bald', sway: 'lean',
      alt: { topColor: '#5d6470', topShade: '#454b55', pants: '#2b2b30', pantsShade: '#1e1e22' },
      tape: { AGE: '34', HEIGHT: '5\'11"', WEIGHT: '15st 6lb', REACH: '72"', RECORD: '19-4-1 (12 KO)', STYLE: 'Counter puncher' },
      attr: { POWER: 90, SPEED: 72, CHIN: 86, STAMINA: 76 },
    },
    bigjoe: {
      name: 'BIG JOE', short: 'BIG JOE', voice: { pitch: 84, formant: 0.86, breath: 0.45 },
      skin: '#e2a48a', skinShade: '#bf8068', hair: '#efece6',
      top: 'tank', build: 'belly', topColor: '#f4f2ec', topShade: '#d3cfc6',
      stains: [[6, -40, 7, 5, 'rgba(142,104,48,0.35)'], [30, -18, 5, 4, 'rgba(120,90,50,0.3)']],
      pants: '#1f1f24', pantsShade: '#141418', pantsStripe: null,
      boots: '#18181b', bootSole: '#060606',
      wraps: null, wrapShade: null,
      sleeves: 'none', legs: 'trousers', shoes: 'boots', fist: 'bare', head: 'white', stache: 'handlebar', chain: true, sway: 'duck',
      alt: { topColor: '#2c2c31', topShade: '#1d1d21', pants: '#3a2c22', pantsShade: '#2a2019' },
      tape: { AGE: '46', HEIGHT: '6\'2"', WEIGHT: '19st 4lb', REACH: '76"', RECORD: '31-6 (24 KO)', STYLE: 'Brawler' },
      attr: { POWER: 95, SPEED: 64, CHIN: 92, STAMINA: 68 },
    },
    skinny: {
      name: 'SKINNY ARTHUR', short: 'ARTHUR', voice: { pitch: 138, formant: 1.06, breath: 0.35 },
      skin: '#e8b99a', skinShade: '#c99878', hair: '#6b5a4a',
      top: 'none', build: 'skinny', limbW: 0.74, torsoW: 0.8, topColor: '#e8b99a', topShade: '#c99878',
      stains: [],
      pants: '#2b3f6b', pantsShade: '#213153', pantsStripe: '#e8e8e8',
      boots: '#f2f0ea', bootSole: '#bdb8ad',
      wraps: null, wrapShade: null,
      sleeves: 'none', legs: 'shorts', shoes: 'shoe', fist: 'bare', head: 'skin',
      // SWAY is an automatic jab-cross-hook costing 40% of the stamina bar; can't clinch; quick on his feet
      sway: 'combo', noClinch: true, move: 1.22, regen: 1.35,
      alt: { pants: '#6b1f24', pantsShade: '#511519', boots: '#1c1c1f' },
      tape: { AGE: '23', HEIGHT: '6\'0"', WEIGHT: '10st 3lb', REACH: '74"', RECORD: '8-2 (1 KO)', STYLE: 'Speed merchant' },
      attr: { POWER: 58, SPEED: 97, CHIN: 70, STAMINA: 92 },
    },
    digger: {
      name: 'DIGGER', short: 'DIGGER', voice: { pitch: 92, formant: 0.9, breath: 0.4 },
      skin: '#d9a585', skinShade: '#b8835f', hair: '#141214',
      top: 'tank', build: 'muscle', limbW: 1.2, torsoW: 1.12, topColor: '#6f7176', topShade: '#55575b',
      stains: [[8, -34, 6, 4, 'rgba(40,30,20,0.3)']],
      pants: '#1b1b1f', pantsShade: '#121215', pantsStripe: null,
      boots: '#b99c70', bootSole: '#6d5a3e',
      wraps: null, wrapShade: null,
      sleeves: 'none', legs: 'jeans', shoes: 'desert', fist: 'dusters', head: 'slick', beard: 'long',
      // no sway at all; his super is a knuckle-duster uppercut, once a round; heavy on his feet
      sway: 'none', super: 'duster', superOnce: true, move: 0.8, regen: 0.8,
      alt: { topColor: '#2c2c31', topShade: '#1d1d21', pants: '#3a2c22', pantsShade: '#2a2019' },
      tape: { AGE: '38', HEIGHT: '6\'1"', WEIGHT: '17st 0lb', REACH: '75"', RECORD: '22-3 (20 KO)', STYLE: 'Knockout artist' },
      attr: { POWER: 99, SPEED: 60, CHIN: 84, STAMINA: 58 },
    },
  };
  BK.FIGHTER_ORDER = ['michael', 'johnjoe', 'bigjoe', 'skinny', 'digger'];
  // Tournament running order (your own fighter is skipped); Digger is the final boss.
  BK.TOUR_ORDER = ['skinny', 'johnjoe', 'michael', 'bigjoe', 'digger'];
  BK.CORNERS = [
    { corner: 'RED CORNER', color: '#b3202a' },
    { corner: 'BLUE CORNER', color: '#23386b' },
  ];

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
    ko:    { hand: 'rear',  dur: 0.95, hitAt: 0.55, dmg: 40,  reach: 190, cost: 16, stun: 0.6,  snap: 0.9,  through: 1.0,  power: true, super: true },
    // Digger's special: a big knuckle-duster uppercut, once a round, same trigger as the super punch
    duster: { hand: 'rear', dur: 1.05, hitAt: 0.62, dmg: 45,  reach: 150, cost: 16, stun: 0.7,  snap: 1.1,  through: 1.0,  power: true, super: true },
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
