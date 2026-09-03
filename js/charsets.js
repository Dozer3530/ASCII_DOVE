/* ==========================================================================
   ASCII_DOVE — charsets.js
   The glyph armoury. 101 character sets across 12 categories.

   CONVENTION: every set is ordered DARK -> LIGHT.
   Index 0 is the emptiest glyph (least ink), the last index is the densest.
   This matches the default of light glyphs on a dark ground, where more ink
   means more brightness. Flip it with the "Reverse ramp" switch.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  /* --- helpers ----------------------------------------------------------- */

  // Build a string from a list of code points.
  function cp() {
    return String.fromCodePoint.apply(String, arguments);
  }

  // Build a contiguous unicode range as a string.
  function range(start, end) {
    var out = '';
    for (var i = start; i <= end; i++) out += String.fromCodePoint(i);
    return out;
  }

  // Braille: U+2800 + 8-bit dot mask. Sorting the full 256 by popcount gives a
  // beautifully smooth 0..8 ramp with lots of intermediate texture.
  function brailleByDensity() {
    var items = [];
    for (var i = 0; i < 256; i++) {
      var bits = 0, n = i;
      while (n) { bits += n & 1; n >>= 1; }
      items.push({ ch: String.fromCodePoint(0x2800 + i), bits: bits, i: i });
    }
    items.sort(function (a, b) { return a.bits - b.bits || a.i - b.i; });
    return items.map(function (o) { return o.ch; }).join('');
  }

  // A tidy 9-step braille ramp: 0,1,2,...,8 dots, each filling from the top.
  var BRAILLE_LINEAR = '⠀⠁⠃⠇⠏⠟⠿⢿⣿';

  /* --- the armoury -------------------------------------------------------
     Each set: { id, name, chars, note? , mono? }
     `mono: false` marks sets whose glyphs often fall back to a proportional
     symbol font (emoji, cards, chess) — the renderer centres those per-cell.
     ----------------------------------------------------------------------- */

  var CATEGORIES = [
    {
      id: 'classic',
      name: 'Classic ASCII',
      sigil: 'A',
      sets: [
        { id: 'std70', name: 'Standard 70', chars: " .'`^\",:;Il!i><~+_-?][}{1)(|/\\tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
        { id: 'std10', name: 'Standard 10', chars: ' .:-=+*#%@' },
        { id: 'std16', name: 'Standard 16', chars: ' .`:,;\'_^"></-!~=)(|j?}{][ti+l7v1%yrfcJ32uIC$zwo964nax5kZ' },
        { id: 'minimal5', name: 'Minimal 5', chars: ' .:*#' },
        { id: 'binary', name: 'Ink & Void', chars: ' #' },
        { id: 'ternary', name: 'Three Tones', chars: ' .#' },
        { id: 'typewriter', name: 'Typewriter', chars: ' .,:;ox%#@' },
        { id: 'terminal', name: 'Terminal', chars: ' .,:ilwW' },
        { id: 'lower', name: 'Lowercase Ramp', chars: ' .ijltfcvzsxaeoyunmqpdbkhwg' },
        { id: 'upper', name: 'Uppercase Ramp', chars: ' .:ILTVXYFEZKAHNUSPGDBRQOCMW' },
        { id: 'weight', name: 'Weight Study', chars: ' .-:=+*oOB#@' },
        { id: 'sketch', name: 'Sketch', chars: " .'\",;:clodxkO0KXNWM" }
      ]
    },
    {
      id: 'numeric',
      name: 'Numbers',
      sigil: '7',
      sets: [
        { id: 'digits', name: 'Digits', chars: ' .1743206859' },
        { id: 'bits', name: 'Bits', chars: ' 01' },
        { id: 'hex', name: 'Hexadecimal', chars: ' 1743206859ACEFBD' },
        { id: 'roman', name: 'Roman Numerals', chars: ' IVXLCDM' },
        { id: 'super', name: 'Superscript', chars: ' ¹⁷⁴³²⁰⁶⁸⁵⁹' },
        { id: 'sub', name: 'Subscript', chars: ' ₁₇₄₃₂₀₆₈₅₉' },
        { id: 'circled', name: 'Circled', chars: ' ①②③④⑤⑥⑦⑧⑨⑩⑪⑫' },
        { id: 'negcircled', name: 'Filled Circled', chars: ' ➀➁➂➃➄➅➆➇➈➉➊➋➌➍➎➏➐➑➒➓', mono: false },
        { id: 'dice', name: 'Dice', chars: ' ⚀⚁⚂⚃⚄⚅', mono: false },
        { id: 'fractions', name: 'Fractions', chars: ' ⅛¼⅜½⅝¾⅞' },
        { id: 'rods', name: 'Counting Rods', chars: ' \u{1D360}\u{1D361}\u{1D362}\u{1D363}\u{1D364}\u{1D365}\u{1D366}\u{1D367}\u{1D368}', note: 'Ancient Chinese counting rods.' }
      ]
    },
    {
      id: 'symbols',
      name: 'Symbols',
      sigil: '§',
      sets: [
        { id: 'punct', name: 'Punctuation', chars: " .,'`:;\"^~!?*|/\\+=<>()[]{}&@#" },
        { id: 'math', name: 'Mathematics', chars: ' ·+−×÷=≠≈≤≥±∓∞∑∏∫√∂∇' },
        { id: 'logic', name: 'Logic', chars: ' ¬∧∨⊕→↔∀∃⊢⊨⊥⊤' },
        { id: 'currency', name: 'Currency', chars: ' ¢$£¥€₽₩₹₪₫¤₿' },
        { id: 'arrows', name: 'Arrows', chars: ' ←↑→↓↔↕↖↗↘↙⇐⇑⇒⇓⇔' },
        { id: 'stars', name: 'Stars', chars: ' ˙·*✴✵✶✷✸✹✺✻✦✧★' },
        { id: 'asterisks', name: 'Asterisms', chars: ' ⸮*⁂⁑⁕✽❈❉❊❋' },
        { id: 'music', name: 'Musical', chars: ' ♩♪♭♮♯♫♬𝄞' },
        { id: 'weather', name: 'Weather', chars: ' ☀☁☂☃☄❄⛅⛈', mono: false },
        { id: 'ticks', name: 'Marks & Ticks', chars: ' ˙·•‣⁃✓✔✗✘✖' }
      ]
    },
    {
      id: 'blocks',
      name: 'Blocks & Shading',
      sigil: '▓',
      sets: [
        { id: 'shade', name: 'Shade Blocks', chars: ' ░▒▓█' },
        { id: 'shadeAscii', name: 'Shade + ASCII', chars: ' .:-=░▒▓█' },
        { id: 'eighthsV', name: 'Vertical Eighths', chars: ' ▁▂▃▄▅▆▇█' },
        { id: 'eighthsH', name: 'Horizontal Eighths', chars: ' ▏▎▍▌▋▊▉█' },
        { id: 'quadrants', name: 'Quadrants', chars: ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█' },
        { id: 'halves', name: 'Half Blocks', chars: ' ▄▀█' },
        { id: 'smallblocks', name: 'Small Blocks', chars: ' ▫◽▪◾■' },
        { id: 'blockmix', name: 'Block Mixture', chars: ' ·:░▒▓█' },
        { id: 'sextants', name: 'Sextants', chars: ' \u{1FB00}\u{1FB01}\u{1FB03}\u{1FB07}\u{1FB0F}\u{1FB1F}\u{1FB3F}\u{1FB6F}█', note: 'Needs a modern legacy-computing font.' },
        { id: 'diag', name: 'Diagonal Fill', chars: ' ╱╲╳◢◣◤◥■' }
      ]
    },
    {
      id: 'braille',
      name: 'Braille',
      sigil: '⣿',
      sets: [
        { id: 'brLinear', name: 'Braille Ramp 9', chars: BRAILLE_LINEAR },
        { id: 'brDensity', name: 'Braille Full 256', chars: brailleByDensity(), note: 'Sorted by dot count — very smooth gradients.' },
        { id: 'brCoarse', name: 'Braille Coarse', chars: '⠀⠁⠉⠙⠹⠽⡽⣽⣿' },
        { id: 'brDots', name: 'Braille Dots', chars: '⠀⠂⠆⠇⡇⣇⣧⣷⣿' },
        { id: 'brSparse', name: 'Braille Sparse', chars: '⠀⠄⠠⠤⠰⠴⢴⣴⣿' }
      ]
    },
    {
      id: 'geometric',
      name: 'Geometric',
      sigil: '◇',
      sets: [
        { id: 'circles', name: 'Circles', chars: ' ˙·∘○◌◍◎●' },
        { id: 'squares', name: 'Squares', chars: ' ▫◽□◻◼▪■' },
        { id: 'triangles', name: 'Triangles', chars: ' ▵▴▿▾◃◂▹▸▲' },
        { id: 'diamonds', name: 'Diamonds', chars: ' ⋄◇◈◆' },
        { id: 'mixedgeo', name: 'Mixed Shapes', chars: ' ·▫▵○◇□◈●■' },
        { id: 'polygons', name: 'Polygons', chars: ' △□⬠⬡◯⬢⬣⬟⬛' },
        { id: 'lozenge', name: 'Lozenges', chars: ' ◊⬩⬪⬫⬬⬭◆' },
        { id: 'pips', name: 'Pips', chars: ' ‧•●⬤' }
      ]
    },
    {
      id: 'scripts',
      name: 'Languages',
      sigil: 'ア',
      sets: [
        { id: 'katakana', name: 'Katakana', chars: ' ・ーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' },
        { id: 'katakanaHalf', name: 'Halfwidth Katakana', chars: ' ･ｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' },
        { id: 'hiragana', name: 'Hiragana', chars: ' ぁぃぅぇぉこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' },
        { id: 'hanzi', name: 'Hanzi Strokes', chars: ' 一二丁十丰王目田国圖囊', note: 'Ordered by stroke count — a natural density ramp.' },
        { id: 'greek', name: 'Greek', chars: ' ιτγπλσδθξφψωβμΣΦΨΩΞ' },
        { id: 'cyrillic', name: 'Cyrillic', chars: ' гтсоеанипбяджшщЖШЩЮЪ' },
        { id: 'hebrew', name: 'Hebrew', chars: ' יוזרדכנגתחהאמסשם' },
        { id: 'arabic', name: 'Arabic-Indic', chars: ' ٠١٢٣٤٥٦٧٨٩' },
        { id: 'devanagari', name: 'Devanagari', chars: ' ।रनतकपमभधङझषघ' },
        { id: 'runes', name: 'Elder Futhark', chars: ' ᛁᛌᚨᚱᚲᚷᚹᚺᚾᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ', note: 'Windows renders these via Segoe UI Historic.' },
        { id: 'ogham', name: 'Ogham', chars: ' ᚁᚂᚃᚄᚅᚆᚇᚈᚉᚊᚋᚌᚍᚎᚏᚐᚑᚒᚓ' },
        { id: 'georgian', name: 'Georgian', chars: ' ინეაოუგდმშჩყხჯ' }
      ]
    },
    {
      id: 'cards',
      name: 'Cards & Games',
      sigil: '♠',
      sets: [
        { id: 'suits', name: 'Card Suits', chars: ' ♡♢♤♧♥♦♠♣' },
        { id: 'suitsFilled', name: 'Filled Suits', chars: ' ♥♦♣♠' },
        { id: 'cardsBack', name: 'Playing Cards', chars: ' \u{1F0A1}\u{1F0A5}\u{1F0A9}\u{1F0AD}\u{1F0B1}\u{1F0B5}\u{1F0B9}\u{1F0BD}\u{1F0C1}\u{1F0CD}\u{1F0D1}\u{1F0DD}\u{1F0A0}', mono: false },
        { id: 'chess', name: 'Chess', chars: ' ♙♘♗♖♕♔♟♞♝♜♛♚', mono: false },
        { id: 'domino', name: 'Dominoes', chars: ' \u{1F031}\u{1F032}\u{1F033}\u{1F034}\u{1F035}\u{1F036}\u{1F037}', mono: false },
        { id: 'mahjong', name: 'Mahjong', chars: ' \u{1F019}\u{1F01A}\u{1F01B}\u{1F01C}\u{1F01D}\u{1F01E}\u{1F01F}\u{1F020}\u{1F021}', mono: false }
      ]
    },
    {
      id: 'arcane',
      name: 'Arcane',
      sigil: '✡',
      sets: [
        { id: 'alchemy', name: 'Alchemical', chars: ' \u{1F701}\u{1F702}\u{1F703}\u{1F704}\u{1F70D}\u{1F70E}\u{1F714}\u{1F71B}\u{1F729}\u{1F730}', mono: false },
        { id: 'zodiac', name: 'Zodiac', chars: ' ♈♉♊♋♌♍♎♏♐♑♒♓', mono: false },
        { id: 'planets', name: 'Planetary', chars: ' ☿♀⊕♂♃♄♅♆♇☉☽☾' },
        { id: 'crosses', name: 'Crosses', chars: ' †‡✝✞✟✠✡♰♱☦☧☨☩☪' },
        { id: 'heraldic', name: 'Heraldic', chars: ' ⚜⚔⚒⛨☠☤☥⚚', mono: false },
        { id: 'runic2', name: 'Bind Runes', chars: ' ᚠᚢᚦᚫᚱᚻᛁᛋᛗᛝᛠᛥ' },
        { id: 'yijing', name: 'Yijing Trigrams', chars: ' ☰☱☲☳☴☵☶☷' },
        { id: 'monogram', name: 'Monograms', chars: ' ⚊⚋⚌⚍⚎⚏' }
      ]
    },
    {
      id: 'technical',
      name: 'Technical',
      sigil: '┼',
      sets: [
        { id: 'boxLight', name: 'Box Drawing', chars: ' ╴╵╶╷─│┌┐└┘├┤┬┴┼' },
        { id: 'boxDouble', name: 'Double Box', chars: ' ═║╔╗╚╝╠╣╦╩╬' },
        { id: 'boxHeavy', name: 'Heavy Box', chars: ' ╸╹╺╻━┃┏┓┗┛┣┫┳┻╋' },
        { id: 'boxRound', name: 'Rounded Box', chars: ' ─│╭╮╯╰├┤┬┴┼' },
        { id: 'lineramp', name: 'Line Ramp', chars: ' ╴╵╶╷─│┼█' },
        { id: 'apl', name: 'APL', chars: ' ¨¯⌷⍋⍉⍤⍨⍪⍲⍳⍴⍵⍺⎕' },
        { id: 'ctrl', name: 'Control Pictures', chars: ' ␣␊␉␍␀␁␂␃␄␅␆␇' },
        { id: 'ocr', name: 'OCR', chars: ' ⑀⑁⑂⑃⑄⑅⑆⑇⑈⑉⑊' }
      ]
    },
    {
      id: 'nature',
      name: 'Nature',
      sigil: '❀',
      sets: [
        { id: 'moon', name: 'Moon Phases', chars: ' \u{1F311}\u{1F312}\u{1F313}\u{1F314}\u{1F315}', mono: false },
        { id: 'florets', name: 'Florets', chars: ' .·°∘*✿❀❁✾⚘' },
        { id: 'botanical', name: 'Botanical', chars: ' ˙·⸕☙❦❧☙❧❀✿' },
        { id: 'organic', name: 'Organic', chars: ' ·⸞∼≈≋░▒▓█' },
        { id: 'flakes', name: 'Snowflakes', chars: ' ˙·*❀❅❆❄❊❋', mono: false }
      ]
    },
    {
      id: 'expressive',
      name: 'Expressive',
      sigil: '✱',
      sets: [
        { id: 'dingbats', name: 'Dingbats', chars: ' ❘❙❚✥✦✧✱✲✳❃❇❈' },
        { id: 'hands', name: 'Hands', chars: ' ☜☞☝☟☚☛', mono: false },
        { id: 'faces', name: 'Faces', chars: ' ☺☻☹', mono: false },
        { id: 'gender', name: 'Alchemical Metals', chars: ' ⚥⚢⚣⚤⚦⚧⚨⚩' },
        { id: 'braces', name: 'Ornamental Braces', chars: ' ⸠⸡⸢⸣⸤⸥⸦⸧⸨⸩' },
        { id: 'quilt', name: 'Quilt', chars: ' ░▒◢◣◤◥▨▦▧▩▓█' }
      ]
    }
  ];

  /* --- edge glyph sets ----------------------------------------------------
     Used by the Sobel edge pass. Order is [horizontal, diag-up(/), vertical,
     diag-down(\)] mapping to gradient direction buckets.
     ----------------------------------------------------------------------- */
  var EDGE_SETS = [
    { id: 'ascii', name: 'ASCII Strokes', chars: '-/|\\' },
    { id: 'heavy', name: 'Heavy Strokes', chars: '━╱┃╲' },
    { id: 'light', name: 'Light Strokes', chars: '─╱│╲' },
    { id: 'double', name: 'Double Strokes', chars: '═╱║╲' },
    { id: 'blocks', name: 'Block Strokes', chars: '▄◥▌◤' },
    { id: 'under', name: 'Underscores', chars: '_/|\\' },
    { id: 'equals', name: 'Equals', chars: '=/!\\' },
    { id: 'dots', name: 'Braille Strokes', chars: '⠒⠦⠶⠌' }
  ];

  /* --- flat index --------------------------------------------------------- */

  var BY_ID = {};
  var ALL = [];
  CATEGORIES.forEach(function (cat) {
    cat.sets.forEach(function (set) {
      set.category = cat.id;
      set.categoryName = cat.name;
      // Normalise to an array of grapheme-safe characters (handles astral planes).
      set.glyphs = Array.from(set.chars);
      set.mono = set.mono !== false;
      BY_ID[set.id] = set;
      ALL.push(set);
    });
  });

  /* --- charset resolution -------------------------------------------------
     Applies user modifications (injection, reversal, density sorting) to a
     base set and returns a plain array of glyphs.
     ----------------------------------------------------------------------- */

  function resolve(opts) {
    var base = BY_ID[opts.setId] || BY_ID.std10;
    var glyphs = base.glyphs.slice();

    var inject = Array.from(opts.custom || '').slice(0, 10);
    if (inject.length) {
      switch (opts.injectMode) {
        case 'replace':
          glyphs = inject;
          break;
        case 'prepend':
          glyphs = inject.concat(glyphs);
          break;
        case 'append':
          glyphs = glyphs.concat(inject);
          break;
        case 'mix':
          // Distribute injected glyphs evenly through the ramp.
          var step = glyphs.length / (inject.length + 1);
          inject.forEach(function (ch, i) {
            var at = Math.round(step * (i + 1)) + i;
            glyphs.splice(Math.min(at, glyphs.length), 0, ch);
          });
          break;
      }
    }

    if (opts.dedupe) {
      var seen = Object.create(null);
      glyphs = glyphs.filter(function (g) {
        if (seen[g]) return false;
        seen[g] = 1;
        return true;
      });
    }

    if (opts.reverse) glyphs.reverse();
    if (glyphs.length < 2) glyphs = glyphs.concat(glyphs.length ? glyphs[0] : ' ');
    return glyphs;
  }

  /* --- measured density sorting -------------------------------------------
     Renders every glyph in the target font and sorts by mean coverage. This is
     what makes custom sets and exotic scripts behave like a real tone ramp.
     Results are memoised per (font + glyph list).
     ----------------------------------------------------------------------- */

  var densityCache = Object.create(null);

  function measureDensity(glyphs, fontCss) {
    var key = fontCss + ' ' + glyphs.join('');
    if (densityCache[key]) return densityCache[key];

    var S = 24;
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.font = '18px ' + fontCss;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';

    var out = glyphs.map(function (g) {
      cx.clearRect(0, 0, S, S);
      cx.fillStyle = '#fff';
      try { cx.fillText(g, S / 2, S / 2); } catch (e) { /* ignore */ }
      var d = cx.getImageData(0, 0, S, S).data;
      var sum = 0;
      for (var i = 3; i < d.length; i += 4) sum += d[i];
      return { g: g, v: sum / (S * S * 255) };
    });

    densityCache[key] = out;
    return out;
  }

  function sortByDensity(glyphs, fontCss) {
    var m = measureDensity(glyphs, fontCss).slice();
    m.sort(function (a, b) { return a.v - b.v; });
    return m.map(function (o) { return o.g; });
  }

  /* --- exports ------------------------------------------------------------ */

  SS.charsets = {
    CATEGORIES: CATEGORIES,
    EDGE_SETS: EDGE_SETS,
    BY_ID: BY_ID,
    ALL: ALL,
    resolve: resolve,
    sortByDensity: sortByDensity,
    measureDensity: measureDensity,
    range: range,
    cp: cp,
    count: ALL.length
  };
})(window);
