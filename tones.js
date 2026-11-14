/* HeyTools alarm tones. One recipe per tone, used two ways:
   - in the browser: HeyTones.play(id) synthesises it with WebAudio (preview, and ringing while a page is open)
   - in the Android build: native/scripts/patch-android.js renders the same recipes to WAV files for notification sounds. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.HeyTones = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var N = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };
  /* event: t start (s), d length (s), f start Hz, f2 end Hz (optional sweep), w wave, g gain, k decay rate (higher = shorter ring) */
  function ev(t, d, f, w, g, k, f2) { return { t: t, d: d, f: f, f2: f2 || f, w: w || 'sine', g: g == null ? 0.6 : g, k: k == null ? 5 : k }; }
  function repeat(motif, period, total) { var out = []; for (var s = 0; s < total; s += period) motif.forEach(function (e) { if (s + e.t < total) out.push(Object.assign({}, e, { t: s + e.t })); }); return out; }
  var T = 9; // seconds per tone
  var LIST = [
    { id: 'classic', name: 'Classic bell', ev: function () { return repeat([ev(0, 0.9, 880, 'sine', 0.5, 4), ev(0, 0.9, 1760, 'sine', 0.25, 6), ev(0, 0.9, 2640, 'sine', 0.12, 9), ev(0.25, 0.9, 880, 'sine', 0.5, 4), ev(0.25, 0.9, 1760, 'sine', 0.25, 6)], 1.2, T); } },
    { id: 'digital', name: 'Digital beep', ev: function () { return repeat([ev(0, 0.12, 1000, 'square', 0.35, 1), ev(0.2, 0.12, 1000, 'square', 0.35, 1), ev(0.4, 0.12, 1000, 'square', 0.35, 1), ev(0.6, 0.12, 1000, 'square', 0.35, 1)], 1.4, T); } },
    { id: 'chime', name: 'Gentle chime', ev: function () { return repeat([ev(0, 1.2, N.C5, 'sine', 0.5, 3), ev(0.35, 1.2, N.E5, 'sine', 0.5, 3), ev(0.7, 1.2, N.G5, 'sine', 0.5, 3), ev(1.05, 1.6, N.C6, 'sine', 0.5, 2.5)], 3, T); } },
    { id: 'birds', name: 'Morning birds', ev: function () { return repeat([ev(0, 0.18, 2200, 'sine', 0.4, 2, 3400), ev(0.22, 0.18, 2600, 'sine', 0.4, 2, 3600), ev(0.46, 0.25, 2400, 'sine', 0.4, 2, 3900), ev(1.1, 0.15, 3000, 'sine', 0.35, 2, 2400), ev(1.3, 0.15, 3200, 'sine', 0.35, 2, 2600)], 2.4, T); } },
    { id: 'radar', name: 'Radar ping', ev: function () { return repeat([ev(0, 1.3, 700, 'sine', 0.7, 3.2), ev(0.02, 1.3, 1400, 'sine', 0.2, 5)], 1.6, T); } },
    { id: 'marimba', name: 'Marimba', ev: function () { return repeat([ev(0, 0.5, N.E5, 'triangle', 0.7, 7), ev(0.18, 0.5, N.G5, 'triangle', 0.7, 7), ev(0.36, 0.5, N.E5, 'triangle', 0.7, 7), ev(0.54, 0.5, N.C5, 'triangle', 0.7, 7), ev(0.9, 0.7, N.G5, 'triangle', 0.7, 6)], 2, T); } },
    { id: 'siren', name: 'Siren', ev: function () { return repeat([ev(0, 0.8, 600, 'sawtooth', 0.28, 0.2, 1200), ev(0.8, 0.8, 1200, 'sawtooth', 0.28, 0.2, 600)], 1.6, T); } },
    { id: 'pulse', name: 'Pulse', ev: function () { return repeat([ev(0, 0.14, 660, 'square', 0.3, 1.5), ev(0.18, 0.14, 880, 'square', 0.3, 1.5), ev(0.36, 0.14, 660, 'square', 0.3, 1.5), ev(0.54, 0.14, 880, 'square', 0.3, 1.5)], 1.2, T); } },
    { id: 'harp', name: 'Harp', ev: function () { var n = [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6]; return repeat(n.map(function (f, i) { return ev(i * 0.14, 1.4, f, 'sine', 0.5, 3.2); }), 2.6, T); } },
    { id: 'oldschool', name: 'Old school ring', ev: function () { var m = []; for (var i = 0; i < 16; i++) m.push(ev(i * 0.05, 0.05, i % 2 ? 1900 : 2100, 'square', 0.3, 0.5)); return repeat(m, 1.6, T); } },
    { id: 'sunrise', name: 'Sunrise', ev: function () { return [ev(0, 4, N.C4, 'sine', 0.45, 0.4), ev(1, 4, N.E4, 'sine', 0.4, 0.4), ev(2, 4, N.G4, 'sine', 0.4, 0.4), ev(4, 5, N.C5, 'sine', 0.45, 0.5), ev(5, 4, N.E5, 'sine', 0.4, 0.5), ev(6, 3, N.G5, 'sine', 0.4, 0.6)]; } },
    { id: 'melody', name: 'Soft melody', ev: function () { var seq = [[N.E5, 0], [N.D5, 0.4], [N.C5, 0.8], [N.D5, 1.2], [N.E5, 1.6], [N.E5, 2.0], [N.E5, 2.4]]; return repeat(seq.map(function (s) { return ev(s[1], 0.6, s[0], 'triangle', 0.55, 4); }), 3.6, T); } },
    { id: 'alert', name: 'Urgent alert', ev: function () { return repeat([ev(0, 0.25, 880, 'square', 0.3, 0.5), ev(0.3, 0.25, 880, 'square', 0.3, 0.5), ev(0.6, 0.25, 1175, 'square', 0.3, 0.5)], 1.2, T); } },
    { id: 'bowl', name: 'Zen bowl', ev: function () { return repeat([ev(0, 3, 220, 'sine', 0.6, 1.1), ev(0, 3, 440, 'sine', 0.25, 1.4), ev(0, 3, 660, 'sine', 0.12, 1.8)], 4.2, T); } }
  ];
  var byId = {}; LIST.forEach(function (t) { byId[t.id] = t; });

  /* ----- render to PCM (Node / build time) ----- */
  function render(id, rate) {
    rate = rate || 22050;
    var tone = byId[id] || LIST[0], events = tone.ev(), n = Math.floor(T * rate), buf = new Float32Array(n), peak = 0;
    events.forEach(function (e) {
      var s0 = Math.floor(e.t * rate), len = Math.min(n - s0, Math.floor((e.d + 0.05) * rate)), phase = 0;
      for (var i = 0; i < len; i++) {
        var t = i / rate, f = e.f + (e.f2 - e.f) * Math.min(1, t / e.d);
        phase += 2 * Math.PI * f / rate;
        var x = e.w === 'square' ? (Math.sin(phase) >= 0 ? 1 : -1) * 0.7 : e.w === 'sawtooth' ? ((phase / Math.PI) % 2 - 1) * 0.8 : e.w === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
        var env = Math.min(1, t / 0.006) * Math.exp(-e.k * t) * (t > e.d ? Math.max(0, 1 - (t - e.d) / 0.05) : 1);
        buf[s0 + i] += x * env * e.g;
      }
    });
    for (var j = 0; j < n; j++) if (Math.abs(buf[j]) > peak) peak = Math.abs(buf[j]);
    var gain = peak > 0 ? 0.92 / peak : 1, out = new Int16Array(n);
    for (var k = 0; k < n; k++) out[k] = Math.max(-32768, Math.min(32767, Math.round(buf[k] * gain * 32767)));
    return out;
  }
  function wav(id, rate) {
    rate = rate || 22050;
    var pcm = render(id, rate), data = Buffer.from(pcm.buffer), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  }

  /* ----- play in the browser ----- */
  var ctx = null, active = null;
  function audio() { var C = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null); if (!C) return null; if (!ctx) ctx = new C(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  /* play(id, {loop:true}) returns a stop() function */
  function play(id, opts) {
    opts = opts || {}; var a = audio(); if (!a) return function () {};
    stop();
    var tone = byId[id] || LIST[0], master = a.createGain(), nodes = [], timer = 0, stopped = false;
    master.gain.value = opts.volume == null ? 0.8 : opts.volume; master.connect(a.destination);
    function once() {
      var base = a.currentTime + 0.05;
      tone.ev().forEach(function (e) {
        var o = a.createOscillator(), g = a.createGain(), t0 = base + e.t;
        o.type = e.w; o.frequency.setValueAtTime(e.f, t0); if (e.f2 !== e.f) o.frequency.linearRampToValueAtTime(e.f2, t0 + e.d);
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(e.g * 0.8, t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, e.g * 0.8 * Math.exp(-e.k * e.d)), t0 + e.d);
        o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + e.d + 0.05); nodes.push(o);
      });
      if (opts.loop) timer = setTimeout(function () { if (!stopped) once(); }, (T - 0.2) * 1000);
      else timer = setTimeout(function () { stop(); }, (opts.seconds || 4) * 1000);
    }
    once();
    var s = function () { if (stopped) return; stopped = true; clearTimeout(timer); nodes.forEach(function (o) { try { o.stop(); } catch (e) { /* done */ } }); try { master.disconnect(); } catch (e) { /* done */ } if (active === s) active = null; };
    active = s; return s;
  }
  function stop() { if (active) active(); }
  return { list: LIST, byId: byId, render: render, wav: wav, play: play, stop: stop, seconds: T };
});
