/* ==========================================================================
   ASCII_DOVE — palettes.js
   Discrete colour palettes (nearest-match quantisation) and continuous
   gradient ramps (luminance-mapped).
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  /* --- discrete palettes -------------------------------------------------- */

  var PALETTES = [
    { id: 'phosphorGreen', name: 'Green Phosphor', group: 'Monochrome',
      colors: ['#001100', '#00330f', '#006622', '#00a63a', '#22e05c', '#7dff9e'] },
    { id: 'phosphorAmber', name: 'Amber Phosphor', group: 'Monochrome',
      colors: ['#150800', '#3a1c00', '#7a3f00', '#c47100', '#ffab21', '#ffd98a'] },
    { id: 'phosphorIce', name: 'Ice Phosphor', group: 'Monochrome',
      colors: ['#00080f', '#062134', '#0b4f6c', '#128fb5', '#4fd3ec', '#b6f2ff'] },
    { id: 'paperInk', name: 'Ink on Vellum', group: 'Monochrome',
      colors: ['#100d09', '#2e2418', '#5a4a33', '#8f7a56', '#c4b18a', '#ece0c4'] },
    { id: 'grayscale8', name: 'Grayscale 8', group: 'Monochrome',
      colors: ['#000000', '#242424', '#484848', '#6d6d6d', '#919191', '#b6b6b6', '#dadada', '#ffffff'] },
    { id: 'grayscale4', name: 'Grayscale 4', group: 'Monochrome',
      colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },

    { id: 'cga0', name: 'CGA Palette 0', group: 'Retro Hardware',
      colors: ['#000000', '#00aa00', '#aa0000', '#aa5500'] },
    { id: 'cga1', name: 'CGA Palette 1', group: 'Retro Hardware',
      colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
    { id: 'ega', name: 'EGA 16', group: 'Retro Hardware',
      colors: ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
               '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'] },
    { id: 'c64', name: 'Commodore 64', group: 'Retro Hardware',
      colors: ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77',
               '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'] },
    { id: 'zx', name: 'ZX Spectrum', group: 'Retro Hardware',
      colors: ['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7',
               '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff'] },
    { id: 'apple2', name: 'Apple II', group: 'Retro Hardware',
      colors: ['#000000', '#843c24', '#5a3c9c', '#d84ce4', '#0c6c3c', '#8c8c8c', '#1cb4f4', '#bcc4f4',
               '#3c5414', '#f47c14', '#c4c4c4', '#f49cbc', '#3cd414', '#d4d47c', '#8ce4b4', '#ffffff'] },
    { id: 'gameboy', name: 'Game Boy DMG', group: 'Retro Hardware',
      colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
    { id: 'gameboyPocket', name: 'Game Boy Pocket', group: 'Retro Hardware',
      colors: ['#181818', '#4a5138', '#8c926f', '#c5caa4'] },
    { id: 'nes', name: 'NES', group: 'Retro Hardware',
      colors: ['#000000', '#fcfcfc', '#f8f8f8', '#bcbcbc', '#7c7c7c', '#a4e4fc', '#3cbcfc', '#0078f8',
               '#0000fc', '#b8b8f8', '#6888fc', '#0058f8', '#d8b8f8', '#9878f8', '#6844fc', '#4428bc',
               '#f8b8f8', '#f878f8', '#d800cc', '#940084', '#f8a4c0', '#f85898', '#e40058', '#a80020',
               '#f0d0b0', '#f87858', '#f83800', '#a81000', '#fce0a8', '#fca044', '#e45c10', '#881400',
               '#f8d878', '#f8b800', '#ac7c00', '#503000', '#d8f878', '#b8f818', '#00b800', '#007800',
               '#b8f8b8', '#58d854', '#00a800', '#006800', '#b8f8d8', '#58f898', '#00a844', '#005800'] },
    { id: 'pico8', name: 'PICO-8', group: 'Retro Hardware',
      colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
               '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'] },
    { id: 'teletext', name: 'Teletext', group: 'Retro Hardware',
      colors: ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'] },
    { id: 'msdos', name: 'ANSI 16', group: 'Retro Hardware',
      colors: ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
               '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'] },

    { id: 'forge', name: 'Forge', group: 'Studio',
      colors: ['#0a0908', '#2a1710', '#5c2b16', '#a8431c', '#d97032', '#e8a33d', '#f2d492'] },
    { id: 'grimoire', name: 'Grimoire', group: 'Studio',
      colors: ['#08070c', '#1d1630', '#3c2b5c', '#6b4a8f', '#a074c4', '#d3b3e8', '#f0e6f7'] },
    { id: 'verdigris', name: 'Verdigris', group: 'Studio',
      colors: ['#06100e', '#0f2b26', '#1d4a42', '#2f7566', '#54a48d', '#8fcbb6', '#d6ece2'] },
    { id: 'bloodMoon', name: 'Blood Moon', group: 'Studio',
      colors: ['#0b0406', '#2b0a12', '#5c1220', '#961f2c', '#cc3b3b', '#e8756a', '#f7c3ad'] },
    { id: 'goldLeaf', name: 'Gold Leaf', group: 'Studio',
      colors: ['#0c0a05', '#2e2410', '#5c4a1c', '#94762a', '#c9a227', '#e8cc63', '#fbf0bc'] },
    { id: 'cyberpunk', name: 'Neon Wire', group: 'Studio',
      colors: ['#05020c', '#170a33', '#3d0f6b', '#7a1fa2', '#e0329c', '#ff5fd2', '#7df9ff'] },
    { id: 'sepia', name: 'Sepia Print', group: 'Studio',
      colors: ['#1c1208', '#3c2a18', '#65482c', '#8f6b45', '#b8926a', '#dcc09a', '#f5e7cf'] },
    { id: 'cyanotype', name: 'Cyanotype', group: 'Studio',
      colors: ['#04121f', '#0b2b46', '#154a72', '#2673a3', '#4fa0c9', '#8fc9e3', '#dcf0fa'] },
    { id: 'riso', name: 'Risograph', group: 'Studio',
      colors: ['#101010', '#0d3b9c', '#f15060', '#ffe800', '#00a95c', '#ff8833', '#f4f0e6'] }
  ];

  /* --- continuous gradients ----------------------------------------------
     Stops are [position 0..1, '#rrggbb'].
     ----------------------------------------------------------------------- */

  var GRADIENTS = [
    { id: 'ember', name: 'Ember', stops: [[0, '#000000'], [0.25, '#4a0f04'], [0.5, '#b4351a'], [0.75, '#f0902b'], [1, '#fff3c4']] },
    { id: 'inferno', name: 'Inferno', stops: [[0, '#000004'], [0.25, '#420a68'], [0.5, '#932667'], [0.75, '#dd513a'], [0.9, '#fca50a'], [1, '#fcffa4']] },
    { id: 'viridis', name: 'Viridis', stops: [[0, '#440154'], [0.25, '#3b528b'], [0.5, '#21918c'], [0.75, '#5ec962'], [1, '#fde725']] },
    { id: 'magma', name: 'Magma', stops: [[0, '#000004'], [0.25, '#3b0f70'], [0.5, '#8c2981'], [0.75, '#de4968'], [0.9, '#fe9f6d'], [1, '#fcfdbf']] },
    { id: 'plasma', name: 'Plasma', stops: [[0, '#0d0887'], [0.25, '#7e03a8'], [0.5, '#cc4778'], [0.75, '#f89540'], [1, '#f0f921']] },
    { id: 'ice', name: 'Ice', stops: [[0, '#00030c'], [0.35, '#0b3d6b'], [0.7, '#3fa9d6'], [1, '#e8faff']] },
    { id: 'toxic', name: 'Toxic', stops: [[0, '#020a02'], [0.4, '#0d4d18'], [0.7, '#5ac03a'], [1, '#e8ff8f']] },
    { id: 'vaporwave', name: 'Vaporwave', stops: [[0, '#180032'], [0.33, '#7b2ff7'], [0.66, '#f107a3'], [1, '#ffd6f5']] },
    { id: 'goldRamp', name: 'Molten Gold', stops: [[0, '#0a0700'], [0.4, '#6b4a05'], [0.7, '#c9a227'], [1, '#fff6d0']] },
    { id: 'bruise', name: 'Bruise', stops: [[0, '#08040a'], [0.3, '#2c1046'], [0.6, '#7a2247'], [0.85, '#c65a3f'], [1, '#f4dfb8']] },
    { id: 'copper', name: 'Copper', stops: [[0, '#0b0705'], [0.5, '#8a4b2a'], [0.8, '#d18e5c'], [1, '#ffe9d2']] },
    { id: 'grayRamp', name: 'Neutral', stops: [[0, '#000000'], [1, '#ffffff']] },
    { id: 'duotoneCM', name: 'Cyan / Magenta', stops: [[0, '#00e5ff'], [1, '#ff0090']] },
    { id: 'duotoneGA', name: 'Green / Amber', stops: [[0, '#00ff85'], [1, '#ffb300']] }
  ];

  /* --- colour utilities ---------------------------------------------------- */

  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  // Bake a gradient into a 256-entry Uint8 lookup table (RGB triples).
  function bakeGradient(stops) {
    var lut = new Uint8ClampedArray(256 * 3);
    var pts = stops.map(function (s) { return { p: s[0], c: hexToRgb(s[1]) }; })
                   .sort(function (a, b) { return a.p - b.p; });
    for (var i = 0; i < 256; i++) {
      var t = i / 255, a = pts[0], b = pts[pts.length - 1];
      for (var j = 0; j < pts.length - 1; j++) {
        if (t >= pts[j].p && t <= pts[j + 1].p) { a = pts[j]; b = pts[j + 1]; break; }
      }
      var span = b.p - a.p;
      var f = span <= 0 ? 0 : (t - a.p) / span;
      lut[i * 3] = a.c[0] + (b.c[0] - a.c[0]) * f;
      lut[i * 3 + 1] = a.c[1] + (b.c[1] - a.c[1]) * f;
      lut[i * 3 + 2] = a.c[2] + (b.c[2] - a.c[2]) * f;
    }
    return lut;
  }

  // Flatten a discrete palette to a Uint8 array for fast nearest-match search.
  function bakePalette(colors) {
    var arr = new Uint8ClampedArray(colors.length * 3);
    colors.forEach(function (c, i) {
      var rgb = hexToRgb(c);
      arr[i * 3] = rgb[0]; arr[i * 3 + 1] = rgb[1]; arr[i * 3 + 2] = rgb[2];
    });
    return arr;
  }

  // Nearest palette entry by squared euclidean distance in RGB.
  function nearest(pal, r, g, b, out) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < pal.length; i += 3) {
      var dr = r - pal[i], dg = g - pal[i + 1], db = b - pal[i + 2];
      var d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    out[0] = pal[best]; out[1] = pal[best + 1]; out[2] = pal[best + 2];
    return out;
  }

  var PAL_BY_ID = {}; PALETTES.forEach(function (p) { PAL_BY_ID[p.id] = p; });
  var GRAD_BY_ID = {}; GRADIENTS.forEach(function (g) { GRAD_BY_ID[g.id] = g; });

  SS.palettes = {
    PALETTES: PALETTES,
    GRADIENTS: GRADIENTS,
    PAL_BY_ID: PAL_BY_ID,
    GRAD_BY_ID: GRAD_BY_ID,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    bakeGradient: bakeGradient,
    bakePalette: bakePalette,
    nearest: nearest
  };
})(window);
