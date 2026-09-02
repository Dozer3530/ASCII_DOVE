/* ==========================================================================
   GLYPHFORGE — presets.js
   Factory presets (read-only) + user presets in localStorage + JSON portability.
   A preset is { name, state, bindings } — nothing else, so it stays readable
   and hand-editable.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});
  var STORE_KEY = 'glyphforge.presets.v1';
  var LAST_KEY = 'glyphforge.session.v1';

  /* --- factory presets ------------------------------------------------------
     Each lists only what it changes; the rest falls back to schema defaults.
     -------------------------------------------------------------------------- */

  var FACTORY = [
    {
      name: 'Ink on Vellum',
      note: 'Warm manuscript plate, fine ramp, paper ground.',
      state: {
        setId: 'std70', depth: 40, cols: 200, cellW: 6, cellRatio: 1.9,
        colorMode: 'mono', fgColor: '#2b2114', bgMode: 'solid', bgColor: '#e8dcc0',
        // Dark ink on light paper: reverse the ramp so bright areas thin out and
        // let the vellum show. Inverting the image instead would flip twice.
        reverse: true,
        contrast: 0.22, gamma: 1.1, grain: 0.18, vignette: 0.25,
        fontFamily: 'Consolas', padding: 32
      }
    },
    {
      name: 'Amber Terminal',
      note: 'VT220 in a dark room. Scanlines, bloom, phosphor decay.',
      state: {
        setId: 'std10', depth: 10, cols: 150, cellW: 8, cellRatio: 2,
        colorMode: 'palette', paletteId: 'phosphorAmber',
        bgMode: 'solid', bgColor: '#0a0704',
        contrast: 0.3, glow: 6, bloom: 0.4, bloomRadius: 10,
        scanlines: 0.32, scanlineSize: 3, vignette: 0.45, grain: 0.08
      }
    },
    {
      name: 'Green Phosphor',
      note: 'The other terminal. Sharper, colder, more legible.',
      state: {
        setId: 'terminal', depth: 8, cols: 170, cellW: 7,
        colorMode: 'palette', paletteId: 'phosphorGreen',
        bgMode: 'solid', bgColor: '#020704',
        contrast: 0.35, glow: 4, bloom: 0.25, scanlines: 0.25, vignette: 0.4
      }
    },
    {
      name: 'Braille Etching',
      note: 'All 256 braille patterns sorted by dot count — the smoothest ramp available.',
      state: {
        setId: 'brDensity', depth: 64, cols: 220, cellW: 6, cellRatio: 1.6,
        colorMode: 'mono', fgColor: '#e8e4d8', bgMode: 'solid', bgColor: '#0b0b0d',
        contrast: 0.2, gamma: 0.95, dither: 'floyd', ditherAmount: 0.6
      }
    },
    {
      name: 'Woodcut',
      note: 'Edges only, heavy strokes. Pure contour, no tone.',
      state: {
        setId: 'binary', edgeMode: 'only', edgeSet: 'heavy',
        edgeThreshold: 0.22, edgeStrength: 2.2, edgeBlur: 1, edgeSuper: 3,
        cols: 190, cellW: 7,
        colorMode: 'mono', fgColor: '#12100c', bgMode: 'solid', bgColor: '#d8cdb2',
        contrast: 0.35, grain: 0.22
      }
    },
    {
      name: 'Line Engraving',
      note: 'Sobel strokes over a faint tone bed. Reads like a banknote.',
      state: {
        setId: 'minimal5', depth: 4, edgeMode: 'overlay', edgeSet: 'light',
        edgeThreshold: 0.3, edgeStrength: 1.8, edgeSuper: 3,
        edgeColorOn: true, edgeColor: '#ffffff',
        cols: 200, cellW: 7,
        colorMode: 'mono', fgColor: '#5a5f6b', bgMode: 'solid', bgColor: '#07080a',
        contrast: 0.15
      }
    },
    {
      name: 'Illuminated',
      note: 'Gold leaf gradient on quadrant blocks. Bloom does the gilding.',
      state: {
        setId: 'quadrants', depth: 16, cols: 160, cellW: 8,
        colorMode: 'gradient', gradientId: 'goldRamp',
        bgMode: 'gradient', bgColor: '#0a0805', bgColor2: '#1c1408',
        contrast: 0.25, bloom: 0.45, bloomRadius: 12, glow: 3, vignette: 0.35
      }
    },
    {
      name: 'Runestone',
      note: 'Elder Futhark cut into cold stone.',
      state: {
        setId: 'runes', depth: 20, cols: 110, cellW: 11, cellRatio: 1.7,
        colorMode: 'palette', paletteId: 'paperInk',
        bgMode: 'solid', bgColor: '#14130f',
        contrast: 0.3, gamma: 1.2, grain: 0.3, vignette: 0.4, glow: 2
      }
    },
    {
      name: 'Matrix Cascade',
      note: 'Katakana with the offset on a slow saw — glyphs churn while the image holds.',
      state: {
        setId: 'katakanaHalf', depth: 30, cols: 160, cellW: 8, cellRatio: 1.9,
        colorMode: 'gradient', gradientId: 'toxic',
        bgMode: 'solid', bgColor: '#000402',
        contrast: 0.4, glow: 5, bloom: 0.3, scanlines: 0.15
      },
      bindings: {
        offset: { enabled: true, wave: 'saw', rate: 0.6, amount: 0.5, phase: 0, mode: 'add', seed: 1 },
        randomize: { enabled: true, wave: 'noise', rate: 0.4, amount: 0.25, phase: 0, mode: 'sweep', seed: 3 }
      }
    },
    {
      name: 'Halftone Press',
      note: 'Ordered dithering at low depth — newsprint, basically.',
      state: {
        setId: 'minimal5', depth: 5, cols: 200, cellW: 6,
        dither: 'bayer8', ditherAmount: 1,
        colorMode: 'mono', fgColor: '#2a2118',
        bgMode: 'solid', bgColor: '#f2e8d2',
        reverse: true, contrast: 0.3, gamma: 1.1, grain: 0.15, vignette: 0.2
      }
    },
    {
      name: 'Neon Sigil',
      note: 'Chromatic split, heavy bloom, hot palette.',
      state: {
        setId: 'blockmix', depth: 6, cols: 150, cellW: 9,
        colorMode: 'palette', paletteId: 'cyberpunk',
        bgMode: 'solid', bgColor: '#04020a',
        contrast: 0.35, saturation: 1.5, colorBoost: 1.4,
        glow: 10, bloom: 0.55, bloomRadius: 14, chroma: 3, vignette: 0.4
      }
    },
    {
      name: 'Mosaic',
      note: 'Solid cell fills with sampled colour — glyphs become tesserae.',
      state: {
        setId: 'quadrants', depth: 16, cols: 180, cellW: 8,
        colorMode: 'source', colorQuantize: 16, cellFill: 0.9,
        bgMode: 'solid', bgColor: '#0a0908',
        contrast: 0.15, saturation: 1.2
      }
    },
    {
      name: 'Cold Cyanotype',
      note: 'Blueprint tones, high gamma, soft dither.',
      state: {
        setId: 'shadeAscii', depth: 9, cols: 190, cellW: 7,
        dither: 'atkinson', ditherAmount: 0.8,
        colorMode: 'palette', paletteId: 'cyanotype',
        bgMode: 'solid', bgColor: '#04121f',
        gamma: 1.3, contrast: 0.2
      }
    },
    {
      name: 'Card Table',
      note: 'Suits as tone. Absurd and it works.',
      state: {
        setId: 'suits', depth: 9, cols: 90, cellW: 13, cellRatio: 1.5,
        colorMode: 'duotone', duoDark: '#1b1b22', duoLight: '#e8d8b0',
        bgMode: 'solid', bgColor: '#0d2a1c',
        contrast: 0.3, vignette: 0.35
      }
    },
    {
      name: 'Breathing Depth',
      note: 'Static image, moving ramp — depth and gamma on slow LFOs.',
      state: {
        setId: 'std70', depth: 30, cols: 170, cellW: 7,
        colorMode: 'gradient', gradientId: 'inferno',
        bgMode: 'solid', bgColor: '#050308', contrast: 0.25, bloom: 0.2
      },
      bindings: {
        depth: { enabled: true, wave: 'sine', rate: 0.12, amount: 0.5, phase: 0, mode: 'sweep', seed: 1 },
        gamma: { enabled: true, wave: 'triangle', rate: 0.07, amount: 0.3, phase: 0.25, mode: 'add', seed: 1 },
        offset: { enabled: true, wave: 'sine', rate: 0.05, amount: 0.15, phase: 0.5, mode: 'add', seed: 1 }
      }
    },
    {
      name: 'Game Boy',
      note: 'Four greens, chunky cells, hard dither.',
      state: {
        setId: 'shade', depth: 4, cols: 160, cellW: 8, cellRatio: 1.8,
        dither: 'bayer4', ditherAmount: 1,
        colorMode: 'palette', paletteId: 'gameboy',
        bgMode: 'solid', bgColor: '#0f380f',
        contrast: 0.3, cellFill: 0.85
      }
    }
  ];

  /* --- storage --------------------------------------------------------------- */

  function readStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('Preset store unreadable, starting fresh.', e);
      return [];
    }
  }

  function writeStore(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.warn('Could not persist presets.', e);
      return false;
    }
  }

  function userPresets() { return readStore(); }

  function savePreset(name, state, bindings) {
    var list = readStore();
    var entry = {
      name: String(name || 'Untitled').slice(0, 60),
      state: JSON.parse(JSON.stringify(state)),
      bindings: JSON.parse(JSON.stringify(bindings || {})),
      savedAt: new Date().toISOString()
    };
    var at = list.findIndex(function (p) { return p.name === entry.name; });
    if (at >= 0) list[at] = entry; else list.push(entry);
    writeStore(list);
    return entry;
  }

  function deletePreset(name) {
    var list = readStore().filter(function (p) { return p.name !== name; });
    writeStore(list);
    return list;
  }

  function renamePreset(from, to) {
    var list = readStore();
    var p = list.filter(function (x) { return x.name === from; })[0];
    if (p) { p.name = to; writeStore(list); }
    return list;
  }

  function findPreset(name) {
    var all = FACTORY.concat(readStore());
    return all.filter(function (p) { return p.name === name; })[0] || null;
  }

  /** Merge a preset's partial state onto schema defaults. */
  function expand(preset) {
    var state = SS.params.sanitize(Object.assign(SS.params.defaults(), preset.state || {}));
    var bindings = {};
    Object.keys(preset.bindings || {}).forEach(function (k) {
      if (!SS.params.BY_KEY[k]) return;
      bindings[k] = Object.assign(SS.anim.defaultBinding(), preset.bindings[k]);
    });
    return { state: state, bindings: bindings };
  }

  /* --- portability ------------------------------------------------------------ */

  function toJSON(name, state, bindings) {
    return JSON.stringify({
      format: 'glyphforge-preset',
      version: 1,
      name: name,
      state: state,
      bindings: bindings
    }, null, 2);
  }

  function exportFile(name, state, bindings) {
    var json = toJSON(name, state, bindings);
    SS.exporters.save(
      new Blob([json], { type: 'application/json' }),
      String(name || 'preset').replace(/[^\w\-]+/g, '_') + '.glyphforge.json'
    );
  }

  function exportAll() {
    var json = JSON.stringify({
      format: 'glyphforge-preset-pack', version: 1, presets: readStore()
    }, null, 2);
    SS.exporters.save(new Blob([json], { type: 'application/json' }),
      'glyphforge-presets-' + SS.exporters.stamp() + '.json');
  }

  /**
   * Accepts a single preset or a pack. Returns { imported: n, names: [] }.
   */
  function importJSON(text) {
    var data = JSON.parse(text);
    var incoming = [];

    if (data && data.format === 'glyphforge-preset-pack' && Array.isArray(data.presets)) {
      incoming = data.presets;
    } else if (data && (data.state || data.format === 'glyphforge-preset')) {
      incoming = [data];
    } else if (Array.isArray(data)) {
      incoming = data;
    } else {
      throw new Error('That file is not a Glyphforge preset.');
    }

    var list = readStore();
    var names = [];
    incoming.forEach(function (p) {
      if (!p || !p.state) return;
      var name = String(p.name || 'Imported').slice(0, 60);
      // Never silently clobber an existing preset.
      var base = name, n = 2;
      while (list.some(function (x) { return x.name === name; })) name = base + ' ' + (n++);
      list.push({
        name: name,
        state: SS.params.sanitize(p.state),
        bindings: p.bindings || {},
        savedAt: new Date().toISOString()
      });
      names.push(name);
    });
    writeStore(list);
    return { imported: names.length, names: names };
  }

  /* --- session autosave -------------------------------------------------------- */

  function saveSession(state, bindings) {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ state: state, bindings: bindings }));
    } catch (e) { /* quota or private mode — not worth interrupting for */ }
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(LAST_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.state) return null;
      return expand(d);
    } catch (e) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(LAST_KEY); } catch (e) {}
  }

  SS.presets = {
    FACTORY: FACTORY,
    userPresets: userPresets,
    savePreset: savePreset,
    deletePreset: deletePreset,
    renamePreset: renamePreset,
    findPreset: findPreset,
    expand: expand,
    toJSON: toJSON,
    exportFile: exportFile,
    exportAll: exportAll,
    importJSON: importJSON,
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession
  };
})(window);
