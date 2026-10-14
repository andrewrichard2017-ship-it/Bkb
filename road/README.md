# Road Rumble

A 3D motorbike combat racer heavily inspired by **Road Rash** (EA, 1991–2000; PS1 1995). Race a pack of rival bikers down long public roads at 200+ km/h, punch, kick and club them off their bikes, dodge the traffic, and stay ahead of the police. Plain HTML/JS with no build step; the 3D is [three.js](https://threejs.org) (vendored in `lib/`).

Play it at `/Bkb/road/` on the GitHub Pages site, or open `road/index.html` through a local web server (`python3 -m http.server` in the repo root, then `http://localhost:8000/road/`). It won't run from `file://` because it loads a JavaScript module.

> **Content warning:** cartoon road violence (punches, kicks, weapons, crashes). All characters are fictional.

## Modes

- **Career.** Five levels, five roads each. Finish in the top 3 on every road to move up a level; roads get longer and the pack gets faster. Places 1–6 pay prize money, plus a bonus for every rider you knock off. Spend it in the **Garage** on faster bikes. Get **busted** by the police (fine) or **wreck** your bike (repair bill) and your race is over.
- **2 Players · same screen.** Split screen (top/bottom), both of you against the pack. Pick track, level and each player's bike.
- **Play online · invite a mate.** One of you hosts and gets a link (and a 5-letter code); the other opens the link on their own device and joins the lobby. Both pick bikes, the host picks the road and starts.

## Roads

| | |
|---|---|
| **Coast Highway** | Late afternoon on cliff-top tarmac. Guard rail on the right and the ocean below it. |
| **Redwood Pass** | Twisty climb through dense pines under snowy mountains. Trees right up to the road edge. |
| **Vineyard Valley** | Bright, open farmland with vineyards, barns and fences. Fast and wide. |
| **Canyon Run** | Golden hour in red-rock desert. Long straights, mesas, cactus, and big crests that throw you into the air. |
| **Downtown** | Night in the city: lit office blocks, neon, street lights, parked cars, rush-hour traffic and more cops. Your headlight lights the road. |

Every road is generated from a seed: the bends, hills, jumps, roadside props and traffic. It's a different layout on each level.

## Bikes

| Bike | Class | Price | Notes |
|---|---|---|---|
| Rustbucket 350 | Rat | starter | Slow and tatty. |
| Viper 600 | Sport | $3,500 | Light and quick. |
| Banshee 750 | Sport | $7,000 | Sharp in the bends. |
| Kodiak 1100 | Muscle | $9,500 | Heavy: shoves riders around and shrugs off crashes, but slow to turn. |
| Phantom 1000 | Super | $15,000 | 3 nitro boosts. |
| Wraith 1300 | Super | $24,000 | The fastest; 4 nitro boosts. |

## Controls

**PS5 DualSense / PS4 DualShock / any standard controller**

| Button | Action |
|---|---|
| R2 or ✕ | Throttle |
| L2 | Brake |
| Left stick / D-pad | Steer |
| □ / ○ | Punch or swing your weapon to the left / right |
| △ | Kick (towards whoever is beside you; push the stick to choose a side) |
| R1 | Nitro (super bikes) |
| L1 | Look behind |
| R3 / touchpad click | Change camera (chase, far, low, helmet) |
| Options | Pause |
| Menus | D-pad / stick to move, ✕ select, ○ back, ◀ ▶ (or L1/R1) to change a setting |

Hits, crashes, landings and the start all **rumble** the pad. Web pages can't use the DualSense's adaptive triggers or light bar.

**Pairing a PS5 controller:** hold **Create** (top left) and the **PS** button until the light bar flashes, then pair it in your phone's or computer's Bluetooth settings (or plug it in with USB-C). Open the game in Chrome or Edge (Safari works too on recent Apple devices) and press any button.

**Keyboard:** W/↑ throttle, S/↓ brake, A D/← → steer, J / K hit left / right, L kick, Space nitro, B look behind, V camera, Esc pause. **Two players on one keyboard:** P1 WASD + F/G hit + H kick + Q nitro; P2 arrows + , . hit + / kick + Right Shift nitro. With one controller plugged in, the controller is P1 and the keyboard P2.

**Touch (phones without a controller):** the bike accelerates on its own; drag across the left half to steer; buttons on the right for hit left/right, kick, brake and nitro.

## How it plays

- **Fighting.** Ride alongside a rival and hit them. Their health bar shows at the top while you're close. At zero they come off the bike. Kicks do less damage but shove them sideways, into traffic or a tree if you time it.
- **Weapons.** Some rivals carry a chain, club, crowbar, pipe or bat. Punch one just as they wind up a swing and you **steal it**; knock an armed rider off bare-handed and you pick theirs up. Police carry batons.
- **Crashes.** Hitting a car, tree, pole, rock or parked car at speed throws you off. You tumble, then **run back to your bike**; mash ✕ to run faster. Every crash damages the bike; at 0% it's **wrecked**.
- **Police.** Cops wait at the roadside and chase you when you pass (siren, ★ POLICE tag, flashing warning). They'll try to club you off. If one reaches you while you're off your bike, you're **busted**.
- **Riding.** The faster you go, the harder the bends pull you to the outside, so lean into them or brake. Crests and jumps launch you into the air (no steering up there). Off the tarmac you slow right down. The left side of the road is oncoming traffic.
- **The pack** races hard, picks fights (with you and each other), swerves through traffic and crashes too. It stays roughly around you, so there's always someone to fight.

## Online play: how it works and its limits

The two devices talk directly to each other over WebRTC, using [PeerJS](https://peerjs.com)'s free public server to find each other (vendored in `lib/peerjs.min.js`). The host runs the race (the pack, the cops, the results); the guest drives their own bike and sends its position 20 times a second. Hits between the two are sent as messages. Both sides build the identical road and traffic from the race seed, so traffic never needs sending.

- Both players need an internet connection; it works across different networks (home Wi-Fi to mobile data, say).
- Some strict networks (some workplaces, schools, a few mobile carriers) block direct connections. Without a paid relay ("TURN") server those players can't join. If joining times out, try another network.
- PeerJS's free server has no uptime guarantee.
- If your mate disconnects mid-race, their bike carries on as a computer rider.

For testing, run a local PeerServer (`npx peer --port 9000`) and add `?peerhost=127.0.0.1&peerport=9000` to the URL.

## Files

- `index.html`: page, styles, script tags (bump the `?v=` numbers after changing anything in `js/`).
- `js/core.js` maths, seeded RNG/noise, settings and career save · `js/data.js` bikes, rivals, weapons, themes, levels
- `js/track.js` road generation (bends, hills, jumps, props, deterministic traffic) · `js/world.js` the three.js scene, streamed in 240 m chunks
- `js/models.js` procedural bikes, riders (IK limbs), weapons and cars · `js/rider.js` physics, combat, crashes, AI, cops, posing
- `js/race.js` a race: grid, countdown, hits, bumps, busts, standings, results · `js/main.js` loop, cameras, split screen, events → sound/rumble/sparks
- `js/input.js` pad/keyboard/touch · `js/hud.js` HUD · `js/menu.js` menus, career, garage · `js/net.js` online · `js/audio.js` synthesised engines, hits and music · `js/fx.js` particles
- `lib/`: three.js r170 and PeerJS 1.5.4 (both MIT, licences alongside).
