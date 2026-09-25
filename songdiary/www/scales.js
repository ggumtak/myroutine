/* 노래일기 — scale practice: the exercises vocal teachers use, note names, and pitch detection for '내 음 보기' */
(function () {
'use strict';

/* steps are semitones above the note you pressed, which counts as 도 (movable do) */
const PRESETS = [
  { id: 'five', name: '5음 스케일', steps: [0, 2, 4, 5, 7, 5, 4, 2, 0] },
  { id: 'three', name: '3음 스케일', steps: [0, 2, 4, 2, 0] },
  { id: 'arp', name: '아르페지오', steps: [0, 4, 7, 4, 0] },
  { id: 'octarp', name: '옥타브 아르페지오', steps: [0, 4, 7, 12, 7, 4, 0] },
  { id: 'octrep', name: '옥타브 반복', steps: [0, 4, 7, 12, 12, 12, 12, 12, 7, 4, 0] },
  { id: 'nine', name: '9음 스케일', steps: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0] },
  { id: 'octjump', name: '옥타브 점프', steps: [0, 12, 0] },
  { id: 'minor', name: '단조 5음', steps: [0, 2, 3, 5, 7, 5, 3, 2, 0] }
];
const SOLFA = ['도', '도#', '레', '미♭', '미', '파', '파#', '솔', '솔#', '라', '시♭', '시'];
/* a step as sung from 도: 0 → 도, 7 → 솔, 12 → 높은도, -1 → 낮은시 */
function degName(off) {
  const pc = ((off % 12) + 12) % 12, oct = Math.floor(off / 12);
  return (oct > 0 ? '높은' : oct < 0 ? '낮은' : '') + SOLFA[pc];
}
/* the buttons for building your own exercise */
const BUILD_KEYS = [-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];

/* ---------- pitch detection (YIN) for the singer's voice ---------- */
/* buf: Float32Array of samples; returns frequency in Hz, or null for silence / no clear pitch */
function detectPitch(buf, sr, minF = 65, maxF = 1100) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.012) return null;
  const maxLag = Math.min(Math.floor(sr / minF), buf.length >> 1), minLag = Math.max(2, Math.floor(sr / maxF));
  const W = buf.length - maxLag - 1;
  const d = new Float32Array(maxLag + 2);
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const x = buf[j] - buf[j + tau]; s += x * x; }
    d[tau] = s;
  }
  /* cumulative mean normalised difference */
  let run = 0;
  d[0] = 1;
  for (let tau = 1; tau <= maxLag + 1; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < 0.15) { while (t + 1 <= maxLag && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  const x0 = d[tau - 1], x1 = d[tau], x2 = d[tau + 1];
  const den = x0 + x2 - 2 * x1;
  const t = den ? tau + (x0 - x2) / (2 * den) : tau;
  return sr / t;
}
const midiOf = f => 69 + 12 * Math.log2(f / 440);

window.ScaleKit = { PRESETS, SOLFA, degName, BUILD_KEYS, detectPitch, midiOf };
})();
