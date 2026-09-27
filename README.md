# Bare Knuckle

A bare knuckle boxing game for Android phones and tablets, inspired by Fight Night. It's an HTML5 canvas game, so it runs in Chrome with no install and no build step.

## Fighters

| | Michael McDonagh (you, red corner) | Baldy Can Box (CPU, blue corner) |
|---|---|---|
| Kit | Stained white tank top, tracksuit bottoms, beige desert boots, red hand wraps | Brown hoodie, jeans, black shoes, bare knuckles |
| Style | Pressure fighter: faster, better stamina | Counter puncher: hits harder, better chin |

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Move | Drag anywhere on the left half | WASD / arrows |
| Jab / Cross | JAB / CROSS | J / K |
| Hook / Uppercut | HOOK / UPPER | U / I |
| Block (hold) | BLOCK | L |
| Slip | SLIP | Space |
| KO punch (opponent under 5% health) | KO! (appears when ready) | O |
| Pause | ⏸ under the clock | P / Esc |

## How a fight works

- **Stamina.** Every punch costs stamina; missing costs more. A tired fighter punches slower and weaker and his hands drop.
- **Defence.** Blocking stops most of a jab or cross, but hooks and uppercuts partly break the guard. Slip a punch to open a counter window.
- **Counters.** Land a punch while your opponent is mid-punch, or straight after a slip, for 1.6× damage.
- **KO punch.** When your opponent drops under 5% health a glowing **KO!** button appears. It throws a loaded overhand that can't be blocked (but can be slipped or missed); if it lands, the fight is over, with no count.
- **Replays.** Every knockdown and knockout is replayed TV-style: slow motion through the impact, a tilted close-up camera, letterbox bars. Tap to skip.
- **Hurt.** A fighter below ~28 HP can be staggered by power shots and becomes easier to finish.
- **Knockdowns.** At 0 HP a fighter goes down and the referee counts. To beat the count, **tap each orb as the closing ring meets it**. Perfect or good timing lifts you up; mistimed taps knock you back a step. Each knockdown needs more orbs and gives you less time, and lowers your maximum health for the rest of the fight. **Three knockdowns in one round is a TKO.**
- **Rounds.** 90-second rounds (1, 3 or 5). Between rounds your corner shows fight stats, the judges' scorecards and advice.
- **Corner game.** Choose *Work the corner* between rounds. **Cutman:** tap each cut on the close-up of your face before it bleeds. Every clean one heals you and brings the swelling down. **Breathe:** tap as the breathing ring meets the gold line, three times. A great corner is worth up to +40 health and some of your lost maximum health back; skipping it only gives +14. Baldy's corner recovers more on harder difficulties.
- **Scoring.** Three judges score each round on the 10-point must system: 10-9 to the round winner, and a point off for every knockdown. Fights that go the distance end in a unanimous, split or majority decision, or a draw.
- **Record.** Your win-loss-draw record is saved on the device.

## Run it

- **Locally:** open `index.html` in a browser, or run `python3 -m http.server` and open `http://<computer-ip>:8000` on your phone (same Wi-Fi).
- **On your phone:** host with GitHub Pages (Settings → Pages → deploy from branch), open the URL in Chrome, then ⋮ → *Add to Home screen*. It launches full screen in landscape.
- **Play Store (later):** wrap the same files with [Capacitor](https://capacitorjs.com/).

## Animation

Characters are cutout-animated: vector body parts (head, torso, upper arm, forearm, fist, thigh, shin, boots) hang on a skeleton. Arms and legs are posed by two-bone IK, so a pose is just a handful of numbers and any two poses blend smoothly. `js/rig.js` holds the pose library: guard, tired guard, block, slip, hurt, stagger, wind-up and extension for each punch, the fall, lying, propped up, kneeling, victory, and the referee's count and wave-off.

Timing: every punch runs wind-up, then a fast snap to full extension, a held follow-through and an eased recovery. Clean hits freeze the frame for a few frames, squash the fighter who is hit, swell the attacker's fist toward the camera and punch the camera in slightly.

## Code layout

| File | What it does |
|---|---|
| `js/core.js` | Namespace, ring geometry, camera, settings/record storage, drawing helpers |
| `js/looks.js` | Fighter outfits, tale of the tape, attributes, punch data, corner advice |
| `js/rig.js` | Cutout character rig: skeleton + IK, cel-shaded vector body parts, pose library |
| `js/fighter.js` | Movement, punches, defence, damage, knockdowns, and the animation layer that blends poses |
| `js/referee.js` | Referee movement, count and wave-off |
| `js/replay.js` | Records the last few seconds and plays back knockdowns in slow motion |
| `js/ai.js` | CPU opponent (Easy / Normal / Hard) |
| `js/getup.js` | Get-up orb minigame |
| `js/corner.js` | Between-rounds corner minigame (cutman + breathing) |
| `js/arena.js` | Crowd, lighting rig, ring, ropes |
| `js/fx.js` | Sweat, blood, sparks, callouts |
| `js/hud.js` | Health/stamina/clock HUD and every menu screen |
| `js/input.js` | Touch controls and keyboard |
| `js/audio.js` | Synthesised punches, bell, crowd and referee count |
| `js/game.js` | Fight flow, knockdown count, scoring, main loop |
