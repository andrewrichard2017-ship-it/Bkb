# Working on this repo

More than one person edits this game, sometimes with other AI tools (e.g. ChatGPT) or directly on GitHub.

- **Before changing anything**, fetch and pull the latest from GitHub (`git fetch --all` then `git pull --ff-only`), and tell the owner if there are new commits from someone else and what they changed.
- **Before pushing**, fetch again. If GitHub moved on while you were working, merge those changes in (never force-push, never discard someone else's commits) and re-test.
- If someone else's change breaks the game, say so and fix it forward rather than reverting their work without asking.
- The game is plain HTML/JS with no build step: open `index.html`, scripts are in `js/`, recorded audio in `audio/`.
