#!/usr/bin/env python3
"""Build upload-ready zips of Bubble Odyssey for game portals.

    python3 bubble/tools/package.py

Writes to bubble/dist/ (not committed):
  bubble-odyssey-crazygames.zip  ads on: loads the CrazyGames SDK (break ads, watch-an-ad rewards)
  bubble-odyssey-web.zip         no ads, for itch.io or any other plain web host

Each zip has index.html at the top and its own copy of PeerJS in lib/, because the portals host the game
on its own and can't reach ../road/lib/. The GitHub Pages copy is untouched and stays ad-free.
"""
import pathlib
import zipfile

BUBBLE = pathlib.Path(__file__).resolve().parent.parent
PEERJS = BUBBLE.parent / 'road' / 'lib' / 'peerjs.min.js'
DIST = BUBBLE / 'dist'
BUILDS = {
    'crazygames': {'portal': 'crazygames', 'manifest': False},
    'web': {'portal': '', 'manifest': True},
}


def page(portal, manifest):
    html = (BUBBLE / 'index.html').read_text(encoding='utf-8')
    setup = "window.BB_PEERJS = 'lib/peerjs.min.js?v=1';"
    if portal:
        setup += f" window.BB_PORTAL = '{portal}';"
    first = '<script src="js/core.js'
    assert first in html, 'index.html no longer loads js/core.js first'
    html = html.replace(first, f'<script>{setup}</script>\n{first}', 1)
    if not manifest:
        # portals run the game in a frame, so there's nothing to install
        html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
    return html


def build(name, portal, manifest):
    DIST.mkdir(exist_ok=True)
    out = DIST / f'bubble-odyssey-{name}.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('index.html', page(portal, manifest))
        for f in sorted((BUBBLE / 'js').glob('*.js')):
            z.write(f, f'js/{f.name}')
        z.write(BUBBLE / 'icon.svg', 'icon.svg')
        if manifest:
            z.write(BUBBLE / 'manifest.webmanifest', 'manifest.webmanifest')
        z.write(PEERJS, 'lib/peerjs.min.js')
    print(f'{out.relative_to(BUBBLE.parent)}  {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    for name, b in BUILDS.items():
        build(name, b['portal'], b['manifest'])
