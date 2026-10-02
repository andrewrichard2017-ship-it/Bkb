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

**Inside the school.** After the kids go in, a *Go into school!* button takes you into the classroom: the kids you dropped off sit at their tables, the teacher's whiteboard says good morning, and a paper menu of today's work is on your desk.

- **My name:** colour in each letter of the name, one at a time, on handwriting lines. Each letter says its sound and shows a picture (k for kite, e for egg, l for lion...). Then the whole name is sounded out and said, and a gold star goes into the **star book**. The name is `CHILD_NAME` at the top of `bus/js/school.js`; every letter a-z has a sound, so any name works. The voice is recorded clips in `bus/audio/voice/` (a British English voice, letters as pure sounds like "k" and "lll"), so it works the same on every phone. After changing the name or the word lists, regenerate them with `bus/tools/make_voice.py` (instructions at the top of it); until then the game falls back to the device's own speech voice for the missing clips.
- **Count the kids:** three rounds. First the kids you brought on the bus, then two sets of other things (apples, ducks...). Tap each one and the voice counts along; then pick how many from three numbers. A wrong pick just greys out.
- **Colour numbers:** colour in three numbers in a row, the same way as the name. After each one, that many things pop up and get counted ("one, two, three: three apples!"). Next time it carries on from the next number, round and round 1 to 10 (`NUMBERS_PER_GO` in `bus/js/school.js`).
- Every finished activity puts a gold star in the star book, marked with what it was for.
