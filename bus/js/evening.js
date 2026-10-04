'use strict';
// After dinner: pick something to do (football at the park, a drive to the ice cream shop, or
// hide and seek), then brush your teeth and go to bed. Built on the stage kit from js/home.js.
// Everything that's said is in LINES: tools/make_voice.py reads it. Keys starting m_ are Mammy's
// voice and s_ the ice cream shop man's; {name} is filled in for each player.

const LINES = {
  m_eve_pick: "Dinner's all done! What will we do now? You pick!",
  f_intro: "Let's play football at the park! Can you score three goals?",
  f_left: "Kick the ball into the left side of the goal!",
  f_right: "Kick the ball into the right side of the goal!",
  f_saved_left: "Saved! That was the right side. Try the left side!",
  f_saved_right: "Saved! That was the left side. Try the right side!",
  f_wide: "Oops, it missed the goal! Try again.",
  f_goal_1: "Goal! That's one goal!",
  f_goal_2: "Goal! That's two goals!",
  f_goal_3: "Goal! That's three goals!",
  park_star: "What a brilliant footballer, {name}! You get a gold star!",
  m_car: "Let's drive to the ice cream shop! Here we go!",
  c_red: "The light is red! Red means stop. Tap the stop button!",
  c_red_auto: "Remember, red means stop!",
  c_amber: "Now it's amber. Amber means get ready!",
  c_green: "Green means go! Tap the go button!",
  c_shop: "Here's the ice cream shop!",
  s_hello: "Hello! Welcome to the ice cream shop! Let's make you a big ice cream.",
  s_find_pink: "Can you find the pink ice cream?",
  s_find_brown: "Can you find the brown ice cream?",
  s_find_white: "Can you find the white ice cream?",
  s_find_green: "Can you find the green ice cream?",
  s_find_yellow: "Can you find the yellow ice cream?",
  s_find_blue: "Can you find the blue ice cream?",
  s_find_orange: "Can you find the orange ice cream?",
  s_yes_pink: "Yes! Pink is strawberry!",
  s_yes_brown: "Yes! Brown is chocolate!",
  s_yes_white: "Yes! White is vanilla!",
  s_yes_green: "Yes! Green is mint!",
  s_yes_yellow: "Yes! Yellow is banana!",
  s_yes_blue: "Yes! Blue is bubblegum!",
  s_yes_orange: "Yes! Orange is orange flavour!",
  ic_no_pink: "That's pink. Pink is strawberry.",
  ic_no_brown: "That's brown. Brown is chocolate.",
  ic_no_white: "That's white. White is vanilla.",
  ic_no_green: "That's green. Green is mint.",
  ic_no_yellow: "That's yellow. Yellow is banana.",
  ic_no_blue: "That's blue. Blue is bubblegum.",
  ic_no_orange: "That's orange. Orange is orange flavour.",
  s_sprinkles: "Now let's add some sprinkles! Tap the sprinkles.",
  s_sauce: "And some sauce! Which sauce would you like?",
  ic_count: "One, two, three scoops! What a yummy ice cream!",
  icecream_star: "That's the best ice cream ever, {name}! You get a gold star!",
  hs_intro: "Let's play hide and seek! Close your eyes and count to ten.",
  hs_count_again: "Close your eyes and count to ten again!",
  hs_ready: "Ready or not, here I come!",
  hs_find_mammy: "Where is Mammy hiding? Tap to look!",
  hs_find_teddy: "Now the teddy is hiding! Where can it be?",
  hs_find_cat: "Now the cat is hiding! Where can it be?",
  hs_not_sofa: "Not behind the sofa!",
  hs_not_curtains: "Not behind the curtains!",
  hs_not_cupboard: "Not in the cupboard!",
  hs_not_plant: "Not behind the plant!",
  hs_not_table: "Not under the table!",
  hs_not_box: "Not in the toy box!",
  hs_hint_behind: "Here's a clue! Look behind something.",
  hs_hint_under: "Here's a clue! Look under something.",
  hs_hint_in: "Here's a clue! Look in something.",
  m_found: "You found me! Well done!",
  hs_found_teddy: "You found the teddy!",
  hs_found_cat: "You found the cat! Meow!",
  hs_was_sofa: "It was behind the sofa!",
  hs_was_curtains: "It was behind the curtains!",
  hs_was_cupboard: "It was in the cupboard!",
  hs_was_plant: "It was behind the plant!",
  hs_was_table: "It was under the table!",
  hs_was_box: "It was in the toy box!",
  hide_star: "You're brilliant at hide and seek, {name}! You get a gold star!",
  m_bedtime: "Time to get ready for bed! First, let's brush your teeth.",
  bt_paste: "Squeeze some toothpaste onto the toothbrush. Tap the toothpaste!",
  bt_top: "Brush your top teeth! Scrub, scrub, scrub!",
  bt_bottom: "Now brush your bottom teeth!",
  bt_rinse: "All clean! Now rinse your mouth. Tap the cup!",
  teeth_star: "Sparkly clean teeth, {name}! Remember to brush every morning and every night. You get a gold star!",
  m_bed: "Into bed you go! Snuggle down. Can you turn off the lamp?",
  m_sleep: "Goodnight, sleep tight. I love you!",
};

const Evening = (() => {
  let K = null, done = null;
  const TAU = Math.PI * 2;
  const say = key => K.say([key], LINES[key]);
  const mammy = key => K.mammy(key, LINES[key]);
  const star = (kind, key) => K.goldStar(kind, key + '_' + K.cfg.id, LINES[key].replace('{name}', K.cfg.name));
  const live = g => K.game === g;
  function start(kit, then) { K = kit; done = then; choose(); }

  // A scene drawn on a 1000 x 600 board, scaled to fit and centred; the edges are filled in.
  function board(c, fill) {
    const W = K.W, H = K.H, s = Math.min(W / 1000, H / 600), ox = (W - 1000 * s) / 2, oy = (H - 600 * s) / 2;
    if (fill) fill(c, W, H, oy, s);
    c.save(); c.translate(ox, oy); c.scale(s, s);
    return { s, ox, oy, end: () => c.restore(), to: p => ({ x: (p.x - ox) / s, y: (p.y - oy) / s }) };
  }
  const inRect = (p, r) => p.x >= r[0] && p.x <= r[0] + r[2] && p.y >= r[1] && p.y <= r[1] + r[3];
  function trayButtons(list) { // [[label, className, fn]]
    const row = document.createElement('div'); row.className = 'hCards';
    for (const [label, cls, fn] of list) {
      const b = document.createElement('button'); b.className = 'eBtn ' + cls; b.innerHTML = label;
      b.addEventListener('click', () => { K.cfg.sound.click(); fn(b); });
      row.appendChild(b);
    }
    K.tray.appendChild(row);
    return row;
  }

  // ---------- what will we do? ----------
  function choose() {
    K.setSkip(bedtime);
    let picked = false;
    const g = {
      start() {
        const row = document.createElement('div'); row.className = 'hCards';
        for (const [id, pic, name, sub, fn] of [['park', '⚽', 'Park', 'Score a goal', park], ['icecream', '🍦', 'Ice cream', 'Drive to the shop', drive], ['hide', '🙈', 'Hide and seek', 'Find Mammy', hide]]) {
          const b = document.createElement('button'); b.className = 'hCard';
          b.innerHTML = '<span class="pic">' + pic + '</span><b>' + name + '</b><small>' + sub + '</small>';
          b.addEventListener('click', () => { if (picked) return; picked = true; b.classList.add('sel'); K.cfg.sound.sparkle(); K.cfg.hush(); setTimeout(() => { if (live(g)) fn(); }, 400); });
          row.appendChild(b);
        }
        K.tray.appendChild(row);
        setTimeout(() => { if (live(g)) mammy('m_eve_pick'); }, 300);
      },
      again() { mammy('m_eve_pick'); },
      draw(c, dt, t) {
        const B = board(c, (c, W, H) => { c.fillStyle = '#e9d5ff'; c.fillRect(0, 0, W, H); });
        c.fillStyle = '#e9d5ff'; c.fillRect(0, 0, 1000, 600);
        c.fillStyle = '#a16207'; c.fillRect(-400, 440, 1800, 400);
        const sky = c.createLinearGradient(0, 70, 0, 280); sky.addColorStop(0, '#7c3aed'); sky.addColorStop(1, '#fb923c');
        c.fillStyle = '#fff'; c.fillRect(90, 64, 250, 222); c.fillStyle = sky; c.fillRect(100, 74, 230, 202); c.fillStyle = '#fff'; c.fillRect(212, 74, 6, 202);
        c.fillStyle = '#2563eb'; K.rr(c, 600, 300, 330, 90, 30); c.fill(); K.rr(c, 580, 360, 370, 90, 20); c.fill();
        c.fillStyle = '#1d4ed8'; K.rr(c, 570, 340, 40, 110, 14); c.fill(); K.rr(c, 920, 340, 40, 110, 14); c.fill();
        K.mammyFig(c, 470, 560, 5.4, t, true);
        B.end();
      },
    };
    K.stage(g, 'What will we do?');
  }

  // ---------- football at the park: left and right ----------
  const KEEPER = { skin: '#c68642', hair: '#111111', style: 0, shirt: '#facc15', pants: '#111827', bag: '#facc15' };
  function park() {
    let goals = 0, target = K.pick(['left', 'right']), ball = null, keeper = 0, keeperTo = 0, busy = true, hint = false, net = 0, saved = false;
    const geo = () => {
      const W = K.W, H = K.H, gw = Math.min(W * 0.72, H * 1.15), gh = gw * 0.36;
      return { W, H, gw, gh, gx: (W - gw) / 2, gy: H * 0.16, bx: W / 2, by: H * 0.8, br: Math.min(W, H) * 0.055 };
    };
    function ask() {
      busy = false; ball = null; saved = false;
      keeperTo = target === 'left' ? 0.55 : -0.55;
      K.prompt(target === 'left' ? '⬅ Left side!' : 'Right side! ➡');
      K.dots(3, goals);
      say('f_' + target);
    }
    const g = {
      start() {
        K.prompt('Football!'); K.dots(3, 0);
        say('f_intro').then(() => { if (live(g)) ask(); });
      },
      again() { if (!busy) say('f_' + target); },
      down(p) {
        if (busy) return;
        const G = geo();
        busy = true; ball = { x0: G.bx, y0: G.by, x1: p.x, y1: p.y, t: 0 };
        K.cfg.sound.pop(); K.buzz(15);
      },
      draw(c, dt, t) {
        const G = geo(), { W, H, gw, gh, gx, gy } = G;
        // the park
        const sky = c.createLinearGradient(0, 0, 0, gy + gh); sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(1, '#e0f2fe');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        c.fillStyle = '#4d7c0f'; for (let x = -20; x < W + 40; x += 46) K.dot(c, x, gy + gh * 0.2, 34);
        c.fillStyle = '#65a30d'; c.fillRect(0, gy + gh * 0.55, W, H);
        c.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 8; k++) if (k % 2) c.fillRect(0, gy + gh * 0.55 + k * (H - gy) / 8, W, (H - gy) / 8);
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(gx - gw * 0.18, gy + gh); c.lineTo(gx - gw * 0.3, H * 0.62); c.lineTo(gx + gw * 1.3, H * 0.62); c.lineTo(gx + gw * 1.18, gy + gh); c.stroke();
        // the goal and its net
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; c.beginPath();
        const wob = Math.sin(t * 30) * net * 6;
        for (let k = 1; k < 12; k++) { c.moveTo(gx + gw * k / 12 + wob, gy); c.lineTo(gx + gw * k / 12 - wob, gy + gh); }
        for (let k = 1; k < 5; k++) { c.moveTo(gx, gy + gh * k / 5 + wob); c.lineTo(gx + gw, gy + gh * k / 5 - wob); }
        c.stroke(); net = Math.max(0, net - dt * 0.8);
        c.strokeStyle = '#fff'; c.lineWidth = Math.max(6, gw * 0.02); c.lineCap = 'round';
        c.beginPath(); c.moveTo(gx, gy + gh); c.lineTo(gx, gy); c.lineTo(gx + gw, gy); c.lineTo(gx + gw, gy + gh); c.stroke(); c.lineCap = 'butt';
        // left and right signs
        c.font = '700 ' + Math.round(Math.max(14, gh * 0.16)) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        for (const side of ['left', 'right']) {
          const x = gx + gw * (side === 'left' ? 0.25 : 0.75), y = gy + gh + gh * 0.22, on = hint && side === target;
          c.fillStyle = on ? '#facc15' : 'rgba(255,255,255,.85)'; K.rr(c, x - gw * 0.13, y - gh * 0.12, gw * 0.26, gh * 0.24, gh * 0.12); c.fill();
          c.fillStyle = '#1f2937'; c.fillText(side === 'left' ? '⬅ LEFT' : 'RIGHT ➡', x, y + 1);
        }
        // the goalkeeper moves to the other side
        keeper += (keeperTo - keeper) * Math.min(1, dt * 3);
        const ksc = gh * 0.78 / 70;
        Scene.kid(c, { look: KEEPER, face: 1, wave: saved, phase: 1, alpha: 1, hop: saved ? 10 : 0 }, gx + gw / 2 + keeper * gw / 2, gy + gh, ksc, t);
        // the player beside the ball
        const dsc = H * 0.28 / 345;
        c.save(); c.translate(G.bx - G.br * 3.2, H * 0.99); c.scale(dsc, dsc); K.doll(c, K.look(), K.outfit, t); c.restore();
        // the ball
        let bx = G.bx, by = G.by, br = G.br;
        if (ball) {
          ball.t = Math.min(1, ball.t + dt * 1.7);
          const e = ball.t;
          bx = ball.x0 + (ball.x1 - ball.x0) * e; by = ball.y0 + (ball.y1 - ball.y0) * e - Math.sin(e * Math.PI) * H * 0.12; br = G.br * (1 - e * 0.45);
          if (e >= 1 && !ball.done) { ball.done = true; land(G); }
          if (saved) { bx = gx + gw / 2 + keeper * gw / 2; by = gy + gh * 0.45; }
        }
        c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(bx, (ball ? ball.y0 + (ball.y1 - ball.y0) * ball.t : by) + br * 0.9, br, br * 0.3, 0, 0, TAU); c.fill();
        K.emoji(c, '⚽', bx, by, br * 2);
        if (!busy && !ball) K.emoji(c, '👆', hint ? gx + gw * (target === 'left' ? 0.25 : 0.75) : G.bx + G.br, (hint ? gy + gh * 0.55 : G.by + G.br * 1.8) + Math.sin(t * 6) * 6, G.br * 1.4);
        K.drawFx(c, dt);
      },
    };
    async function land(G) {
      const { gx, gy, gw, gh } = G, b = ball, r = K.run;
      const inside = b.x1 > gx && b.x1 < gx + gw && b.y1 > gy && b.y1 < gy + gh;
      const side = b.x1 < gx + gw / 2 ? 'left' : 'right';
      if (!inside) { K.cfg.sound.nope(); await say('f_wide'); }
      else if (side !== target) {
        saved = true; keeperTo = (b.x1 - (gx + gw / 2)) / (gw / 2); hint = true;
        K.cfg.sound.nope(); K.buzz(30); await say('f_saved_' + target);
      } else {
        net = 1; goals++; hint = false; K.burst(b.x1, b.y1); K.cfg.sound.sparkle(); K.buzz([30, 40, 30]);
        K.dots(3, goals);
        await say('f_goal_' + goals);
        if (goals >= 3) { if (await star('park', 'park_star') && live(g)) bedtime(); return; }
        target = K.pick(['left', 'right']);
      }
      if (r === K.run && live(g)) { await K.sleep(300); ask(); }
    }
    K.stage(g, 'Football!');
  }

  // ---------- a drive to the ice cream shop: traffic lights ----------
  function drive() {
    const LIGHT = 1500, SHOP = 2900;
    let x = 0, v = 0, phase = 'go', light = 'green', stopPressed = false, lightT = 0, buttons = null;
    const unit = () => K.H / 400; // world units per pixel-ish
    const g = {
      start() {
        K.prompt('Off to the shop!');
        buttons = trayButtons([['🛑 Stop', 'red', () => press('stop')], ['🟢 Go', 'green', () => press('go')]]);
        mammy('m_car');
      },
      again() { if (light === 'red') say('c_red'); else if (light === 'green' && phase === 'wait') say('c_green'); },
      draw(c, dt, t) {
        const W = K.W, H = K.H, u = unit(), carW = Math.min(W * 0.4, H * 0.75), road = H * 0.7;
        // speed: drive on, stop at the line on red
        const line = LIGHT - 40;
        if (phase === 'go') {
          v = Math.min(260, v + 160 * dt);
          if (light === 'green' && x > LIGHT - 1300 && x < LIGHT - 300) { light = 'red'; lightT = 0; buttons.children[0].classList.add('hintBtn'); say('c_red'); K.prompt('Red means stop!'); }
          if (light === 'red' && (stopPressed || x > line - 330)) { phase = 'brake'; if (!stopPressed) { say('c_red_auto'); } }
          if (x > SHOP - 40) { phase = 'there'; v = 0; arrive(); }
        } else if (phase === 'brake') {
          const left = Math.max(0, line - x);
          v = Math.max(0, Math.min(v, Math.sqrt(2 * 300 * left)));
          if (v < 2) { v = 0; phase = 'wait'; lightT = 0; buttons.children[0].classList.remove('hintBtn'); }
        } else if (phase === 'wait') {
          lightT += dt;
          if (light === 'red' && lightT > 2) { light = 'amber'; lightT = 0; say('c_amber'); K.prompt('Amber means get ready'); }
          else if (light === 'amber' && lightT > 3) { light = 'green'; lightT = 0; say('c_green'); K.prompt('Green means go!'); buttons.children[1].classList.add('hintBtn'); }
        }
        x += v * dt;
        const cam = x - W / u * 0.75;
        const sx = wx => (wx - cam) * u;
        // sky, houses, road
        const sky = c.createLinearGradient(0, 0, 0, road); sky.addColorStop(0, '#f472b6'); sky.addColorStop(1, '#fde68a');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        c.fillStyle = '#86efac'; c.fillRect(0, road - H * 0.12, W, H * 0.12);
        for (let k = Math.floor(cam / 260) - 1; k < Math.floor(cam / 260) + W / u / 260 + 2; k++) {
          if (Math.abs(k * 260 - SHOP) < 300) continue;
          c.save(); c.translate(sx(k * 260), road - H * 0.1); c.scale(u * 0.8, u * 0.8);
          if (k % 3 === 2) Scene.trees(c, 0, 0, k); else Scene.house(c, 0, 0, Math.abs(k) + 3);
          c.restore();
        }
        // the ice cream shop
        { const X = sx(SHOP - 120);
          c.save(); c.translate(X, road - H * 0.1); c.scale(u, u);
          c.fillStyle = '#f9a8d4'; c.fillRect(0, -170, 260, 170);
          for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#fff' : '#ec4899'; c.fillRect(k * 32.5, -190, 32.5, 34); }
          c.fillStyle = '#bfdbfe'; c.fillRect(20, -130, 100, 80); c.fillStyle = '#7c2d12'; c.fillRect(160, -120, 70, 120);
          c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(110, -195); c.lineTo(150, -195); c.lineTo(130, -235); c.closePath(); c.fill();
          c.fillStyle = '#f472b6'; K.dot(c, 130, -248, 22); c.fillStyle = '#fff'; K.dot(c, 122, -262, 14);
          c.restore(); }
        c.fillStyle = '#4b5563'; c.fillRect(0, road - H * 0.02, W, H * 0.2);
        c.fillStyle = '#d1d5db'; c.fillRect(0, road + H * 0.18, W, H);
        c.fillStyle = '#fef08a'; for (let k = Math.floor(cam / 120); k < Math.floor(cam / 120) + W / u / 120 + 2; k++) c.fillRect(sx(k * 120), road + H * 0.075, 50 * u, 5 * u);
        // the stop line and the traffic light
        c.fillStyle = '#fff'; c.fillRect(sx(line), road - H * 0.02, 10 * u, H * 0.2);
        { const X = sx(LIGHT + 40);
          c.fillStyle = '#374151'; c.fillRect(X - 6 * u, road - 230 * u, 12 * u, 230 * u);
          c.fillStyle = '#111827'; K.rr(c, X - 26 * u, road - 330 * u, 52 * u, 120 * u, 10 * u); c.fill();
          [['red', '#ef4444'], ['amber', '#f59e0b'], ['green', '#22c55e']].forEach(([k, col], i) => {
            c.fillStyle = light === k ? col : '#374151'; K.dot(c, X, road - 305 * u + i * 36 * u, 14 * u);
            if (light === k) { c.fillStyle = col + '55'; K.dot(c, X, road - 305 * u + i * 36 * u, 22 * u); }
          }); }
        // the car, with Mammy driving
        const cx = sx(x) - carW, cy = road + H * 0.06;
        c.save(); c.translate(cx, cy); const k = carW / 300; c.scale(k, k);
        c.fillStyle = '#ef4444'; K.rr(c, 0, -90, 300, 70, 22); c.fill(); K.rr(c, 60, -150, 170, 70, 26); c.fill();
        c.fillStyle = '#bfdbfe'; K.rr(c, 78, -138, 66, 50, 10); c.fill(); K.rr(c, 152, -138, 64, 50, 10); c.fill();
        for (const [hx, lk] of [[190, { skin: '#f1c27d', hair: '#7c2d12', style: 5, bag: '#ec4899' }], [112, K.look()]]) {
          c.save(); c.beginPath(); c.rect(hx - 34, -138, 68, 50); c.clip(); c.translate(hx, -108); c.scale(1.6, 1.6); Scene.head(c, lk); c.restore();
        }
        c.fillStyle = '#fef08a'; K.dot(c, 290, -60, 10);
        for (const wx of [70, 230]) { c.fillStyle = '#111827'; K.dot(c, wx, -20, 30); c.fillStyle = '#9ca3af'; K.dot(c, wx, -20, 13);
          c.strokeStyle = '#111827'; c.lineWidth = 4; c.beginPath(); const a = x / 30; c.moveTo(wx + Math.cos(a) * 13, -20 + Math.sin(a) * 13); c.lineTo(wx - Math.cos(a) * 13, -20 - Math.sin(a) * 13); c.stroke(); }
        c.restore();
        K.drawFx(c, dt);
      },
    };
    function press(which) {
      if (which === 'stop' && light === 'red' && phase === 'go') { stopPressed = true; K.cfg.sound.airBrake(); }
      else if (which === 'go' && light === 'green' && phase === 'wait') { phase = 'go'; buttons.children[1].classList.remove('hintBtn'); K.cfg.sound.gear(); K.prompt('Off we go!'); }
    }
    async function arrive() {
      K.prompt('The ice cream shop!'); buttons.remove();
      await say('c_shop');
      if (live(g)) shop();
    }
    K.stage(g, 'Off to the shop!');
  }

  // ---------- the ice cream shop: colours and flavours ----------
  const FLAVOURS = { pink: '#f9a8d4', brown: '#92400e', white: '#fffbeb', green: '#86efac', yellow: '#fde047', blue: '#7dd3fc', orange: '#fdba74' };
  const SHOPMAN = { skin: '#e0ac69', hair: '#2b1d14', style: 4, shirt: '#fff', pants: '#1e3a8a', bag: '#ec4899' };
  function shop() {
    const tubs = K.shuffle(Object.keys(FLAVOURS)).slice(0, 6), want = K.shuffle(tubs.slice()).slice(0, 3);
    let i = 0, scoops = [], flying = null, busy = true, sprinkles = false, sauce = null, shopLine = null, phase = 'scoop';
    function geo() {
      const W = K.W, H = K.H, land = W > H * 1.1;
      const area = land ? { x: W * 0.04, y: H * 0.42, w: W * 0.6, h: H * 0.54 } : { x: W * 0.04, y: H * 0.34, w: W * 0.92, h: H * 0.36 };
      const cols = 3, rows = 2, cw = area.w / cols, ch = area.h / rows;
      const cone = land ? { x: W * 0.82, y: H * 0.86, s: Math.min(W * 0.12, H * 0.16) } : { x: W * 0.5, y: H * 0.98, s: Math.min(W * 0.16, H * 0.1) };
      return { W, H, land, area, cols, cw, ch, cone, man: land ? { x: W * 0.82, y: H * 0.5, sc: H * 0.3 / 70 } : { x: W * 0.8, y: H * 0.3, sc: H * 0.2 / 70 } };
    }
    const tubAt = (G, k) => ({ x: G.area.x + (k % G.cols + 0.5) * G.cw, y: G.area.y + (Math.floor(k / G.cols) + 0.5) * G.ch, r: Math.min(G.cw, G.ch) * 0.36 });
    const man = key => { shopLine = { text: LINES[key].split(/(?<=[!?.])\s/)[0], t: 3 }; return say(key); };
    function ask() { busy = false; K.prompt('Find ' + want[i]); K.dots(3, i); man('s_find_' + want[i]); }
    const g = {
      start() { K.prompt('Ice cream shop'); man('s_hello').then(() => { if (live(g)) ask(); }); },
      again() { if (phase === 'scoop' && !busy) man('s_find_' + want[i]); else if (phase === 'sprinkles') man('s_sprinkles'); else if (phase === 'sauce') man('s_sauce'); },
      async down(p) {
        if (busy || phase !== 'scoop') return;
        const G = geo(), k = tubs.findIndex((_, j) => { const q = tubAt(G, j); return Math.hypot(p.x - q.x, p.y - q.y) < q.r * 1.3; });
        if (k < 0) return;
        const col = tubs[k], r = K.run;
        if (col !== want[i]) { K.cfg.sound.nope(); K.buzz(30); K.cfg.hush(); K.say(['ic_no_' + col, 'p_again'], LINES['ic_no_' + col] + ' Have another go!'); return; }
        busy = true; K.cfg.sound.pop(); flying = { k, col, t: 0 };
        await K.sleep(650);
        scoops.push(col); flying = null; K.cfg.sound.sparkle(); K.dots(3, scoops.length);
        K.cfg.hush(); await man('s_yes_' + col);
        if (r !== K.run || !live(g)) return;
        if (++i < 3) return ask();
        phase = 'sprinkles'; K.prompt('Sprinkles!');
        const row = trayButtons([['✨ Sprinkles', 'pink', () => {
          if (sprinkles) return; sprinkles = true; K.cfg.sound.sparkle(); row.remove(); sauceStep();
        }]]);
        row.children[0].classList.add('hintBtn');
        man('s_sprinkles');
      },
      draw(c, dt, t) {
        const G = geo(), { W, H } = G;
        c.fillStyle = '#fdf2f8'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#fbcfe8'; for (let x = 0; x < W; x += 50) c.fillRect(x, 0, 25, H);
        // the shop man behind the counter
        Scene.kid(c, { look: SHOPMAN, face: -1, wave: false, phase: 1, alpha: 1 }, G.man.x, G.man.y, G.man.sc, t);
        c.fillStyle = '#fff'; K.rr(c, G.man.x - 15 * G.man.sc, G.man.y - 84 * G.man.sc, 30 * G.man.sc, 14 * G.man.sc, 6 * G.man.sc); c.fill();
        if (shopLine) { shopLine.t -= dt; Scene.bubble(c, shopLine.text, K.clamp(G.man.x - 40, 140, W - 140), G.man.y - 86 * G.man.sc, Math.min(1.3, G.man.sc / 2)); if (shopLine.t <= 0) shopLine = null; }
        // the counter and the tubs
        c.fillStyle = '#ec4899'; c.fillRect(0, G.area.y - G.ch * 0.15, W, H);
        c.fillStyle = '#fff'; c.fillRect(0, G.area.y - G.ch * 0.15, W, 10);
        c.fillStyle = 'rgba(191,219,254,.6)'; K.rr(c, G.area.x - 8, G.area.y - 8, G.area.w + 16, G.area.h + 16, 16); c.fill();
        tubs.forEach((col, k) => {
          const q = tubAt(G, k);
          c.fillStyle = '#cbd5e1'; K.rr(c, q.x - q.r * 1.1, q.y - q.r * 0.2, q.r * 2.2, q.r * 0.9, q.r * 0.15); c.fill();
          c.fillStyle = FLAVOURS[col];
          for (let j = 0; j < 4; j++) K.dot(c, q.x - q.r * 0.75 + j * q.r * 0.5, q.y - q.r * 0.2, q.r * 0.38);
          c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.beginPath(); c.arc(q.x, q.y - q.r * 0.1, q.r * 0.6, Math.PI, 0); c.stroke();
        });
        // the cone, with the scoops on
        const cn = G.cone, s = cn.s;
        c.fillStyle = '#d97706'; c.beginPath(); c.moveTo(cn.x - s * 0.5, cn.y - s * 1.4); c.lineTo(cn.x + s * 0.5, cn.y - s * 1.4); c.lineTo(cn.x, cn.y - s * 0.1); c.closePath(); c.fill();
        c.strokeStyle = '#92400e'; c.lineWidth = 2; c.beginPath();
        for (let j = -2; j <= 2; j++) { c.moveTo(cn.x + j * s * 0.2 - s * 0.1, cn.y - s * 1.4); c.lineTo(cn.x + j * s * 0.05, cn.y - s * 0.3); }
        c.stroke();
        const scoopY = j => cn.y - s * 1.55 - j * s * 0.62;
        scoops.forEach((col, j) => { c.fillStyle = FLAVOURS[col]; K.dot(c, cn.x, scoopY(j), s * 0.45); c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2; c.beginPath(); c.arc(cn.x, scoopY(j), s * 0.45, 0, TAU); c.stroke(); });
        if (sauce) {
          const top = scoopY(scoops.length - 1);
          c.fillStyle = sauce; c.beginPath(); c.moveTo(cn.x - s * 0.42, top - s * 0.1);
          for (let j = 0; j <= 6; j++) c.lineTo(cn.x - s * 0.42 + j * s * 0.14, top + (j % 2 ? s * 0.25 : s * 0.05));
          c.lineTo(cn.x + s * 0.42, top - s * 0.1); c.arc(cn.x, top, s * 0.43, -0.2, Math.PI + 0.2, true); c.fill();
        }
        if (sprinkles) {
          const top = scoopY(scoops.length - 1);
          ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#fff'].forEach((col, j) => {
            for (let m = 0; m < 3; m++) { const a = j * 1.1 + m * 2.2; c.save(); c.translate(cn.x + Math.cos(a) * s * 0.28, top - s * 0.15 + Math.sin(a) * s * 0.18); c.rotate(a); c.fillStyle = col; c.fillRect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.04); c.restore(); }
          });
        }
        if (flying) {
          flying.t = Math.min(1, flying.t + dt * 1.6);
          const q = tubAt(G, flying.k), e = flying.t, tx = cn.x, ty = scoopY(scoops.length);
          c.fillStyle = FLAVOURS[flying.col]; K.dot(c, q.x + (tx - q.x) * e, q.y + (ty - q.y) * e - Math.sin(e * Math.PI) * H * 0.15, s * 0.45);
        }
        K.drawFx(c, dt);
      },
    };
    function sauceStep() {
      phase = 'sauce'; K.prompt('Which sauce?');
      const row = trayButtons([['🍫 Chocolate sauce', 'brown', () => pickSauce('#5b2a0e')], ['🍓 Strawberry sauce', 'red', () => pickSauce('#dc2626')]]);
      function pickSauce(col) {
        if (sauce) return;
        sauce = col; K.cfg.sound.sparkle(); row.remove(); finishIce();
      }
      man('s_sauce');
    }
    async function finishIce() {
      phase = 'done'; const r = K.run;
      await K.sleep(500);
      await say('ic_count');
      if (r !== K.run || !live(g)) return;
      if (await star('icecream', 'icecream_star') && live(g)) bedtime();
    }
    K.stage(g, 'Ice cream shop');
  }

  // ---------- hide and seek: counting, and behind / under / in ----------
  const SPOTS = [
    { id: 'curtains', prep: 'behind', r: [190, 60, 110, 380] },
    { id: 'cupboard', prep: 'in', r: [320, 140, 120, 300] },
    { id: 'sofa', prep: 'behind', r: [470, 270, 280, 180] },
    { id: 'plant', prep: 'behind', r: [770, 220, 90, 230] },
    { id: 'table', prep: 'under', r: [860, 350, 130, 100] },
    { id: 'box', prep: 'in', r: [90, 460, 150, 100] },
  ];
  const DECOYS = ['🧦', '📚', '⚽', '🎈', '🧩', '🪀', '🚗'];
  function hide() {
    const who = ['mammy', 'teddy', 'cat'];
    let round = 0, phase = 'count', count = 0, where = null, misses = 0, open = {}, found = false, wiggle = false, busy = true;
    const ask = () => { busy = false; K.prompt('Where is ' + (who[round] === 'mammy' ? 'Mammy' : 'the ' + who[round]) + '?'); say('hs_find_' + who[round]); };
    async function countUp() {
      const r = K.run;
      phase = 'count'; count = 0; open = {}; found = false; misses = 0; wiggle = false; busy = true;
      where = K.pick(SPOTS.filter(s => s !== where));
      K.prompt('Count to ten!'); K.dots(3, round);
      await say(round ? 'hs_count_again' : 'hs_intro');
      for (let n = 1; n <= 10; n++) {
        if (r !== K.run || !live(g)) return;
        count = n; K.cfg.sound.board(n - 1);
        await K.say(['n_' + n], ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n]);
        await K.sleep(250);
      }
      if (r !== K.run || !live(g)) return;
      await say('hs_ready');
      phase = 'seek'; if (live(g)) ask();
    }
    const g = {
      start() { countUp(); },
      again() { if (phase === 'seek' && !busy) say('hs_find_' + who[round]); },
      async down(p) {
        if (phase !== 'seek' || busy) return;
        const q = toBoard(p), spot = SPOTS.find(s => inRect(q, s.r));
        if (!spot || open[spot.id]) return;
        const r = K.run;
        open[spot.id] = spot === where ? 'found' : K.pick(DECOYS); K.cfg.sound.door(true);
        if (spot !== where) {
          misses++; K.cfg.hush();
          busy = true;
          await say('hs_not_' + spot.id);
          if (misses === 2) await say('hs_hint_' + where.prep);
          if (misses >= 4) wiggle = true;
          busy = false;
          return;
        }
        busy = true; found = true; K.cfg.sound.sparkle(); K.burst(p.x, p.y); K.buzz([30, 40, 30]);
        K.cfg.hush();
        if (who[round] === 'mammy') await mammy('m_found'); else await say('hs_found_' + who[round]);
        await say('hs_was_' + where.id);
        if (r !== K.run || !live(g)) return;
        if (round + 1 < who.length) { await K.sleep(400); round++; return countUp(); }
        K.dots(3, 3);
        if (await star('hide', 'hide_star') && live(g)) bedtime();
      },
      draw(c, dt, t) {
        const B = board(c, (c, W, H, oy) => { c.fillStyle = '#fde68a'; c.fillRect(0, 0, W, H); c.fillStyle = '#b45309'; c.fillRect(0, oy + 440 * Math.min(W / 1000, H / 600), W, H); });
        lastBoard = B;
        // the room
        c.fillStyle = '#fde68a'; c.fillRect(0, 0, 1000, 440);
        c.fillStyle = '#fcd34d'; for (let x = 0; x < 1000; x += 50) c.fillRect(x, 0, 22, 440);
        c.fillStyle = '#b45309'; c.fillRect(0, 440, 1000, 160);
        c.fillStyle = 'rgba(0,0,0,.1)'; for (let y = 470; y < 600; y += 34) c.fillRect(0, y, 1000, 3);
        c.fillStyle = '#fff'; c.fillRect(60, 70, 200, 190); c.fillStyle = '#93c5fd'; c.fillRect(70, 80, 180, 170); c.fillStyle = '#fff'; c.fillRect(156, 80, 8, 170);
        c.fillStyle = '#e5e7eb'; c.fillRect(40, 54, 280, 10);
        const wig = sp => (wiggle && sp === where && !found ? Math.sin(t * 18) * 3 : 0);
        const hider = (x, y, sc) => {
          if (who[round] === 'mammy') { c.save(); c.translate(x, y); c.scale(sc, sc); Scene.head(c, { skin: '#f1c27d', hair: '#7c2d12', style: 5, bag: '#ec4899' }); c.restore(); }
          else K.emoji(c, who[round] === 'teddy' ? '🧸' : '🐱', x, y, sc * 30);
        };
        const reveal = (sp, x, y, sc) => { const o = open[sp.id]; if (!o) return; if (o === 'found') hider(x, y, sc); else K.emoji(c, o, x, y, 54); };
        // curtains: a panel each side of the window; the right one pulls back
        c.fillStyle = '#dc2626'; c.fillRect(40, 64, 90, 376);
        const cs = SPOTS[0]; reveal(cs, 245, 330, 3.2);
        c.fillStyle = '#dc2626'; c.fillRect(190 + (open.curtains ? 70 : 0) + wig(cs), 64, open.curtains ? 40 : 110, 376);
        c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 3; c.beginPath(); for (let x = 205; x < 300; x += 22) { c.moveTo(x + (open.curtains ? 60 : 0), 70); c.lineTo(x + (open.curtains ? 60 : 0), 440); } c.stroke();
        // the cupboard
        const cu = SPOTS[1];
        c.fillStyle = '#7c2d12'; c.fillRect(320 + wig(cu), 140, 120, 300);
        if (open.cupboard) { c.fillStyle = '#1f1208'; c.fillRect(330, 150, 100, 280); reveal(cu, 380, 280, 3.2); c.fillStyle = '#9a3412'; c.fillRect(270, 150, 50, 280); }
        else { c.fillStyle = '#9a3412'; c.fillRect(330 + wig(cu), 150, 48, 280); c.fillRect(382 + wig(cu), 150, 48, 280); c.fillStyle = '#fbbf24'; K.dot(c, 372, 300, 5); K.dot(c, 388, 300, 5); }
        // the plant (behind it, the hider peeks out)
        const pl = SPOTS[3];
        if (open.plant) reveal(pl, 845, 300, 3);
        c.fillStyle = '#15803d'; for (const [dx, dy, rad] of [[0, 0, 40], [-28, 30, 30], [28, 30, 30], [0, -40, 30]]) K.dot(c, 815 + dx + wig(pl), 290 + dy, rad);
        c.fillStyle = '#c2410c'; c.beginPath(); c.moveTo(780, 360); c.lineTo(850, 360); c.lineTo(840, 445); c.lineTo(790, 445); c.closePath(); c.fill();
        // the sofa (behind it, a head pops up)
        const so = SPOTS[2];
        if (open.sofa) reveal(so, 610, 275, 3.2);
        c.fillStyle = '#2563eb'; K.rr(c, 480 + wig(so), 290, 260, 80, 26); c.fill(); K.rr(c, 470 + wig(so), 350, 280, 90, 18); c.fill();
        c.fillStyle = '#1d4ed8'; K.rr(c, 460 + wig(so), 330, 36, 110, 12); c.fill(); K.rr(c, 724 + wig(so), 330, 36, 110, 12); c.fill();
        // the table with its long cloth
        const ta = SPOTS[4];
        c.fillStyle = '#7c2d12'; c.fillRect(870, 350, 110, 12);
        if (open.table) { c.fillStyle = '#7c2d12'; c.fillRect(880, 360, 10, 85); c.fillRect(960, 360, 10, 85); reveal(ta, 925, 410, 2.4); c.fillStyle = '#f9a8d4'; c.fillRect(860, 336, 130, 30); }
        else { c.fillStyle = '#f9a8d4'; c.beginPath(); c.moveTo(860 + wig(ta), 340); c.lineTo(990 + wig(ta), 340); c.lineTo(995, 445); c.lineTo(855, 445); c.closePath(); c.fill(); c.fillStyle = '#fff'; for (let x = 862; x < 990; x += 18) K.dot(c, x, 444, 5); }
        K.emoji(c, '🏺', 925, 320, 40);
        // the toy box
        const bo = SPOTS[5];
        if (open.box) { reveal(bo, 165, 470, 2.8); c.fillStyle = '#451a03'; c.save(); c.translate(90, 480); c.rotate(-0.5); c.fillRect(0, -30, 150, 24); c.restore(); }
        c.fillStyle = '#7c2d12'; K.rr(c, 90 + wig(bo), 480, 150, 80, 8); c.fill();
        if (!open.box) { c.fillStyle = '#451a03'; c.fillRect(84 + wig(bo), 470, 162, 20); }
        c.fillStyle = '#fbbf24'; c.font = '700 22px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText('TOYS', 165, 530);
        // counting with your eyes shut
        if (phase === 'count') {
          c.fillStyle = 'rgba(30,20,60,.75)'; c.fillRect(-500, -500, 2000, 1600);
          K.emoji(c, '🙈', 500, 220, 140);
          if (count) { c.fillStyle = '#fff'; c.font = '700 150px Andika, Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(count, 500, 420); }
        }
        B.end();
        K.drawFx(c, dt);
      },
    };
    let lastBoard = null;
    const toBoard = p => lastBoard ? lastBoard.to(p) : p;
    K.stage(g, 'Hide and seek');
  }

  // ---------- bedtime: brush your teeth ----------
  function bedtime() {
    K.setSkip(bed);
    const teeth = [];
    for (let k = 0; k < 6; k++) teeth.push({ row: 'top', x: 290 + k * 84, y: 210, dirt: 1 }, { row: 'bottom', x: 290 + k * 84, y: 360, dirt: 1 });
    const germs = teeth.map((_, k) => ({ dx: ((k * 37) % 30) - 15, dy: ((k * 53) % 24) - 12 }));
    let phase = 'paste', paste = false, brush = null, held = false, foam = [], rinse = 0, row = null, sparkle = 0;
    const left = r => teeth.filter(tt => tt.row === r && tt.dirt > 0.05).length;
    const g = {
      start() {
        K.prompt('Brush your teeth');
        row = trayButtons([['🧴 Toothpaste', 'blue', () => {
          if (paste) return; paste = true; K.cfg.sound.pop(); row.remove(); phase = 'top'; K.prompt('Top teeth'); say('bt_top');
        }]]);
        row.children[0].classList.add('hintBtn');
        mammy('m_bedtime').then(() => { if (live(g) && !paste) say('bt_paste'); });
      },
      again() { say(phase === 'paste' ? 'bt_paste' : phase === 'top' ? 'bt_top' : phase === 'bottom' ? 'bt_bottom' : 'bt_rinse'); },
      down(p) { held = true; brush = toBoard(p); },
      move(p) {
        const q = toBoard(p);
        if (held && brush && (phase === 'top' || phase === 'bottom')) {
          const d = Math.hypot(q.x - brush.x, q.y - brush.y);
          for (const tt of teeth) if (tt.row === phase && tt.dirt > 0 && Math.abs(q.x - tt.x) < 50 && Math.abs(q.y - tt.y) < 70) {
            tt.dirt = Math.max(0, tt.dirt - d / 420);
            if (Math.random() < 0.3) foam.push({ x: q.x + (Math.random() - 0.5) * 40, y: q.y + (Math.random() - 0.5) * 40, r: 6 + Math.random() * 10, life: 1 });
          }
          if (Math.random() < 0.15) K.cfg.sound.scribble();
          if (!left(phase)) {
            K.cfg.sound.sparkle();
            if (phase === 'top') { phase = 'bottom'; K.prompt('Bottom teeth'); say('bt_bottom'); }
            else { phase = 'rinse'; K.prompt('Rinse!'); held = false; say('bt_rinse');
              row = trayButtons([['🥛 Rinse', 'blue', async () => {
                if (rinse) return; rinse = 0.001; row.remove(); K.cfg.sound.door(false);
                await K.sleep(1200); sparkle = 1; K.cfg.sound.sparkle();
                if (await star('teeth', 'teeth_star') && live(g)) bed();
              }]]);
              row.children[0].classList.add('hintBtn');
            }
          }
        }
        brush = q;
      },
      up() { held = false; },
      draw(c, dt, t) {
        const B = board(c, (c, W, H) => { c.fillStyle = '#cffafe'; c.fillRect(0, 0, W, H); });
        lastBoard = B;
        c.fillStyle = '#cffafe'; c.fillRect(0, 0, 1000, 600);
        c.strokeStyle = 'rgba(14,116,144,.15)'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= 1000; x += 50) { c.moveTo(x, 0); c.lineTo(x, 600); } for (let y = 0; y <= 600; y += 50) { c.moveTo(0, y); c.lineTo(1000, y); } c.stroke();
        // a big smile: lips, gums and two rows of teeth
        c.fillStyle = '#f472b6'; c.beginPath(); c.ellipse(500, 290, 330, 190, 0, 0, TAU); c.fill();
        c.fillStyle = '#7f1d1d'; c.beginPath(); c.ellipse(500, 290, 290, 160, 0, 0, TAU); c.fill();
        c.fillStyle = '#fb7185'; c.beginPath(); c.ellipse(500, 150, 270, 60, 0, 0, Math.PI); c.fill(); c.beginPath(); c.ellipse(500, 430, 270, 60, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#f43f5e'; c.beginPath(); c.ellipse(500, 360, 150, 50, 0, Math.PI, 0); c.fill();
        teeth.forEach((tt, k) => {
          c.fillStyle = '#fff'; K.rr(c, tt.x - 36, tt.y - 60, 72, 120, 22); c.fill();
          if (sparkle) { c.fillStyle = 'rgba(255,255,255,.9)'; K.dot(c, tt.x - 14, tt.y - 30, 6); }
          if (tt.dirt > 0) {
            const gm = germs[k], a = tt.dirt;
            c.globalAlpha = Math.min(1, a * 1.4);
            c.fillStyle = k % 3 ? '#a3e635' : '#facc15'; K.dot(c, tt.x + gm.dx, tt.y + gm.dy, 18 * (0.5 + a * 0.5));
            c.fillStyle = '#1f2937'; K.dot(c, tt.x + gm.dx - 6, tt.y + gm.dy - 3, 2.5); K.dot(c, tt.x + gm.dx + 6, tt.y + gm.dy - 3, 2.5);
            c.globalAlpha = 1;
          }
        });
        // foam and bubbles; rinsing washes them away
        if (rinse) rinse = Math.min(1, rinse + dt);
        for (const f of foam) { f.life -= dt * (rinse ? 2 : 0.08); c.fillStyle = 'rgba(255,255,255,' + Math.max(0, f.life) * 0.9 + ')'; K.dot(c, f.x, f.y, f.r); }
        foam = foam.filter(f => f.life > 0);
        if (sparkle) { sparkle += dt; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + sparkle; K.emoji(c, '✨', 500 + Math.cos(a) * 380, 290 + Math.sin(a) * 230, 40); } }
        // the toothbrush follows the finger
        if (phase === 'top' || phase === 'bottom') {
          const b = brush || { x: 820, y: 520 + Math.sin(t * 3) * 10 };
          c.save(); c.translate(b.x, b.y); c.rotate(-0.5);
          c.fillStyle = '#3b82f6'; K.rr(c, -10, 0, 220, 26, 12); c.fill();
          c.fillStyle = '#e5e7eb'; c.fillRect(-60, -24, 60, 26); c.fillStyle = '#fff'; for (let x = -58; x < 0; x += 8) c.fillRect(x, -40, 5, 18);
          if (paste) { c.fillStyle = '#7dd3fc'; K.rr(c, -62, -56, 64, 18, 9); c.fill(); }
          c.restore();
          if (!held && !brush) K.emoji(c, '👆', 820, 470, 50);
        }
        B.end();
        K.drawFx(c, dt);
      },
    };
    let lastBoard = null;
    const toBoard = p => lastBoard ? lastBoard.to(p) : p;
    K.stage(g, 'Brush your teeth');
  }

  // ---------- bed: lamp off, stars, a lullaby, goodnight ----------
  function bed() {
    K.setSkip(() => done());
    let dark = 0, off = false, asleep = 0, zs = [], fade = 0;
    const lamp = [120, 250, 120, 190];
    const g = {
      start() { K.prompt('Bedtime'); mammy('m_bed'); },
      again() { if (!off) mammy('m_bed'); },
      async down(p) {
        if (off) return;
        const q = lastBoard ? lastBoard.to(p) : p;
        if (!inRect(q, lamp)) return;
        off = true; K.cfg.sound.click(); K.prompt('Goodnight');
        const r = K.run;
        await K.sleep(900);
        const twinkle = SONGS.findIndex(s => /Twinkle/.test(s.name));
        K.cfg.sound.radioOn(twinkle < 0 ? 0 : twinkle);
        await K.sleep(2500);
        if (r !== K.run || !live(g)) return;
        asleep = 0.001;
        await mammy('m_sleep');
        await K.sleep(3500);
        if (r !== K.run || !live(g)) return;
        fade = 0.001;
        await K.sleep(1500);
        if (r === K.run && live(g)) done();
      },
      draw(c, dt, t) {
        if (off) dark = Math.min(1, dark + dt * 0.8);
        const B = board(c, (c, W, H) => { c.fillStyle = Scene.mix('#ddd6fe', '#1e1b4b', dark); c.fillRect(0, 0, W, H); });
        lastBoard = B;
        c.fillStyle = Scene.mix('#ddd6fe', '#1e1b4b', dark); c.fillRect(0, 0, 1000, 600);
        c.fillStyle = Scene.mix('#a16207', '#2e1065', dark); c.fillRect(0, 470, 1000, 130);
        // the window: the moon and stars
        c.fillStyle = '#fff'; c.fillRect(690, 60, 230, 190); c.fillStyle = '#1e3a8a'; c.fillRect(700, 70, 210, 170);
        c.fillStyle = '#fef9c3'; K.dot(c, 850, 120, 30); c.fillStyle = '#1e3a8a'; K.dot(c, 838, 110, 26);
        for (const [x, y] of [[730, 100], [770, 190], [880, 210], [740, 220], [800, 90]]) { c.fillStyle = '#fde68a'; K.dot(c, x, y, 3 + Math.sin(t * 3 + x) * 1.2); }
        c.fillStyle = '#fff'; c.fillRect(801, 70, 8, 170);
        // glow stars on the ceiling once it's dark
        if (dark > 0.3) { c.globalAlpha = (dark - 0.3) / 0.7; for (const [x, y] of [[100, 60], [260, 40], [420, 80], [560, 40], [620, 120], [330, 140], [180, 150]]) K.emoji(c, '⭐', x, y, 26 + Math.sin(t * 2 + x) * 4); c.globalAlpha = 1; }
        // the bed with the player tucked in
        c.fillStyle = '#7c2d12'; K.rr(c, 300, 260, 30, 240, 10); c.fill(); K.rr(c, 860, 340, 30, 160, 10); c.fill();
        c.fillStyle = '#fff'; K.rr(c, 330, 300, 170, 80, 30); c.fill();
        c.save(); c.translate(410, 320); c.scale(3.3, 3.3); Scene.head(c, K.look());
        if (asleep) { // eyes shut
          const L = K.look(); c.fillStyle = L.skin; K.dot(c, -2.5, -1, 2.8); K.dot(c, 6, -1, 2.8);
          c.strokeStyle = '#1f2937'; c.lineWidth = 0.9; c.beginPath(); c.arc(-2.5, -1.5, 2.2, 0.2, Math.PI - 0.2); c.moveTo(8.2, -1); c.arc(6, -1.5, 2.2, 0.2, Math.PI - 0.2); c.stroke();
        }
        c.restore();
        c.fillStyle = '#3b82f6'; K.rr(c, 330, 360, 540, 140, 24); c.fill();
        c.fillStyle = '#93c5fd'; for (let x = 360; x < 860; x += 60) for (let y = 390; y < 490; y += 50) K.emoji(c, '⭐', x + (y % 100 ? 30 : 0), y, 22);
        c.fillStyle = '#bfdbfe'; K.rr(c, 330, 350, 540, 30, 14); c.fill();
        // the bedside lamp
        c.fillStyle = '#92400e'; c.fillRect(110, 380, 140, 120);
        c.fillStyle = '#6b7280'; c.fillRect(173, 300, 14, 80);
        c.fillStyle = off ? '#9ca3af' : '#fde047'; c.beginPath(); c.moveTo(130, 300); c.lineTo(230, 300); c.lineTo(205, 250); c.lineTo(155, 250); c.closePath(); c.fill();
        if (!off) { c.fillStyle = 'rgba(253,224,71,.25)'; K.dot(c, 180, 300, 110); K.emoji(c, '👆', 240, 330 + Math.sin(t * 6) * 6, 46); }
        // Mammy says goodnight
        if (!fade || fade < 1) { if (fade) fade = Math.min(1, fade + dt); c.globalAlpha = 1 - fade; K.mammyFig(c, 935, 545, 3.4, t, !!asleep); c.globalAlpha = 1; }
        // dark, then the z's
        c.fillStyle = 'rgba(10,8,40,' + dark * 0.45 + ')'; c.fillRect(-500, -500, 2000, 1600);
        if (asleep) {
          if (Math.random() < dt * 1.2) zs.push({ x: 470, y: 280, life: 1 });
          c.fillStyle = '#e0e7ff'; c.font = '700 40px Fredoka, sans-serif'; c.textAlign = 'center';
          for (const z of zs) { z.life -= dt * 0.35; z.y -= dt * 30; z.x += dt * 18; c.globalAlpha = Math.max(0, z.life); c.fillText('Z', z.x, z.y); }
          c.globalAlpha = 1; zs = zs.filter(z => z.life > 0);
        }
        B.end();
      },
    };
    let lastBoard = null;
    K.stage(g, 'Bedtime');
  }

  return { start };
})();
