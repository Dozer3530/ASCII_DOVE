/* ==========================================================================
   ASCII_DOVE — mobile.js
   Touch front-end. Drives the same engine as the desktop app (renderer,
   imageproc, media, params, presets, exporters) but replaces ui.js/main.js
   entirely — neither is loaded here, so the desktop shell is untouched.

   The premise is different too: a phone is a camera, not a workstation. This
   exposes a curated dozen controls instead of all 73, and defaults to a
   cheaper render because phone CPUs are several times slower.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = global.SS;
  var P = SS.params;

  var plate = document.getElementById('plate');
  var ctx = plate.getContext('2d', { willReadFrequently: true });
  var stage = document.getElementById('stage');

  var state = P.defaults();
  var lastGrid = null;
  var dirty = true;
  var renderMs = 0;
  var view = { x: 0, y: 0, z: 1, fitted: true };

  /* Presets worth having on a phone: strong, legible, and cheap to render.
     The full 47 are still reachable through a saved preset or the desktop. */
  var STRIP = [
    'Amber Terminal', 'Braille Etching', 'Illuminated', 'Mosaic', 'Neon Sigil',
    'Green Phosphor', 'Ink on Vellum', 'Woodcut', 'Game Boy', 'Halftone Press',
    'Cold Cyanotype', 'Quilt', 'Star Chart', 'Matrix Cascade', 'Zodiac Wheel',
    'Risograph', 'Moon Phase', 'Circuit Trace'
  ];

  /* Phones are roughly 4-8x slower than the desktop this was tuned on, so the
     mobile baseline is fewer columns and no edge pass until asked for. */
  var MOBILE_DEFAULTS = {
    cols: 92, cellW: 7, cellRatio: 2, padding: 10,
    edgeMode: 'off', edgeSuper: 2, bloom: 0, glow: 0
  };

  /* ───────────────────────── toast ───────────────────────── */

  var toastRoot = document.getElementById('toasts');
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    toastRoot.appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 3800 : 2200);
  }

  /* ───────────────────────── render ───────────────────────── */

  function requestRender() { dirty = true; }

  function flush() { if (dirty) draw(); }

  function draw() {
    var src = SS.media.current;
    if (!src || !src.width || !src.height) return;
    var t0 = performance.now();
    try {
      lastGrid = SS.renderer.render(ctx, src, state);
    } catch (e) {
      toast('Render failed: ' + e.message, true);
      return;
    }
    renderMs = performance.now() - t0;
    dirty = false;
    if (view.fitted) fit(); else applyView();
    var s = document.getElementById('mStats');
    if (s && lastGrid) {
      s.textContent = lastGrid.cols + '×' + lastGrid.rows + ' cells · ' + renderMs.toFixed(0) + ' ms';
    }
  }

  function loop() {
    var src = SS.media.current;
    if (dirty || (src && src.live)) draw();
    requestAnimationFrame(loop);
  }

  /* ───────────────────────── viewport ───────────────────────── */

  function applyView() {
    plate.style.transform =
      'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')';
  }

  function fit() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!plate.width || !plate.height) return;
    view.z = Math.min(w / plate.width, h / plate.height) * 0.96;
    view.x = (w - plate.width * view.z) / 2;
    view.y = (h - plate.height * view.z) / 2;
    view.fitted = true;
    applyView();
  }

  function wireGestures() {
    var pts = new Map();
    var start = null;
    var hint = document.getElementById('stageHint');
    var hintGone = false;

    function hideHint() {
      if (hintGone) return;
      hintGone = true;
      hint.classList.add('gone');
    }

    function centroid() {
      var xs = 0, ys = 0, n = 0;
      pts.forEach(function (p) { xs += p.x; ys += p.y; n++; });
      return { x: xs / n, y: ys / n, n: n };
    }
    function spread() {
      var a = Array.from(pts.values());
      if (a.length < 2) return 0;
      return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }

    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      start = { c: centroid(), d: spread(), x: view.x, y: view.y, z: view.z };
    });

    stage.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!start) return;
      hideHint();

      var c = centroid();
      var rect = stage.getBoundingClientRect();

      if (pts.size >= 2 && start.d > 0) {
        // Pinch: scale about the gesture centroid so it stays put.
        var scale = spread() / start.d;
        var nz = Math.max(0.05, Math.min(12, start.z * scale));
        var mx = c.x - rect.left, my = c.y - rect.top;
        var sx = start.c.x - rect.left, sy = start.c.y - rect.top;
        view.x = mx - (sx - start.x) * (nz / start.z);
        view.y = my - (sy - start.y) * (nz / start.z);
        view.z = nz;
      } else {
        view.x = start.x + (c.x - start.c.x);
        view.y = start.y + (c.y - start.c.y);
      }
      view.fitted = false;
      applyView();
    });

    function release(e) {
      pts.delete(e.pointerId);
      if (pts.size === 0) start = null;
      else start = { c: centroid(), d: spread(), x: view.x, y: view.y, z: view.z };
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    var lastTap = 0;
    stage.addEventListener('click', function () {
      var now = Date.now();
      if (now - lastTap < 300) { fit(); hideHint(); }
      lastTap = now;
    });

    global.addEventListener('resize', function () { if (view.fitted) fit(); });
    global.addEventListener('orientationchange', function () {
      setTimeout(function () { fit(); }, 250);
    });
  }

  /* ───────────────────────── sliders ───────────────────────── */

  function slider(host, key, label, opts) {
    opts = opts || {};
    var p = P.BY_KEY[key];
    var min = opts.min != null ? opts.min : p.min;
    var max = opts.max != null ? opts.max : p.max;
    var step = opts.step != null ? opts.step : p.step;

    var row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      '<div class="row-head"><span class="row-label"></span><span class="row-val"></span></div>';
    var input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    row.appendChild(input);
    row.querySelector('.row-label').textContent = label;
    host.appendChild(row);

    var valEl = row.querySelector('.row-val');

    function paint() {
      var dyn = max;
      if (p.dynamicMax) { try { dyn = Math.max(min + 1, p.dynamicMax(state)); } catch (e) {} }
      if (String(input.max) !== String(dyn)) input.max = dyn;
      var v = Math.min(dyn, state[key]);
      input.value = v;
      valEl.textContent = step >= 1 ? Math.round(v) : v.toFixed(2);
      input.style.setProperty('--fill', ((v - min) / (dyn - min) * 100).toFixed(1) + '%');
    }

    input.addEventListener('input', function () {
      state[key] = parseFloat(input.value);
      paint();
      requestRender();
      saveSession();
    });

    return paint;
  }

  var repaints = [];
  function syncAll() { repaints.forEach(function (f) { f(); }); }

  /* ───────────────────────── sheets ───────────────────────── */

  var veil = document.getElementById('sheetVeil');
  var openSheet = null;

  function sheet(id) {
    closeSheet();
    var el = document.getElementById(id);
    el.hidden = false;
    veil.hidden = false;
    openSheet = el;
    syncAll();
  }
  function closeSheet() {
    if (openSheet) openSheet.hidden = true;
    openSheet = null;
    veil.hidden = true;
    document.querySelectorAll('.act').forEach(function (a) { a.classList.remove('on'); });
  }
  veil.addEventListener('click', closeSheet);
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', closeSheet);
  });

  /* ───────────────────────── preset strip ───────────────────────── */

  function buildStrip() {
    var strip = document.getElementById('presetStrip');
    STRIP.forEach(function (name) {
      var p = SS.presets.FACTORY.filter(function (x) { return x.name === name; })[0];
      if (!p) return;
      var b = document.createElement('button');
      b.className = 'chip';
      b.textContent = name;
      b.dataset.preset = name;
      b.addEventListener('click', function () { applyPreset(p); });
      strip.appendChild(b);
    });
  }

  function markStrip(name) {
    document.querySelectorAll('.chip').forEach(function (c) {
      c.classList.toggle('on', c.dataset.preset === name);
    });
  }

  function applyPreset(p) {
    var ex = SS.presets.expand(p);
    state = Object.assign(ex.state, MOBILE_DEFAULTS);
    // A preset's own grid choice is usually desktop-scale; keep ours but
    // respect a deliberately chunky cell.
    if (ex.state.cellRatio) state.cellRatio = ex.state.cellRatio;
    state.cols = MOBILE_DEFAULTS.cols;
    markStrip(p.name);
    view.fitted = true;
    syncAll();
    syncSelects();
    requestRender();
    saveSession();
    toast(p.name);
  }

  /* ───────────────────────── selects ───────────────────────── */

  function fillSelect(el, opts) {
    el.innerHTML = '';
    opts.forEach(function (o) {
      var n = document.createElement('option');
      n.value = o.value; n.textContent = o.label;
      el.appendChild(n);
    });
  }

  function syncSelects() {
    var set = document.getElementById('mSet');
    if (set.value !== state.setId) set.value = state.setId;
    document.getElementById('mReverse').checked = !!state.reverse;
    document.getElementById('mInvert').checked = !!state.invert;
    document.getElementById('mEdges').checked = state.edgeMode !== 'off';
    document.getElementById('mColorMode').value = state.colorMode;
    document.getElementById('mPalette').value = state.paletteId;
    document.getElementById('mGradient').value = state.gradientId;
    document.getElementById('palWrap').hidden = state.colorMode !== 'palette';
    document.getElementById('gradWrap').hidden = state.colorMode !== 'gradient';

    var glyphs = SS.charsets.resolve({
      setId: state.setId, custom: '', injectMode: 'mix', reverse: state.reverse
    });
    var r = document.getElementById('rampPreview');
    r.textContent = glyphs.join('');
    r.style.fontFamily = SS.renderer.fontStack(state);
  }

  /* ───────────────────────── session ───────────────────────── */

  var saveTimer = null;
  function saveSession() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem('asciidove.mobile.v1', JSON.stringify(state)); } catch (e) {}
    }, 600);
  }
  function loadSession() {
    try {
      var raw = localStorage.getItem('asciidove.mobile.v1');
      if (!raw) return null;
      return P.sanitize(JSON.parse(raw));
    } catch (e) { return null; }
  }

  /* ───────────────────────── sources ───────────────────────── */

  var facing = 'environment';
  var camBusy = false;

  function useCamera() {
    if (camBusy) return;                       // double-taps race the hardware
    camBusy = true;

    var want = facing;
    var wasLive = !!(SS.media.current && SS.media.current.live);

    // The running camera has to be released first. Holding both is what makes
    // the second getUserMedia fail on a phone.
    if (wasLive) SS.media.stopLive();
    toast(wasLive ? 'Switching camera…' : 'Starting camera…');

    SS.media.startWebcam(want).then(function () {
      facing = want === 'user' ? 'environment' : 'user';
      view.fitted = true;
      requestRender();
      toast(want === 'user' ? 'Front camera · tap to flip' : 'Rear camera · tap to flip');
    }).catch(function (e) {
      // We already let go of the old stream, so recover rather than leaving a
      // dead viewport: any camera, else back to the built-in chart.
      return SS.media.startWebcam().then(function () {
        view.fitted = true;
        requestRender();
        toast('Could not switch camera — kept the current one', true);
      }).catch(function () {
        SS.media.setSource(SS.media.buildDefault());
        view.fitted = true;
        requestRender();
        toast(e && e.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : 'Camera unavailable' + (e && e.name ? ' (' + e.name + ')' : ''), true);
      });
    }).then(function () { camBusy = false; }, function () { camBusy = false; });
  }

  /* ───────────────────────── export ───────────────────────── */

  function plateBlob() {
    return new Promise(function (res) { plate.toBlob(res, 'image/png'); });
  }

  function wireSave() {
    var share = document.getElementById('saveShare');
    var canShare = !!(navigator.canShare && navigator.share);
    share.hidden = !canShare;

    share.addEventListener('click', function () {
      flush();
      plateBlob().then(function (blob) {
        var file = new File([blob], 'ascii_dove.png', { type: 'image/png' });
        if (!navigator.canShare({ files: [file] })) { toast('Sharing images is not supported here', true); return; }
        navigator.share({ files: [file], title: 'ASCII_DOVE' })
          .catch(function (e) { if (e.name !== 'AbortError') toast('Share cancelled'); });
      });
    });

    document.getElementById('savePng').addEventListener('click', function () {
      flush();
      SS.exporters.exportPNG(plate, 1);
      toast('PNG saved');
      closeSheet();
    });
    document.getElementById('saveTxt').addEventListener('click', function () {
      flush();
      if (!lastGrid) return;
      SS.exporters.exportText(lastGrid, true);
      toast('Text saved');
      closeSheet();
    });
    document.getElementById('saveCopy').addEventListener('click', function () {
      flush();
      if (!lastGrid) return;
      var txt = SS.renderer.gridToText(lastGrid, true);
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
        .then(function () { toast(txt.length.toLocaleString() + ' characters copied'); })
        .catch(function () { toast('Copy blocked by the browser', true); });
    });
  }

  /* ───────────────────────── boot ───────────────────────── */

  function boot() {
    var restored = loadSession();
    state = Object.assign(
      restored || SS.presets.expand(SS.presets.FACTORY[1]).state,
      restored ? {} : MOBILE_DEFAULTS
    );

    // sheets
    var look = document.getElementById('lookSliders');
    repaints.push(slider(look, 'depth', 'Depth'));
    repaints.push(slider(look, 'offset', 'Offset', { min: -64, max: 64 }));

    var tone = document.getElementById('toneSliders');
    repaints.push(slider(tone, 'brightness', 'Brightness'));
    repaints.push(slider(tone, 'contrast', 'Contrast'));
    repaints.push(slider(tone, 'gamma', 'Gamma'));
    repaints.push(slider(tone, 'exposure', 'Exposure'));

    var more = document.getElementById('moreSliders');
    repaints.push(slider(more, 'cols', 'Detail (columns)', { min: 40, max: 220 }));
    repaints.push(slider(more, 'cellRatio', 'Cell aspect'));
    repaints.push(slider(more, 'saturation', 'Saturation'));

    fillSelect(document.getElementById('mSet'), P.optionsOf(P.BY_KEY.setId));
    fillSelect(document.getElementById('mPalette'), P.optionsOf(P.BY_KEY.paletteId));
    fillSelect(document.getElementById('mGradient'), P.optionsOf(P.BY_KEY.gradientId));

    document.getElementById('mSet').addEventListener('change', function () {
      state.setId = this.value;
      var len = SS.charsets.resolve({ setId: state.setId, custom: '', injectMode: 'mix' }).length;
      if (state.depth > len) state.depth = len;
      syncAll(); syncSelects(); requestRender(); saveSession();
    });
    ['mReverse:reverse', 'mInvert:invert'].forEach(function (pair) {
      var bits = pair.split(':');
      document.getElementById(bits[0]).addEventListener('change', function () {
        state[bits[1]] = this.checked;
        syncSelects(); requestRender(); saveSession();
      });
    });
    document.getElementById('mEdges').addEventListener('change', function () {
      state.edgeMode = this.checked ? 'overlay' : 'off';
      if (this.checked) { state.edgeStrength = 1.8; state.edgeThreshold = 0.3; }
      requestRender(); saveSession();
    });
    document.getElementById('mColorMode').addEventListener('change', function () {
      state.colorMode = this.value; syncSelects(); requestRender(); saveSession();
    });
    document.getElementById('mPalette').addEventListener('change', function () {
      state.paletteId = this.value; requestRender(); saveSession();
    });
    document.getElementById('mGradient').addEventListener('change', function () {
      state.gradientId = this.value; requestRender(); saveSession();
    });

    // actions
    document.getElementById('actCamera').addEventListener('click', useCamera);
    document.getElementById('actOpen').addEventListener('click', function () {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', function () {
      if (!this.files || !this.files.length) return;
      toast('Reading…');
      SS.media.loadFiles(this.files).then(function () {
        view.fitted = true; requestRender(); toast('Loaded');
      }).catch(function (e) { toast(e.message || 'Could not read that file', true); });
      this.value = '';
    });
    document.getElementById('actLook').addEventListener('click', function () {
      this.classList.add('on'); sheet('sheetLook');
    });
    document.getElementById('actTone').addEventListener('click', function () {
      this.classList.add('on'); sheet('sheetTone');
    });
    document.getElementById('actSave').addEventListener('click', function () {
      flush();
      var n = lastGrid ? lastGrid.cols * lastGrid.rows : 0;
      document.getElementById('saveNote').textContent =
        plate.width + ' × ' + plate.height + ' px · ' + n.toLocaleString() + ' characters';
      sheet('sheetSave');
    });
    document.getElementById('btnMore').addEventListener('click', function () { sheet('sheetMore'); });
    document.getElementById('btnRoll').addEventListener('click', function () {
      var p = SS.presets.FACTORY[Math.floor(Math.random() * SS.presets.FACTORY.length)];
      applyPreset(p);
    });

    // undo: one level, enough for a phone
    var undoStack = [];
    var btnUndo = document.getElementById('btnUndo');
    function pushUndo() {
      undoStack.push(JSON.stringify(state));
      if (undoStack.length > 20) undoStack.shift();
      btnUndo.disabled = false;
    }
    btnUndo.addEventListener('click', function () {
      if (!undoStack.length) return;
      state = P.sanitize(JSON.parse(undoStack.pop()));
      btnUndo.disabled = !undoStack.length;
      syncAll(); syncSelects(); requestRender();
    });
    var origApply = applyPreset;
    applyPreset = function (p) { pushUndo(); origApply(p); };

    wireGestures();
    wireSave();
    buildStrip();
    syncSelects();

    SS.media.setSource(SS.media.buildDefault());
    requestRender();
    loop();

    setTimeout(function () {
      document.getElementById('stageHint').classList.add('gone');
    }, 4200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
