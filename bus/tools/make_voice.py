#!/usr/bin/env python3
"""Make the recorded voice clips for the school games (bus/audio/voice/).

The game speaks by playing these clips, so it sounds the same on every device and doesn't
depend on the phone having a speech voice (Android in-app browsers, including the Claude app,
have none). The words, numbers, things to count and the child's name are read from
bus/js/school.js, so after changing CHILD_NAME or the word lists, run this again.

Setup (once), then run from the repo root:
  python3 -m venv /tmp/tts && /tmp/tts/bin/pip install kokoro-onnx soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  /tmp/tts/bin/python bus/tools/make_voice.py --model kokoro-v1.0.int8.onnx --voices voices-v1.0.bin
Needs ffmpeg for the mp3s. Then bump VOICE_VERSION in bus/js/school.js.
"""
import argparse, json, os, re, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio', 'voice')
VOICE, LANG = 'bf_isabella', 'en-gb'  # a soft British English voice; --voice picks another (or a mix, "bf_emma:0.5,af_heart:0.5")
SPEED = 1.0  # natural talking speed: slower than this sounds robotic
NUMS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']


def read_game():
    src = open(os.path.join(ROOT, 'js', 'school.js'), encoding='utf-8').read()
    name = re.search(r"const CHILD_NAME = '([^']+)'", src).group(1)
    block = src[src.index('const LETTERS'):src.index('const NUM_WORDS')]
    letters = {}
    for m in re.finditer(r"^\s*([a-z]): \{ name: '([^']+)', words: \[(.*?)\]\](, phrase: '(\w+)')?", block, re.M):
        letters[m.group(1)] = (m.group(2), re.findall(r"\['([a-z\- ]+)', '[^']+'", m.group(3) + ']'), m.group(5) or 'for')
    block = src[src.index('const COUNT_THINGS'):src.index('const NUMBERS_PER_GO')]
    things = re.findall(r"\['[^']+', '([a-z ]+)', '([a-z ]+)'\]", block)
    block = src[src.index('const ANIMALS ='):src.index('const ANIMALS_PER_GO')]
    animals = re.findall(r"\{ name: '([a-z]+)', pic: '[^']+', say: \"([^\"]+)\" \}", block)
    return name, letters, things, animals


def clips():
    name, letters, things, animals = read_game()
    c = {}
    for l, (spoken, words, phrase) in letters.items():
        c['l_' + l] = spoken.capitalize() + '!'
        for w in words: c['f_%s_%s' % (l, w)] = '%s is %s %s!' % (spoken.capitalize(), phrase, w)
    for n in range(1, 11):
        c['n_%d' % n] = NUMS[n].capitalize() + '!'
        c['p_yes_%d' % n] = 'Yes! %s!' % NUMS[n].capitalize()
        one, many = things[(n - 1) % len(things)]
        c['c_%d' % n] = '%s %s!' % (NUMS[n].capitalize(), one if n == 1 else many)
    for one, many in things + [('kid', 'kids')]:
        c['p_how_' + many] = 'How many %s? Tap each one to count!' % many
        c['p_so_' + many] = 'So, how many %s are there?' % many
    c['p_how_kids'] = 'How many kids came to school on the bus? Tap each one to count!'
    c['p_nope'] = 'Not that one. Have another go!'
    for a, line in animals:
        c['an_' + a] = line
        c['ar_' + a] = "Yes! That's the %s!" % a
        c['aw_' + a] = "That's the %s." % a
    c['p_again'] = 'Have another go!'
    c['p_star_animals'] = 'Brilliant, %s! You know your animals! You get a gold star!' % name
    c['p_spells'] = 'That spells %s!' % name
    c['p_star_name'] = 'Well done, %s! You get a gold star!' % name
    c['p_star_numbers'] = 'Brilliant counting, %s! You get a gold star!' % name
    c['p_star_count'] = 'Great counting, %s! You get a gold star!' % name
    return name, c


def voice_style(k, spec):
    if ':' not in spec: return spec
    mix = 0
    for part in spec.split(','):
        v, w = part.split(':')
        mix = mix + k.get_voice_style(v) * float(w)
    return mix


def trim(a, sr):
    loud = np.where(np.abs(a) > 0.02)[0]
    if not len(loud): return a
    pad = int(0.04 * sr)
    return a[max(0, loud[0] - pad):loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default=VOICE); ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    k = Kokoro(args.model, args.voices)
    style = voice_style(k, args.voice)
    lang = 'en-gb' if args.voice.startswith('b') else 'en-us'
    name, c = clips()
    os.makedirs(args.out, exist_ok=True)
    for f in os.listdir(args.out):
        if f.endswith('.mp3'): os.remove(os.path.join(args.out, f))
    with tempfile.TemporaryDirectory() as tmp:
        for key, text in c.items():
            a, sr = k.create(text, voice=style, speed=SPEED, lang=lang)
            wav = os.path.join(tmp, 'c.wav'); sf.write(wav, trim(a, sr), sr)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '48k',
                            os.path.join(args.out, key + '.mp3')], check=True)
            print(key, '-', text)
    json.dump({'name': name, 'voice': args.voice, 'clips': sorted(c)}, open(os.path.join(args.out, 'clips.json'), 'w'), indent=0)
    print(len(c), 'clips for', name)


if __name__ == '__main__':
    main()
