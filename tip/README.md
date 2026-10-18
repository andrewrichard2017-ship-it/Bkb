# Tractor Tippin'

A 3D cartoon farm game about tractor tipping, inspired by the Disney/Pixar *Cars* films. Sneak up on sleeping tractors at night, honk, watch them go over on their backs, and get out through the farm gate before **Thrasher**, the big angry combine harvester, wakes up and runs you down. Plain HTML/JS with no build step. The 3D is [three.js](https://threejs.org) and online play uses [PeerJS](https://peerjs.com). Both are shared with Road Rumble from `../road/lib/`.

Play it at `/Bkb/tip/` on the GitHub Pages site, or open `tip/index.html` through a local web server (`python3 -m http.server` in the repo root, then `http://localhost:8000/tip/`). It won't run from `file://` because it loads a JavaScript module.

The characters are **original look-alikes**, not copies of the film's characters:

- **Rusty**: a rusty old tow truck with buck teeth and a swinging hook. Big loud horn, grips well, and reverses as fast as he drives forwards.
- **Dash**: a red number 88 stock car with a lightning stripe. Very fast, small horn, slides about on the grass.
- **Thrasher**: a red combine harvester with bull horns on his header. He wakes when the farm gets too noisy.

All three have their eyes in the windshield and a mouth on the front bumper.

## How to play

- **Creep up** on a sleeping tractor. Go faster than a crawl near one and it wakes up grumpy, and you don't get a tip.
- **Honk** when you're close (a HONK! prompt shows). Everything asleep in range of your horn jumps, moos and goes over on its back. Rusty's horn reaches further, so he can tip a whole herd at once.
- Honks, tips, boosting and driving fast near the barn all make noise. When **Thrasher's meter** fills he wakes up and comes for you. He's quick in a straight line but can't turn tight. Hide in the corn and keep still and he loses you, though he can mow straight through it. Hay bales don't stop him either.
- Tip enough tractors to open the **gate**, then drive out through it. It only stays open for **6 seconds**: if you're not out by then it shuts, and you have to tip another tractor to open it again. Thrasher hits you 3 times and you're caught.
- Stars: ★ escape · ★ tip the bonus number · ★ don't get hit at all. Each farm unlocks the next.

## Modes

- **Story** (1 player) or **Team up** (2 players, same screen or online): tip enough to open the gate and escape. Tips count for the team, and only one of you has to get out.
- **Tip-Off**: 2½ minutes with Thrasher awake the whole time. Every hit costs you 2 tips, and the tractors get back up after a while. With 2 players, most tips wins. With 1 player it's a score attack and your best on each farm is saved.
- **Thrasher Hunt**: someone drives **Thrasher** and hunts the cars down. On your own (**BE THRASHER · CHASE RUSTY** on the title screen) you're Thrasher and the computer drives Rusty and Dash: they sneak about tipping tractors, and once they've tipped 80% of the herd the gate opens. Catch every runner (2 hits each) before they get out or the 3:00 clock runs out. With 2 players (same screen or online) one of you is Thrasher (pick who), the other drives a car and the computer drives the other one. Thrasher is heavy and turns wide but can **charge** (○ / R1 / Shift) and **roar** (✕ / Space): the roar wakes every sleeping tractor near him so the runners can't tip them for a while, and gives anyone close a fright. An arrow at the top of his screen points to the nearest runner.
- **🎃 Halloween special**: *Haunted Harvest*. Ghost tractors that fade away when tipped, a pumpkin patch to smash (squash pumpkins for treats), jack-o'-lanterns, a graveyard, scarecrows, bats round a big orange moon, spooky music, Rusty in a witch's hat, Dash with devil horns, and **Pumpkin Thrasher**.

## Farms

| | Farm | Tractors | Gate opens at | Notes |
|---|---|---|---|---|
| 1 | Sundown Pasture | 8 | 6 | Dusk, gentle start |
| 2 | Moonlit Cornfield | 10 | 8 | Lots of corn to hide in |
| 3 | Hay Bale Hollow | 12 | 9 | Bales everywhere (Thrasher smashes them) |
| 4 | Muddy Bottoms | 12 | 10 | Fog, mud patches and a duck pond slow you down |
| 5 | Thrasher's Barn | 16 | 13 | Harvest moon, biggest herd, Thrasher wakes easily |
| 🎃 | Haunted Harvest | 12 | 9 | Halloween special, always unlocked |

Each farm is generated from a fixed seed (`TT.LEVELS` in `js/data.js`), so it's the same every time and the same on both machines online.

## Controls

**PS5 DualSense** (or PS4 / any standard pad, Bluetooth or USB; press a button once to wake it up): R2 (or stick up) drive · L2 (or stick down) brake / reverse · left stick or D-pad steer · **✕ honk** · ○ or R1 boost · □ handbrake slide · L1 look behind · △ change camera · right stick look around · Options pause. Every menu works with the D-pad/stick, ✕ and ○. Honks, tips, hits and Thrasher's roar rumble the pad.

**Keyboard**: W/↑ drive · S/↓ brake/reverse · A D / ← → steer · **Space honk** · Shift boost · L handbrake · B look behind · C camera · Esc pause.

**Two players on one screen** (split top/bottom): two pads, or one pad + keyboard, or both on the keyboard (P1 WASD + F honk, G boost, Q handbrake · P2 arrows + `.` honk, `/` boost, `,` handbrake).

**Touch**: drag on the left half to steer; GAS, REVERSE, HONK and BOOST buttons on the right.

## Online (2 players)

**PLAY ONLINE → HOST A GAME** gives a 5-letter code and an invite link; your mate opens the link (or types the code under **JOIN WITH A CODE**). In the lobby each of you picks a vehicle and the host picks Team up, Tip-Off or Thrasher Hunt (and who drives Thrasher) and the farm. In the hunt the computer drives the spare car on the host's machine; if the player driving Thrasher drops out, Thrasher drives himself. The host's machine runs the farm (tractors, Thrasher, the score); the guest drives their own car and sends its position, honks and squashed pumpkins. Connections go through PeerJS's free public server. To test locally, run a PeerServer and add `?peerhost=127.0.0.1&peerport=9000` to the URL.

## Code

| File | What it does |
|---|---|
| `js/core.js` | Namespace (`TT`), maths, seeded RNG and noise, settings and the save |
| `js/data.js` | The two cars, the farms, sky themes, messages |
| `js/audio.js` | All sound, synthesised: horns, engines, moos, Thrasher's diesel and roar, four tunes (farm/spooky, calm/chase) |
| `js/input.js` | Gamepad (PS5 mapping and rumble), keyboard (one or two players) and touch |
| `js/models.js` | The characters, built from primitives, with canvas-drawn windshield eyes and bumper mouths |
| `js/farm.js` | The farm: terrain, fence and gate, barn, house, silo, windmill, corn (Thrasher mows it), bales, mud, pond, trees, sky, Halloween dressing |
| `js/vehicles.js` | Car handling, the tractors' sleep/tip cycle, Thrasher's chase AI and his player controls, the computer drivers for Rusty and Dash (Thrasher Hunt) |
| `js/game.js` | The rules: sneaking, honking, the noise meter, hits, the gate, escaping, scores, online snapshots |
| `js/fx.js` | Particles (dust, smoke, backfires, hay, pumpkin splats, sparkles) and floating Zs |
| `js/hud.js` | In-game HUD and minimap |
| `js/menu.js` | Menus and the results screen |
| `js/net.js` | Online play |
| `js/main.js` | Boot, main loop, cameras, split screen, events to sound/rumble/particles, the showroom |

After changing anything in `js/`, bump the `?v=` numbers on the script tags in `index.html` so phones pick up the new copy.
