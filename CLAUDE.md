# Working on this repo

More than one person edits this game, sometimes with other AI tools (e.g. ChatGPT) or directly on GitHub.

- **Checking GitHub:** fetch and pull the latest (`git fetch --all` then `git pull --ff-only`) **at most once every two days** while working on the code, not before every change. When you do, tell the owner if there are new commits from someone else and what they changed. (Tip: `git log -1 --format=%cr origin/<branch>` and the age of `.git/FETCH_HEAD` show when it was last checked.)
- **Pushing:** never force-push and never discard someone else's commits. If a push is rejected because GitHub moved on, merge those changes in, then push.
- If someone else's change breaks the game, say so and fix it forward rather than reverting their work without asking.
- **Testing:** don't run the game in a browser to confirm every change. Only do it when the owner asks, when they report a problem, or when a change is complex enough that it's genuinely needed. A quick syntax check is fine: `for f in js/*.js; do node --check "$f"; done` (`node --check js/*.js` only checks the first file).
- The game is plain HTML/JS with no build step: open `index.html`, scripts are in `js/`, recorded audio in `audio/`.
- **Cache-busting:** after changing any file in `js/` or `audio/`, bump the `?v=` number on the script tags in `index.html` and on the clip URL in `js/audio.js`, or phones may keep running the old copy.
