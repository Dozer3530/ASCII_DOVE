/* ==========================================================================
   ASCII_DOVE — anim.js
   Per-parameter LFO modulation.

   A binding drives one animatable parameter from a waveform. The base value
   stays whatever the slider says; the LFO rides on top of it, so you can keep
   dialling a control while it's moving.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  var TAU = Math.PI * 2;

  /* --- waveforms — all return [-1, 1] over phase p in [0, 1) --------------- */

  function smoothNoise(x, seed) {
    var i = Math.floor(x), f = x - i;
    var a = hash(i, seed), b = hash(i + 1, seed);
    var t = f * f * (3 - 2 * f);            // smoothstep
    return (a + (b - a) * t) * 2 - 1;
  }

  function hash(n, seed) {
    var h = (n * 374761393 + (seed | 0) * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  var WAVES = {
    sine: function (p) { return Math.sin(p * TAU); },
    triangle: function (p) { return 4 * Math.abs(p - Math.floor(p + 0.5)) - 1; },
    saw: function (p) { return 2 * (p - Math.floor(p)) - 1; },
    ramp: function (p) { return 1 - 2 * (p - Math.floor(p)); },
    square: function (p) { return (p - Math.floor(p)) < 0.5 ? 1 : -1; },
    pulse: function (p) { return (p - Math.floor(p)) < 0.25 ? 1 : -1; },
    exp: function (p) { var t = p - Math.floor(p); return Math.pow(t, 3) * 2 - 1; },
    bounce: function (p) { return Math.abs(Math.sin(p * Math.PI)) * 2 - 1; },
    noise: function (p, seed) { return smoothNoise(p * 4, seed || 1); },
    steps: function (p, seed) { var t = p - Math.floor(p); return hash(Math.floor(t * 8), seed || 1) * 2 - 1; },
    random: function (p, seed) { return smoothNoise(p * 16, seed || 1); }
  };

  var WAVE_LIST = [
    { value: 'sine', label: 'Sine' },
    { value: 'triangle', label: 'Triangle' },
    { value: 'saw', label: 'Saw' },
    { value: 'ramp', label: 'Ramp down' },
    { value: 'square', label: 'Square' },
    { value: 'pulse', label: 'Pulse 25%' },
    { value: 'exp', label: 'Exponential' },
    { value: 'bounce', label: 'Bounce' },
    { value: 'noise', label: 'Smooth noise' },
    { value: 'steps', label: 'Stepped random' },
    { value: 'random', label: 'Fast noise' }
  ];

  function defaultBinding() {
    return {
      enabled: true,
      wave: 'sine',
      rate: 0.25,      // cycles per second
      amount: 0.4,     // fraction of the parameter's full range
      phase: 0,        // 0..1
      mode: 'add',     // 'add' rides on the slider; 'sweep' ignores it
      seed: 1
    };
  }

  /* --- evaluation ---------------------------------------------------------- */

  /**
   * Produce a state object with every enabled binding applied at time t.
   * The base state is never mutated.
   */
  function apply(state, bindings, t) {
    var keys = Object.keys(bindings || {});
    if (!keys.length) return state;

    var out = null;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var b = bindings[key];
      if (!b || !b.enabled) continue;

      var p = SS.params.BY_KEY[key];
      if (!p || p.type !== 'range') continue;

      var min = p.min, max = p.max;
      if (p.dynamicMax) {
        try { max = Math.max(min + 1, p.dynamicMax(state)); } catch (e) {}
      }
      var range = max - min;

      var wave = WAVES[b.wave] || WAVES.sine;
      var v = wave(t * b.rate + b.phase, b.seed);

      var value;
      if (b.mode === 'sweep') {
        // Traverse the parameter's own range, centred, scaled by amount.
        var mid = (min + max) / 2;
        value = mid + v * (range / 2) * b.amount;
      } else {
        value = state[key] + v * range * b.amount * 0.5;
      }

      value = Math.max(min, Math.min(max, value));
      if (p.step >= 1) value = Math.round(value);

      if (!out) out = Object.assign({}, state);
      out[key] = value;
    }
    return out || state;
  }

  /* --- clock ---------------------------------------------------------------
     A single transport shared by the LFOs, the media source and the recorder,
     so an exported clip lines up exactly with what was on screen.
     -------------------------------------------------------------------------- */

  function makeClock() {
    var t = 0;
    var playing = false;
    var speed = 1;
    var last = 0;
    var loopLen = 8;   // seconds, used when the source has no duration of its own
    var loopOn = true;

    return {
      get time() { return t; },
      set time(v) { t = v; },
      get playing() { return playing; },
      get speed() { return speed; },
      set speed(v) { speed = v; },
      get loopLength() { return loopLen; },
      set loopLength(v) { loopLen = Math.max(0.1, v); },
      get loop() { return loopOn; },
      set loop(v) { loopOn = !!v; },
      start: function () { playing = true; last = performance.now(); },
      stop: function () { playing = false; },
      toggle: function () { playing ? this.stop() : this.start(); },
      reset: function () { t = 0; },
      /** @returns {number} delta seconds since the last tick */
      tick: function () {
        var now = performance.now();
        if (!playing) { last = now; return 0; }
        var dt = Math.min(0.25, (now - last) / 1000) * speed;
        last = now;
        t += dt;
        if (loopOn && loopLen > 0 && t > loopLen) t = t % loopLen;
        return dt;
      }
    };
  }

  SS.anim = {
    WAVES: WAVES,
    WAVE_LIST: WAVE_LIST,
    defaultBinding: defaultBinding,
    apply: apply,
    makeClock: makeClock
  };
})(window);
