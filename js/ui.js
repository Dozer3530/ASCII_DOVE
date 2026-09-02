/* ==========================================================================
   GLYPHFORGE — ui.js
   Builds the control panel and the glyph armoury from the schemas, plus the
   shared chrome (toasts, modals, the LFO editor).

   Nothing here owns application state — main.js passes state in and receives
   changes through callbacks.
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});
  var P = SS.params;

  /* ───────────────────────── tiny DOM helpers ───────────────────────── */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ───────────────────────── toasts ───────────────────────── */

  var toastRoot = null;
  function toast(msg, kind, ms) {
    if (!toastRoot) toastRoot = document.getElementById('toasts');
    if (!toastRoot) return;
    var t = el('div', 'toast' + (kind ? ' is-' + kind : ''), msg);
    toastRoot.appendChild(t);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { t.remove(); }, 260);
    }, ms || (kind === 'bad' ? 4200 : 2400));
  }

  /* ───────────────────────── modals ───────────────────────── */

  var veil = null;
  var openId = null;

  function initModals(onClose) {
    veil = document.getElementById('modalVeil');
    veil.addEventListener('click', function (e) {
      if (e.target === veil) closeModal();
    });
    $$('[data-close]', veil).forEach(function (b) {
      b.addEventListener('click', closeModal);
    });
    initModals._onClose = onClose;
  }

  function openModal(id) {
    if (!veil) return;
    $$('.modal', veil).forEach(function (m) { m.hidden = m.id !== id; });
    veil.hidden = false;
    openId = id;
    var focusable = $('input, select, button:not(.modal-x)', document.getElementById(id));
    if (focusable) setTimeout(function () { focusable.focus(); }, 40);
  }

  function closeModal() {
    if (!veil) return;
    veil.hidden = true;
    $$('.modal', veil).forEach(function (m) { m.hidden = true; });
    var was = openId;
    openId = null;
    if (initModals._onClose) initModals._onClose(was);
  }

  // Returns the open modal's id (truthy) or null, so callers can both test
  // "is anything open" and ask which one.
  function isModalOpen() { return openId; }

  /* ───────────────────────── glyph ramp preview ─────────────────────────
     Draws the active tone response of a character set: luminance sweeps left
     to right and the glyph for each step is painted. Honours depth, offset and
     reverse so the strip is a real preview, not a decoration.
     ------------------------------------------------------------------------ */

  function drawRamp(canvas, setId, state, opts) {
    opts = opts || {};
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var cssW = canvas.clientWidth || 240;
    var cssH = canvas.clientHeight || 26;
    var W = Math.max(40, Math.round(cssW * dpr));
    var H = Math.max(12, Math.round(cssH * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    var cx = canvas.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = opts.bg || '#080806';
    cx.fillRect(0, 0, W, H);

    var glyphs = SS.charsets.resolve({
      setId: setId,
      custom: opts.useCustom ? state.customChars : '',
      injectMode: state.injectMode,
      reverse: state.reverse,
      dedupe: state.dedupe
    });
    if (opts.autoDensity && state.autoDensity) {
      glyphs = SS.charsets.sortByDensity(glyphs, SS.renderer.fontStack(state));
    }

    var len = glyphs.length;
    var cw = Math.max(5 * dpr, Math.round(6 * dpr));
    var cols = Math.max(4, Math.floor(W / cw));
    cw = W / cols;

    var depth = opts.useDepth ? Math.max(2, Math.min(state.depth | 0 || len, len)) : Math.min(len, cols);
    var offset = opts.useDepth ? (state.offset | 0) : 0;

    cx.font = Math.round(H * 0.78) + 'px ' + SS.renderer.fontStack(state);
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';

    for (var x = 0; x < cols; x++) {
      var t = cols > 1 ? x / (cols - 1) : 0;
      var lvl = Math.round(t * (depth - 1));
      var idx = depth > 1 ? Math.round(lvl * (len - 1) / (depth - 1)) : 0;
      idx = ((idx + offset) % len + len) % len;
      var v = Math.round(70 + t * 185);
      cx.fillStyle = opts.color || ('rgb(' + Math.round(v * 1.0) + ',' + Math.round(v * 0.86) + ',' + Math.round(v * 0.5) + ')');
      cx.fillText(glyphs[idx], x * cw + cw / 2, H / 2 + H * 0.03);
    }
  }

  /* ───────────────────────── armoury (character set browser) ───────────────────────── */

  function buildArmoury(opts) {
    var listRoot = document.getElementById('setList');
    var catRoot = document.getElementById('catStrip');
    var search = document.getElementById('setSearch');
    var countEl = document.getElementById('setCount');
    var rampGlyphs = document.getElementById('rampGlyphs');
    var rampLen = document.getElementById('rampLen');

    var activeCat = 'all';
    var query = '';
    var rows = [];        // { set, node, canvas, visible }
    var state = opts.getState();

    countEl.textContent = SS.charsets.count + ' sets';
    search.placeholder = 'search ' + SS.charsets.count + ' sets…';

    /* category chips */
    var cats = [{ id: 'all', name: 'All' }].concat(SS.charsets.CATEGORIES);
    cats.forEach(function (c) {
      var b = el('button', 'cat-chip' + (c.id === 'all' ? ' is-on' : ''), c.name);
      b.dataset.cat = c.id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', function () {
        activeCat = c.id;
        $$('.cat-chip', catRoot).forEach(function (n) { n.classList.toggle('is-on', n.dataset.cat === c.id); });
        filter();
      });
      catRoot.appendChild(b);
    });

    /* rows */
    SS.charsets.ALL.forEach(function (set) {
      var node = el('button', 'set-item');
      node.type = 'button';
      node.dataset.setId = set.id;
      node.setAttribute('role', 'option');

      var top = el('div', 'set-top');
      top.appendChild(el('span', 'set-name', set.name));
      top.appendChild(el('span', 'set-cat', set.categoryName));
      node.appendChild(top);

      var cv = el('canvas', 'set-preview');
      node.appendChild(cv);

      var g = el('div', 'set-glyphs', set.glyphs.slice(0, 40).join('') + (set.glyphs.length > 40 ? ' …' : ''));
      node.appendChild(g);

      if (set.note) node.appendChild(el('div', 'set-note', set.note));

      node.addEventListener('click', function () { opts.onPick(set.id); });
      listRoot.appendChild(node);

      rows.push({ set: set, node: node, canvas: cv, drawn: false, visible: false });
    });

    /* only paint previews that are actually on screen */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var row = rows.filter(function (r) { return r.node === e.target; })[0];
        if (!row) return;
        row.visible = e.isIntersecting;
        if (e.isIntersecting && !row.drawn) { paintRow(row); }
      });
    }, { root: listRoot, rootMargin: '160px' });
    rows.forEach(function (r) { io.observe(r.node); });

    function paintRow(row) {
      try {
        drawRamp(row.canvas, row.set.id, state, { useDepth: false });
        row.drawn = true;
      } catch (e) { /* a font may reject an exotic glyph; skip quietly */ }
    }

    function repaintVisible() {
      rows.forEach(function (r) {
        if (r.visible) { r.drawn = false; paintRow(r); }
        else r.drawn = false;
      });
    }

    function filter() {
      var q = query.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var catOk = activeCat === 'all' || r.set.category === activeCat;
        var qOk = !q ||
          r.set.name.toLowerCase().indexOf(q) >= 0 ||
          r.set.categoryName.toLowerCase().indexOf(q) >= 0 ||
          r.set.chars.indexOf(q) >= 0;
        var on = catOk && qOk;
        r.node.style.display = on ? '' : 'none';
        if (on) shown++;
      });
      countEl.textContent = shown === SS.charsets.count ? (SS.charsets.count + ' sets') : (shown + ' of ' + SS.charsets.count);
    }

    search.addEventListener('input', function () { query = search.value; filter(); });

    function sync(newState) {
      state = newState;
      var changed = false;
      rows.forEach(function (r) {
        var on = r.set.id === state.setId;
        if (r.node.classList.contains('is-on') !== on) { r.node.classList.toggle('is-on', on); changed = true; }
      });

      var glyphs = SS.charsets.resolve({
        setId: state.setId, custom: state.customChars, injectMode: state.injectMode,
        reverse: state.reverse, dedupe: state.dedupe
      });
      rampLen.textContent = glyphs.length + ' glyphs';
      rampGlyphs.textContent = glyphs.join('');
      rampGlyphs.style.fontFamily = SS.renderer.fontStack(state);

      if (changed) {
        var active = rows.filter(function (r) { return r.set.id === state.setId; })[0];
        if (active) active.node.scrollIntoView({ block: 'nearest' });
      }
    }

    function nextSet(dir) {
      var visible = rows.filter(function (r) { return r.node.style.display !== 'none'; });
      var at = visible.findIndex(function (r) { return r.set.id === state.setId; });
      if (at < 0) at = 0;
      var next = visible[(at + dir + visible.length) % visible.length];
      if (next) opts.onPick(next.set.id);
    }

    return { sync: sync, repaint: repaintVisible, nextSet: nextSet };
  }

  /* ───────────────────────── control panel ───────────────────────── */

  var SWATCHES = ['#e8dcc0', '#c9a227', '#d95d39', '#4a9c86', '#8fb8d9', '#e07ab5',
                  '#ffffff', '#0a0908', '#1a1a22', '#f2e8d2'];

  function buildControls(opts) {
    var root = document.getElementById('groups');
    var controls = {};   // key -> { wrap, input, value, def, animBtn }
    var groupNodes = {};
    var openGroups = loadOpenGroups();

    P.GROUPS.forEach(function (group, gi) {
      var g = el('section', 'group');
      g.dataset.group = group.id;

      var head = el('button', 'group-head');
      head.type = 'button';
      head.appendChild(el('span', 'sigil', group.sigil));
      head.appendChild(el('span', 'group-name', group.name));
      var mods = el('span', 'group-mods');
      mods.hidden = true;
      head.appendChild(mods);
      head.appendChild(el('span', 'group-caret', '▶'));
      g.appendChild(head);

      var body = el('div', 'group-body');
      if (group.hint) body.appendChild(el('p', 'group-hint', group.hint));
      g.appendChild(body);

      var isOpen = openGroups[group.id] != null ? openGroups[group.id] : (gi < 4);
      g.classList.toggle('is-open', isOpen);

      head.addEventListener('click', function () {
        g.classList.toggle('is-open');
        openGroups[group.id] = g.classList.contains('is-open');
        saveOpenGroups(openGroups);
      });

      group.params.forEach(function (p) {
        var ctl = buildControl(p, opts);
        controls[p.key] = ctl;
        body.appendChild(ctl.wrap);
      });

      groupNodes[group.id] = { node: g, mods: mods };
      root.appendChild(g);
    });

    /* --- one control ------------------------------------------------------ */

    function buildControl(p, opts) {
      var wrap = el('div', 'ctl');
      wrap.dataset.key = p.key;

      var head = el('div', 'ctl-head');
      var label = el('label', 'ctl-label', p.label);
      label.htmlFor = 'ctl_' + p.key;
      head.appendChild(label);

      var valueEl = null, animBtn = null;

      if (p.type === 'range') {
        valueEl = el('span', 'ctl-value');
        head.appendChild(valueEl);
      }
      if (p.anim) {
        animBtn = el('button', 'ctl-anim', '∿');
        animBtn.type = 'button';
        animBtn.title = 'Animate ' + p.label;
        animBtn.addEventListener('click', function (e) {
          e.preventDefault();
          opts.onAnim(p.key);
        });
        head.appendChild(animBtn);
      }

      var input = null;

      if (p.type === 'range') {
        wrap.appendChild(head);
        input = el('input');
        input.type = 'range';
        input.id = 'ctl_' + p.key;
        input.min = p.min; input.max = p.max; input.step = p.step;
        input.addEventListener('input', function () {
          opts.onChange(p.key, parseFloat(input.value));
        });
        // Double-click a slider to restore its default.
        input.addEventListener('dblclick', function () {
          opts.onChange(p.key, p.def);
        });
        wrap.appendChild(input);

      } else if (p.type === 'toggle') {
        var lab = el('label', 'tgl');
        input = el('input');
        input.type = 'checkbox';
        input.id = 'ctl_' + p.key;
        lab.appendChild(input);
        lab.appendChild(el('span', 'tgl-box'));
        lab.appendChild(el('span', 'tgl-label', p.label));
        input.addEventListener('change', function () { opts.onChange(p.key, input.checked); });
        wrap.appendChild(lab);

      } else if (p.type === 'select') {
        wrap.appendChild(head);
        input = el('select', 'select');
        input.id = 'ctl_' + p.key;
        P.optionsOf(p).forEach(function (o) {
          var opt = el('option', null, o.label);
          opt.value = o.value;
          input.appendChild(opt);
        });
        input.addEventListener('change', function () { opts.onChange(p.key, input.value); });
        wrap.appendChild(input);

        if (p.key === 'paletteId' || p.key === 'gradientId') {
          var strip = el('div', 'strip');
          wrap.appendChild(strip);
          wrap._strip = strip;
        }

      } else if (p.type === 'color') {
        wrap.appendChild(head);
        var row = el('div', 'color-row');
        input = el('input');
        input.type = 'color';
        input.id = 'ctl_' + p.key;
        var hex = el('input', 'color-hex');
        hex.type = 'text';
        hex.spellcheck = false;
        input.addEventListener('input', function () {
          hex.value = input.value;
          opts.onChange(p.key, input.value);
        });
        hex.addEventListener('change', function () {
          if (/^#?[0-9a-f]{6}$/i.test(hex.value.trim())) {
            var v = hex.value.trim();
            if (v[0] !== '#') v = '#' + v;
            input.value = v;
            opts.onChange(p.key, v);
          } else {
            hex.value = input.value;
          }
        });
        row.appendChild(input);
        row.appendChild(hex);
        var sw = el('div', 'swatches');
        SWATCHES.forEach(function (c) {
          var b = el('button', 'swatch');
          b.type = 'button';
          b.style.background = c;
          b.title = c;
          b.addEventListener('click', function () {
            input.value = c; hex.value = c; opts.onChange(p.key, c);
          });
          sw.appendChild(b);
        });
        row.appendChild(sw);
        wrap.appendChild(row);
        wrap._hex = hex;

      } else if (p.type === 'text') {
        wrap.appendChild(head);
        var tw = el('div', 'ctl-text-wrap');
        input = el('input', 'input');
        input.type = 'text';
        input.id = 'ctl_' + p.key;
        if (p.maxlength) input.maxLength = p.maxlength;
        if (p.placeholder) input.placeholder = p.placeholder;
        var count = el('span', 'ctl-count');
        input.addEventListener('input', function () {
          // Count by code point so astral glyphs aren't split.
          var chars = Array.from(input.value).slice(0, p.maxlength || 999);
          var v = chars.join('');
          if (v !== input.value) input.value = v;
          count.textContent = chars.length + '/' + (p.maxlength || '∞');
          opts.onChange(p.key, v);
        });
        tw.appendChild(input);
        tw.appendChild(count);
        wrap.appendChild(tw);
        wrap._count = count;
      }

      if (p.hint) wrap.appendChild(el('div', 'ctl-hint', p.hint));

      return { param: p, wrap: wrap, input: input, value: valueEl, animBtn: animBtn };
    }

    /* --- formatting ------------------------------------------------------- */

    function fmt(p, v) {
      if (typeof v !== 'number') return String(v);
      if (p.step >= 1) return String(Math.round(v));
      if (p.step >= 0.1) return v.toFixed(1);
      if (p.step >= 0.01) return v.toFixed(2);
      return v.toFixed(3);
    }

    /* --- sync ------------------------------------------------------------- */

    function sync(state, bindings, animatedState) {
      P.ALL.forEach(function (p) {
        var c = controls[p.key];
        if (!c) return;

        var show = !p.showIf || p.showIf(state);
        c.wrap.classList.toggle('is-hidden', !show);
        if (!show) return;

        var bound = bindings && bindings[p.key] && bindings[p.key].enabled;
        c.wrap.classList.toggle('is-animated', !!bound);
        if (c.animBtn) c.animBtn.classList.toggle('is-on', !!bound);

        if (p.type === 'range') {
          var max = p.max;
          if (p.dynamicMax) {
            try { max = Math.max(p.min + 1, p.dynamicMax(state)); } catch (e) {}
            if (String(c.input.max) !== String(max)) c.input.max = max;
          }
          var v = Math.min(max, state[p.key]);
          if (document.activeElement !== c.input) c.input.value = v;
          var pct = ((v - p.min) / (max - p.min)) * 100;
          c.input.style.setProperty('--fill', pct.toFixed(1) + '%');

          var shown = (bound && animatedState) ? animatedState[p.key] : v;
          c.value.textContent = fmt(p, shown) + (p.unit ? ' ' + p.unit : '');

        } else if (p.type === 'toggle') {
          c.input.checked = !!state[p.key];

        } else if (p.type === 'select') {
          if (c.input.value !== String(state[p.key])) c.input.value = String(state[p.key]);
          if (c.wrap._strip) paintStrip(c.wrap._strip, p.key, state[p.key]);

        } else if (p.type === 'color') {
          if (document.activeElement !== c.input) c.input.value = state[p.key];
          if (document.activeElement !== c.wrap._hex) c.wrap._hex.value = state[p.key];

        } else if (p.type === 'text') {
          if (document.activeElement !== c.input) c.input.value = state[p.key];
          c.wrap._count.textContent = Array.from(state[p.key] || '').length + '/' + (p.maxlength || '∞');
        }
      });

      // Per-group badge counting active LFOs.
      P.GROUPS.forEach(function (g) {
        var n = g.params.filter(function (p) {
          return bindings && bindings[p.key] && bindings[p.key].enabled;
        }).length;
        var node = groupNodes[g.id];
        node.mods.hidden = n === 0;
        node.mods.textContent = n + ' ∿';
      });
    }

    function paintStrip(strip, key, id) {
      strip.innerHTML = '';
      if (key === 'paletteId') {
        var pal = SS.palettes.PAL_BY_ID[id];
        if (!pal) return;
        pal.colors.forEach(function (c) {
          var i = el('i');
          i.style.background = c;
          strip.appendChild(i);
        });
      } else {
        var g = SS.palettes.GRAD_BY_ID[id];
        if (!g) return;
        var i2 = el('i');
        i2.style.background = 'linear-gradient(90deg,' + g.stops.map(function (s) {
          return s[1] + ' ' + (s[0] * 100) + '%';
        }).join(',') + ')';
        i2.style.flex = '1';
        strip.appendChild(i2);
      }
    }

    function openGroupFor(key) {
      var p = P.BY_KEY[key];
      if (!p) return;
      var node = groupNodes[p.group];
      if (node) node.node.classList.add('is-open');
    }

    return { sync: sync, controls: controls, openGroupFor: openGroupFor };
  }

  function loadOpenGroups() {
    try { return JSON.parse(localStorage.getItem('glyphforge.groups') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveOpenGroups(o) {
    try { localStorage.setItem('glyphforge.groups', JSON.stringify(o)); } catch (e) {}
  }

  /* ───────────────────────── LFO editor ───────────────────────── */

  function buildAnimEditor(opts) {
    var body = document.getElementById('animBody');
    var titleParam = document.getElementById('animParam');
    var currentKey = null;

    function open(key, binding) {
      currentKey = key;
      var p = P.BY_KEY[key];
      titleParam.textContent = p ? p.label : key;
      body.innerHTML = '';

      var b = binding || SS.anim.defaultBinding();

      var scope = el('canvas', 'anim-scope');
      body.appendChild(scope);

      function row(label, node) {
        var r = el('div', 'anim-row');
        r.appendChild(el('label', null, label));
        r.appendChild(node);
        return r;
      }

      // enable
      var enWrap = el('label', 'tgl');
      var en = el('input'); en.type = 'checkbox'; en.checked = b.enabled;
      enWrap.appendChild(en);
      enWrap.appendChild(el('span', 'tgl-box'));
      enWrap.appendChild(el('span', 'tgl-label', 'Modulation active'));
      body.appendChild(enWrap);
      body.appendChild(el('div', 'ctl-hint', 'The slider stays your base value; the wave rides on top of it.'));

      // wave
      var wave = el('select', 'select');
      SS.anim.WAVE_LIST.forEach(function (w) {
        var o = el('option', null, w.label); o.value = w.value; wave.appendChild(o);
      });
      wave.value = b.wave;
      body.appendChild(row('Wave', wave));

      // mode
      var mode = el('select', 'select');
      [{ value: 'add', label: 'Add to slider value' },
       { value: 'sweep', label: 'Sweep the full range' }].forEach(function (m) {
        var o = el('option', null, m.label); o.value = m.value; mode.appendChild(o);
      });
      mode.value = b.mode;
      body.appendChild(row('Mode', mode));

      function slider(label, min, max, step, val, unit, fmtFn) {
        var s = el('input'); s.type = 'range';
        s.min = min; s.max = max; s.step = step; s.value = val;
        var out = el('span', 'ctl-value');
        var r = el('div', 'anim-row');
        r.appendChild(el('label', null, label));
        r.appendChild(s);
        r.appendChild(out);
        function upd() {
          out.textContent = (fmtFn ? fmtFn(parseFloat(s.value)) : parseFloat(s.value).toFixed(2)) + (unit || '');
          s.style.setProperty('--fill', (((s.value - min) / (max - min)) * 100).toFixed(1) + '%');
        }
        s.addEventListener('input', function () { upd(); push(); });
        upd();
        body.appendChild(r);
        return s;
      }

      var rate = slider('Rate', 0.01, 4, 0.01, b.rate, ' Hz');
      var amount = slider('Amount', 0, 1, 0.01, b.amount, '');
      var phase = slider('Phase', 0, 1, 0.01, b.phase, '');
      var seed = slider('Seed', 1, 99, 1, b.seed, '', function (v) { return String(Math.round(v)); });

      var acts = el('div', 'modal-actions');
      var clear = el('button', 'btn btn-quiet', 'Remove modulation');
      clear.type = 'button';
      clear.addEventListener('click', function () {
        opts.onClear(currentKey);
        closeModal();
      });
      var done = el('button', 'btn btn-gold', 'Done');
      done.type = 'button';
      done.addEventListener('click', closeModal);
      acts.appendChild(done);
      acts.appendChild(clear);
      body.appendChild(acts);

      function read() {
        return {
          enabled: en.checked,
          wave: wave.value,
          mode: mode.value,
          rate: parseFloat(rate.value),
          amount: parseFloat(amount.value),
          phase: parseFloat(phase.value),
          seed: Math.round(parseFloat(seed.value))
        };
      }

      function push() {
        var v = read();
        opts.onChange(currentKey, v);
        drawScope(scope, v);
      }

      [en, wave, mode].forEach(function (n) { n.addEventListener('change', push); });

      drawScope(scope, read());
      openModal('modalAnim');
      // Canvas has no size until it's laid out.
      requestAnimationFrame(function () { drawScope(scope, read()); });
    }

    return { open: open };
  }

  function drawScope(canvas, b) {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var W = Math.max(80, Math.round((canvas.clientWidth || 380) * dpr));
    var H = Math.max(40, Math.round((canvas.clientHeight || 60) * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var cx = canvas.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = '#050403';
    cx.fillRect(0, 0, W, H);

    // centre line
    cx.strokeStyle = 'rgba(201,162,39,.18)';
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(0, H / 2); cx.lineTo(W, H / 2); cx.stroke();

    var wave = SS.anim.WAVES[b.wave] || SS.anim.WAVES.sine;
    var cycles = 2;
    cx.strokeStyle = b.enabled ? '#4a9c86' : 'rgba(120,120,120,.5)';
    cx.lineWidth = 1.6 * dpr;
    cx.beginPath();
    for (var x = 0; x <= W; x++) {
      var t = (x / W) * cycles;
      var v = wave(t + b.phase, b.seed) * b.amount;
      var y = H / 2 - v * (H / 2 - 4 * dpr);
      if (x === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.stroke();

    cx.fillStyle = 'rgba(232,220,192,.4)';
    cx.font = (9 * dpr) + 'px ' + 'ui-monospace, monospace';
    cx.fillText(b.rate.toFixed(2) + ' Hz · ' + (b.amount * 100).toFixed(0) + '%', 6 * dpr, 12 * dpr);
  }

  /* ───────────────────────── exports ───────────────────────── */

  SS.ui = {
    el: el, $: $, $$: $$,
    toast: toast,
    initModals: initModals,
    openModal: openModal,
    closeModal: closeModal,
    isModalOpen: isModalOpen,
    buildArmoury: buildArmoury,
    buildControls: buildControls,
    buildAnimEditor: buildAnimEditor,
    drawRamp: drawRamp,
    drawScope: drawScope
  };
})(window);
