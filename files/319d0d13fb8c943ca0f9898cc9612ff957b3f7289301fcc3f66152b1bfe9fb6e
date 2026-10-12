# Yamaha C5 · lossless stereo samples

Salamander Grand Piano V3 by **Alexander Holm**, licensed under **CC BY 3.0**.
Source: https://github.com/sfzinstruments/SalamanderGrandPiano/tree/3382bf9496bba2486f5ab0de55a264d1dfc38404
License: https://creativecommons.org/licenses/by/3.0/ (full text in LICENSE.txt).

44 samples: 22 root notes (MIDI 33–96 at three-semitone intervals), two original velocity layers (8 and 12).
48 kHz, 24-bit, stereo **lossless FLAC**, not an MP3 transcode. The export trims leading silence, keeps up to
eight seconds of the natural recording, and fades only the final 200 ms of the stored tail. No per-note
normalization or added reverb. Playback applies the damper earlier when the musical note ends.

`samples.json` records the original filenames, pinned revision, and SHA-256 of the inputs and exports.
Rebuild with ffmpeg: `python3 songdiary/tools/build_piano_samples.py --cache /tmp/salamander-sources`.
Only the required notes are decoded for each round, with a 20-buffer cache cleared when the app is hidden.
The soft velocity layer supplies chords/UI notes; the firmer layer supplies the scale and keyboard.
