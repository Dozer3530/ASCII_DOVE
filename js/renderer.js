/* ==========================================================================
   GLYPHFORGE — renderer.js
   Turns a source frame into a glyph grid, then paints that grid.

   render() returns a `grid` descriptor that the exporters reuse, so PNG, TXT,
   ANSI, SVG and HTML all come from exactly the same pass — what you see is
   literally what you export.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});
  var IP = SS.imageproc;
  var PAL = SS.palettes;

  var MAX_CELLS = 600000; // hard ceiling so a stray slider can't lock the tab

  /* --- deterministic per-cell noise ---------------------------------------- */
  function hash2(x, y, seed) {
    var h = x * 374761393 + y * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  /* --- geometry ------------------------------------------------------------ */

  function computeGeometry(state, srcW, srcH) {
    var cellW, cellH, cols, rows;
    var ar = (srcH && srcW) ? srcH / srcW : 1;

    cellW = Math.max(1, state.cellW);
    cellH = state.aspectLock
      ? Math.max(1, Math.round(state.cellW * state.cellRatio))
      : Math.max(1, state.cellH);

    if (state.sizeMode === 'cols') {
      cols = Math.max(2, Math.round(state.cols));
      rows = Math.max(2, Math.round(cols * ar * (cellW / cellH)));
    } else {
      // Derive the grid from a target output width in pixels.
      cols = Math.max(2, Math.round(state.outWidth / cellW));
      rows = Math.max(2, Math.round(cols * ar * (cellW / cellH)));
    }

    // Clamp to the cell ceiling, preserving aspect.
    if (cols * rows > MAX_CELLS) {
      var scale = Math.sqrt(MAX_CELLS / (cols * rows));
      cols = Math.max(2, Math.floor(cols * scale));
      rows = Math.max(2, Math.floor(rows * scale));
    }

    return {
      cols: cols, rows: rows,
      cellW: cellW, cellH: cellH,
      width: cols * cellW,
      height: rows * cellH
    };
  }

  /* --- font stack ---------------------------------------------------------- */

  function fontStack(state) {
    var base = state.fontFamily || 'Consolas';
    // Symbol fallbacks matter: braille, runes, alchemical and card glyphs all
    // live in different system faces. Order is deliberate.
    return '"' + base + '", "Cascadia Mono", "DejaVu Sans Mono", ' +
      '"Segoe UI Symbol", "Segoe UI Historic", "Segoe UI Emoji", ' +
      '"Apple Symbols", "Noto Sans Symbols 2", "Noto Sans Mono", monospace';
  }

  function fontCss(state, cellH) {
    var size = Math.max(1, cellH * (state.fontScale || 1));
    var style = state.fontItalic ? 'italic ' : '';
    return style + (state.fontWeight || 400) + ' ' + size.toFixed(2) + 'px/1 ' + fontStack(state);
  }

  /* --- reusable buffers ---------------------------------------------------- */
  var buf = {
    luma: null, alpha: null, levels: null, lumaHi: null
  };

  /* --- main render --------------------------------------------------------- */

  /**
   * @param {CanvasRenderingContext2D} ctx  destination
   * @param {Object} source  { el, width, height }
   * @param {Object} state   full parameter object
   * @param {Object} [opts]  { skipPaint: bool }
   * @returns {Object} grid descriptor
   */
  function render(ctx, source, state, opts) {
    opts = opts || {};
    var srcW = source.width, srcH = source.height;
    if (!srcW || !srcH) return null;

    var geo = computeGeometry(state, srcW, srcH);
    var cols = geo.cols, rows = geo.rows, n = cols * rows;

    /* 1. sample ---------------------------------------------------------- */
    var xf = {
      rotate: state.srcRotate, flipX: state.flipX, flipY: state.flipY,
      zoom: state.srcZoom, panX: state.srcPanX, panY: state.srcPanY
    };
    var img = IP.sampleGrid(source.el, srcW, srcH, cols, rows, xf);

    /* 2. tone ------------------------------------------------------------ */
    IP.applyTone(img, state);

    /* 3. luminance ------------------------------------------------------- */
    buf.luma = IP.toLuma(img, buf.luma, state.lumaMode);
    buf.alpha = IP.toAlpha(img, buf.alpha);

    var luma = buf.luma;
    if (state.blur > 0) luma = IP.boxBlur(luma, cols, rows, Math.round(state.blur), 2);
    if (state.sharpen > 0) luma = IP.sharpen(luma, cols, rows, state.sharpen, 1);

    /* 4. charset --------------------------------------------------------- */
    var glyphs = SS.charsets.resolve({
      setId: state.setId,
      custom: state.customChars,
      injectMode: state.injectMode,
      reverse: state.reverse,
      dedupe: state.dedupe
    });
    var fcss = fontCss(state, geo.cellH);
    if (state.autoDensity) glyphs = SS.charsets.sortByDensity(glyphs, fontStack(state));

    var setLen = glyphs.length;
    var depth = Math.max(2, Math.min(state.depth | 0 || setLen, setLen));
    var offset = state.offset | 0;

    /* 5. quantise -------------------------------------------------------- */
    buf.levels = IP.quantize(luma, cols, rows, depth, state.dither, state.ditherAmount, buf.levels);
    var levels = buf.levels;

    /* 6. edges ----------------------------------------------------------- */
    var edges = null;
    if (state.edgeMode !== 'off' && state.edgeStrength > 0) {
      var ss = Math.max(1, Math.min(4, state.edgeSuper | 0 || 2));
      // Square pixels, sized from the source aspect rather than the cell grid.
      // Sampling on the (usually 2:1) cell lattice would compress the image
      // vertically and tip nearly every contour toward horizontal.
      var hw = Math.min(2600, Math.max(16, cols * ss));
      var hh = Math.min(2600, Math.max(16, Math.round(hw * (srcH / srcW))));
      var hiImg = IP.sampleSuper(source.el, srcW, srcH, hw, hh, xf);
      IP.applyTone(hiImg, state);
      buf.lumaHi = IP.toLuma(hiImg, buf.lumaHi, state.lumaMode);
      edges = IP.sobelCells(buf.lumaHi, hw, hh, cols, rows,
        state.edgeThreshold, state.edgeBlur);
    }
    var edgeGlyphs = Array.from(
      (SS.charsets.EDGE_SETS.filter(function (e) { return e.id === state.edgeSet; })[0] ||
        SS.charsets.EDGE_SETS[0]).chars
    );

    /* 7. colour ---------------------------------------------------------- */
    var mode = state.colorMode;
    var gradLut = null, palArr = null;
    if (mode === 'gradient' || mode === 'duotone') {
      var grad = (mode === 'duotone')
        ? { stops: [[0, state.duoDark], [1, state.duoLight]] }
        : (PAL.GRAD_BY_ID[state.gradientId] || PAL.GRADIENTS[0]);
      gradLut = PAL.bakeGradient(grad.stops);
    }
    if (mode === 'palette') {
      var pal = PAL.PAL_BY_ID[state.paletteId] || PAL.PALETTES[0];
      palArr = PAL.bakePalette(pal.colors);
    }

    /* 8. build the grid --------------------------------------------------- */
    var chars = new Array(n);
    var colors = new Uint8Array(n * 3);
    var isEdge = new Uint8Array(n);
    var data = img.data;
    var fg = PAL.hexToRgb(state.fgColor);
    var q = Math.max(2, state.colorQuantize | 0 || 32);
    var qStep = 255 / (q - 1);
    var tmp = [0, 0, 0];
    var seed = state.noiseSeed | 0;
    var alphaCut = state.alphaThreshold;
    var edgeRgb = PAL.hexToRgb(state.edgeColor);
    var randomize = state.randomize || 0;
    var boost = state.colorBoost == null ? 1 : state.colorBoost;
    var edgeOnly = state.edgeMode === 'only';

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x;
        var j = i * 4;

        // Transparent source pixels drop out entirely.
        if (buf.alpha[i] < alphaCut) { chars[i] = null; continue; }

        var lvl = levels[i];
        var ch = null, edgeHere = false;

        if (edges && edges.dir[i] >= 0 && edges.mag[i] * state.edgeStrength >= state.edgeThreshold) {
          ch = edgeGlyphs[edges.dir[i]] || edgeGlyphs[0];
          edgeHere = true;
        }

        if (!ch) {
          if (edgeOnly) { chars[i] = null; continue; }
          var idx = depth > 1
            ? Math.round(lvl * (setLen - 1) / (depth - 1))
            : 0;
          if (randomize > 0 && hash2(x, y, seed) < randomize) {
            idx += hash2(x, y, seed + 7) < 0.5 ? -1 : 1;
          }
          idx = ((idx + offset) % setLen + setLen) % setLen;
          ch = glyphs[idx];
        }

        chars[i] = ch;
        isEdge[i] = edgeHere ? 1 : 0;

        // ---- colour for this cell
        var r, g, b;
        if (edgeHere && state.edgeColorOn) {
          r = edgeRgb[0]; g = edgeRgb[1]; b = edgeRgb[2];
        } else if (mode === 'mono') {
          r = fg[0]; g = fg[1]; b = fg[2];
        } else if (mode === 'source') {
          r = Math.round(data[j] / qStep) * qStep;
          g = Math.round(data[j + 1] / qStep) * qStep;
          b = Math.round(data[j + 2] / qStep) * qStep;
        } else if (mode === 'palette') {
          PAL.nearest(palArr, data[j], data[j + 1], data[j + 2], tmp);
          r = tmp[0]; g = tmp[1]; b = tmp[2];
        } else { // gradient / duotone
          var t = depth > 1 ? (lvl / (depth - 1)) : 0;
          var gi = Math.max(0, Math.min(255, Math.round(t * 255))) * 3;
          r = gradLut[gi]; g = gradLut[gi + 1]; b = gradLut[gi + 2];
        }

        if (boost !== 1) {
          var yy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = yy + (r - yy) * boost;
          g = yy + (g - yy) * boost;
          b = yy + (b - yy) * boost;
        }

        colors[i * 3] = r < 0 ? 0 : r > 255 ? 255 : r;
        colors[i * 3 + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        colors[i * 3 + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      }
    }

    var grid = {
      cols: cols, rows: rows,
      cellW: geo.cellW, cellH: geo.cellH,
      width: geo.width, height: geo.height,
      chars: chars, colors: colors, isEdge: isEdge,
      font: fcss, fontStack: fontStack(state),
      glyphs: glyphs, depth: depth, setLen: setLen
    };

    if (!opts.skipPaint) paint(ctx, grid, state, source);
    return grid;
  }

  /* --- painting ------------------------------------------------------------ */

  function paint(ctx, grid, state, source) {
    var cv = ctx.canvas;
    var pad = state.padding | 0;
    var W = grid.width + pad * 2;
    var H = grid.height + pad * 2;

    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* background */
    if (state.bgMode === 'solid') {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, W, H);
    } else if (state.bgMode === 'gradient') {
      var lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, state.bgColor);
      lg.addColorStop(1, state.bgColor2);
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    } else if (state.bgMode === 'source' && source) {
      ctx.save();
      ctx.globalAlpha = state.bgSourceAlpha;
      if (state.bgSourceBlur > 0) ctx.filter = 'blur(' + state.bgSourceBlur + 'px)';
      try {
        ctx.drawImage(source.el, pad, pad, grid.width, grid.height);
      } catch (e) { /* video not ready */ }
      ctx.restore();
      ctx.filter = 'none';
    }

    /* cell backgrounds — "block" mode fills each cell with its colour first */
    if (state.cellFill > 0) {
      var cf = state.cellFill;
      for (var ci = 0; ci < grid.chars.length; ci++) {
        if (grid.chars[ci] == null) continue;
        var cx0 = (ci % grid.cols) * grid.cellW + pad;
        var cy0 = ((ci / grid.cols) | 0) * grid.cellH + pad;
        ctx.fillStyle = 'rgba(' + grid.colors[ci * 3] + ',' + grid.colors[ci * 3 + 1] +
          ',' + grid.colors[ci * 3 + 2] + ',' + cf + ')';
        ctx.fillRect(cx0, cy0, grid.cellW, grid.cellH);
      }
    }

    /* glyphs, bucketed by colour so we set fillStyle as rarely as possible */
    ctx.font = grid.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var buckets = new Map();
    var nudgeX = state.nudgeX || 0;
    var nudgeY = state.nudgeY || 0;

    for (var i = 0; i < grid.chars.length; i++) {
      var ch = grid.chars[i];
      if (ch == null || ch === ' ') continue;
      var key = (grid.colors[i * 3] << 16) | (grid.colors[i * 3 + 1] << 8) | grid.colors[i * 3 + 2];
      var arr = buckets.get(key);
      if (!arr) { arr = []; buckets.set(key, arr); }
      arr.push(i);
    }

    var halfW = grid.cellW / 2 + pad + nudgeX;
    var halfH = grid.cellH / 2 + pad + nudgeY;

    if (state.glow > 0) {
      ctx.shadowBlur = state.glow;
    }

    buckets.forEach(function (list, key) {
      ctx.fillStyle = '#' + ('000000' + key.toString(16)).slice(-6);
      if (state.glow > 0) ctx.shadowColor = ctx.fillStyle;
      for (var k = 0; k < list.length; k++) {
        var idx = list[k];
        var x = (idx % grid.cols) * grid.cellW + halfW;
        var y = ((idx / grid.cols) | 0) * grid.cellH + halfH;
        ctx.fillText(grid.chars[idx], x, y);
      }
    });

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    /* post effects */
    postFx(ctx, W, H, state);
  }

  /* --- post effects -------------------------------------------------------- */

  var fxScratch = document.createElement('canvas');
  var fxCx = fxScratch.getContext('2d');

  function postFx(ctx, W, H, state) {
    if (state.bloom > 0) {
      if (fxScratch.width !== W || fxScratch.height !== H) { fxScratch.width = W; fxScratch.height = H; }
      fxCx.setTransform(1, 0, 0, 1, 0, 0);
      fxCx.clearRect(0, 0, W, H);
      fxCx.filter = 'blur(' + (state.bloomRadius || 6) + 'px)';
      fxCx.drawImage(ctx.canvas, 0, 0);
      fxCx.filter = 'none';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = state.bloom;
      ctx.drawImage(fxScratch, 0, 0);
      ctx.restore();
    }

    if (state.chroma > 0) {
      if (fxScratch.width !== W || fxScratch.height !== H) { fxScratch.width = W; fxScratch.height = H; }
      fxCx.setTransform(1, 0, 0, 1, 0, 0);
      fxCx.clearRect(0, 0, W, H);
      fxCx.drawImage(ctx.canvas, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(fxScratch, -state.chroma, 0);
      ctx.drawImage(fxScratch, state.chroma, 0);
      ctx.restore();
    }

    if (state.scanlines > 0) {
      ctx.save();
      ctx.globalAlpha = state.scanlines;
      ctx.fillStyle = '#000';
      var step = Math.max(2, state.scanlineSize | 0 || 3);
      for (var y = 0; y < H; y += step) ctx.fillRect(0, y, W, 1);
      ctx.restore();
    }

    if (state.grain > 0) {
      var g = grainTile(state.grain);
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.grain);
      ctx.globalCompositeOperation = 'overlay';
      var p = ctx.createPattern(g, 'repeat');
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (state.vignette > 0) {
      var rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25,
        W / 2, H / 2, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,' + state.vignette + ')');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  var grainCv = null;
  function grainTile() {
    if (grainCv) return grainCv;
    grainCv = document.createElement('canvas');
    grainCv.width = grainCv.height = 128;
    var gc = grainCv.getContext('2d');
    var id = gc.createImageData(128, 128);
    for (var i = 0; i < id.data.length; i += 4) {
      var v = 90 + Math.random() * 76;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    gc.putImageData(id, 0, 0);
    return grainCv;
  }

  /* --- text extraction ------------------------------------------------------ */

  function gridToText(grid, trim) {
    var lines = [];
    for (var y = 0; y < grid.rows; y++) {
      var s = '';
      for (var x = 0; x < grid.cols; x++) {
        var c = grid.chars[y * grid.cols + x];
        s += (c == null ? ' ' : c);
      }
      lines.push(trim ? s.replace(/\s+$/, '') : s);
    }
    return lines.join('\n');
  }

  SS.renderer = {
    render: render,
    paint: paint,
    computeGeometry: computeGeometry,
    gridToText: gridToText,
    fontStack: fontStack,
    fontCss: fontCss,
    MAX_CELLS: MAX_CELLS
  };
})(window);
