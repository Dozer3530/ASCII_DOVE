/* ==========================================================================
   ASCII_DOVE — presets.js
   Factory presets (read-only) + user presets in localStorage + JSON portability.
   A preset is { name, state, bindings } — nothing else, so it stays readable
   and hand-editable.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});
  var STORE_KEY = 'asciidove.presets.v1';
  var LAST_KEY = 'asciidove.session.v1';

  /* --- migration from the pre-rename storage keys ---------------------------
     The app was called Glyphforge before this. Anyone who saved presets under
     the old keys keeps them: copy across once, only when the new key is still
     empty, and leave the old data in place so a downgrade is not destructive.
     -------------------------------------------------------------------------- */

  function migrateKey(oldKey, newKey) {
    try {
      if (localStorage.getItem(newKey) !== null) return;
      var old = localStorage.getItem(oldKey);
      if (old !== null) localStorage.setItem(newKey, old);
    } catch (e) { /* private mode or quota — nothing to recover */ }
  }

  migrateKey('glyphforge.presets.v1', STORE_KEY);
  migrateKey('glyphforge.session.v1', LAST_KEY);
  migrateKey('glyphforge.groups', 'asciidove.groups');

  /* --- factory presets ------------------------------------------------------
     Each lists only what it changes; the rest falls back to schema defaults.
     -------------------------------------------------------------------------- */

  // Menu order for the factory groups. Anything not listed sorts last.
  var GROUP_ORDER = ['Terminal', 'Print', 'Line', 'Script', 'Symbol', 'Colour & Texture', 'Motion'];

  var FACTORY = [
    {
      name: 'Ink on Vellum', group: 'Print',
      note: 'Warm manuscript plate, fine ramp, paper ground.',
      state: {
        setId: 'std70', depth: 40, cols: 200, cellW: 6, cellRatio: 1.9,
        colorMode: 'mono', fgColor: '#2b2114', bgMode: 'solid', bgColor: '#e8dcc0',
        // Dark ink on light paper: reverse the ramp so bright areas thin out and
        // let the vellum show. Inverting the image instead would flip twice.
        reverse: true,
        contrast: 0.26, gamma: 1.6, brightness: 0.04, grain: 0.18, vignette: 0.25,
        fontFamily: 'Consolas', padding: 32
      }
    },
    {
      name: 'Amber Terminal', group: 'Terminal',
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
      name: 'Green Phosphor', group: 'Terminal',
      note: 'The other terminal. Sharper, colder, more legible.',
      state: {
        setId: 'terminal', depth: 8, cols: 170, cellW: 7,
        colorMode: 'palette', paletteId: 'phosphorGreen',
        bgMode: 'solid', bgColor: '#020704',
        contrast: 0.35, glow: 4, bloom: 0.25, scanlines: 0.25, vignette: 0.4
      }
    },
    {
      name: 'Braille Etching', group: 'Colour & Texture',
      note: 'All 256 braille patterns sorted by dot count — the smoothest ramp available.',
      state: {
        setId: 'brDensity', depth: 64, cols: 220, cellW: 6, cellRatio: 1.6,
        colorMode: 'mono', fgColor: '#e8e4d8', bgMode: 'solid', bgColor: '#0b0b0d',
        contrast: 0.2, gamma: 0.95, dither: 'floyd', ditherAmount: 0.6
      }
    },
    {
      name: 'Woodcut', group: 'Line',
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
      name: 'Line Engraving', group: 'Line',
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
      name: 'Illuminated', group: 'Colour & Texture',
      note: 'Gold leaf gradient on quadrant blocks. Bloom does the gilding.',
      state: {
        setId: 'quadrants', depth: 16, cols: 160, cellW: 8,
        colorMode: 'gradient', gradientId: 'goldRamp',
        bgMode: 'gradient', bgColor: '#0a0805', bgColor2: '#1c1408',
        contrast: 0.25, bloom: 0.45, bloomRadius: 12, glow: 3, vignette: 0.35
      }
    },
    {
      name: 'Runestone', group: 'Script',
      note: 'Elder Futhark cut into cold stone.',
      state: {
        setId: 'runes', depth: 20, cols: 110, cellW: 11, cellRatio: 1.7,
        colorMode: 'palette', paletteId: 'paperInk',
        bgMode: 'solid', bgColor: '#14130f',
        contrast: 0.3, gamma: 1.2, grain: 0.3, vignette: 0.4, glow: 2
      }
    },
    {
      name: 'Matrix Cascade', group: 'Motion',
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
      name: 'Halftone Press', group: 'Print',
      note: 'Ordered dithering at low depth — newsprint, basically.',
      state: {
        setId: 'minimal5', depth: 5, cols: 200, cellW: 6,
        dither: 'bayer8', ditherAmount: 1,
        colorMode: 'mono', fgColor: '#2a2118',
        bgMode: 'solid', bgColor: '#f2e8d2',
        reverse: true, contrast: 0.34, gamma: 1.65, brightness: 0.05, grain: 0.15, vignette: 0.2
      }
    },
    {
      name: 'Neon Sigil', group: 'Colour & Texture',
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
      name: 'Mosaic', group: 'Colour & Texture',
      note: 'Solid cell fills with sampled colour — glyphs become tesserae.',
      state: {
        setId: 'quadrants', depth: 16, cols: 180, cellW: 8,
        colorMode: 'source', colorQuantize: 16, cellFill: 0.9,
        bgMode: 'solid', bgColor: '#0a0908',
        contrast: 0.15, saturation: 1.2
      }
    },
    {
      name: 'Cold Cyanotype', group: 'Print',
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
      name: 'Card Table', group: 'Symbol',
      note: 'Suits as tone. Absurd and it works.',
      state: {
        setId: 'suits', depth: 9, cols: 90, cellW: 13, cellRatio: 1.5,
        colorMode: 'duotone', duoDark: '#1b1b22', duoLight: '#e8d8b0',
        bgMode: 'solid', bgColor: '#0d2a1c',
        contrast: 0.3, vignette: 0.35
      }
    },
    {
      name: 'Breathing Depth', group: 'Motion',
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
      name: 'Game Boy', group: 'Colour & Texture',
      note: 'Four greens, chunky cells, hard dither.',
      state: {
        setId: 'shade', depth: 4, cols: 160, cellW: 8, cellRatio: 1.8,
        dither: 'bayer4', ditherAmount: 1,
        colorMode: 'palette', paletteId: 'gameboy',
        bgMode: 'solid', bgColor: '#0f380f',
        contrast: 0.3, cellFill: 0.85
      }
    },

    /* ---- Terminal ---------------------------------------------------- */
    {
      name: 'Ice Terminal', group: 'Terminal',
      note: 'Cold tube. Block shading, hard contrast, heavy bloom.',
      state: {
        setId: 'shadeAscii', depth: 9, cols: 160, cellW: 8,
        colorMode: 'palette', paletteId: 'phosphorIce',
        bgMode: 'solid', bgColor: '#00060c',
        contrast: 0.34, gamma: 1.1, glow: 5, bloom: 0.42, bloomRadius: 12,
        scanlines: 0.28, vignette: 0.45
      }
    },
    {
      name: 'Thermal Receipt', group: 'Terminal',
      note: 'Two tones on hot paper, ordered dither, nothing else.',
      state: {
        setId: 'binary', depth: 2, cols: 190, cellW: 6, cellRatio: 1.8,
        dither: 'bayer4', ditherAmount: 1,
        colorMode: 'mono', fgColor: '#241a16', bgMode: 'solid', bgColor: '#f4ece0',
        // Reverse makes dark areas the inkiest, so lift the shadows or a
        // low-key source prints as a solid black page.
        reverse: true, contrast: 0.45, gamma: 1.7, brightness: 0.06, grain: 0.2
      }
    },
    {
      name: 'Cyrillic Broadcast', group: 'Terminal',
      note: 'Cold-war television. Cyrillic, scanlines, a tube that never warmed up.',
      state: {
        setId: 'cyrillic', depth: 18, cols: 140, cellW: 9, cellRatio: 1.8,
        colorMode: 'palette', paletteId: 'phosphorIce',
        bgMode: 'solid', bgColor: '#03070d',
        contrast: 0.34, glow: 5, bloom: 0.3, scanlines: 0.3, chroma: 1.5, vignette: 0.4
      }
    },

    /* ---- Print ------------------------------------------------------- */
    {
      name: 'Newsprint', group: 'Print',
      note: 'Three tones through a coarse ordered dither — cheap paper.',
      state: {
        setId: 'ternary', depth: 3, cols: 210, cellW: 6, cellRatio: 1.8,
        dither: 'bayer2', ditherAmount: 1,
        colorMode: 'mono', fgColor: '#1c1a17', bgMode: 'solid', bgColor: '#e6e1d4',
        reverse: true, contrast: 0.38, gamma: 1.65, brightness: 0.05, grain: 0.24, vignette: 0.18
      }
    },
    {
      name: 'Botanical Plate', group: 'Print',
      note: 'Floret glyphs on sepia stock.',
      state: {
        setId: 'florets', depth: 10, cols: 130, cellW: 10, cellRatio: 1.7,
        colorMode: 'mono', fgColor: '#3a2c1c', bgMode: 'solid', bgColor: '#efe3c8',
        reverse: true, contrast: 0.26, gamma: 1.7, brightness: 0.04, grain: 0.16, vignette: 0.24
      }
    },
    {
      name: 'Hanzi Ledger', group: 'Print',
      note: 'Stroke count as tone — the ramp is literally denser characters.',
      state: {
        setId: 'hanzi', depth: 12, cols: 110, cellW: 12, cellRatio: 1.15,
        colorMode: 'mono', fgColor: '#241d16', bgMode: 'solid', bgColor: '#e9dcc0',
        reverse: true, contrast: 0.3, gamma: 1.6, brightness: 0.04, grain: 0.14
      }
    },
    {
      name: 'Risograph', group: 'Print',
      note: 'Five ink drums, hard dither, no blending anywhere.',
      state: {
        setId: 'shade', depth: 4, cols: 170, cellW: 8,
        dither: 'burkes', ditherAmount: 1,
        colorMode: 'palette', paletteId: 'riso', cellFill: 0.9,
        bgMode: 'solid', bgColor: '#f4f0e6',
        contrast: 0.25, saturation: 1.4
      }
    },

    /* ---- Line -------------------------------------------------------- */
    {
      name: 'Wireframe', group: 'Line',
      note: 'Contours only, drawn in light box strokes.',
      state: {
        setId: 'binary', edgeMode: 'only', edgeSet: 'light',
        edgeThreshold: 0.24, edgeStrength: 2.0, edgeBlur: 1, edgeSuper: 3,
        cols: 200, cellW: 7,
        colorMode: 'mono', fgColor: '#7fe3c8', bgMode: 'solid', bgColor: '#06090c',
        contrast: 0.2, glow: 4, bloom: 0.22, vignette: 0.35
      }
    },
    {
      name: 'Blueprint', group: 'Line',
      note: 'Double-stroke contours over a faint tone bed, drafting blue.',
      state: {
        setId: 'minimal5', depth: 4, cols: 200, cellW: 7,
        edgeMode: 'overlay', edgeSet: 'double', edgeThreshold: 0.3,
        edgeStrength: 1.9, edgeSuper: 3, edgeColorOn: true, edgeColor: '#dceeff',
        colorMode: 'mono', fgColor: '#3c6f9c', bgMode: 'solid', bgColor: '#0b2136',
        contrast: 0.18, gamma: 1.1, grain: 0.1
      }
    },
    {
      name: 'Braille Contour', group: 'Line',
      note: 'The edge pass drawn in braille strokes — dotted contour lines.',
      state: {
        setId: 'brSparse', depth: 8, cols: 190, cellW: 7,
        edgeMode: 'overlay', edgeSet: 'dots', edgeThreshold: 0.28,
        edgeStrength: 2.0, edgeSuper: 3, edgeColorOn: true, edgeColor: '#ffd98a',
        colorMode: 'mono', fgColor: '#8a8470', bgMode: 'solid', bgColor: '#0a0908',
        contrast: 0.28, gamma: 1.1
      }
    },
    {
      name: 'Circuit Trace', group: 'Line',
      note: 'Heavy box drawing in verdigris — a board, etched.',
      state: {
        setId: 'boxHeavy', depth: 14, cols: 170, cellW: 8,
        colorMode: 'palette', paletteId: 'verdigris',
        bgMode: 'solid', bgColor: '#05100d',
        contrast: 0.3, glow: 4, bloom: 0.25, vignette: 0.35
      }
    },

    /* ---- Script ------------------------------------------------------ */
    {
      name: 'Oracle Bone', group: 'Script',
      note: 'Ogham strokes scratched into bone.',
      state: {
        setId: 'ogham', depth: 16, cols: 120, cellW: 10, cellRatio: 1.6,
        colorMode: 'mono', fgColor: '#2e2418', bgMode: 'solid', bgColor: '#ddd2b4',
        reverse: true, contrast: 0.32, gamma: 1.7, brightness: 0.05, grain: 0.3, vignette: 0.3
      }
    },
    {
      name: 'Hebrew Codex', group: 'Script',
      note: 'Square script gilded on dark parchment.',
      state: {
        setId: 'hebrew', depth: 14, cols: 120, cellW: 10, cellRatio: 1.5,
        colorMode: 'gradient', gradientId: 'goldRamp',
        bgMode: 'solid', bgColor: '#12100b',
        contrast: 0.3, glow: 3, bloom: 0.2, grain: 0.16, vignette: 0.35
      }
    },
    {
      name: 'Devanagari Silk', group: 'Script',
      note: 'Warm copper gradient through Devanagari.',
      state: {
        setId: 'devanagari', depth: 13, cols: 130, cellW: 10, cellRatio: 1.6,
        colorMode: 'gradient', gradientId: 'copper',
        bgMode: 'solid', bgColor: '#0d0705',
        contrast: 0.28, bloom: 0.25, vignette: 0.3
      }
    },
    {
      name: 'Greek Marble', group: 'Script',
      note: 'Greek letterforms in cool stone.',
      state: {
        setId: 'greek', depth: 18, cols: 140, cellW: 9,
        colorMode: 'palette', paletteId: 'paperInk',
        bgMode: 'solid', bgColor: '#15161a',
        contrast: 0.26, gamma: 1.1, grain: 0.2, vignette: 0.3
      }
    },

    /* ---- Symbol ------------------------------------------------------ */
    {
      name: 'Chess Study', group: 'Symbol',
      note: 'Pieces as tone. Large cells, or it turns to soup.',
      state: {
        setId: 'chess', depth: 12, cols: 80, cellW: 15, cellRatio: 1.2,
        colorMode: 'mono', fgColor: '#e8dcc0', bgMode: 'solid', bgColor: '#1a1713',
        contrast: 0.3, vignette: 0.35
      }
    },
    {
      name: 'Zodiac Wheel', group: 'Symbol',
      note: 'Twelve signs, twelve steps.',
      state: {
        setId: 'zodiac', depth: 12, cols: 90, cellW: 14, cellRatio: 1.3,
        colorMode: 'duotone', duoDark: '#3a2a6a', duoLight: '#ffe6ad',
        bgMode: 'solid', bgColor: '#080615',
        contrast: 0.34, gamma: 1.15, glow: 6, bloom: 0.38, vignette: 0.4
      }
    },
    {
      name: 'Star Chart', group: 'Symbol',
      note: 'Asterisks on deep sky, glow doing the work.',
      state: {
        setId: 'stars', depth: 14, cols: 150, cellW: 9,
        colorMode: 'gradient', gradientId: 'ice',
        bgMode: 'solid', bgColor: '#01030a',
        contrast: 0.38, gamma: 1.25, glow: 8, bloom: 0.45, bloomRadius: 12, vignette: 0.45
      }
    },
    {
      name: 'Roman Numerals', group: 'Symbol',
      note: 'I V X L C D M as a seven-step ramp.',
      state: {
        setId: 'roman', depth: 8, cols: 130, cellW: 10,
        colorMode: 'gradient', gradientId: 'goldRamp',
        bgMode: 'solid', bgColor: '#0b0904',
        contrast: 0.3, glow: 3, bloom: 0.25, vignette: 0.35
      }
    },
    {
      name: 'Dice Field', group: 'Symbol',
      note: 'Six faces, six tones — the pips do the shading for you.',
      state: {
        setId: 'dice', depth: 6, cols: 90, cellW: 14, cellRatio: 1.15,
        dither: 'bayer4', ditherAmount: 0.8,
        colorMode: 'mono', fgColor: '#f0ead8', bgMode: 'solid', bgColor: '#141416',
        contrast: 0.4, gamma: 1.2, glow: 2
      }
    },
    {
      name: 'Weathervane', group: 'Symbol',
      note: 'Arrows as tone. Chaos up close, legible from across the room.',
      state: {
        setId: 'arrows', depth: 15, cols: 140, cellW: 9,
        colorMode: 'gradient', gradientId: 'copper',
        bgMode: 'solid', bgColor: '#0d0d10',
        contrast: 0.34, gamma: 1.1, glow: 3, bloom: 0.2, vignette: 0.3
      }
    },
    {
      name: 'Counting Rods', group: 'Symbol',
      note: 'Ancient tally marks in ledger green.',
      state: {
        setId: 'rods', depth: 10, cols: 130, cellW: 10, cellRatio: 1.5,
        colorMode: 'palette', paletteId: 'phosphorGreen',
        bgMode: 'solid', bgColor: '#020604',
        contrast: 0.32, glow: 4, bloom: 0.25
      }
    },
    {
      name: 'Moon Phase', group: 'Symbol',
      note: 'Five moons as a five-step ramp.',
      state: {
        setId: 'moon', depth: 5, cols: 80, cellW: 15, cellRatio: 1.1,
        dither: 'bayer8', ditherAmount: 0.9,
        colorMode: 'mono', fgColor: '#ffffff', bgMode: 'solid', bgColor: '#05060c',
        contrast: 0.3, glow: 5, bloom: 0.3, vignette: 0.45
      }
    },

    /* ---- Texture & colour -------------------------------------------- */
    {
      name: 'Quilt', group: 'Colour & Texture',
      note: 'Diagonal block glyphs over filled cells — patchwork.',
      state: {
        setId: 'quilt', depth: 12, cols: 150, cellW: 9,
        colorMode: 'source', colorQuantize: 12, cellFill: 0.75,
        bgMode: 'solid', bgColor: '#0a0908',
        contrast: 0.2, saturation: 1.35, colorBoost: 1.2
      }
    },
    {
      name: 'Measured Ink', group: 'Colour & Texture',
      note: 'Punctuation reordered by real measured coverage — this ramp is computed, not authored.',
      state: {
        setId: 'punct', depth: 24, cols: 180, cellW: 7,
        autoDensity: true,
        colorMode: 'gradient', gradientId: 'bruise',
        bgMode: 'solid', bgColor: '#08060a',
        contrast: 0.26, bloom: 0.2, vignette: 0.3
      }
    },
    {
      name: 'Sigil Injection', group: 'Colour & Texture',
      note: 'Custom glyphs folded into a plain ramp — edit "Inject characters" to make it yours.',
      state: {
        setId: 'minimal5', depth: 9, cols: 150, cellW: 9,
        customChars: '✦✧⚜†', injectMode: 'mix',
        colorMode: 'gradient', gradientId: 'goldRamp',
        bgMode: 'solid', bgColor: '#0a0806',
        contrast: 0.3, glow: 4, bloom: 0.3, vignette: 0.35
      }
    },
    {
      name: 'Alpha Plate', group: 'Colour & Texture',
      note: 'Transparent ground — export a PNG that drops onto any background.',
      state: {
        setId: 'blockmix', depth: 6, cols: 170, cellW: 8,
        colorMode: 'gradient', gradientId: 'ember',
        bgMode: 'transparent', alphaThreshold: 0.02,
        contrast: 0.3, glow: 3
      }
    },

    /* ---- Motion ------------------------------------------------------ */
    {
      name: 'Vapour Drift', group: 'Motion',
      note: 'Gradient, offset and framing all drifting against each other.',
      state: {
        setId: 'shadeAscii', depth: 9, cols: 160, cellW: 8,
        colorMode: 'gradient', gradientId: 'vaporwave',
        bgMode: 'solid', bgColor: '#0a0418',
        contrast: 0.28, glow: 5, bloom: 0.35, scanlines: 0.12, vignette: 0.35
      },
      bindings: {
        offset: { enabled: true, wave: 'triangle', rate: 0.08, amount: 0.35, phase: 0, mode: 'add', seed: 1 },
        colorBoost: { enabled: true, wave: 'sine', rate: 0.05, amount: 0.4, phase: 0.3, mode: 'add', seed: 1 },
        srcPanX: { enabled: true, wave: 'sine', rate: 0.03, amount: 0.12, phase: 0, mode: 'add', seed: 1 }
      }
    },
    {
      name: 'Pulse Grid', group: 'Motion',
      note: 'Cell fill and glow breathing together — a mosaic that throbs.',
      state: {
        setId: 'quadrants', depth: 16, cols: 150, cellW: 9,
        colorMode: 'source', colorQuantize: 14,
        bgMode: 'solid', bgColor: '#08070a',
        contrast: 0.24, saturation: 1.2
      },
      bindings: {
        cellFill: { enabled: true, wave: 'sine', rate: 0.5, amount: 0.9, phase: 0, mode: 'sweep', seed: 1 },
        glow: { enabled: true, wave: 'sine', rate: 0.5, amount: 0.5, phase: 0.1, mode: 'sweep', seed: 1 }
      }
    },
    {
      name: 'Tide', group: 'Motion',
      note: 'Dither strength and gamma swelling — the grain moves, the image does not.',
      state: {
        setId: 'brLinear', depth: 9, cols: 200, cellW: 6, cellRatio: 1.7,
        dither: 'bayer8', ditherAmount: 1,
        colorMode: 'palette', paletteId: 'cyanotype',
        bgMode: 'solid', bgColor: '#03101c',
        contrast: 0.32, gamma: 1.2, glow: 3, bloom: 0.2
      },
      bindings: {
        ditherAmount: { enabled: true, wave: 'sine', rate: 0.09, amount: 0.6, phase: 0, mode: 'sweep', seed: 1 },
        gamma: { enabled: true, wave: 'triangle', rate: 0.06, amount: 0.28, phase: 0.4, mode: 'add', seed: 1 }
      }
    },
    {
      name: 'Static Bloom', group: 'Motion',
      note: 'Glyph jitter on smooth noise — snow that resolves and dissolves.',
      state: {
        setId: 'std16', depth: 20, cols: 170, cellW: 7,
        colorMode: 'palette', paletteId: 'grayscale8',
        bgMode: 'solid', bgColor: '#050505',
        contrast: 0.38, gamma: 1.2, glow: 2, scanlines: 0.15, vignette: 0.4
      },
      bindings: {
        randomize: { enabled: true, wave: 'noise', rate: 0.5, amount: 0.5, phase: 0, mode: 'sweep', seed: 5 },
        chroma: { enabled: true, wave: 'steps', rate: 0.7, amount: 0.35, phase: 0, mode: 'sweep', seed: 9 }
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
      format: 'asciidove-preset',
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
      String(name || 'preset').replace(/[^\w\-]+/g, '_') + '.asciidove.json'
    );
  }

  function exportAll() {
    var json = JSON.stringify({
      format: 'asciidove-preset-pack', version: 1, presets: readStore()
    }, null, 2);
    SS.exporters.save(new Blob([json], { type: 'application/json' }),
      'asciidove-presets-' + SS.exporters.stamp() + '.json');
  }

  /**
   * Accepts a single preset or a pack. Returns { imported: n, names: [] }.
   */
  function importJSON(text) {
    var data = JSON.parse(text);
    var incoming = [];

    // 'glyphforge-*' is the pre-rename format; files exported then still import.
    var PACK = ['asciidove-preset-pack', 'glyphforge-preset-pack'];
    var ONE = ['asciidove-preset', 'glyphforge-preset'];

    if (data && PACK.indexOf(data.format) >= 0 && Array.isArray(data.presets)) {
      incoming = data.presets;
    } else if (data && (data.state || ONE.indexOf(data.format) >= 0)) {
      incoming = [data];
    } else if (Array.isArray(data)) {
      incoming = data;
    } else {
      throw new Error('That file is not an ASCII_DOVE preset.');
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
    GROUP_ORDER: GROUP_ORDER,
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
