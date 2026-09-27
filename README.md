# Bare Knuckle

A bare knuckle boxing game for Android phones and tablets. It's an HTML5 canvas game, so it runs in Chrome with no install and no build step.

## Fighters

Pick any fighter for yourself and for the CPU on the main menu (tap the name to cycle). **Quick fight** is a single bout; **Tournament** runs you through everyone else in turn (Digger is the final boss). Your health carries over between tournament fights and you get +10% back after each win; lose (or draw) and you're out. If both corners pick the same man, the CPU gets alternate colours.

| | Kit | Style | Sway / special |
|---|---|---|---|
| **Michael McD** | Stained white tank top, tracksuit bottoms, beige desert boots, red hand wraps | Pressure fighter: fast, good stamina | Leans back |
| **John Joe** | Brown hoodie, jeans, black shoes | Counter puncher: heavy hands, good chin | Leans back |
| **Big Joe** | White tank over a big belly, black trousers and boots, gold chain, white hair and handlebar moustache | Brawler: huge power, best chin, slow | Ducks and rolls |
| **Skinny Arthur** | Shirtless, shorts, white shoes, skinhead | Speed merchant: fast hands and feet, light punches, best stamina recovery, **can't clinch** | **COMBO**: automatic jab-cross-left hook for 40% of his stamina (needs at least 40%) |
| **Digger** | Grey tank, black jeans, desert boots, slicked-back hair, long beard, knuckle dusters | Knockout artist: the most power, low stamina, slow feet | **No sway.** His super is a knuckle-duster uppercut, once per round |

## Controls

**Controller** (PS5 DualSense / PS4 DualShock over Bluetooth or USB, or any standard pad): left stick or D-pad moves; ✕ jab, ○ cross, □ hook, △ uppercut; L1 sway/duck/combo; R1 clinch; hold L2 block, hold R2 body shot; R3 (or L1+R1) super punch; Options pauses; any face button skips replays and the walkout. On the menu the D-pad picks your fighter and L1/R1 the CPU's; ✕ starts a quick fight, △ a tournament. In the corner ✕ / ○ / □ pick diesel / slaps / beer. Hits rumble the pad.

**Touch and keyboard:**


| Action | Touch | Keyboard |
|---|---|---|
| Move | Drag anywhere on the left half | WASD / arrows |
| Jab / Cross | JAB / CROSS | J / K |
| Hook / Uppercut | HOOK / UPPER | U / I |
| Body shot (hold, then punch) | BODY | hold B |
| Clinch | CLINCH | C |
| Block (hold) | BLOCK | L |
| Sway (lean back or duck & roll, by fighter) | SWAY / DUCK | Space |
| Super punch (opponent under 5% health) | SUPER (appears when ready) | O |
| Pause | ⏸ under the clock | P / Esc |

## How a fight works

- **Walkout.** Each fighter comes out of his lit entrance arch and walks down the ramp to his corner under a spotlight, ducks through the ropes and parades while the announcer calls him. The referee brings them to the centre to touch gloves, but one of them may refuse. Tap to skip.
- **The referee** chips in at random moments, at most twice a round, with recorded lines (`audio/`): "Come on boys, fair knock", "Come on boys, few shlaaaps and then few pints later", "Come on boys, call it a draw now", 

- **Stamina.** Every punch costs stamina; missing costs more. A tired fighter punches slower and weaker and his hands drop.
- **Defence.** Blocking stops most of a jab or cross, but hooks and uppercuts partly break the guard. Swaying costs 15 stamina (more than any punch) and always comes back with a punch: a cross off the lean-back, a hook out of the duck-and-roll. If the sway made him miss, that punch lands as a counter. Leaning back and ducking both avoid head shots; a duck-and-roll sets up a bigger counter but walks straight into an uppercut. Neither gets you out of the way of a body shot.
- **Counters.** Land a punch while your opponent is mid-punch, or straight after a slip, for 1.6× damage.
- **Body shots.** Hold BODY and throw any punch to go to the ribs. Little damage to health, but they drain stamina hard, get through a high guard more easily, and every one slows the opponent's stamina recovery for the rest of the fight.
- **Clinch.** Tap CLINCH up close to grab. The reach-in can be **blocked** (you're pushed off) or **slipped** ("swayed", and he gets a counter). Locked up, punches become short body digs that do light damage and **can never knock anyone down**. Hold BLOCK in the clinch to tie his arms up and smother the digs. The grabber gets his breath back; the referee breaks it after a few seconds.
- **Super punch.** When your opponent drops under 5% health a glowing **SUPER** button appears. It throws a loaded overhand that can't be blocked (but can be slipped or missed); if it lands it's a guaranteed knockdown, and the count decides the rest. The CPU always beats the count the first two times it goes down; after that the odds fall (about 75%, 50%, 30%, then 15%). Three knockdowns in one round is still a TKO.
- **Replays.** Every knockdown and knockout is replayed TV-style: slow motion through the impact, a tilted close-up camera, letterbox bars. Tap to skip.
- **Combos.** Taps are queued (up to three) and thrown as soon as possible. Once a punch lands you can chain the next one before the arm comes back: switching hands is quickest. The punch buttons flash gold when the next punch is ready, and chained punches hit a little harder.
- **Cuts.** As the face takes damage, cuts open (brow, nose, lip, cheek, forehead) and keep bleeding for the rest of the fight.
- **Hurt.** A fighter below ~28 HP can be staggered by power shots and becomes easier to finish.
- **Knockdowns.** At 0 HP a fighter goes down and the referee counts. To beat the count, **tap each orb as the closing ring meets it**. Perfect or good timing lifts you up; mistimed taps knock you back a step. Each knockdown needs more orbs and gives you less time, and lowers your maximum health for the rest of the fight. **Three knockdowns in one round is a TKO.**
- **Rounds.** 90-second rounds (1, 3 or 5). Between rounds your corner shows fight stats, the judges' scorecards and advice.
- **Corner.** Between rounds both fighters recover some health. Go *To the corner* for a 15-second scene on the stool and pick one boost: **dip your hands in diesel** (+5% power), **take a few slaps** (+7% chin) or **drink a beer** (+10% stamina). Boosts stack for the rest of the fight and show under your name. Baldy's corner picks one too.
- **Scoring.** Three judges score each round on the 10-point must system: 10-9 to the round winner, and a point off for every knockdown. Fights that go the distance end in a unanimous, split or majority decision, or a draw.
- **Sound.** Synthesised punches, bell, crowd, referee count, and a voice for each fighter: several different grunts when throwing, when hit (head, body, big shots) and a groan on a knockdown.
- **Blood and sweat.** Sweat builds up over the fight; blood from cuts soaks into tops and trousers, and a bleeding opponent leaves his blood on you.
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
| `audio/` | Recorded referee lines |
| `js/core.js` | Namespace, ring geometry, camera, settings/record storage, drawing helpers |
| `js/looks.js` | Fighter outfits, tale of the tape, attributes, punch data, corner advice |
| `js/rig.js` | Cutout character rig: skeleton + IK, cel-shaded vector body parts, pose library |
| `js/fighter.js` | Movement, punches, defence, damage, knockdowns, and the animation layer that blends poses |
| `js/referee.js` | Referee movement, count and wave-off |
| `js/replay.js` | Records the last few seconds and plays back knockdowns in slow motion |
| `js/ai.js` | CPU opponent (Easy / Normal / Hard) |
| `js/getup.js` | Get-up orb minigame |
| `js/walkout.js` | Walkouts, announcer and touching gloves before round 1 |
| `js/corner.js` | Between-rounds corner scene: diesel, slaps or a beer |
| `js/arena.js` | Crowd, lighting rig, ring, ropes |
| `js/fx.js` | Sweat, blood, sparks, callouts |
| `js/hud.js` | Health/stamina/clock HUD and every menu screen |
| `js/input.js` | Touch controls and keyboard |
| `js/audio.js` | Synthesised punches, bell, crowd and referee count |
| `js/game.js` | Fight flow, knockdown count, scoring, main loop |
