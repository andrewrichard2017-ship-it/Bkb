# Bare Knuckle

A bare knuckle boxing game for Android phones and tablets. It's an HTML5 canvas game, so it runs in Chrome with no install and no build step.

> Also in this repo: **[Bus Driver](bus/)**, a separate game for young kids (`bus/index.html`). It shares nothing with the boxing game.

> **Content warning:** this game contains fictional violence: bare knuckle boxing, knockdowns, cuts, cartoon-style animated blood and strong language. All characters and events are fictional.

## Fighters

Pick any fighter for yourself and for the CPU on the main menu (tap the name to cycle). **Quick fight** is a single bout; **Tournament** runs you through everyone else in turn (Spade is the final boss). Your health carries over between tournament fights and you get +10% back after each win; lose (or draw) and you're out. If both corners pick the same man, the CPU gets alternate colours.

| | Kit | Style | Sway / special | Super punch |
|---|---|---|---|---|
| **Paddy Quinn** | Stained white tank top, tracksuit bottoms, beige desert boots, red hand wraps | Pressure fighter: fast, good stamina | Leans back | **Haymaker**: swung up from the hip into the jaw |
| **Tommy Brennan** | Brown hoodie, jeans, black shoes | Counter puncher: heavy hands, good chin | Leans back | **Sledgehammer**: overhand right, over the top |
| **Big Mossie** | White tank over a big belly, black trousers and boots, gold chain, white hair and handlebar moustache | Brawler: huge power, best chin, slow | Ducks and rolls | **Wrecking ball**: a huge looping swing |
| **Lanky Leo** | Shirtless, shorts, white shoes, skinhead | Speed merchant: fast hands and feet, light punches, best stamina recovery | **COMBO**: automatic jab-cross-left hook for 40% of his stamina (needs at least 40%) | **Superman punch**: leaps in behind a flying cross |
| **Spade** | Grey tank, black jeans, desert boots, slicked-back hair, long beard, knuckle dusters | Knockout artist: the most power, low stamina, slow feet | **No sway** | **Duster cross**: a big knuckle-duster cross, once per round |
| **Gerry Keane** | Stained white t-shirt, jeans, black boots, hair cropped right down, dark stubble, muck on his face | Dirty fighter: great stamina and chin, decent power, a heavy stumbling walk | **SPIT**: a gob in the eye and a rake across it, blinding him for a couple of seconds (he blocks worse and swings wild) | **Scalding kettle** (once a round): a kettle of boiling water in the face. Puts him down, and burns his right hand out of the fight for 14 seconds (no cross or uppercut) |

## Controls

**Controller** (PS5 DualSense / PS4 DualShock over Bluetooth or USB, or any standard pad): left stick or D-pad moves; ✕ jab, ○ cross, □ hook, △ uppercut; L1 clinch; hold R1 for a body shot; L2 sway/duck/combo; hold R2 to block; R3 super punch; Options opens the pause menu (resume, controls, sound, rumble, quit); any face button skips replays and the walkout. Every menu works with the D-pad or stick (a gold cursor moves over the buttons), ✕ selects and ○ goes back; on the title screen L1/R1 cycle the red/blue fighter and △ starts a tournament. Hits rumble the pad. The keyboard's arrow keys and Enter drive the menus the same way.

**Arenas:** tap ARENA on the menu to switch venue. THE HALL is the big fight-night arena. TYRE YARD is outdoors at night behind a tyre place, with no ring: they fight on the concrete among tools, drums and tyre piles about, a fire going in an oil drum, drizzle under the floodlights, and a few onlookers with their hoods up. The fighters walk out of the workshop shutters instead of down the ramps, and walk straight in with no ropes to duck through. THE HEAP is a meet on a gravel flat under a huge dark spoil heap on a grey day: no ring, a loose circle of lads in their everyday gear (arms folded, hands in pockets, a few filming), and each fighter walks in from beside a car parked at the edge of the site with its hazards flashing. The fight plays exactly the same in all three.

**Two players:** set PLAYERS to 2 on the menu. With two controllers, pad 1 is the red corner and pad 2 the blue; with one, the pad takes the blue corner and the touch screen / keyboard the red. Each player picks their own fighter (D-pad on their own pad), plays their own get-up bar and corner scene, and gets rumble on their own pad. Keyboard player 2: arrows move, 1-4 jab/cross/hook/upper, 5 sway, 6 clinch, hold 7 body, hold 8 block, 9 super. Tournaments are always one player against the CPU, and two-player results don't count toward your record.

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
| Super punch (opponent under 8% health) | SUPER (appears when ready) | O |
| Pause | ⏸ under the clock | P / Esc |

## How a fight works

- **Walkout.** Each fighter comes out of his lit entrance arch and walks down the ramp to his corner under a spotlight, ducks through the ropes and parades while the announcer calls him. The referee brings them to the centre to touch gloves, but one of them may refuse. Tap to skip.
- **The referee** counts knockdowns with a recorded voice (`audio/count-1.mp3` to `count-10.mp3`). He can also chip in with recorded lines at random moments, at most twice a round, but there are none at the moment: add an mp3 to `audio/` and list it in `REF_LINES` (`js/game.js`) and `CLIPS` (`js/audio.js`). 

- **Stamina.** Every punch costs stamina; missing costs more. A tired fighter punches slower and weaker and his hands drop.
- **Defence.** Blocking stops most of a jab or cross, but hooks and uppercuts partly break the guard. Swaying costs 15 stamina (more than any punch) and always comes back with a punch: a cross off the lean-back, a hook out of the duck-and-roll. If the sway made him miss, that punch lands as a counter. Leaning back and ducking both avoid head shots; a duck-and-roll sets up a bigger counter but walks straight into an uppercut. Neither gets you out of the way of a body shot.
- **Counters.** Land a punch while your opponent is mid-punch, or straight after a slip, for 1.6× damage.
- **Body shots.** Hold BODY and throw any punch to go to the ribs. Little damage to health, but they drain stamina hard, get through a high guard more easily, and every one slows the opponent's stamina recovery for the rest of the fight.
- **Clinch.** Tap CLINCH up close to grab. The reach-in can be **blocked** (you're pushed off) or **slipped** ("swayed", and he gets a counter). Locked up, punches become short body digs that do light damage and **can never knock anyone down**. Hold BLOCK in the clinch to tie his arms up and smother the digs. The grabber gets his breath back; the referee breaks it after a few seconds.
- **Super punch.** When your opponent drops under 8% health a glowing **SUPER** button appears. It throws that fighter's own finisher (see the table above), aimed at the other man's head, that can't be blocked (but can be slipped or missed); if it lands it's a guaranteed knockdown, and the count decides the rest. The CPU always beats the count the first two times it goes down; after that the odds fall (about 75%, 50%, 30%, then 15%). Three knockdowns in one round is still a TKO. The CPU uses its super on you too: when you're under 8% health a red warning appears, and after a short pause it lets its finisher go (more often on harder difficulties), so be ready to sway it.
- **Replays.** Every knockdown and knockout is replayed TV-style: slow motion through the impact, a tilted close-up camera, letterbox bars. Tap to skip.
- **Combos.** Taps are queued (up to three) and thrown as soon as possible. Once a punch lands you can chain the next one before the arm comes back: switching hands is quickest. The punch buttons flash gold when the next punch is ready, and chained punches hit a little harder.
- **Cuts.** As the face takes damage, cuts open (brow, nose, lip, cheek, forehead) and keep bleeding for the rest of the fight.
- **Hurt.** A fighter below ~28 HP can be staggered by power shots and becomes easier to finish.
- **Rocked.** Once a fighter is down to 15% health, every clean hit he takes rocks the picture. Each one lands with a punch-in (the camera lurches in on him with a flash and a split second of slow motion, and his ears ring), then the camera tilts and sways, the screen swims with blurred double vision, the edges close in like tunnel vision, the crowd goes muffled and a heartbeat thumps. It stacks: the first hit rocks him for about 2.5 seconds and each follow-up adds more (up to 6), and the lower his health the harder it hits. A standing count rocks the picture the same way until he clears his head. Getting hold of him gets you out of it: land a **clinch** while you're on 15% or less and you hang on and come back up to 20% (once a round). The CPU does it too.
- **Knockdowns.** At 0 HP it's a coin toss between going down and a **standing count**: he stays on his feet, out of it and swaying with his hands down, while the referee jumps in and counts (the screen rocks and blurs until he clears his head). Both are knockdowns and use the same get-up bar; counted out on his feet, he collapses. A super always puts him on the floor, and so does a knockdown that would be the third of the round. For a knockdown on the floor the referee counts. To beat the count, a marker sweeps along a bar: **press ✕ (or Space/Enter, or tap anywhere) while it's in the gold zone**. Each hit lifts you further up and moves the zone; a miss knocks you back a step and briefly locks you out, so mashing doesn't work. The first two knockdowns are forgiving (wide zone, slow marker, 2 then 3 hits). From the third, the zone shrinks, the marker speeds up and you need more hits. Every knockdown also lowers your maximum health for the rest of the fight. **Three knockdowns in one round is a TKO.**
- **After a knockout.** If the loser is left on the floor, a 10-second cut scene plays before the result: the winner stands over him shouting "FIGHT FUCKING NOW!" and keeps putting the boot in with stamps, kicks and punches on the ground. Tap (or any button) to skip it. It doesn't play after a points decision.
- **Rounds.** 90-second rounds (1, 3 or 5). Between rounds your corner shows fight stats, the judges' scorecards and advice.
- **Corner.** Between rounds both fighters recover some health. Go *To the corner* for a 15-second scene on the stool and pick one boost: **dip your hands in diesel** (+5% power), **take a few slaps** (+7% chin) or **drink a beer** (+10% stamina). Boosts stack for the rest of the fight and show under your name. Baldy's corner picks one too.
- **Scoring.** Three judges score each round on the 10-point must system: 10-9 to the round winner, and a point off for every knockdown. Fights that go the distance end in a unanimous, split or majority decision, or a draw.
- **Light and depth.** Each venue has its own light: the hall's overhead rig, the yard's floodlights off to the sides, the heap's flat overcast sky. Fighters throw a soft shadow along the floor that leans away from it, plus a pool under their feet.
- **Camera.** Hand-held: it follows the action on a spring with a little lag and overshoot, drifts and breathes while it waits, and takes a jolt on big hits and a whip when someone goes down (on top of the rocked-state effects). It steadies on the menus.
- **Sound.** Synthesised punches, bell and crowd, a recorded referee count, and a voice for each fighter: several different grunts when throwing, when hit (head, body, big shots) and a groan on a knockdown. Voices are brighter and louder for the man nearer the camera. Footsteps match the floor (canvas thuds in the hall, scuffs on the yard's concrete, crunching gravel at the heap). The crowd reacts to what actually happens: a sharp gasp on a counter or a knockdown before the roar, an "oooh" when a big one lands on a hurt man, the odd shout, and jeers and whistles when something dirty happens (a spit, an eye rake, the kettle).
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
| `js/getup.js` | Get-up rhythm bar |
| `js/walkout.js` | Walkouts, announcer and touching gloves before round 1 |
| `js/corner.js` | Between-rounds corner scene: diesel, slaps or a beer |
| `js/arena.js` | The hall (crowd, lighting rig, ring, ropes) and the venue switch |
| `js/yard.js` | The tyre yard venue |
| `js/heap.js` | The heap venue |
| `js/fx.js` | Sweat, blood, sparks, callouts |
| `js/hud.js` | Health/stamina/clock HUD and every menu screen |
| `js/input.js` | Touch controls and keyboard |
| `js/audio.js` | Synthesised punches, bell and crowd; recorded referee lines and count |
| `js/game.js` | Fight flow, knockdown count, scoring, main loop |

## Licence

Copyright (c) 2026 Andrew Richard and contributors. Released under the [PolyForm Strict License 1.0.0](LICENSE), which covers the code, art and recorded audio.

In short: you may play it and read the code for personal, non-commercial purposes. You may **not** modify it, build new works from it, redistribute it or sell it. For any other use, ask the owner for permission.

## Performance

The game draws at a capped resolution (at most about 1920 canvas pixels across, and no more than 1.5x the screen's CSS pixels). Past that there's no visible gain on a phone, only more pixels to fill. While you play it watches the frame time: if it's running well under 60 fps it steps the resolution down (not below about three quarters), and after a long smooth run it tries stepping back up. The canvas is opaque, which saves the browser a compositing pass.
