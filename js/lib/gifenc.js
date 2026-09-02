/* ==========================================================================
   ASCII_DOVE — lib/gifenc.js
   A compact GIF89a encoder: colour quantisation (exact when possible, median
   cut otherwise) + variable-width LZW, emitting animated, looping GIFs.
   No dependencies — ASCII animations should be shareable offline.
   ========================================================================== */
(function (global) {
  'use strict';
  var SS = (global.SS = global.SS || {});

  /* --- byte sink ----------------------------------------------------------- */

  function ByteBuf(initial) {
    this.buf = new Uint8Array(initial || 1 << 16);
    this.len = 0;
  }
  ByteBuf.prototype._grow = function (need) {
    if (this.len + need <= this.buf.length) return;
    var size = this.buf.length;
    while (size < this.len + need) size *= 2;
    var nb = new Uint8Array(size);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  };
  ByteBuf.prototype.u8 = function (v) { this._grow(1); this.buf[this.len++] = v & 0xFF; };
  ByteBuf.prototype.u16 = function (v) { this.u8(v); this.u8(v >> 8); };
  ByteBuf.prototype.str = function (s) { for (var i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); };
  ByteBuf.prototype.bytes = function (a) {
    this._grow(a.length); this.buf.set(a, this.len); this.len += a.length;
  };
  ByteBuf.prototype.done = function () { return this.buf.subarray(0, this.len); };

  /* --- colour quantisation --------------------------------------------------
     Step 1: bucket into a 5-5-5 histogram (32768 cells).
     Step 2: if <= 256 populated cells, that IS the palette — exact, no loss.
     Step 3: otherwise median-cut the populated cells down to 256.
     -------------------------------------------------------------------------- */

  /**
   * @param {Uint8ClampedArray|Array<Uint8ClampedArray>} input  one frame, or many
   * @param {number} maxColors
   * @param {number} [stride]  sample every Nth pixel (defaults to 1 for a
   *                           single frame, higher when many frames are given)
   */
  function quantize(input, maxColors, stride) {
    maxColors = maxColors || 256;
    var frames = Array.isArray(input) ? input : [input];
    if (!stride) stride = frames.length > 8 ? 3 : 1;
    var step = 4 * stride;
    var hist = new Map();

    for (var f = 0; f < frames.length; f++) {
      var rgba = frames[f];
      for (var i = 0; i < rgba.length; i += step) {
        var r = rgba[i] >> 3, g = rgba[i + 1] >> 3, b = rgba[i + 2] >> 3;
        var key = (r << 10) | (g << 5) | b;
        var e = hist.get(key);
        if (e) { e.n++; e.r += rgba[i]; e.g += rgba[i + 1]; e.b += rgba[i + 2]; }
        else hist.set(key, { n: 1, r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
      }
    }

    var boxes = [];
    hist.forEach(function (e) {
      boxes.push({ n: e.n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n });
    });

    if (boxes.length > maxColors) boxes = medianCut(boxes, maxColors);

    var pal = new Uint8Array(boxes.length * 3);
    boxes.forEach(function (b, i) {
      pal[i * 3] = Math.round(b.r);
      pal[i * 3 + 1] = Math.round(b.g);
      pal[i * 3 + 2] = Math.round(b.b);
    });
    return pal;
  }

  function medianCut(points, target) {
    var boxes = [makeBox(points)];
    while (boxes.length < target) {
      // Split the box with the largest weighted spread.
      var bi = -1, best = -1;
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].pts.length < 2) continue;
        var score = boxes[i].spread * Math.log(1 + boxes[i].n);
        if (score > best) { best = score; bi = i; }
      }
      if (bi < 0) break;

      var box = boxes[bi];
      var axis = box.axis;
      var sorted = box.pts.slice().sort(function (a, b) { return a[axis] - b[axis]; });
      // Split at the weighted median so both halves carry similar pixel counts.
      var half = box.n / 2, acc = 0, cut = 1;
      for (var k = 0; k < sorted.length; k++) {
        acc += sorted[k].n;
        if (acc >= half) { cut = Math.max(1, Math.min(sorted.length - 1, k + 1)); break; }
      }
      boxes.splice(bi, 1, makeBox(sorted.slice(0, cut)), makeBox(sorted.slice(cut)));
    }
    return boxes.map(function (b) {
      var n = 0, r = 0, g = 0, bl = 0;
      b.pts.forEach(function (p) { n += p.n; r += p.r * p.n; g += p.g * p.n; bl += p.b * p.n; });
      return { n: n, r: r / n, g: g / n, b: bl / n };
    });
  }

  function makeBox(pts) {
    var rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0, n = 0;
    pts.forEach(function (p) {
      if (p.r < rmin) rmin = p.r; if (p.r > rmax) rmax = p.r;
      if (p.g < gmin) gmin = p.g; if (p.g > gmax) gmax = p.g;
      if (p.b < bmin) bmin = p.b; if (p.b > bmax) bmax = p.b;
      n += p.n;
    });
    var dr = rmax - rmin, dg = gmax - gmin, db = bmax - bmin;
    // Weight channels perceptually when choosing the split axis.
    var wr = dr * 1.0, wg = dg * 1.2, wb = db * 0.8;
    var axis = wg >= wr && wg >= wb ? 'g' : (wr >= wb ? 'r' : 'b');
    return { pts: pts, n: n, axis: axis, spread: Math.max(wr, wg, wb) };
  }

  /* --- nearest-colour index with a memo cache -------------------------------- */

  function makeIndexer(pal) {
    var cache = new Map();
    var count = pal.length / 3;
    return function (r, g, b) {
      var key = (r << 16) | (g << 8) | b;
      var hit = cache.get(key);
      if (hit !== undefined) return hit;
      var best = 0, bestD = Infinity;
      for (var i = 0; i < count; i++) {
        var dr = r - pal[i * 3], dg = g - pal[i * 3 + 1], db = b - pal[i * 3 + 2];
        var d = dr * dr * 2 + dg * dg * 4 + db * db;   // perceptual-ish weights
        if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
      }
      cache.set(key, best);
      return best;
    };
  }

  /* --- LZW ------------------------------------------------------------------- */

  function lzwEncode(minCodeSize, indices, out) {
    var clear = 1 << minCodeSize;
    var eoi = clear + 1;
    var next = eoi + 1;
    var codeSize = minCodeSize + 1;
    var dict = new Map();

    // GIF image data is a chain of sub-blocks, each at most 255 bytes and
    // prefixed by its own length byte.
    var packet = new Uint8Array(255);
    var packetLen = 0;
    var cur = 0, curBits = 0;

    function writeBlock() {
      if (!packetLen) return;
      out.u8(packetLen);
      out.bytes(packet.subarray(0, packetLen));
      packetLen = 0;
    }

    function pushByte(b) {
      packet[packetLen++] = b;
      if (packetLen === 255) writeBlock();
    }

    function emit(code) {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) {
        pushByte(cur & 0xFF);
        cur >>= 8;
        curBits -= 8;
      }
    }

    out.u8(minCodeSize);
    emit(clear);

    var prefix = indices[0];
    for (var i = 1; i < indices.length; i++) {
      var k = indices[i];
      var key = (prefix << 8) | k;
      var found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      emit(prefix);
      dict.set(key, next);
      next++;
      if (next === 4096) {
        emit(clear);
        dict.clear();
        next = eoi + 1;
        codeSize = minCodeSize + 1;
      } else if (next > (1 << codeSize)) {
        codeSize++;
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (curBits > 0) pushByte(cur & 0xFF);

    writeBlock();
    out.u8(0); // block terminator
  }

  /* --- encoder --------------------------------------------------------------- */

  /**
   * @param {number} width
   * @param {number} height
   * @param {Object} [opts] { loop: 0 = forever, maxColors: 256, dither: bool }
   */
  function Encoder(width, height, opts) {
    opts = opts || {};
    this.w = width;
    this.h = height;
    this.loop = opts.loop == null ? 0 : opts.loop;
    this.maxColors = opts.maxColors || 256;
    this.dither = !!opts.dither;
    // A palette derived from every frame avoids banding when colours drift
    // across an animation. The recorder passes one in; otherwise the first
    // frame decides.
    this.fixedPalette = opts.palette || null;
    this.out = new ByteBuf(1 << 20);
    this.started = false;
  }

  Encoder.prototype._header = function (pal) {
    var o = this.out;
    o.str('GIF89a');
    o.u16(this.w);
    o.u16(this.h);

    var bits = 1;
    while ((1 << bits) < pal.length / 3) bits++;
    if (bits > 8) bits = 8;
    this.palBits = bits;

    o.u8(0x80 | ((bits - 1) & 7));   // global colour table, 8-bit colour resolution
    o.u8(0);                          // background index
    o.u8(0);                          // pixel aspect ratio

    var size = 1 << bits;
    for (var i = 0; i < size; i++) {
      o.u8(pal[i * 3] || 0);
      o.u8(pal[i * 3 + 1] || 0);
      o.u8(pal[i * 3 + 2] || 0);
    }

    // Netscape looping extension
    o.u8(0x21); o.u8(0xFF); o.u8(11);
    o.str('NETSCAPE2.0');
    o.u8(3); o.u8(1); o.u16(this.loop); o.u8(0);
  };

  /**
   * @param {Uint8ClampedArray} rgba  width*height*4
   * @param {number} delayMs
   */
  Encoder.prototype.addFrame = function (rgba, delayMs) {
    if (!this.started) {
      this.pal = this.fixedPalette || quantize(rgba, this.maxColors);
      this.indexer = makeIndexer(this.pal);
      this._header(this.pal);
      this.started = true;
    }

    var o = this.out;
    var delay = Math.max(2, Math.round(delayMs / 10)); // GIF delay is in 1/100s

    // Graphic Control Extension
    o.u8(0x21); o.u8(0xF9); o.u8(4);
    o.u8(0x04);              // disposal = restore to background, no transparency
    o.u16(delay);
    o.u8(0);
    o.u8(0);

    // Image Descriptor
    o.u8(0x2C);
    o.u16(0); o.u16(0);
    o.u16(this.w); o.u16(this.h);
    o.u8(0);                 // no local colour table, not interlaced

    var n = this.w * this.h;
    var idx = new Uint8Array(n);
    var indexer = this.indexer, pal = this.pal;

    if (this.dither) {
      // Floyd–Steinberg in RGB against the fixed palette.
      var work = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        work[i * 3] = rgba[i * 4];
        work[i * 3 + 1] = rgba[i * 4 + 1];
        work[i * 3 + 2] = rgba[i * 4 + 2];
      }
      for (var y = 0; y < this.h; y++) {
        for (var x = 0; x < this.w; x++) {
          var p = (y * this.w + x) * 3;
          var r = clamp255(work[p]), g = clamp255(work[p + 1]), b = clamp255(work[p + 2]);
          var ci = indexer(r, g, b);
          idx[y * this.w + x] = ci;
          var er = work[p] - pal[ci * 3];
          var eg = work[p + 1] - pal[ci * 3 + 1];
          var eb = work[p + 2] - pal[ci * 3 + 2];
          spread(work, this.w, this.h, x + 1, y, er, eg, eb, 7 / 16);
          spread(work, this.w, this.h, x - 1, y + 1, er, eg, eb, 3 / 16);
          spread(work, this.w, this.h, x, y + 1, er, eg, eb, 5 / 16);
          spread(work, this.w, this.h, x + 1, y + 1, er, eg, eb, 1 / 16);
        }
      }
    } else {
      for (var k = 0; k < n; k++) {
        idx[k] = indexer(rgba[k * 4], rgba[k * 4 + 1], rgba[k * 4 + 2]);
      }
    }

    var minCodeSize = Math.max(2, this.palBits);
    lzwEncode(minCodeSize, idx, o);
  };

  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

  function spread(work, w, h, x, y, er, eg, eb, f) {
    if (x < 0 || x >= w || y >= h) return;
    var p = (y * w + x) * 3;
    work[p] += er * f;
    work[p + 1] += eg * f;
    work[p + 2] += eb * f;
  }

  Encoder.prototype.finish = function () {
    this.out.u8(0x3B);
    return new Blob([this.out.done()], { type: 'image/gif' });
  };

  SS.gifenc = {
    Encoder: Encoder,
    quantize: quantize
  };
})(window);
