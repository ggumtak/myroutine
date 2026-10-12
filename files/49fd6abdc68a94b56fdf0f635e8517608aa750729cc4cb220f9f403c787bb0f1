/* Offline stereo Yamaha C5 (Salamander Grand Piano V3, Alexander Holm, CC BY 3.0).
 * Load just the notes a round needs; a bounded cache is important when Android backgrounds the WebView.
 */
(function () {
'use strict';
const keys = Array.from({ length: 22 }, (_, i) => 33 + i * 3);
const nearest = midi => keys.reduce((a, k) => Math.abs(k - midi) < Math.abs(a - midi) ? k : a, keys[0]);
const layer = vol => vol >= 0.23 ? 12 : 8;
const id = (midi, vol) => `${nearest(midi)}v${layer(vol)}`;
const bank = {
  buf: new Map(), pending: new Map(), generation: 0, limit: 20,
  near: nearest,
  async load(ctx, notes = [48, 60, 64, 67], vol = 0.27) {
    const ids = [...new Set(notes.map(m => id(m, vol)))];
    await Promise.all(ids.map(k => {
      if (this.buf.has(k)) return;
      if (this.pending.has(k)) return this.pending.get(k);
      const generation = this.generation;
      const promise = (async () => {
        const r = await fetch(`piano/p${k}.flac`);
        if (!r.ok) throw new Error('piano ' + r.status);
        const buffer = await ctx.decodeAudioData(await r.arrayBuffer());
        if (generation !== this.generation) return;
        this.buf.set(k, buffer);
        while (this.buf.size > this.limit) this.buf.delete(this.buf.keys().next().value);
      })().finally(() => { if (this.pending.get(k) === promise) this.pending.delete(k); });
      this.pending.set(k, promise);
      return promise;
    }));
  },
  get(midi, vol) {
    const k = id(midi, vol), b = this.buf.get(k);
    if (b) { this.buf.delete(k); this.buf.set(k, b); }
    return b;
  },
  clear() { this.generation++; this.buf.clear(); this.pending.clear(); }
};
window.GrandPiano = bank;
})();
