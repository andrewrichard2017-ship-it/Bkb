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
VOICE, LANG = 'bf_emma', 'en-gb'  # a British English voice

# Pure letter sounds (no "uh" after them), as phonetic symbols: stretched for sounds you can hold.
SOUNDS = {'a': 'a', 'b': 'b', 'c': 'k', 'd': 'd', 'e': 'ɛ', 'f': 'fː', 'g': 'ɡ', 'h': 'h', 'i': 'ɪ', 'j': 'ʤ', 'k': 'k',
          'l': 'lː', 'm': 'mː', 'n': 'nː', 'o': 'ɒ', 'p': 'p', 'q': 'kw', 'r': 'ɹː', 's': 'sː', 't': 't', 'u': 'ʌ',
          'v': 'vː', 'w': 'w', 'x': 'ks', 'y': 'j', 'z': 'zː'}
NUMS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']


def read_game():
    src = open(os.path.join(ROOT, 'js', 'school.js'), encoding='utf-8').read()
    name = re.search(r"const CHILD_NAME = '([^']+)'", src).group(1)
    phon = src[src.index('const PHONICS'):src.index('const CRAYONS')]
    words = re.findall(r"\['([a-z\- ]+)', '[^']+'\]", phon)
    block = src[src.index('const COUNT_THINGS'):src.index('const NUMBERS_PER_GO')]
    things = re.findall(r"\['[^']+', '([a-z ]+)', '([a-z ]+)'\]", block)
    return name, words, things


def clips():
    name, words, things = read_game()
    c = {}
    for l, ph in SOUNDS.items(): c['s_' + l] = ('ph', ph)
    for w in words: c['w_' + w] = ('tx', w + '!')
    for n in range(1, 11): c['n_%d' % n] = ('tx', NUMS[n] + '.')
    for one, many in things + [('kid', 'kids')]:
        c['t_' + one] = ('tx', one + '!'); c['t_' + many] = ('tx', many + '!')
        c['p_how_' + many] = ('tx', 'How many %s? Tap each one to count!' % many)
        c['p_so_' + many] = ('tx', 'So how many %s are there?' % many)
    c['p_how_kids'] = ('tx', 'How many kids came to school on the bus? Tap each one to count!')
    c['p_yes'] = ('tx', 'Yes!')
    c['p_nope'] = ('tx', 'Not that one. Have another go!')
    c['name'] = ('tx', name + '!')
    c['name_slow'] = ('slow', name)
    c['p_star_name'] = ('tx', 'Well done, %s! You get a gold star!' % name)
    c['p_star_numbers'] = ('tx', 'Brilliant counting, %s! You get a gold star!' % name)
    c['p_star_count'] = ('tx', 'Great counting, %s! You get a gold star!' % name)
    return name, c


def trim(a, sr):
    loud = np.where(np.abs(a) > 0.02)[0]
    if not len(loud): return a
    pad = int(0.04 * sr)
    return a[max(0, loud[0] - pad):loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    args = ap.parse_args()
    k = Kokoro(args.model, args.voices)
    name, c = clips()
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.mp3'): os.remove(os.path.join(OUT, f))
    with tempfile.TemporaryDirectory() as tmp:
        for key, (kind, text) in c.items():
            if kind == 'ph': a, sr = k.create(text, voice=VOICE, speed=0.8, is_phonemes=True)
            else: a, sr = k.create(text, voice=VOICE, speed=0.55 if kind == 'slow' else 0.9, lang=LANG)
            wav = os.path.join(tmp, 'c.wav'); sf.write(wav, trim(a, sr), sr)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '48k',
                            os.path.join(OUT, key + '.mp3')], check=True)
            print(key, '-', text)
    json.dump({'name': name, 'voice': VOICE, 'clips': sorted(c)}, open(os.path.join(OUT, 'clips.json'), 'w'), indent=0)
    print(len(c), 'clips for', name)


if __name__ == '__main__':
    main()
