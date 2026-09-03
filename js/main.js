/* ==========================================================================
   ASCII_DOVE — main.js
   Application controller: state, the render loop, the viewport, input,
   presets and the export dialogs.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = global.SS;
  var UI = SS.ui;
  var P = SS.params;
  var $ = UI.$;

  /* ───────────────────────── state ───────────────────────── */

  var state = P.defaults();
  var bindings = {};              // paramKey -> LFO binding
  var clock = SS.anim.makeClock();

  var plate = document.getElementById('plate');
  var ctx = plate.getContext('2d', { willReadFrequently: true });

  var lastGrid = null;
  var lastAnimState = state;
  var dirty = true;
  var renderMs = 0;

  var view = { x: 0, y: 0, z: 1, userZoomed: false };
  var lastPlateSize = { w: 0, h: 0 };

  var armoury, controls, animEditor;
  var exporting = false;
  var cancelExport = false;

  /* ───────────────────────── boot ───────────────────────── */

  function boot() {
    UI.initModals(function () { /* modal closed */ });

    controls = UI.buildControls({
      onChange: setParam,
      onAnim: openAnim
    });

    armoury = UI.buildArmoury({
      getState: function () { return state; },
      onPick: function (id) { setParam('setId', id); }
    });

    animEditor = UI.buildAnimEditor({
      onChange: function (key, b) {
        beginChange(false);
        bindings[key] = b;
        if (!b.enabled) delete bindings[key];
        syncUI();
        requestRender();
      },
      onClear: function (key) {
        beginChange(true);
        delete bindings[key];
        syncUI();
        requestRender();
      }
    });

    // Any source change refreshes the readout, however it was triggered.
    SS.media.on(function (type) {
      if (type === 'source') { updateSourceInfo(); updateTransportBadge(); requestRender(); }
    });

    wireTopBar();
    wireStage();
    wireTransport();
    wireExport();
    wirePresets();
    wireKeys();

    // Restore the last session if there is one, otherwise open on a preset that
    // shows the tool off rather than a bare default.
    var session = SS.presets.loadSession();
    if (session) {
      state = session.state;
      bindings = session.bindings;
    } else {
      var opener = SS.presets.expand(SS.presets.FACTORY[1]); // Amber Terminal
      state = opener.state;
      bindings = opener.bindings;
    }

    refreshPresetSelect();
    SS.media.setSource(SS.media.buildDefault());
    syncUI();
    requestRender();
    loop();

    UI.toast('Drop an image anywhere · press ? for shortcuts', 'good', 4200);
  }

  /* ───────────────────────── parameter plumbing ───────────────────────── */

  function setParam(key, value) {
    var p = P.BY_KEY[key];
    if (!p) return;

    // Sliders, colour pickers and text fields all fire continuously while
    // you work them, so those coalesce into one undo step; a select or a
    // toggle is a single deliberate act and commits on its own.
    beginChange(p.type === 'select' || p.type === 'toggle');

    state[key] = P.coerce(key, value);

    // Depth must stay inside the (possibly new) ramp length.
    if (key === 'setId' || key === 'customChars' || key === 'injectMode' || key === 'dedupe') {
      var len = SS.charsets.resolve({
        setId: state.setId, custom: state.customChars, injectMode: state.injectMode,
        reverse: state.reverse, dedupe: state.dedupe
      }).length;
      if (state.depth > len) state.depth = len;
      armoury.repaint();
    }
    if (key === 'fontFamily' || key === 'reverse' || key === 'autoDensity') armoury.repaint();

    syncUI();
    requestRender();
    scheduleSessionSave();
  }

  var saveTimer = null;
  function scheduleSessionSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      SS.presets.saveSession(state, bindings);
    }, 700);
  }

  /* ───────────────────────── history ─────────────────────────
     Undo covers the whole parameter set plus the LFO bindings, since those
     are the two things a preset load or a Roll replaces wholesale.

     Dragging a slider fires dozens of changes a second, so continuous edits
     are coalesced: the state from *before* the first change is held aside and
     only committed once the edits stop. Discrete changes (a select, a toggle,
     a preset load) commit straight away.
     ------------------------------------------------------------------------- */

  var HISTORY_LIMIT = 80;
  var COALESCE_MS = 450;
  var history = { past: [], future: [], pending: null, timer: null };

  function snapshot() {
    var snap = {
      state: Object.assign({}, state),
      bindings: JSON.parse(JSON.stringify(bindings))
    };
    snap.key = JSON.stringify(snap.state) + '|' + JSON.stringify(snap.bindings);
    return snap;
  }

  function restore(snap) {
    state = Object.assign({}, snap.state);
    bindings = JSON.parse(JSON.stringify(snap.bindings));
  }

  function pushHistory(snap) {
    var last = history.past[history.past.length - 1];
    if (last && last.key === snap.key) return;      // nothing actually moved
    history.past.push(snap);
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.future.length = 0;                       // a new edit forks the timeline
  }

  /**
   * Call immediately BEFORE mutating state.
   * @param {boolean} immediate  true for discrete edits, false to coalesce.
   */
  function beginChange(immediate) {
    if (!history.pending) history.pending = snapshot();
    clearTimeout(history.timer);
    if (immediate) commitPending();
    else history.timer = setTimeout(commitPending, COALESCE_MS);
  }

  function commitPending() {
    clearTimeout(history.timer);
    if (!history.pending) return;
    pushHistory(history.pending);
    history.pending = null;
    updateHistoryButtons();
  }

  /** Record a restore point right now, for a wholesale replacement. */
  function recordNow() {
    commitPending();
    pushHistory(snapshot());
    updateHistoryButtons();
  }

  function undo() {
    commitPending();
    if (!history.past.length) { UI.toast('Nothing left to undo'); return; }
    history.future.push(snapshot());
    restore(history.past.pop());
    afterHistoryMove('Undo');
  }

  function redo() {
    commitPending();
    if (!history.future.length) { UI.toast('Nothing to redo'); return; }
    history.past.push(snapshot());
    restore(history.future.pop());
    afterHistoryMove('Redo');
  }

  function afterHistoryMove(label) {
    // The LFO editor builds its controls from the binding it was opened with,
    // so close it rather than let the dialog and the state disagree.
    if (UI.isModalOpen() === 'modalAnim') UI.closeModal();
    view.userZoomed = false;
    syncUI();
    requestRender();
    scheduleSessionSave();
    updateHistoryButtons();
    UI.toast(label + ' — ' + history.past.length + ' back, ' + history.future.length + ' forward');
  }

  function updateHistoryButtons() {
    var u = $('#btnUndo'), r = $('#btnRedo');
    if (!u || !r) return;
    u.disabled = history.past.length === 0 && !history.pending;
    r.disabled = history.future.length === 0;
  }

  function syncUI() {
    controls.sync(state, bindings, lastAnimState);
    armoury.sync(state);
    updateTransportBadge();
  }

  function openAnim(key) {
    animEditor.open(key, bindings[key] || SS.anim.defaultBinding());
    // Opening the editor arms the LFO so you hear it immediately.
    if (!bindings[key]) {
      beginChange(true);
      bindings[key] = SS.anim.defaultBinding();
      syncUI();
      requestRender();
    }
  }

  /* ───────────────────────── render loop ───────────────────────── */

  function requestRender() { dirty = true; }

  // Anything that reads `lastGrid` or the plate pixels — the text view, every
  // export — must draw any pending change first, or it hands back the frame
  // from before the last parameter edit.
  function flushRender() {
    if (dirty) { draw(); dirty = false; }
  }

  function isMoving() {
    var src = SS.media.current;
    var hasLfo = Object.keys(bindings).some(function (k) { return bindings[k].enabled; });
    if (src && src.live) return true;
    if (clock.playing && (hasLfo || (src && src.animated))) return true;
    return false;
  }

  function loop() {
    var dt = clock.tick();

    var src = SS.media.current;
    if (src) {
      if (src.advance && clock.playing) src.advance(dt);
      if (src.kind === 'video' && clock.playing && src.paused) src.play();
      if (src.kind === 'video' && !clock.playing && !src.paused) src.pause();
    }

    if (dirty || isMoving()) {
      draw();
      dirty = false;
    }

    updateTimeReadout();
    requestAnimationFrame(loop);
  }

  function draw() {
    var src = SS.media.current;
    if (!src || !src.width || !src.height) return;

    var t0 = performance.now();
    lastAnimState = SS.anim.apply(state, bindings, clock.time);

    try {
      lastGrid = SS.renderer.render(ctx, src, lastAnimState);
    } catch (e) {
      console.error('Render failed', e);
      UI.toast('Render failed: ' + e.message, 'bad');
      return;
    }

    renderMs = performance.now() - t0;
    afterDraw();
  }

  function afterDraw() {
    if (!lastGrid) return;

    if (plate.width !== lastPlateSize.w || plate.height !== lastPlateSize.h) {
      lastPlateSize = { w: plate.width, h: plate.height };
      var wrap = document.getElementById('plateWrap');
      wrap.style.width = plate.width + 'px';
      wrap.style.height = plate.height + 'px';
      if (!view.userZoomed) fitView(); else applyView();
    }

    $('#statGrid').textContent = lastGrid.cols + '×' + lastGrid.rows;
    $('#statSize').textContent = plate.width + '×' + plate.height;
    $('#statMs').textContent = renderMs.toFixed(1);

    // Values shown next to animated sliders should track the live value.
    if (Object.keys(bindings).length) controls.sync(state, bindings, lastAnimState);
  }

  /* ───────────────────────── viewport ───────────────────────── */

  function applyView() {
    var wrap = document.getElementById('plateWrap');
    wrap.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')';
    $('#zoomLabel').textContent = Math.round(view.z * 100) + '%';
  }

  function fitView() {
    var vp = document.getElementById('viewport');
    var vw = vp.clientWidth, vh = vp.clientHeight;
    if (!plate.width || !plate.height) return;
    var z = Math.min(vw / plate.width, vh / plate.height) * 0.92;
    view.z = Math.max(0.02, Math.min(8, z));
    view.x = (vw - plate.width * view.z) / 2;
    view.y = (vh - plate.height * view.z) / 2;
    applyView();
  }

  function actualSize() {
    var vp = document.getElementById('viewport');
    view.z = 1;
    view.x = (vp.clientWidth - plate.width) / 2;
    view.y = (vp.clientHeight - plate.height) / 2;
    view.userZoomed = true;
    applyView();
  }

  function wireStage() {
    var vp = document.getElementById('viewport');
    var wrap = document.getElementById('plateWrap');

    vp.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = vp.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var factor = Math.exp(-e.deltaY * 0.0016);
      var nz = Math.max(0.02, Math.min(16, view.z * factor));
      // Keep the point under the cursor pinned.
      view.x = mx - (mx - view.x) * (nz / view.z);
      view.y = my - (my - view.y) * (nz / view.z);
      view.z = nz;
      view.userZoomed = true;
      applyView();
    }, { passive: false });

    var panning = false, px = 0, py = 0;
    vp.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.button !== 1) return;
      panning = true;
      px = e.clientX; py = e.clientY;
      vp.classList.add('is-panning');
      vp.setPointerCapture(e.pointerId);
    });
    vp.addEventListener('pointermove', function (e) {
      if (!panning) return;
      view.x += e.clientX - px;
      view.y += e.clientY - py;
      px = e.clientX; py = e.clientY;
      view.userZoomed = true;
      applyView();
    });
    ['pointerup', 'pointercancel'].forEach(function (evt) {
      vp.addEventListener(evt, function () {
        panning = false;
        vp.classList.remove('is-panning');
      });
    });
    vp.addEventListener('dblclick', function () { view.userZoomed = false; fitView(); });

    $('#btnFit').addEventListener('click', function () { view.userZoomed = false; fitView(); });
    $('#btnActual').addEventListener('click', actualSize);
    $('#btnCheck').addEventListener('click', function () {
      this.classList.toggle('is-on');
      wrap.classList.toggle('is-checker');
    });
    $('#btnPixel').addEventListener('click', function () {
      this.classList.toggle('is-on');
      vp.classList.toggle('is-crisp');
    });

    global.addEventListener('resize', function () {
      if (!view.userZoomed) fitView();
    });

    /* drag & drop anywhere */
    var veil = document.getElementById('dropVeil');
    var depth = 0;
    ['dragenter', 'dragover'].forEach(function (evt) {
      global.addEventListener(evt, function (e) {
        if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
        e.preventDefault();
        if (evt === 'dragenter') depth++;
        veil.classList.add('is-on');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      global.addEventListener(evt, function (e) {
        if (evt === 'dragleave') { depth = Math.max(0, depth - 1); if (depth) return; }
        depth = 0;
        veil.classList.remove('is-on');
      });
    });
    global.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      loadFiles(e.dataTransfer.files);
    });

    /* rail collapse */
    var body = document.querySelector('.body');
    $('#toggleLeft').addEventListener('click', function () {
      body.classList.toggle('no-left');
      this.textContent = body.classList.contains('no-left') ? '›' : '‹';
      setTimeout(function () { if (!view.userZoomed) fitView(); }, 220);
    });
    $('#toggleRight').addEventListener('click', function () {
      body.classList.toggle('no-right');
      this.textContent = body.classList.contains('no-right') ? '‹' : '›';
      setTimeout(function () { if (!view.userZoomed) fitView(); }, 220);
    });
  }

  /* ───────────────────────── sources ───────────────────────── */

  function loadFiles(files) {
    UI.toast('Reading…');
    SS.media.loadFiles(files).then(function (src) {
      onSourceLoaded(src);
    }).catch(function (err) {
      UI.toast(err.message || 'Could not read that file.', 'bad');
    });
  }

  function onSourceLoaded(src) {
    view.userZoomed = false;
    clock.reset();
    if (src.animated && src.duration) clock.loopLength = src.duration;
    updateSourceInfo();
    updateTransportBadge();
    requestRender();
    UI.toast(src.label + ' loaded', 'good');
  }

  function updateSourceInfo() {
    var src = SS.media.current;
    if (!src) return;
    $('#srcKind').textContent = src.kind;
    $('#srcName').textContent = src.label;
    $('#srcDim').textContent = (src.width || 0) + '×' + (src.height || 0) +
      (src.frameCount ? ' · ' + src.frameCount + 'f' : '');
  }

  function wireTopBar() {
    var input = document.getElementById('fileInput');
    $('#btnOpen').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files && input.files.length) loadFiles(input.files);
      input.value = '';
    });

    $('#btnCam').addEventListener('click', function () {
      SS.media.startWebcam().then(function (src) {
        onSourceLoaded(src);
        clock.start();
        updatePlayButton();
      }).catch(function (e) {
        UI.toast(e.message || 'Camera unavailable.', 'bad');
      });
    });

    $('#btnScreen').addEventListener('click', function () {
      SS.media.startScreen().then(function (src) {
        onSourceLoaded(src);
        clock.start();
        updatePlayButton();
      }).catch(function (e) {
        UI.toast(e.message || 'Screen capture cancelled.', 'bad');
      });
    });

    $('#btnSample').addEventListener('click', function () {
      SS.media.setSource(SS.media.buildDefault());
      onSourceLoaded(SS.media.current);
    });

    $('#btnText').addEventListener('click', openTextView);
    $('#btnExport').addEventListener('click', openExport);
    $('#btnHelp').addEventListener('click', function () { UI.openModal('modalHelp'); });

    $('#btnReset').addEventListener('click', function () {
      recordNow();
      state = P.defaults();
      bindings = {};
      syncUI();
      requestRender();
      UI.toast('Every parameter reset');
    });

    $('#btnRandom').addEventListener('click', roll);
    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
  }

  /* ───────────────────────── transport ───────────────────────── */

  function wireTransport() {
    $('#btnPlay').addEventListener('click', function () {
      clock.toggle();
      updatePlayButton();
      requestRender();
    });
    $('#btnRewind').addEventListener('click', function () {
      clock.reset();
      var src = SS.media.current;
      if (src && src.seek) src.seek(0);
      requestRender();
    });

    var scrub = $('#tpScrub');
    scrub.addEventListener('input', function () {
      var dur = currentDuration();
      var t = (scrub.value / 1000) * dur;
      clock.time = t;
      var src = SS.media.current;
      if (src && src.seek && src.animated) src.seek(t);
      requestRender();
    });

    $('#tpLoop').addEventListener('change', function () {
      clock.loopLength = parseFloat(this.value) || 8;
    });
    $('#tpSpeed').addEventListener('change', function () {
      clock.speed = parseFloat(this.value) || 1;
    });
  }

  function currentDuration() {
    var src = SS.media.current;
    if (src && src.animated && src.duration > 0) return src.duration;
    return clock.loopLength;
  }

  function updatePlayButton() {
    var b = $('#btnPlay');
    b.textContent = clock.playing ? '❚❚' : '▶';
    b.classList.toggle('is-on', clock.playing);
  }

  function updateTimeReadout() {
    var dur = currentDuration();
    $('#tpTime').textContent = clock.time.toFixed(2);
    $('#tpDur').textContent = dur.toFixed(2);
    var scrub = $('#tpScrub');
    if (document.activeElement !== scrub) {
      scrub.value = dur > 0 ? Math.round((clock.time % dur) / dur * 1000) : 0;
    }
  }

  function updateTransportBadge() {
    var badge = $('#tpBadge');
    var src = SS.media.current;
    var hasLfo = Object.keys(bindings).some(function (k) { return bindings[k].enabled; });
    badge.className = 'tp-badge';
    if (src && src.live) { badge.textContent = 'live'; badge.classList.add('is-live'); }
    else if (hasLfo && src && src.animated) { badge.textContent = 'motion + lfo'; badge.classList.add('is-anim'); }
    else if (hasLfo) { badge.textContent = Object.keys(bindings).length + ' lfo'; badge.classList.add('is-anim'); }
    else if (src && src.animated) { badge.textContent = src.kind; badge.classList.add('is-anim'); }
    else badge.textContent = 'static';
  }

  /* ───────────────────────── roll (random look) ─────────────────────────
     Randomises the expressive parameters and leaves geometry alone, so you
     keep your framing while the treatment changes.
     -------------------------------------------------------------------------- */

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function roll() {
    recordNow();
    var set = pick(SS.charsets.ALL);
    state.setId = set.id;
    var len = set.glyphs.length;
    state.depth = Math.max(2, Math.min(len, Math.round(rnd(3, Math.min(48, len)))));
    state.offset = 0;
    state.reverse = Math.random() < 0.25;

    state.colorMode = pick(['mono', 'source', 'palette', 'palette', 'gradient', 'duotone']);
    state.paletteId = pick(SS.palettes.PALETTES).id;
    state.gradientId = pick(SS.palettes.GRADIENTS).id;
    state.dither = pick(['none', 'none', 'floyd', 'atkinson', 'bayer4', 'bayer8']);
    state.contrast = rnd(0, 0.45);
    state.gamma = rnd(0.75, 1.5);
    state.cellW = Math.round(rnd(6, 12));
    state.cols = Math.round(rnd(110, 210));

    var wantEdges = Math.random() < 0.35;
    state.edgeMode = wantEdges ? pick(['overlay', 'overlay', 'only']) : 'off';
    state.edgeSet = pick(SS.charsets.EDGE_SETS).id;

    state.glow = Math.random() < 0.4 ? rnd(0, 8) : 0;
    state.bloom = Math.random() < 0.4 ? rnd(0.1, 0.5) : 0;
    state.scanlines = Math.random() < 0.3 ? rnd(0.1, 0.35) : 0;
    state.vignette = Math.random() < 0.5 ? rnd(0.15, 0.5) : 0;
    state.grain = Math.random() < 0.4 ? rnd(0.05, 0.25) : 0;
    state.cellFill = Math.random() < 0.2 ? rnd(0.5, 1) : 0;

    syncUI();
    requestRender();
    UI.toast('Rolled: ' + set.categoryName + ' — ' + set.name);
  }

  /* ───────────────────────── text view ───────────────────────── */

  function openTextView() {
    flushRender();
    if (!lastGrid) { UI.toast('Nothing rendered yet.', 'bad'); return; }
    var area = $('#textOut');
    var cells = lastGrid.cols * lastGrid.rows;
    if (cells > 400000) {
      UI.toast('That is ' + cells.toLocaleString() + ' cells — reduce columns first.', 'bad');
      return;
    }
    var txt = SS.renderer.gridToText(lastGrid, true);
    area.value = txt;
    $('#textStats').textContent = lastGrid.cols + ' × ' + lastGrid.rows +
      ' · ' + txt.length.toLocaleString() + ' characters';
    UI.openModal('modalText');
  }

  function wireTextView() {
    $('#txtCopy').addEventListener('click', function () {
      var t = $('#textOut').value;
      copyText(t, t.length.toLocaleString() + ' characters copied');
    });
    $('#txtSave').addEventListener('click', function () {
      SS.exporters.save(new Blob([$('#textOut').value], { type: 'text/plain;charset=utf-8' }),
        'ascii_dove-' + SS.exporters.stamp() + '.txt');
    });
  }

  function copyText(t, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () {
        UI.toast(okMsg || 'Copied', 'good');
      }).catch(function () { fallbackCopy(t, okMsg); });
    } else fallbackCopy(t, okMsg);
  }

  function fallbackCopy(t, okMsg) {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      UI.toast(okMsg || 'Copied', 'good');
    } catch (e) {
      UI.toast('Copy blocked by the browser.', 'bad');
    }
    ta.remove();
  }

  /* ───────────────────────── export ───────────────────────── */

  function openExport() {
    flushRender();
    updateExportNotes();
    UI.openModal('modalExport');
  }

  function updateExportNotes() {
    var scale = parseFloat($('#exScale').value) || 1;
    $('#exStillNote').textContent = 'Output: ' + Math.round(plate.width * scale) + ' × ' +
      Math.round(plate.height * scale) + ' px' +
      (state.bgMode === 'transparent' ? ' · PNG keeps the alpha channel, JPEG will flatten it.' : '');

    var fps = parseFloat($('#exFps').value) || 20;
    var dur = parseFloat($('#exDur').value) || 4;
    var frames = Math.max(1, Math.round(fps * dur));
    var fmt = $('#exFormat').value;
    var notes = {
      gif: frames + ' frames at ' + fps + ' fps. Every frame is rendered exactly; large plates take a while.',
      webm: frames + ' frames. MediaRecorder captures in real time, so a slow render drops frames — use GIF or PNG for exactness.',
      zip: frames + ' PNG files in one archive, frame exact.',
      txtzip: frames + ' plain-text files in one archive, frame exact.'
    };
    $('#exMotionNote').textContent = notes[fmt] || '';
    $('#gifOpts').style.display = fmt === 'gif' ? '' : 'none';

    var moving = Object.keys(bindings).some(function (k) { return bindings[k].enabled; }) ||
      (SS.media.current && SS.media.current.animated);
    if (!moving) {
      $('#exMotionNote').textContent = 'Nothing is animated — every frame would be identical. ' +
        'Bind an LFO with the ∿ buttons, or load a video.';
    }
  }

  function wireExport() {
    UI.$$('#exportTabs .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        UI.$$('#exportTabs .tab').forEach(function (t) { t.classList.toggle('is-on', t === tab); });
        UI.$$('#modalExport .tabpane').forEach(function (pane) {
          pane.classList.toggle('is-on', pane.dataset.pane === tab.dataset.tab);
        });
      });
    });

    ['exScale', 'exFps', 'exDur', 'exFormat'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', updateExportNotes);
      document.getElementById(id).addEventListener('change', updateExportNotes);
    });

    $('#exPNG').addEventListener('click', function () {
      flushRender();
      SS.exporters.exportPNG(plate, parseFloat($('#exScale').value) || 1);
      UI.toast('PNG saved', 'good');
    });
    $('#exJPG').addEventListener('click', function () {
      flushRender();
      SS.exporters.exportJPEG(plate, 0.93, state.bgColor);
      UI.toast('JPEG saved', 'good');
    });
    $('#exClip').addEventListener('click', function () {
      if (!global.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
        UI.toast('This browser cannot copy images to the clipboard.', 'bad');
        return;
      }
      flushRender();
      plate.toBlob(function (blob) {
        navigator.clipboard.write([new global.ClipboardItem({ 'image/png': blob })])
          .then(function () { UI.toast('Image copied', 'good'); })
          .catch(function (e) { UI.toast('Copy failed: ' + e.message, 'bad'); });
      }, 'image/png');
    });

    $('#exTXT').addEventListener('click', function () {
      flushRender();
      if (!lastGrid) return;
      SS.exporters.exportText(lastGrid, $('#exTrim').checked);
      UI.toast('Text saved', 'good');
    });
    $('#exANSI').addEventListener('click', function () {
      flushRender();
      if (!lastGrid) return;
      SS.exporters.exportANSI(lastGrid, state.bgMode === 'solid', state.bgColor);
      UI.toast('ANSI saved — cat it in a 24-bit terminal', 'good');
    });
    $('#exSVG').addEventListener('click', function () {
      flushRender();
      if (!lastGrid) return;
      SS.exporters.exportSVG(lastGrid, lastAnimState);
      UI.toast('SVG saved', 'good');
    });
    $('#exHTML').addEventListener('click', function () {
      flushRender();
      if (!lastGrid) return;
      SS.exporters.exportHTML(lastGrid, lastAnimState);
      UI.toast('HTML saved', 'good');
    });
    $('#exCopyText').addEventListener('click', function () {
      flushRender();
      if (!lastGrid) return;
      var t = SS.renderer.gridToText(lastGrid, $('#exTrim').checked);
      copyText(t, t.length.toLocaleString() + ' characters copied');
    });

    $('#exRender').addEventListener('click', startMotionExport);
    $('#exCancel').addEventListener('click', function () { cancelExport = true; });
  }

  /**
   * Render one frame at absolute time t for the export pipeline.
   * Video sources need an async seek; everything else is synchronous.
   */
  function exportFrame(t, i, wantGrid) {
    var src = SS.media.current;
    clock.time = t;

    function paint() {
      var st = SS.anim.apply(state, bindings, t);
      var grid = SS.renderer.render(ctx, src, st);
      lastGrid = grid;
      return wantGrid ? grid : plate;
    }

    if (src && src.kind === 'video' && src.duration) {
      return new Promise(function (resolve) {
        var target = t % src.duration;
        var done = false;
        function onSeek() {
          if (done) return;
          done = true;
          src.el.removeEventListener('seeked', onSeek);
          resolve(paint());
        }
        src.el.addEventListener('seeked', onSeek);
        try { src.el.currentTime = target; } catch (e) { onSeek(); }
        // Some containers never fire 'seeked' near the tail; don't hang on them.
        setTimeout(onSeek, 400);
      });
    }

    if (src && src.frames) {
      src.time = t;
    }
    return paint();
  }

  function startMotionExport() {
    if (exporting) return;
    var fps = Math.max(1, Math.min(60, parseFloat($('#exFps').value) || 20));
    var dur = Math.max(0.1, parseFloat($('#exDur').value) || 4);
    var frames = Math.max(1, Math.round(fps * dur));
    var fmt = $('#exFormat').value;

    if (frames > 900) {
      UI.toast('That is ' + frames + ' frames. Shorten the clip or drop the fps.', 'bad');
      return;
    }

    exporting = true;
    cancelExport = false;
    var wasPlaying = clock.playing;
    var savedTime = clock.time;
    clock.stop();

    var prog = $('#exProgress');
    var bar = $('#exProgressBar');
    var text = $('#exProgressText');
    prog.hidden = false;
    $('#exRender').disabled = true;
    $('#exCancel').hidden = false;

    function onProgress(f, msg) {
      bar.style.width = (f * 100).toFixed(1) + '%';
      text.textContent = msg;
    }

    var opts = {
      canvas: plate,
      frameCount: frames,
      fps: fps,
      maxColors: parseInt($('#exColors').value, 10) || 256,
      gifDither: $('#exGifDither').checked,
      renderFrame: function (t, i, wantGrid) {
        if (cancelExport) throw new Error('cancelled');
        return exportFrame(t, i, wantGrid);
      },
      onProgress: onProgress
    };

    var job;
    if (fmt === 'gif') job = SS.exporters.recordGIF(opts);
    else if (fmt === 'webm') job = SS.exporters.recordVideo(opts);
    else if (fmt === 'zip') job = SS.exporters.recordFrameZip(opts);
    else job = SS.exporters.recordTextZip(opts);

    job.then(function (blob) {
      UI.toast('Saved — ' + (blob.size / 1048576).toFixed(2) + ' MB', 'good', 4000);
    }).catch(function (e) {
      if (String(e.message).indexOf('cancelled') >= 0) UI.toast('Export cancelled');
      else { console.error(e); UI.toast('Export failed: ' + e.message, 'bad'); }
    }).then(function () {
      exporting = false;
      prog.hidden = true;
      bar.style.width = '0';
      $('#exRender').disabled = false;
      $('#exCancel').hidden = true;
      clock.time = savedTime;
      if (wasPlaying) clock.start();
      requestRender();
    });
  }

  /* ───────────────────────── presets ───────────────────────── */

  /** Bucket the factory presets, ordered by GROUP_ORDER with unknowns last. */
  function groupFactory() {
    var byGroup = {}, seen = [];
    SS.presets.FACTORY.forEach(function (p) {
      var g = p.group || 'Other';
      if (!byGroup[g]) { byGroup[g] = []; seen.push(g); }
      byGroup[g].push(p);
    });
    var known = (SS.presets.GROUP_ORDER || []).filter(function (g) { return byGroup[g]; });
    var rest = seen.filter(function (g) { return known.indexOf(g) < 0; }).sort();
    return { order: known.concat(rest), byGroup: byGroup };
  }

  function refreshPresetSelect() {
    var sel = $('#presetSelect');
    sel.innerHTML = '';
    sel.appendChild(new Option('— presets —', ''));

    // Forty-plus presets in one flat list is unusable, so group them.
    var grouped = groupFactory();
    grouped.order.forEach(function (g) {
      var byGroup = grouped.byGroup;
      var og = document.createElement('optgroup');
      og.label = g;
      byGroup[g].forEach(function (p) { og.appendChild(new Option(p.name, 'F:' + p.name)); });
      sel.appendChild(og);
    });

    var user = SS.presets.userPresets();
    if (user.length) {
      var gU = document.createElement('optgroup');
      gU.label = 'Yours';
      user.forEach(function (p) { gU.appendChild(new Option(p.name, 'U:' + p.name)); });
      sel.appendChild(gU);
    }
  }

  function applyPreset(preset) {
    recordNow();
    var ex = SS.presets.expand(preset);
    state = ex.state;
    bindings = ex.bindings;
    view.userZoomed = false;
    syncUI();
    requestRender();
    scheduleSessionSave();
    UI.toast('Loaded “' + preset.name + '”', 'good');
  }

  function wirePresets() {
    $('#presetSelect').addEventListener('change', function () {
      var v = this.value;
      if (!v) return;
      var name = v.slice(2);
      var list = v[0] === 'F' ? SS.presets.FACTORY : SS.presets.userPresets();
      var p = list.filter(function (x) { return x.name === name; })[0];
      if (p) applyPreset(p);
      this.value = '';
    });

    $('#btnPresetSave').addEventListener('click', function () {
      UI.openModal('modalPresets');
      $('#presetName').focus();
    });
    $('#btnPresetManage').addEventListener('click', function () {
      refreshPresetList();
      UI.openModal('modalPresets');
    });

    $('#presetSaveGo').addEventListener('click', function () {
      var name = $('#presetName').value.trim();
      if (!name) { UI.toast('Give it a name first.', 'bad'); return; }
      SS.presets.savePreset(name, state, bindings);
      $('#presetName').value = '';
      refreshPresetSelect();
      refreshPresetList();
      UI.toast('Saved “' + name + '”', 'good');
    });

    $('#presetName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#presetSaveGo').click(); }
    });

    $('#presetImport').addEventListener('click', function () { $('#presetFile').click(); });
    $('#presetFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var r = SS.presets.importJSON(txt);
        refreshPresetSelect();
        refreshPresetList();
        UI.toast('Imported ' + r.imported + ' preset' + (r.imported === 1 ? '' : 's'), 'good');
      }).catch(function (e) {
        UI.toast(e.message || 'That file could not be read.', 'bad');
      });
      this.value = '';
    });

    $('#presetExportAll').addEventListener('click', function () {
      if (!SS.presets.userPresets().length) { UI.toast('You have no saved presets yet.', 'bad'); return; }
      SS.presets.exportAll();
      UI.toast('Preset pack saved', 'good');
    });

    refreshPresetList();
  }

  function refreshPresetList() {
    var root = $('#presetList');
    root.innerHTML = '';

    function section(label, list, isUser) {
      if (!list.length) return;
      root.appendChild(UI.el('div', 'preset-group-label', label));
      list.forEach(function (p) {
        var row = UI.el('div', 'preset-row');
        var info = UI.el('div', 'preset-info');
        info.appendChild(UI.el('div', 'preset-title', p.name));
        if (p.note) info.appendChild(UI.el('div', 'preset-note', p.note));
        else if (p.savedAt) info.appendChild(UI.el('div', 'preset-note', new Date(p.savedAt).toLocaleString()));
        row.appendChild(info);

        var acts = UI.el('div', 'preset-acts');
        var load = UI.el('button', 'mini', 'Load');
        load.addEventListener('click', function () { applyPreset(p); });
        acts.appendChild(load);

        var dl = UI.el('button', 'mini', 'JSON');
        dl.title = 'Export this preset as a file';
        dl.addEventListener('click', function () {
          var ex = SS.presets.expand(p);
          SS.presets.exportFile(p.name, ex.state, ex.bindings);
        });
        acts.appendChild(dl);

        if (isUser) {
          var del = UI.el('button', 'mini', 'Delete');
          del.addEventListener('click', function () {
            SS.presets.deletePreset(p.name);
            refreshPresetSelect();
            refreshPresetList();
            UI.toast('Deleted “' + p.name + '”');
          });
          acts.appendChild(del);
        }
        row.appendChild(acts);
        root.appendChild(row);
      });
    }

    section('Yours', SS.presets.userPresets(), true);

    var grouped = groupFactory();
    grouped.order.forEach(function (g) { section(g, grouped.byGroup[g], false); });
  }

  /* ───────────────────────── keyboard ───────────────────────── */

  function isTyping(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  function bump(key, delta) {
    var p = P.BY_KEY[key];
    if (!p) return;
    var max = p.max;
    if (p.dynamicMax) { try { max = p.dynamicMax(state); } catch (e) {} }
    setParam(key, Math.max(p.min, Math.min(max, state[key] + delta)));
  }

  function wireKeys() {
    wireTextView();

    global.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (UI.isModalOpen()) { UI.closeModal(); e.preventDefault(); }
        return;
      }
      // Undo/redo are checked before the modifier guard below, and stay live
      // while a dialog is open — an editor is expected to always take Ctrl+Z.
      var mod = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (mod && !isTyping(e)) {
        var lower = e.key.toLowerCase();
        if (lower === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo(); else undo();
          return;
        }
        if (lower === 'y') { e.preventDefault(); redo(); return; }
      }

      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (UI.isModalOpen()) return;

      var k = e.key;
      var shift = e.shiftKey;

      switch (k) {
        case ' ':
          e.preventDefault();
          clock.toggle();
          updatePlayButton();
          requestRender();
          break;
        case 'o': case 'O': document.getElementById('fileInput').click(); break;
        case 'f': case 'F': view.userZoomed = false; fitView(); break;
        case '1': actualSize(); break;
        case 't': case 'T': openTextView(); break;
        case 'e': case 'E': openExport(); break;
        case 's': case 'S': UI.openModal('modalPresets'); $('#presetName').focus(); break;
        case 'r': case 'R': roll(); break;
        case 'i': case 'I': setParam('invert', !state.invert); break;
        case 'x': case 'X': setParam('reverse', !state.reverse); break;
        case '[': bump('offset', shift ? -10 : -1); break;
        case ']': bump('offset', shift ? 10 : 1); break;
        case ',': bump('depth', shift ? -10 : -1); break;
        case '.': bump('depth', shift ? 10 : 1); break;
        case '<': bump('cols', -10); break;
        case '>': bump('cols', 10); break;
        case 'ArrowUp': e.preventDefault(); armoury.nextSet(-1); break;
        case 'ArrowDown': e.preventDefault(); armoury.nextSet(1); break;
        case 'Home': clock.reset(); requestRender(); break;
        case '?': UI.openModal('modalHelp'); break;
      }
    });
  }

  /* ───────────────────────── go ───────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);
