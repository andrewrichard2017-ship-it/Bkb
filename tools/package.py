#!/usr/bin/env python3
"""Build upload-ready zips of the games for web game portals.

    python3 tools/package.py              all games
    python3 tools/package.py bubble road  just these (boxing, road, bubble)

Writes to dist/ (not committed), two zips per game:
  <game>-crazygames.zip   ads on: loads the CrazyGames SDK (break ads, watch-an-ad rewards)
  <game>-web.zip          no ads, for itch.io or any other plain web host

Each zip has index.html at the top and everything the game needs inside it (Bubble Odyssey gets its own
copy of PeerJS, which it normally borrows from ../road/lib/). The GitHub Pages copies stay ad-free: the
ads code only switches on when the page sets <PREFIX>_PORTAL, which only these zips do.
"""
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'

GAMES = {
    'boxing': {'dir': '.', 'prefix': 'BK', 'files': ['js/*.js', 'audio/*.mp3', 'icon.svg']},
    'road': {'dir': 'road', 'prefix': 'RR', 'files': ['js/*.js', 'lib/*', 'icon.svg']},
    'bubble': {'dir': 'bubble', 'prefix': 'BB', 'files': ['js/*.js', 'icon.svg'],
               'extra': {'lib/peerjs.min.js': 'road/lib/peerjs.min.js'}, 'setup': "window.BB_PEERJS = 'lib/peerjs.min.js?v=1';"},
}
BUILDS = {'crazygames': 'crazygames', 'web': ''}
MANIFEST = '<link rel="manifest" href="manifest.webmanifest">\n'


def page(game, portal):
    html = (ROOT / game['dir'] / 'index.html').read_text(encoding='utf-8')
    setup = game.get('setup', '')
    if portal:
        setup += f" window.{game['prefix']}_PORTAL = '{portal}';"
    if setup.strip():
        head = '</title>'
        assert head in html, 'index.html has no <title>'
        html = html.replace(head, f'{head}\n<script>{setup.strip()}</script>', 1)
    if portal:
        # portals run the game in a frame, so there's nothing to install
        html = html.replace(MANIFEST, '')
    return html


def build(name, game, build_name, portal):
    base = ROOT / game['dir']
    DIST.mkdir(exist_ok=True)
    out = DIST / f'{name}-{build_name}.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('index.html', page(game, portal))
        for pattern in game['files']:
            for f in sorted(base.glob(pattern)):
                if f.is_file():
                    z.write(f, f.relative_to(base).as_posix())
        if not portal and (base / 'manifest.webmanifest').exists():
            z.write(base / 'manifest.webmanifest', 'manifest.webmanifest')
        for dest, src in game.get('extra', {}).items():
            z.write(ROOT / src, dest)
    print(f'{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    names = sys.argv[1:] or list(GAMES)
    for n in names:
        for build_name, portal in BUILDS.items():
            build(n, GAMES[n], build_name, portal)
