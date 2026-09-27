# Bare Knuckle

A bare knuckle boxing game for Android phones and tablets. It's built as an HTML5 canvas game, so it runs in Chrome with no install and no build step.

## Fighters

| | Michael McDonagh (you) | Baldy Can Box (CPU) |
|---|---|---|
| Top | Stained white tank top | Brown hoodie |
| Bottoms | Tracksuit bottoms | Jeans |
| Feet | Beige desert boots | Black shoes |
| Hands | Red hand wraps | Bare knuckles |

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Move around the ring | Drag anywhere on the left half of the screen | WASD / arrow keys |
| Jab (fast, 6 dmg) | JAB button | J |
| Cross (slow, 11 dmg) | CROSS button | K |
| Block (takes 15% damage) | Hold BLOCK | L |

Each fighter has 100 HP. The first to 0 is knocked out. Tap to rematch.

## Run it

- **Locally:** open `index.html` in a browser, or serve the folder with `python3 -m http.server` and open `http://<your-computer-ip>:8000` on your phone (same Wi-Fi).
- **On your phone permanently:** host the folder with GitHub Pages (Settings → Pages → deploy from branch), open the URL in Chrome on Android, then use ⋮ → *Add to Home screen*. It launches full screen in landscape.
- **Play Store (later):** wrap the same files with [Capacitor](https://capacitorjs.com/) to produce an Android app bundle.

## Files

- `index.html`: page shell, fonts, portrait "turn your phone" notice
- `game.js`: the whole game (ring, fighters, touch controls, CPU, health bars)
- `manifest.webmanifest`, `icon.svg`: home-screen install
