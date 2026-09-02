/* ==========================================================================
   ASCII_DOVE — imageproc.js
   Tone mapping, blur/sharpen, dithering and the Sobel edge pass.
   Everything works on flat typed arrays for speed; nothing here touches DOM
   except the scratch canvases it owns.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  /* --- scratch canvases ---------------------------------------------------
     Reused across frames so we never thrash the allocator during playback.
     ----------------------------------------------------------------------- */
  function makeScratch() {
    var cv = document.createElement('canvas');
    return { cv: cv, cx: cv.getContext('2d', { willReadFrequently: true }) };
  }
  var gridScratch = makeScratch();   // downsampled to the glyph grid
  var edgeScratch = makeScratch();   // supersampled for edge detection
  var preScratch = makeScratch();    // pre-shrink before a transformed draw

  // Each sampling path gets its own ping-pong pair for the halving chain.
  // Sharing one pair would make every call resize the canvases, and a resize
  // reallocates; kept separate, the sizes are stable frame to frame and `fit`
  // becomes a no-op during playback.
  var CHAIN_GRID = 0, CHAIN_EDGE = 1, CHAIN_PRE = 2;
  var chains = [
    [makeScratch(), makeScratch()],
    [makeScratch(), makeScratch()],
    [makeScratch(), makeScratch()]
  ];

  function fit(scratch, w, h) {
    if (scratch.cv.width !== w || scratch.cv.height !== h) {
      scratch.cv.width = w;
      scratch.cv.height = h;
    }
    return scratch;
  }

  /* --- sampling -----------------------------------------------------------
     Browsers do a poor job downscaling by large factors in one drawImage call
     (they only sample a few taps). Halving repeatedly gives proper area
     averaging, which matters enormously when a 4000px photo becomes 120 cells.

     Each intermediate canvas is sized exactly to the step it holds. Drawing
     into a sub-rect of an oversized canvas looks like it would save an
     allocation, but the smoothing filter samples past the source rectangle and
     drags the surrounding emptiness into the right and bottom edges.
     ----------------------------------------------------------------------- */
  function drawDownscaled(src, srcW, srcH, dstCx, dstW, dstH, chain) {
    if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return;
    var pair = chains[chain || 0];

    // If we're upscaling or only mildly downscaling, one pass is fine.
    if (srcW <= dstW * 2 && srcH <= dstH * 2) {
      dstCx.imageSmoothingEnabled = true;
      dstCx.imageSmoothingQuality = 'high';
      dstCx.clearRect(0, 0, dstW, dstH);
      dstCx.drawImage(src, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
      return;
    }

    // Halve repeatedly, reading straight from the source on the first pass.
    // Copying the source at full size first (a 4K frame is ~9M pixels) costs
    // more than every other stage of the render put together.
    var cur = src, curW = srcW, curH = srcH;
    var useA = true;

    while (curW > dstW * 2 && curH > dstH * 2) {
      var nw = Math.max(dstW, curW >> 1);
      var nh = Math.max(dstH, curH >> 1);
      var t = fit(useA ? pair[0] : pair[1], nw, nh);
      t.cx.imageSmoothingEnabled = true;
      t.cx.imageSmoothingQuality = 'high';
      t.cx.clearRect(0, 0, nw, nh);
      t.cx.drawImage(cur, 0, 0, curW, curH, 0, 0, nw, nh);
      cur = t.cv; curW = nw; curH = nh;
      useA = !useA;   // never read and write the same canvas in one step
    }

    dstCx.imageSmoothingEnabled = true;
    dstCx.imageSmoothingQuality = 'high';
    dstCx.clearRect(0, 0, dstW, dstH);
    dstCx.drawImage(cur, 0, 0, curW, curH, 0, 0, dstW, dstH);
  }

  function hasTransform(xf) {
    return !!(xf && (xf.rotate || xf.flipX || xf.flipY ||
      (xf.zoom && xf.zoom !== 1) || xf.panX || xf.panY));
  }

  // Sample a source element into a w x h ImageData, honouring crop/flip/rotate.
  // The transform is expressed in normalised terms so the same `xf` produces
  // the same framing at any sampling resolution — the tone pass and the edge
  // pass must agree, or contours land on the wrong cells.
  function sampleInto(scratch, src, srcW, srcH, w, h, xf, chain) {
    var s = fit(scratch, w, h);
    s.cx.setTransform(1, 0, 0, 1, 0, 0);
    s.cx.clearRect(0, 0, w, h);

    if (!hasTransform(xf)) {
      drawDownscaled(src, srcW, srcH, s.cx, w, h, chain);
      return s.cx.getImageData(0, 0, w, h);
    }

    // Pre-shrink close to the target so the transformed draw isn't aliased,
    // allowing for magnification when zoomed in.
    var mag = Math.max(1, xf.zoom || 1);
    var pw = Math.max(1, Math.min(srcW, Math.round(w * 2 * mag)));
    var ph = Math.max(1, Math.min(srcH, Math.round(h * 2 * mag)));
    var pre = fit(preScratch, pw, ph);
    drawDownscaled(src, srcW, srcH, pre.cx, pw, ph, CHAIN_PRE);

    s.cx.save();
    s.cx.translate(w / 2 + (xf.panX || 0) * w, h / 2 + (xf.panY || 0) * h);
    if (xf.rotate) s.cx.rotate(xf.rotate * Math.PI / 180);
    s.cx.scale((xf.flipX ? -1 : 1) * (xf.zoom || 1), (xf.flipY ? -1 : 1) * (xf.zoom || 1));
    s.cx.imageSmoothingEnabled = true;
    s.cx.imageSmoothingQuality = 'high';
    s.cx.drawImage(pre.cv, -w / 2, -h / 2, w, h);
    s.cx.restore();

    return s.cx.getImageData(0, 0, w, h);
  }

  function sampleGrid(src, srcW, srcH, cols, rows, xf) {
    return sampleInto(gridScratch, src, srcW, srcH, cols, rows, xf, CHAIN_GRID);
  }

  // Higher-resolution sample for the edge pass. Unlike the glyph grid this one
  // must stay square-pixelled: cells are typically twice as tall as they are
  // wide, and detecting gradients on that squashed field tilts every contour
  // toward horizontal.
  function sampleSuper(src, srcW, srcH, w, h, xf) {
    return sampleInto(edgeScratch, src, srcW, srcH, w, h, xf, CHAIN_EDGE);
  }

  /* --- tone ---------------------------------------------------------------
     Applied in-place on the RGBA byte array. Order matters: exposure ->
     brightness -> contrast -> saturation -> gamma -> posterize -> invert.
     ----------------------------------------------------------------------- */

  var gammaLUT = new Uint8ClampedArray(256);
  var gammaLUTKey = null;

  function buildGammaLUT(g) {
    var key = String(g);
    if (gammaLUTKey === key) return gammaLUT;
    var inv = 1 / Math.max(0.01, g);
    for (var i = 0; i < 256; i++) gammaLUT[i] = Math.pow(i / 255, inv) * 255;
    gammaLUTKey = key;
    return gammaLUT;
  }

  function applyTone(img, p) {
    var d = img.data;
    var n = d.length;

    var exposure = Math.pow(2, p.exposure || 0);
    var bright = (p.brightness || 0) * 255;
    // Standard contrast pivot around mid-grey.
    var c = (p.contrast || 0);
    var cf = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
    var sat = p.saturation == null ? 1 : p.saturation;
    var lut = (p.gamma && p.gamma !== 1) ? buildGammaLUT(p.gamma) : null;
    var post = p.posterize | 0;
    var inv = !!p.invert;

    for (var i = 0; i < n; i += 4) {
      var r = d[i] * exposure + bright;
      var g = d[i + 1] * exposure + bright;
      var b = d[i + 2] * exposure + bright;

      if (c) {
        r = cf * (r - 128) + 128;
        g = cf * (g - 128) + 128;
        b = cf * (b - 128) + 128;
      }

      if (sat !== 1) {
        var y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = y + (r - y) * sat;
        g = y + (g - y) * sat;
        b = y + (b - y) * sat;
      }

      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;

      if (lut) { r = lut[r | 0]; g = lut[g | 0]; b = lut[b | 0]; }

      if (post > 1) {
        var q = 255 / (post - 1);
        r = Math.round(r / q) * q;
        g = Math.round(g / q) * q;
        b = Math.round(b / q) * q;
      }

      if (inv) { r = 255 - r; g = 255 - g; b = 255 - b; }

      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    return img;
  }

  /* --- luminance ---------------------------------------------------------- */

  // Extract normalised luminance. Transparent pixels read as 0 so they land on
  // the emptiest glyph (and can be skipped entirely in transparent bg mode).
  function toLuma(img, out, weights) {
    var d = img.data, n = d.length >> 2;
    if (!out || out.length !== n) out = new Float32Array(n);
    var wr = 0.2126, wg = 0.7152, wb = 0.0722;
    if (weights === 'average') { wr = wg = wb = 1 / 3; }
    else if (weights === 'luminosity601') { wr = 0.299; wg = 0.587; wb = 0.114; }
    else if (weights === 'red') { wr = 1; wg = 0; wb = 0; }
    else if (weights === 'green') { wr = 0; wg = 1; wb = 0; }
    else if (weights === 'blue') { wr = 0; wg = 0; wb = 1; }
    else if (weights === 'max') { wr = -1; }

    for (var i = 0, j = 0; i < n; i++, j += 4) {
      var a = d[j + 3] / 255;
      var v;
      if (wr === -1) v = Math.max(d[j], d[j + 1], d[j + 2]) / 255;
      else v = (wr * d[j] + wg * d[j + 1] + wb * d[j + 2]) / 255;
      out[i] = v * a;
    }
    return out;
  }

  // Alpha channel as its own Float32Array (used for transparent-background cells).
  function toAlpha(img, out) {
    var d = img.data, n = d.length >> 2;
    if (!out || out.length !== n) out = new Float32Array(n);
    for (var i = 0, j = 3; i < n; i++, j += 4) out[i] = d[j] / 255;
    return out;
  }

  /* --- spatial filters ----------------------------------------------------- */

  // Separable box blur, repeated for a gaussian-ish falloff.
  function boxBlur(src, w, h, radius, passes) {
    if (radius < 1) return src;
    var a = Float32Array.from(src);
    var b = new Float32Array(src.length);
    passes = passes || 2;
    for (var p = 0; p < passes; p++) {
      // horizontal
      for (var y = 0; y < h; y++) {
        var row = y * w, sum = 0, count = 0;
        for (var i = -radius; i <= radius; i++) {
          var x0 = Math.min(w - 1, Math.max(0, i));
          sum += a[row + x0]; count++;
        }
        for (var x = 0; x < w; x++) {
          b[row + x] = sum / count;
          var add = Math.min(w - 1, x + radius + 1);
          var sub = Math.max(0, x - radius);
          sum += a[row + add] - a[row + sub];
        }
      }
      // vertical
      for (var x2 = 0; x2 < w; x2++) {
        var sum2 = 0, count2 = 0;
        for (var j = -radius; j <= radius; j++) {
          var y0 = Math.min(h - 1, Math.max(0, j));
          sum2 += b[y0 * w + x2]; count2++;
        }
        for (var y2 = 0; y2 < h; y2++) {
          a[y2 * w + x2] = sum2 / count2;
          var addY = Math.min(h - 1, y2 + radius + 1);
          var subY = Math.max(0, y2 - radius);
          sum2 += b[addY * w + x2] - b[subY * w + x2];
        }
      }
    }
    return a;
  }

  // Unsharp mask: src + amount * (src - blurred).
  function sharpen(src, w, h, amount, radius) {
    if (amount <= 0) return src;
    var blurred = boxBlur(src, w, h, Math.max(1, radius || 1), 1);
    var out = new Float32Array(src.length);
    for (var i = 0; i < src.length; i++) {
      var v = src[i] + amount * (src[i] - blurred[i]);
      out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    return out;
  }

  /* --- dithering -----------------------------------------------------------
     All modes quantise a Float32 luma field to `levels` steps and write the
     integer level into `out` (Int16Array).
     ----------------------------------------------------------------------- */

  var bayerCache = {};
  function bayerMatrix(n) {
    if (bayerCache[n]) return bayerCache[n];
    var m = [[0, 2], [3, 1]];
    var size = 2;
    while (size < n) {
      var next = [];
      for (var y = 0; y < size * 2; y++) next.push(new Array(size * 2));
      for (var yy = 0; yy < size; yy++) {
        for (var xx = 0; xx < size; xx++) {
          var v = m[yy][xx] * 4;
          next[yy][xx] = v;
          next[yy][xx + size] = v + 2;
          next[yy + size][xx] = v + 3;
          next[yy + size][xx + size] = v + 1;
        }
      }
      m = next; size *= 2;
    }
    // Normalise to [0,1)
    var out = new Float32Array(n * n);
    var denom = n * n;
    for (var y2 = 0; y2 < n; y2++)
      for (var x2 = 0; x2 < n; x2++)
        out[y2 * n + x2] = m[y2][x2] / denom;
    bayerCache[n] = out;
    return out;
  }

  // Error-diffusion kernels: [dx, dy, weight] with weights summing to 1.
  var KERNELS = {
    floyd: [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]],
    atkinson: [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]],
    jarvis: [[1, 0, 7 / 48], [2, 0, 5 / 48],
             [-2, 1, 3 / 48], [-1, 1, 5 / 48], [0, 1, 7 / 48], [1, 1, 5 / 48], [2, 1, 3 / 48],
             [-2, 2, 1 / 48], [-1, 2, 3 / 48], [0, 2, 5 / 48], [1, 2, 3 / 48], [2, 2, 1 / 48]],
    stucki: [[1, 0, 8 / 42], [2, 0, 4 / 42],
             [-2, 1, 2 / 42], [-1, 1, 4 / 42], [0, 1, 8 / 42], [1, 1, 4 / 42], [2, 1, 2 / 42],
             [-2, 2, 1 / 42], [-1, 2, 2 / 42], [0, 2, 4 / 42], [1, 2, 2 / 42], [2, 2, 1 / 42]],
    sierra: [[1, 0, 2 / 4], [-1, 1, 1 / 4], [0, 1, 1 / 4]],
    burkes: [[1, 0, 8 / 32], [2, 0, 4 / 32],
             [-2, 1, 2 / 32], [-1, 1, 4 / 32], [0, 1, 8 / 32], [1, 1, 4 / 32], [2, 1, 2 / 32]]
  };

  function quantize(luma, w, h, levels, mode, amount, out) {
    var n = w * h;
    if (!out || out.length !== n) out = new Int16Array(n);
    var maxL = levels - 1;
    if (maxL < 1) maxL = 1;
    amount = amount == null ? 1 : amount;

    var i, x, y, v, q;

    if (mode === 'none' || !mode) {
      for (i = 0; i < n; i++) {
        v = luma[i];
        q = Math.round(v * maxL);
        out[i] = q < 0 ? 0 : q > maxL ? maxL : q;
      }
      return out;
    }

    if (mode === 'noise') {
      for (i = 0; i < n; i++) {
        v = luma[i] + (Math.random() - 0.5) * amount / maxL;
        q = Math.round(v * maxL);
        out[i] = q < 0 ? 0 : q > maxL ? maxL : q;
      }
      return out;
    }

    if (mode.indexOf('bayer') === 0) {
      var size = parseInt(mode.slice(5), 10) || 4;
      var mat = bayerMatrix(size);
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          i = y * w + x;
          var t = mat[(y % size) * size + (x % size)] - 0.5;
          v = luma[i] + (t * amount) / maxL;
          q = Math.round(v * maxL);
          out[i] = q < 0 ? 0 : q > maxL ? maxL : q;
        }
      }
      return out;
    }

    // Error diffusion
    var kern = KERNELS[mode] || KERNELS.floyd;
    var buf = Float32Array.from(luma);
    for (y = 0; y < h; y++) {
      var serpentine = (y & 1) === 1;
      for (var xi = 0; xi < w; xi++) {
        x = serpentine ? (w - 1 - xi) : xi;
        i = y * w + x;
        v = buf[i];
        q = Math.round(v * maxL);
        q = q < 0 ? 0 : q > maxL ? maxL : q;
        out[i] = q;
        var err = (v - q / maxL) * amount;
        for (var k = 0; k < kern.length; k++) {
          var dx = serpentine ? -kern[k][0] : kern[k][0];
          var nx = x + dx, ny = y + kern[k][1];
          if (nx < 0 || nx >= w || ny >= h) continue;
          buf[ny * w + nx] += err * kern[k][2];
        }
      }
    }
    return out;
  }

  /* --- Sobel edge pass -----------------------------------------------------
     Run at a supersampled resolution, then reduced per glyph cell into a
     weighted histogram of 4 directions. A cell only becomes an edge glyph when
     its dominant direction carries enough magnitude — that threshold is what
     keeps the result from turning into noise.

     The edge run is perpendicular to the gradient. Folding its angle into
     [0, PI) and splitting into four sectors gives, in ascending order:

       a ≈ 0     line runs (1, 0)      horizontal   -
       a ≈ PI/4  line runs (1, 1)      down-right   \     (screen y points down)
       a ≈ PI/2  line runs (0, 1)      vertical     |
       a ≈ 3PI/4 line runs (-1, 1)     down-left    /

     EDGE_SETS list their glyphs as [-, /, |, \]. Getting this backwards
     silently mirrors every diagonal in the image, so it is unit-tested against
     synthetic edges of each orientation.
     ----------------------------------------------------------------------- */

  var TAN_PI_8 = Math.tan(Math.PI / 8);   // 0.41421… — the sector boundary

  function sobelCells(lumaHi, w, h, cols, rows, threshold, blurRadius) {
    var src = blurRadius > 0 ? boxBlur(lumaHi, w, h, blurRadius, 1) : lumaHi;

    var cellDir = new Int8Array(cols * rows).fill(-1);
    var cellMag = new Float32Array(cols * rows);

    var sx = w / cols, sy = h / rows;
    var hist = new Float32Array(4);

    for (var cy = 0; cy < rows; cy++) {
      var y0 = Math.floor(cy * sy), y1 = Math.min(h, Math.floor((cy + 1) * sy));
      if (y1 <= y0) y1 = Math.min(h, y0 + 1);
      for (var cx = 0; cx < cols; cx++) {
        var x0 = Math.floor(cx * sx), x1 = Math.min(w, Math.floor((cx + 1) * sx));
        if (x1 <= x0) x1 = Math.min(w, x0 + 1);

        hist[0] = hist[1] = hist[2] = hist[3] = 0;
        var total = 0, samples = 0;

        for (var y = y0; y < y1; y++) {
          if (y === 0 || y === h - 1) continue;
          for (var x = x0; x < x1; x++) {
            if (x === 0 || x === w - 1) continue;
            var o = y * w + x;
            var tl = src[o - w - 1], t = src[o - w], tr = src[o - w + 1];
            var l = src[o - 1], r = src[o + 1];
            var bl = src[o + w - 1], b = src[o + w], br = src[o + w + 1];

            var gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
            var gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
            var mag = Math.sqrt(gx * gx + gy * gy);
            samples++;
            if (mag < threshold) continue;

            // Classify by comparing |gx| and |gy| against tan(PI/8) rather than
            // calling atan2 per pixel — same four sectors, a fraction of the
            // cost, and this runs on every pixel of the supersampled buffer.
            var ax = gx < 0 ? -gx : gx;
            var ay = gy < 0 ? -gy : gy;
            var bucket;
            if (ay <= TAN_PI_8 * ax) {
              bucket = 2;                       // gradient horizontal → edge is vertical  |
            } else if (ax <= TAN_PI_8 * ay) {
              bucket = 0;                       // gradient vertical   → edge is horizontal -
            } else if ((gx > 0) === (gy > 0)) {
              bucket = 1;                       // gradient down-right → edge runs up-right /
            } else {
              bucket = 3;                       // otherwise                               \
            }
            hist[bucket] += mag;
            total += mag;
          }
        }

        if (!samples || total <= 0) continue;
        var best = 0;
        for (var k = 1; k < 4; k++) if (hist[k] > hist[best]) best = k;
        var strength = total / samples;
        // Require the dominant direction to actually dominate, else it's texture.
        if (hist[best] / total < 0.34) continue;
        cellDir[cy * cols + cx] = best;
        cellMag[cy * cols + cx] = strength;
      }
    }
    return { dir: cellDir, mag: cellMag };
  }

  /* --- exports ------------------------------------------------------------ */

  SS.imageproc = {
    sampleGrid: sampleGrid,
    sampleSuper: sampleSuper,
    sampleInto: sampleInto,
    drawDownscaled: drawDownscaled,
    applyTone: applyTone,
    toLuma: toLuma,
    toAlpha: toAlpha,
    boxBlur: boxBlur,
    sharpen: sharpen,
    quantize: quantize,
    sobelCells: sobelCells,
    TAN_PI_8: TAN_PI_8,
    bayerMatrix: bayerMatrix,
    KERNELS: KERNELS
  };
})(window);
