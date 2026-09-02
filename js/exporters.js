/* ==========================================================================
   GLYPHFORGE — exporters.js
   Every export path consumes the same `grid` the viewport was painted from,
   so a PNG, a text file and an SVG of the same frame agree exactly.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  /* --- download helper ------------------------------------------------------ */

  function save(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
      '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --- still images --------------------------------------------------------- */

  function exportPNG(canvas, scale, name) {
    scale = scale || 1;
    var target = canvas;
    if (scale !== 1) {
      target = document.createElement('canvas');
      target.width = Math.round(canvas.width * scale);
      target.height = Math.round(canvas.height * scale);
      var cx = target.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(canvas, 0, 0, target.width, target.height);
    }
    return new Promise(function (resolve) {
      target.toBlob(function (blob) {
        save(blob, (name || 'glyphforge-' + stamp()) + '.png');
        resolve(blob);
      }, 'image/png');
    });
  }

  function exportJPEG(canvas, quality, bgColor, name) {
    // JPEG has no alpha, so flatten onto the chosen ground first.
    var t = document.createElement('canvas');
    t.width = canvas.width; t.height = canvas.height;
    var cx = t.getContext('2d');
    cx.fillStyle = bgColor || '#000';
    cx.fillRect(0, 0, t.width, t.height);
    cx.drawImage(canvas, 0, 0);
    return new Promise(function (resolve) {
      t.toBlob(function (blob) {
        save(blob, (name || 'glyphforge-' + stamp()) + '.jpg');
        resolve(blob);
      }, 'image/jpeg', quality == null ? 0.92 : quality);
    });
  }

  /* --- plain text ----------------------------------------------------------- */

  function exportText(grid, trim, name) {
    var txt = SS.renderer.gridToText(grid, trim);
    save(new Blob([txt], { type: 'text/plain;charset=utf-8' }),
      (name || 'glyphforge-' + stamp()) + '.txt');
    return txt;
  }

  /* --- ANSI (24-bit colour terminal art) -------------------------------------- */

  function toANSI(grid, includeBg, bgColor) {
    var out = [];
    if (includeBg && bgColor) {
      var b = SS.palettes.hexToRgb(bgColor);
      out.push('[48;2;' + b[0] + ';' + b[1] + ';' + b[2] + 'm');
    }
    for (var y = 0; y < grid.rows; y++) {
      var last = -1;
      var line = '';
      for (var x = 0; x < grid.cols; x++) {
        var i = y * grid.cols + x;
        var ch = grid.chars[i];
        if (ch == null) { line += ' '; continue; }
        var key = (grid.colors[i * 3] << 16) | (grid.colors[i * 3 + 1] << 8) | grid.colors[i * 3 + 2];
        if (key !== last) {
          line += '[38;2;' + grid.colors[i * 3] + ';' +
            grid.colors[i * 3 + 1] + ';' + grid.colors[i * 3 + 2] + 'm';
          last = key;
        }
        line += ch;
      }
      out.push(line);
    }
    return out.join('\n') + '[0m\n';
  }

  function exportANSI(grid, includeBg, bgColor, name) {
    var txt = toANSI(grid, includeBg, bgColor);
    save(new Blob([txt], { type: 'text/plain;charset=utf-8' }),
      (name || 'glyphforge-' + stamp()) + '.ans');
    return txt;
  }

  /* --- SVG ------------------------------------------------------------------
     One <text> per run of same-coloured cells, with textLength forcing exact
     cell alignment regardless of the viewer's font metrics.
     -------------------------------------------------------------------------- */

  function toSVG(grid, state) {
    var pad = state.padding | 0;
    var W = grid.width + pad * 2, H = grid.height + pad * 2;
    var fontSize = grid.cellH * (state.fontScale || 1);
    var parts = [];

    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
      '" viewBox="0 0 ' + W + ' ' + H + '">');
    parts.push('<title>Glyphforge plate</title>');

    if (state.bgMode === 'solid') {
      parts.push('<rect width="100%" height="100%" fill="' + escapeXml(state.bgColor) + '"/>');
    } else if (state.bgMode === 'gradient') {
      parts.push('<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + escapeXml(state.bgColor) + '"/>' +
        '<stop offset="1" stop-color="' + escapeXml(state.bgColor2) + '"/>' +
        '</linearGradient></defs>');
      parts.push('<rect width="100%" height="100%" fill="url(#bg)"/>');
    }

    var fam = escapeXml(grid.fontStack);
    parts.push('<g font-family="' + fam + '" font-size="' + fontSize.toFixed(2) +
      '" font-weight="' + (state.fontWeight || 400) + '"' +
      (state.fontItalic ? ' font-style="italic"' : '') +
      ' text-anchor="middle" dominant-baseline="central" xml:space="preserve">');

    for (var y = 0; y < grid.rows; y++) {
      var cy = y * grid.cellH + grid.cellH / 2 + pad + (state.nudgeY || 0);
      var runStart = -1, runColor = -1, runText = '';

      function flush(endX) {
        if (runStart < 0 || !runText.trim()) { runStart = -1; runText = ''; return; }
        var len = endX - runStart;
        var cx = runStart * grid.cellW + (len * grid.cellW) / 2 + pad + (state.nudgeX || 0);
        parts.push('<text x="' + cx.toFixed(2) + '" y="' + cy.toFixed(2) +
          '" textLength="' + (len * grid.cellW).toFixed(2) + '" lengthAdjust="spacing" fill="#' +
          ('000000' + runColor.toString(16)).slice(-6) + '">' + escapeXml(runText) + '</text>');
        runStart = -1; runText = '';
      }

      for (var x = 0; x < grid.cols; x++) {
        var i = y * grid.cols + x;
        var ch = grid.chars[i];
        var key = ch == null ? -1 :
          ((grid.colors[i * 3] << 16) | (grid.colors[i * 3 + 1] << 8) | grid.colors[i * 3 + 2]);

        if (ch == null) { flush(x); continue; }
        if (runStart < 0) { runStart = x; runColor = key; runText = ch; }
        else if (key === runColor) { runText += ch; }
        else { flush(x); runStart = x; runColor = key; runText = ch; }
      }
      flush(grid.cols);
    }

    parts.push('</g></svg>');
    return parts.join('\n');
  }

  function exportSVG(grid, state, name) {
    var svg = toSVG(grid, state);
    save(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      (name || 'glyphforge-' + stamp()) + '.svg');
    return svg;
  }

  /* --- HTML ------------------------------------------------------------------
     Letter-spacing is measured against the real font so the exported page keeps
     the same cell pitch as the canvas.
     -------------------------------------------------------------------------- */

  var measureCv = document.createElement('canvas');
  var measureCx = measureCv.getContext('2d');

  function measureAdvance(fontCss) {
    measureCx.font = fontCss;
    return measureCx.measureText('M').width;
  }

  function toHTML(grid, state) {
    var fontSize = grid.cellH * (state.fontScale || 1);
    var adv = measureAdvance(grid.font) || fontSize * 0.6;
    var ls = grid.cellW - adv;

    var body = [];
    for (var y = 0; y < grid.rows; y++) {
      var runColor = -1, runText = '';
      var line = [];

      function flush() {
        if (!runText) return;
        if (runColor < 0) line.push(escapeHtml(runText));
        else line.push('<i style="color:#' + ('000000' + runColor.toString(16)).slice(-6) + '">' +
          escapeHtml(runText) + '</i>');
        runText = '';
      }

      for (var x = 0; x < grid.cols; x++) {
        var i = y * grid.cols + x;
        var ch = grid.chars[i];
        if (ch == null) ch = ' ';
        var key = grid.chars[i] == null ? -1 :
          ((grid.colors[i * 3] << 16) | (grid.colors[i * 3 + 1] << 8) | grid.colors[i * 3 + 2]);
        if (runText && key !== runColor) flush();
        runColor = key;
        runText += ch;
      }
      flush();
      body.push(line.join(''));
    }

    var bg = state.bgMode === 'transparent' ? 'transparent' : state.bgColor;
    return [
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<title>Glyphforge plate</title>',
      '<style>',
      '  html,body{margin:0;background:' + bg + ';}',
      '  pre{',
      '    font-family:' + grid.fontStack + ';',
      '    font-size:' + fontSize.toFixed(2) + 'px;',
      '    line-height:' + grid.cellH + 'px;',
      '    letter-spacing:' + ls.toFixed(3) + 'px;',
      '    font-weight:' + (state.fontWeight || 400) + ';',
      (state.fontItalic ? '    font-style:italic;' : ''),
      '    margin:0;padding:' + (state.padding | 0) + 'px;',
      '    color:' + state.fgColor + ';',
      '    white-space:pre;display:inline-block;',
      '  }',
      '  i{font-style:inherit;}',
      '</style>',
      '<pre>' + body.join('\n') + '</pre>'
    ].join('\n');
  }

  function exportHTML(grid, state, name) {
    var html = toHTML(grid, state);
    save(new Blob([html], { type: 'text/html;charset=utf-8' }),
      (name || 'glyphforge-' + stamp()) + '.html');
    return html;
  }

  /* --- animation -------------------------------------------------------------
     `renderFrame(t, i)` must paint the shared canvas and return it. Frame-exact
     formats (GIF, PNG sequence, text sequence) step the clock deterministically;
     WebM rides MediaRecorder and therefore runs in real time.
     -------------------------------------------------------------------------- */

  function idle() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  function recordGIF(opts) {
    var frames = opts.frameCount;
    var delay = 1000 / opts.fps;
    var canvas = opts.canvas;
    var collected = [];

    // Pass 1: render and collect pixels so the palette can see the whole clip.
    var chain = Promise.resolve();
    for (var i = 0; i < frames; i++) {
      (function (idx) {
        chain = chain.then(function () {
          // renderFrame may be async (video sources have to seek first).
          return Promise.resolve(opts.renderFrame(idx / opts.fps, idx));
        }).then(function () {
          var cx = canvas.getContext('2d');
          var id = cx.getImageData(0, 0, canvas.width, canvas.height);
          collected.push(id.data);
          if (opts.onProgress) opts.onProgress(idx / frames * 0.55, 'rendering frame ' + (idx + 1) + ' / ' + frames);
          return (idx % 3 === 0) ? idle() : null;
        });
      })(i);
    }

    return chain.then(function () {
      if (opts.onProgress) opts.onProgress(0.58, 'building palette');
      return idle();
    }).then(function () {
      var pal = SS.gifenc.quantize(collected, opts.maxColors || 256);
      var enc = new SS.gifenc.Encoder(canvas.width, canvas.height, {
        loop: 0, palette: pal, dither: !!opts.gifDither
      });
      var c2 = Promise.resolve();
      collected.forEach(function (data, idx) {
        c2 = c2.then(function () {
          enc.addFrame(data, delay);
          if (opts.onProgress) {
            opts.onProgress(0.6 + (idx / frames) * 0.4, 'encoding frame ' + (idx + 1) + ' / ' + frames);
          }
          return (idx % 3 === 0) ? idle() : null;
        });
      });
      return c2.then(function () {
        var blob = enc.finish();
        save(blob, (opts.name || 'glyphforge-' + stamp()) + '.gif');
        return blob;
      });
    });
  }

  function recordFrameZip(opts) {
    var frames = opts.frameCount;
    var canvas = opts.canvas;
    var entries = [];
    var chain = Promise.resolve();
    var pad = String(frames).length;

    for (var i = 0; i < frames; i++) {
      (function (idx) {
        chain = chain.then(function () {
          return Promise.resolve(opts.renderFrame(idx / opts.fps, idx));
        }).then(function () {
          return new Promise(function (resolve) {
            canvas.toBlob(function (blob) {
              blob.arrayBuffer().then(function (ab) {
                var num = String(idx).padStart(pad, '0');
                entries.push({ name: 'frame_' + num + '.png', data: new Uint8Array(ab) });
                if (opts.onProgress) opts.onProgress((idx + 1) / frames, 'frame ' + (idx + 1) + ' / ' + frames);
                resolve();
              });
            }, 'image/png');
          });
        });
      })(i);
    }

    return chain.then(function () {
      var blob = SS.zip.build(entries);
      save(blob, (opts.name || 'glyphforge-' + stamp()) + '-frames.zip');
      return blob;
    });
  }

  function recordTextZip(opts) {
    var frames = opts.frameCount;
    var entries = [];
    var enc = new TextEncoder();
    var chain = Promise.resolve();
    var pad = String(frames).length;

    for (var i = 0; i < frames; i++) {
      (function (idx) {
        chain = chain.then(function () {
          return Promise.resolve(opts.renderFrame(idx / opts.fps, idx, true));
        }).then(function (grid) {
          var txt = SS.renderer.gridToText(grid, true);
          entries.push({
            name: 'frame_' + String(idx).padStart(pad, '0') + '.txt',
            data: enc.encode(txt)
          });
          if (opts.onProgress) opts.onProgress((idx + 1) / frames, 'frame ' + (idx + 1) + ' / ' + frames);
          return (idx % 8 === 0) ? idle() : null;
        });
      })(i);
    }

    return chain.then(function () {
      var blob = SS.zip.build(entries);
      save(blob, (opts.name || 'glyphforge-' + stamp()) + '-text.zip');
      return blob;
    });
  }

  function pickVideoMime() {
    var candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (global.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  function recordVideo(opts) {
    return new Promise(function (resolve, reject) {
      if (!global.MediaRecorder) {
        reject(new Error('MediaRecorder is unavailable in this browser.'));
        return;
      }
      var canvas = opts.canvas;
      var mime = pickVideoMime();
      var stream = canvas.captureStream(0);
      var track = stream.getVideoTracks()[0];
      var rec = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: opts.bitrate || 12000000
      });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { reject(e.error || new Error('Recording failed.')); };
      rec.onstop = function () {
        var ext = mime.indexOf('mp4') >= 0 ? '.mp4' : '.webm';
        var blob = new Blob(chunks, { type: mime || 'video/webm' });
        save(blob, (opts.name || 'glyphforge-' + stamp()) + ext);
        try { track.stop(); } catch (e) {}
        resolve(blob);
      };

      rec.start();

      var frames = opts.frameCount;
      var interval = 1000 / opts.fps;
      var i = 0;
      var startedAt = performance.now();

      function step() {
        if (i >= frames) {
          setTimeout(function () { rec.stop(); }, interval * 2);
          return;
        }
        Promise.resolve(opts.renderFrame(i / opts.fps, i)).then(function () {
          if (track.requestFrame) track.requestFrame();
          else if (stream.requestFrame) stream.requestFrame();
          if (opts.onProgress) opts.onProgress((i + 1) / frames, 'frame ' + (i + 1) + ' / ' + frames);
          i++;
          // Pace to wall clock so the recorded timeline matches the intended fps.
          var due = startedAt + i * interval;
          setTimeout(step, Math.max(0, due - performance.now()));
        }).catch(function (err) {
          try { rec.stop(); } catch (e) {}
          reject(err);
        });
      }
      step();
    });
  }

  SS.exporters = {
    save: save,
    stamp: stamp,
    exportPNG: exportPNG,
    exportJPEG: exportJPEG,
    exportText: exportText,
    exportANSI: exportANSI,
    exportSVG: exportSVG,
    exportHTML: exportHTML,
    toANSI: toANSI,
    toSVG: toSVG,
    toHTML: toHTML,
    recordGIF: recordGIF,
    recordVideo: recordVideo,
    recordFrameZip: recordFrameZip,
    recordTextZip: recordTextZip,
    pickVideoMime: pickVideoMime
  };
})(window);
