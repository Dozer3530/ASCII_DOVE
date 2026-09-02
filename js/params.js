/* ==========================================================================
   GLYPHFORGE — params.js
   The single source of truth for every knob in the app.
   The control panel, the preset format and the animation system are all
   generated from this schema, so adding a parameter here adds it everywhere.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  function setOptions() {
    var out = [];
    SS.charsets.CATEGORIES.forEach(function (cat) {
      cat.sets.forEach(function (s) {
        out.push({ value: s.id, label: cat.name + ' — ' + s.name });
      });
    });
    return out;
  }

  var FONT_OPTIONS = [
    'Consolas', 'Cascadia Mono', 'Cascadia Code', 'Courier New', 'Lucida Console',
    'Lucida Sans Typewriter', 'DejaVu Sans Mono', 'Liberation Mono', 'IBM Plex Mono',
    'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Menlo', 'Monaco',
    'SF Mono', 'Andale Mono', 'MS Gothic', 'SimSun', 'NSimSun', 'Segoe UI Mono',
    'Noto Sans Mono', 'Unifont', 'monospace'
  ].map(function (f) { return { value: f, label: f }; });

  /* ---------------------------------------------------------------------- */

  var GROUPS = [
    {
      id: 'grid', name: 'Grid', sigil: '▦',
      hint: 'Resolution of the glyph lattice.',
      params: [
        { key: 'sizeMode', label: 'Sizing', type: 'select', def: 'cols',
          options: [{ value: 'cols', label: 'By column count' }, { value: 'width', label: 'By output width' }] },
        { key: 'cols', label: 'Columns', type: 'range', min: 8, max: 500, step: 1, def: 140, anim: true,
          showIf: function (s) { return s.sizeMode === 'cols'; } },
        { key: 'outWidth', label: 'Output width', type: 'range', min: 200, max: 6000, step: 10, def: 1600, unit: 'px',
          showIf: function (s) { return s.sizeMode === 'width'; } },
        { key: 'cellW', label: 'Cell width', type: 'range', min: 2, max: 48, step: 1, def: 8, unit: 'px', anim: true },
        { key: 'aspectLock', label: 'Lock cell aspect', type: 'toggle', def: true },
        { key: 'cellRatio', label: 'Cell aspect', type: 'range', min: 0.6, max: 3, step: 0.05, def: 2,
          showIf: function (s) { return s.aspectLock; }, hint: 'Height ÷ width. 2.0 suits most monospace faces.' },
        { key: 'cellH', label: 'Cell height', type: 'range', min: 2, max: 96, step: 1, def: 16, unit: 'px',
          showIf: function (s) { return !s.aspectLock; } },
        { key: 'padding', label: 'Padding', type: 'range', min: 0, max: 200, step: 1, def: 24, unit: 'px' }
      ]
    },
    {
      id: 'type', name: 'Type', sigil: 'Aa',
      hint: 'The face the glyphs are cut from.',
      params: [
        { key: 'fontFamily', label: 'Font', type: 'select', def: 'Consolas', options: FONT_OPTIONS },
        { key: 'fontScale', label: 'Glyph size', type: 'range', min: 0.3, max: 2.2, step: 0.01, def: 1.0, anim: true,
          hint: 'Relative to cell height.' },
        { key: 'fontWeight', label: 'Weight', type: 'select', def: '400',
          options: [100, 200, 300, 400, 500, 600, 700, 800, 900].map(function (w) {
            return { value: String(w), label: String(w) };
          }) },
        { key: 'fontItalic', label: 'Italic', type: 'toggle', def: false },
        { key: 'nudgeX', label: 'Nudge X', type: 'range', min: -8, max: 8, step: 0.1, def: 0, unit: 'px', anim: true },
        { key: 'nudgeY', label: 'Nudge Y', type: 'range', min: -8, max: 8, step: 0.1, def: 0, unit: 'px', anim: true }
      ]
    },
    {
      id: 'charset', name: 'Characters', sigil: '§',
      hint: 'Which glyphs carry which tones.',
      params: [
        { key: 'setId', label: 'Character set', type: 'select', def: 'std10', options: setOptions, searchable: true },
        { key: 'depth', label: 'Character depth', type: 'range', min: 2, max: 256, step: 1, def: 10, anim: true,
          dynamicMax: function (s) {
            return SS.charsets.resolve({
              setId: s.setId, custom: s.customChars, injectMode: s.injectMode,
              reverse: s.reverse, dedupe: s.dedupe
            }).length;
          },
          hint: 'How many tone steps the ramp is divided into.' },
        { key: 'offset', label: 'Character offset', type: 'range', min: -128, max: 128, step: 1, def: 0, anim: true,
          hint: 'Rotates the luminance-to-glyph mapping.' },
        { key: 'reverse', label: 'Reverse ramp', type: 'toggle', def: false },
        { key: 'autoDensity', label: 'Sort by measured ink', type: 'toggle', def: false,
          hint: 'Renders each glyph and reorders by real coverage in the chosen font.' },
        { key: 'customChars', label: 'Inject characters', type: 'text', def: '', maxlength: 10,
          placeholder: 'up to 10 glyphs', hint: 'Pasted glyphs are folded into the ramp.' },
        { key: 'injectMode', label: 'Injection', type: 'select', def: 'mix',
          options: [
            { value: 'mix', label: 'Blend into ramp' },
            { value: 'append', label: 'Append (light end)' },
            { value: 'prepend', label: 'Prepend (dark end)' },
            { value: 'replace', label: 'Replace set' }
          ] },
        { key: 'dedupe', label: 'Remove duplicates', type: 'toggle', def: false },
        { key: 'randomize', label: 'Glyph jitter', type: 'range', min: 0, max: 1, step: 0.01, def: 0, anim: true,
          hint: 'Chance a cell steps one glyph off its true tone.' },
        { key: 'noiseSeed', label: 'Jitter seed', type: 'range', min: 0, max: 999, step: 1, def: 7 }
      ]
    },
    {
      id: 'tone', name: 'Tone', sigil: '◐',
      hint: 'Everything that shapes luminance before it becomes a glyph.',
      params: [
        { key: 'brightness', label: 'Brightness', type: 'range', min: -1, max: 1, step: 0.01, def: 0, anim: true },
        { key: 'contrast', label: 'Contrast', type: 'range', min: -1, max: 1, step: 0.01, def: 0.1, anim: true },
        { key: 'exposure', label: 'Exposure', type: 'range', min: -3, max: 3, step: 0.05, def: 0, unit: 'EV', anim: true },
        { key: 'gamma', label: 'Gamma', type: 'range', min: 0.1, max: 4, step: 0.01, def: 1, anim: true },
        { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 3, step: 0.01, def: 1, anim: true },
        { key: 'invert', label: 'Invert', type: 'toggle', def: false },
        { key: 'posterize', label: 'Posterize', type: 'range', min: 0, max: 32, step: 1, def: 0, anim: true,
          hint: '0 disables.' },
        { key: 'blur', label: 'Blur', type: 'range', min: 0, max: 8, step: 1, def: 0, anim: true },
        { key: 'sharpen', label: 'Sharpen', type: 'range', min: 0, max: 3, step: 0.05, def: 0, anim: true },
        { key: 'lumaMode', label: 'Luminance from', type: 'select', def: 'rec709',
          options: [
            { value: 'rec709', label: 'Rec. 709 (perceptual)' },
            { value: 'luminosity601', label: 'Rec. 601' },
            { value: 'average', label: 'Flat average' },
            { value: 'max', label: 'Max channel' },
            { value: 'red', label: 'Red only' },
            { value: 'green', label: 'Green only' },
            { value: 'blue', label: 'Blue only' }
          ] },
        { key: 'alphaThreshold', label: 'Alpha cutoff', type: 'range', min: 0, max: 1, step: 0.01, def: 0.02,
          hint: 'Cells below this alpha are left empty.' }
      ]
    },
    {
      id: 'dither', name: 'Dither', sigil: '▒',
      hint: 'How tones between two glyphs get resolved.',
      params: [
        { key: 'dither', label: 'Algorithm', type: 'select', def: 'none',
          options: [
            { value: 'none', label: 'None' },
            { value: 'floyd', label: 'Floyd–Steinberg' },
            { value: 'atkinson', label: 'Atkinson' },
            { value: 'jarvis', label: 'Jarvis–Judice–Ninke' },
            { value: 'stucki', label: 'Stucki' },
            { value: 'burkes', label: 'Burkes' },
            { value: 'sierra', label: 'Sierra Lite' },
            { value: 'bayer2', label: 'Ordered 2×2' },
            { value: 'bayer4', label: 'Ordered 4×4' },
            { value: 'bayer8', label: 'Ordered 8×8' },
            { value: 'bayer16', label: 'Ordered 16×16' },
            { value: 'noise', label: 'White noise' }
          ] },
        { key: 'ditherAmount', label: 'Amount', type: 'range', min: 0, max: 1.5, step: 0.01, def: 1, anim: true }
      ]
    },
    {
      id: 'edges', name: 'Edges', sigil: '╱',
      hint: 'A Sobel pass that replaces cells on strong contours with directional strokes. This is what makes shapes read.',
      params: [
        { key: 'edgeMode', label: 'Mode', type: 'select', def: 'off',
          options: [
            { value: 'off', label: 'Off' },
            { value: 'overlay', label: 'Overlay on tone' },
            { value: 'only', label: 'Edges only' }
          ] },
        { key: 'edgeSet', label: 'Stroke glyphs', type: 'select', def: 'ascii',
          options: function () {
            return SS.charsets.EDGE_SETS.map(function (e) {
              return { value: e.id, label: e.name + '   ' + e.chars };
            });
          } },
        { key: 'edgeThreshold', label: 'Threshold', type: 'range', min: 0.01, max: 1.5, step: 0.01, def: 0.35, anim: true },
        { key: 'edgeStrength', label: 'Strength', type: 'range', min: 0, max: 5, step: 0.05, def: 1.6, anim: true },
        { key: 'edgeBlur', label: 'Pre-blur', type: 'range', min: 0, max: 6, step: 1, def: 1,
          hint: 'Smooths noise before gradient detection.' },
        { key: 'edgeSuper', label: 'Supersample', type: 'range', min: 1, max: 4, step: 1, def: 2, unit: '×',
          hint: 'Detects edges above grid resolution. Costly but much cleaner.' },
        { key: 'edgeColorOn', label: 'Tint edges', type: 'toggle', def: false },
        { key: 'edgeColor', label: 'Edge colour', type: 'color', def: '#f2d492',
          showIf: function (s) { return s.edgeColorOn; } }
      ]
    },
    {
      id: 'colour', name: 'Colour', sigil: '◈',
      hint: 'How each glyph is inked.',
      params: [
        { key: 'colorMode', label: 'Mode', type: 'select', def: 'mono',
          options: [
            { value: 'mono', label: 'Single colour' },
            { value: 'source', label: 'Sampled from source' },
            { value: 'palette', label: 'Palette mapped' },
            { value: 'gradient', label: 'Gradient ramp' },
            { value: 'duotone', label: 'Duotone' }
          ] },
        { key: 'fgColor', label: 'Glyph colour', type: 'color', def: '#e8dcc0',
          showIf: function (s) { return s.colorMode === 'mono'; } },
        { key: 'paletteId', label: 'Palette', type: 'select', def: 'phosphorAmber',
          options: function () {
            return SS.palettes.PALETTES.map(function (p) {
              return { value: p.id, label: p.group + ' — ' + p.name };
            });
          },
          showIf: function (s) { return s.colorMode === 'palette'; } },
        { key: 'gradientId', label: 'Gradient', type: 'select', def: 'ember',
          options: function () {
            return SS.palettes.GRADIENTS.map(function (g) { return { value: g.id, label: g.name }; });
          },
          showIf: function (s) { return s.colorMode === 'gradient'; } },
        { key: 'duoDark', label: 'Shadow tint', type: 'color', def: '#241a3c',
          showIf: function (s) { return s.colorMode === 'duotone'; } },
        { key: 'duoLight', label: 'Highlight tint', type: 'color', def: '#ffd98a',
          showIf: function (s) { return s.colorMode === 'duotone'; } },
        { key: 'colorQuantize', label: 'Colour steps', type: 'range', min: 2, max: 64, step: 1, def: 32,
          showIf: function (s) { return s.colorMode === 'source'; },
          hint: 'Fewer steps batch better and look more like a print.' },
        { key: 'colorBoost', label: 'Saturation boost', type: 'range', min: 0, max: 3, step: 0.05, def: 1, anim: true },
        { key: 'cellFill', label: 'Cell fill', type: 'range', min: 0, max: 1, step: 0.01, def: 0, anim: true,
          hint: 'Paints each cell behind its glyph. 1.0 gives solid mosaic blocks.' }
      ]
    },
    {
      id: 'background', name: 'Ground', sigil: '▬',
      params: [
        { key: 'bgMode', label: 'Background', type: 'select', def: 'solid',
          options: [
            { value: 'solid', label: 'Solid colour' },
            { value: 'transparent', label: 'Transparent' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'source', label: 'Source image' }
          ] },
        { key: 'bgColor', label: 'Colour', type: 'color', def: '#0a0908',
          showIf: function (s) { return s.bgMode === 'solid' || s.bgMode === 'gradient'; } },
        { key: 'bgColor2', label: 'Colour 2', type: 'color', def: '#1a1410',
          showIf: function (s) { return s.bgMode === 'gradient'; } },
        { key: 'bgSourceAlpha', label: 'Source opacity', type: 'range', min: 0, max: 1, step: 0.01, def: 0.35,
          showIf: function (s) { return s.bgMode === 'source'; } },
        { key: 'bgSourceBlur', label: 'Source blur', type: 'range', min: 0, max: 40, step: 1, def: 8, unit: 'px',
          showIf: function (s) { return s.bgMode === 'source'; } }
      ]
    },
    {
      id: 'fx', name: 'Effects', sigil: '✦',
      hint: 'Applied to the rendered plate.',
      params: [
        { key: 'glow', label: 'Glyph glow', type: 'range', min: 0, max: 30, step: 0.5, def: 0, anim: true },
        { key: 'bloom', label: 'Bloom', type: 'range', min: 0, max: 1, step: 0.01, def: 0, anim: true },
        { key: 'bloomRadius', label: 'Bloom radius', type: 'range', min: 1, max: 40, step: 1, def: 8,
          showIf: function (s) { return s.bloom > 0; } },
        { key: 'chroma', label: 'Chromatic split', type: 'range', min: 0, max: 12, step: 0.5, def: 0, anim: true },
        { key: 'scanlines', label: 'Scanlines', type: 'range', min: 0, max: 1, step: 0.01, def: 0, anim: true },
        { key: 'scanlineSize', label: 'Scanline pitch', type: 'range', min: 2, max: 12, step: 1, def: 3,
          showIf: function (s) { return s.scanlines > 0; } },
        { key: 'grain', label: 'Grain', type: 'range', min: 0, max: 1, step: 0.01, def: 0, anim: true },
        { key: 'vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.01, def: 0, anim: true }
      ]
    },
    {
      id: 'transform', name: 'Source', sigil: '⟳',
      hint: 'Reframe the input before sampling.',
      params: [
        { key: 'srcZoom', label: 'Zoom', type: 'range', min: 0.2, max: 4, step: 0.01, def: 1, anim: true },
        { key: 'srcPanX', label: 'Pan X', type: 'range', min: -1, max: 1, step: 0.005, def: 0, anim: true },
        { key: 'srcPanY', label: 'Pan Y', type: 'range', min: -1, max: 1, step: 0.005, def: 0, anim: true },
        { key: 'srcRotate', label: 'Rotate', type: 'range', min: -180, max: 180, step: 0.5, def: 0, unit: '°', anim: true },
        { key: 'flipX', label: 'Flip horizontal', type: 'toggle', def: false },
        { key: 'flipY', label: 'Flip vertical', type: 'toggle', def: false }
      ]
    }
  ];

  /* --- flatten ------------------------------------------------------------- */

  var BY_KEY = {};
  var ALL = [];
  GROUPS.forEach(function (g) {
    g.params.forEach(function (p) {
      p.group = g.id;
      p.groupName = g.name;
      BY_KEY[p.key] = p;
      ALL.push(p);
    });
  });

  function defaults() {
    var s = {};
    ALL.forEach(function (p) { s[p.key] = p.def; });
    return s;
  }

  function animatable() {
    return ALL.filter(function (p) { return p.anim; });
  }

  function optionsOf(p) {
    return typeof p.options === 'function' ? p.options() : (p.options || []);
  }

  // Coerce a loaded value into the type the schema expects.
  function coerce(key, value) {
    var p = BY_KEY[key];
    if (!p) return value;
    if (p.type === 'range') {
      var n = parseFloat(value);
      if (!isFinite(n)) return p.def;
      return n;
    }
    if (p.type === 'toggle') return !!value;
    if (p.type === 'select') {
      var opts = optionsOf(p);
      var ok = opts.some(function (o) { return String(o.value) === String(value); });
      return ok ? String(value) : p.def;
    }
    if (p.type === 'text') return String(value == null ? '' : value);
    if (p.type === 'color') return /^#[0-9a-f]{3,8}$/i.test(String(value)) ? String(value) : p.def;
    return value;
  }

  function sanitize(obj) {
    var out = defaults();
    if (!obj) return out;
    Object.keys(obj).forEach(function (k) {
      if (BY_KEY[k]) out[k] = coerce(k, obj[k]);
    });
    return out;
  }

  SS.params = {
    GROUPS: GROUPS,
    ALL: ALL,
    BY_KEY: BY_KEY,
    FONT_OPTIONS: FONT_OPTIONS,
    defaults: defaults,
    animatable: animatable,
    optionsOf: optionsOf,
    coerce: coerce,
    sanitize: sanitize
  };
})(window);
