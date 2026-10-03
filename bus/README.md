# Bus Driver

A game for young kids: drive the school bus, pick the kids up at the bus stops and take them to school. Plain HTML/JS like the boxing game (no build step, no audio files: every sound is made with Web Audio). Open `bus/index.html`; on GitHub Pages it's at `<pages-url>/bus/`.

**Controls** (big buttons on the dashboard; keyboard in brackets)

| Button | What it does |
|---|---|
| Engine (E) | Turn the key: starts or stops the engine. The bus won't move with it off. |
| Go (→) / Back (←) / Stop (↓ or Space) | Drive forward, reverse (with the reversing beeper), brake. |
| BEEP, in the middle of the steering wheel (hold H) | Horn. Kids waiting nearby jump and wave. |
| Open (O) / Close (C) | Doors. They only open when the bus has stopped; it won't drive with them open. |
| Wipers (W) | Wipers on/off. It rains now and then and the windows fill up with drops. |
| Radio (R), ⏭ (N) | Radio on/off and next song: The Wheels on the Bus, Twinkle Twinkle, Old MacDonald, Row Row Row Your Boat, Mary Had a Little Lamb. The kids bounce along. |

**How it plays.** Each day has 3 or 4 stops, then the school. Pull up so the door lines up with the yellow mark on the kerb (it turns green), stop, open the doors and the kids climb on and wave from the windows. At the school they get off, cross at the zebra crossing and go in; every kid delivered is a star (saved on the device). There's no way to fail. The button you need next pulses, so kids who can't read yet can follow along, and the bus slows down by itself as it gets near a stop.

**Players.** The title screen asks who's playing: 1 Kellan (blue) or 2 Alaina (pink). Each has their own bus stars, bus colour, star book and progress through the school games, all saved on the device. The 🏠 button (tap twice) goes back to choosing a player. The players are `PROFILES` at the top of `bus/js/school.js`.

**Inside the school.** After the kids go in, a *Go into school!* button takes you into the classroom: the kids you dropped off sit at their tables, the teacher's whiteboard says good morning, and a paper menu of today's work is on your desk.

- **My name:** colour in each letter of the name, one at a time, on handwriting lines. Each letter says its name and a picture word ("K is for kite", "E is for elephant"), then the name is spelt out ("K, E, L, L, A, N. That spells Kellan!") and a gold star goes into the **star book**. Every letter a-z has words, so any name works. The voice is recorded clips in `bus/audio/voice/` (a soft British English voice, speaking whole sentences), so it works the same on every phone. After changing the players or the word lists, regenerate them with `bus/tools/make_voice.py` (instructions at the top of it); until then the game falls back to the device's own speech voice for the missing clips.
- **Count the kids:** three rounds. First the kids you brought on the bus, then two sets of other things (apples, ducks...). Tap each one and the voice counts along; then pick how many from three numbers. A wrong pick just greys out.
- **Colour numbers:** colour in three numbers in a row, the same way as the name. After each one, that many things pop up and get counted ("one, two, three: three apples!"). Next time it carries on from the next number, round and round 1 to 10 (`NUMBERS_PER_GO` in `bus/js/school.js`).
- **Animals:** the animal's word is written up big and the voice says its name and its noise (or a clue, like the zebra's black and white stripes), then asks to find it out of three pictures. Six animals a go, working through all 17 (`ANIMALS` in `bus/js/school.js`).
- **Lunch time:** a lunch box in the player's colour has a shaped hole for each food: crackers, a yoghurt, a juice drink, apple slices and a slice of watermelon. Drag each food into its own shape; the voice names it as you pick it up, and the wrong hole just sends it back. If nothing happens for a few seconds a see-through copy slides into place to show how. Fill the box for a gold star (`LUNCH` in `bus/js/school.js`).
- Every finished activity puts a gold star in the star book, marked with what it was for.
- **One go each, then home time.** Each game on the menu can be played once per school day; once it's done it gets a tick and greys out, so the day keeps moving forward (quitting a game part way with ✕ doesn't use up its go). When all five are done the menu turns into a **Home time!** card with a ringing bell, and the only way on is the train.

**The train home** (`bus/js/train.js`). You drive a steam train home with the class in the carriage windows and yourself in the cab, through the afternoon into sunset. The dashboard swaps to train controls (keyboard in brackets):

| Button | What it does |
|---|---|
| Go (→) / Back (←) / Stop (↓ or Space) | Drive, reverse, brake. |
| Coal (C) | Shovel coal on the fire. The steam gauge round the whistle runs down as you go and the train slows as it drops; coal tops it up (with sparks from the chimney). |
| TOOT, in the middle (hold H or T) | The steam whistle. The cows moo back, the car at the level crossing beeps, the boat on the river toots, and the kids cheer. |
| Lights (L) | Headlamp and carriage lights. The tunnel is dark without them. |
| Bell (B) | Ding ding, and the kids cheer. |
| Rainbow (R) | Rainbow smoke. |
| Doors (O) | Only at the home platform: the kids get off and run to the grown-ups. |

Along the way: a field of cows, a level crossing whose barriers come down with flashing lights, a tunnel, a river bridge with a sailing boat, then the town and the home station. The train slows near the station and the buffers stop it gently, so it can't overshoot. Getting home is a gold star (🚂 in the star book), then *Next morning* goes back to the bus for a new day.
