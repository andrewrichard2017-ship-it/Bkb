# Bubble Odyssey

A bubble shooter for phones, tablets and computers. Plain HTML5 canvas and JavaScript, no install and no build step: open `index.html` (served over http for online play).

Aim, bounce shots off the walls, and match three or more of the same colour to pop them. Anything no longer hanging from the top falls off (drops score double). Don't let the bubbles reach the dashed line, and don't run out of shots.

## Modes

- **Career:** 50 levels across five worlds, easy to hard: Sunny Meadow, Coral Reef, Candy Clouds, Crystal Caves and Cosmic Nebula. Every 10th level is a boss. Win a level to unlock the next; earn 1-3 stars on score. The map scrolls from world 1 at the bottom to world 5 at the top.
- **Co-op · same screen:** two launchers on one board, sharing the shots, the score and the fever ring. It has its own career progress (all 50 levels) and an endless mode.
- **Online co-op:** host a game and send your mate the link or the 5-letter code. You each play on your own device with your own launcher on the same board. The host picks a level from their co-op career, or co-op endless.
- **Endless:** rows keep pushing in, faster and with more colours and specials as your score climbs. Best scores are saved for solo and co-op.

## Goals

| Goal | How to win |
|---|---|
| Clear | Pop or drop every bubble, including the rows still waiting to come in |
| Rescue | Free every trapped Blip by popping or dropping its bubble |
| Boss | Every bubble you pop hurts the boss, drops hurt double. The boss pushes a new row in every few shots |

The bosses: Grumbletoad (Meadow), Captain Clawdia (Reef), Gumdrop Giant (Candy), Crystal Golem (Caves) and The Void Squid (Nebula).

## Special bubbles

| Bubble | What it does | First seen |
|---|---|---|
| Stone | Can't be popped. Knock away what holds it up | Level 6 |
| Ice | Cracks the first time it's matched, pops the second | Level 11 |
| Bomb | Pop anything next to it and it blows up two rings around | Level 14 |
| Star | Hit it and every bubble of your colour pops | Level 21 |
| Chameleon | Changes colour after every shot | Level 23 |

From level 9 on, some levels push a new row in every few shots.

## Power-ups

Busy shots fill the **fever ring** round your launcher; when it's full your next shot is a free power-up (bomb, fireball, rainbow or lightning). In solo games you can also use power-ups you own: tap one at the bottom of the screen (or press 1-6). If you have none, tapping it buys one with coins.

| Power-up | Price | What it does |
|---|---|---|
| Bomb | 40 | Blows up everything around where it lands |
| Fireball | 60 | Burns straight through every bubble in its path |
| Rainbow | 45 | Matches any colour it touches, two or more |
| Lightning | 50 | Clears the row it hits and the row below it |
| Laser Sight | 30 | Full aim line with a landing marker for 10 shots |
| +5 Shots | 35 | Five extra shots, straight away |

Coins come from winning levels (more for new stars and first clears), endless scores, and a free daily gift in the shop. Out of shots, or the bubbles got too low? You can buy a continue on the results screen.

## Controls

| | |
|---|---|
| Touch | Drag to aim, let go to shoot (drag back below the launcher to cancel). Tap the launcher or the next bubble to swap |
| Mouse | Point to aim, click to shoot |
| Keyboard | ← → or A D aim (hold Shift for fine aim), ↑ / W / Space shoot, ↓ / S swap, 1-6 power-ups, Esc pause |
| Two on one keyboard | Player 1: A D aim, W shoot, S swap. Player 2: ← → aim, ↑ shoot, ↓ swap |
| Controller | Left stick or D-pad aim (right stick points straight at the angle), ✕ shoot, ○ swap, △ pick a power-up, L1 +5 shots, R1 Laser Sight, Options pause |

On one tablet in co-op, each player drags on their own half of the screen.

Settings: music and sound volume, vibration, colour-blind symbols on the bubbles, a full aim line (easier), and your name for online games.

## Files

| File | |
|---|---|
| `js/core.js` | Namespace, maths, seeded random numbers, settings and the save (localStorage) |
| `js/board.js` | The hex grid: moving and snapping shots, matching, specials, power-ups, dropping. No drawing |
| `js/levels.js` | The worlds, the 50 level recipes, the shapes and the board generator, and the tuned shots / star scores |
| `js/game.js` | A game session: launchers, shots, scoring, fever, pushes, bosses, winning and losing. No drawing |
| `js/sprites.js` | Bubbles painted once per zoom level into small canvases |
| `js/bg.js` | The five animated world backdrops |
| `js/fx.js` | Pops, drops, freed Blips, blasts, lightning, floating text |
| `js/render.js` | Layout (portrait or side panels), the board, launchers, aim line, bosses and HUD |
| `js/input.js` | Touch, mouse, keyboard and gamepads |
| `js/audio.js` | Synthesised sound effects and a tune per world |
| `js/net.js` | Online co-op (PeerJS from `../road/lib/`) |
| `js/menu.js` | Menus, the career map, shop and results |
| `js/main.js` | Boot, the loop, events into effects and sound, saving results |
| `tools/sim.js` | Balance tool: bots play every level to set shots and star scores |

## Balancing

Shots and star scores per level come from `tools/sim.js`: a "casual" bot (often not the best shot, shaky aim) sets the shots and the 2-star score, a "sharp" bot sets the 3-star score. After changing a level recipe in `js/levels.js`, run `node bubble/tools/sim.js` (about 90 seconds) and paste the printed `TUNE` array into `js/levels.js`. You can do part of the list: `node bubble/tools/sim.js 11 20 30` re-runs levels 11-20 with 30 runs each.

## Testing online locally

Run a PeerJS server (`npx peer --port 9000`) and open the game with `?peerhost=127.0.0.1&peerport=9000` on both sides.

## Publishing on game portals (ads)

The GitHub Pages copy has no ads. `js/ads.js` only switches on in a portal build:

1. Run `python3 bubble/tools/package.py`.
2. Upload `bubble/dist/bubble-odyssey-crazygames.zip` to the CrazyGames developer portal (ads on), or `bubble-odyssey-web.zip` to itch.io (no ads).

In the CrazyGames build:
- A break ad may show between games (next level, retry, back to the map), at most every 3 minutes and never in the first two games.
- Players can choose to watch an ad for one free continue per level, to double the coins they won, or for 40 coins in the shop.
- Sound mutes while an ad plays.
- There are no break ads in online co-op, so the other player is never left waiting.

To try it locally, add `?portal=crazygames` to the URL; the SDK shows demo ads on localhost.

Store covers (CrazyGames needs 1920×1080, 800×1200 and 800×800) are in `promo/`. They're drawn from the game's own art by `tools/cover.html`; to redo them, serve the repo (`python3 -m http.server 8123` from the root) and run `node bubble/tools/covers.js` (`--world=reef` etc. for another backdrop).
