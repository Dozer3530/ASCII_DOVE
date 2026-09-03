/* ==========================================================================
   ASCII_DOVE — media.js
   One uniform "source" interface over stills, video, animated GIF/WebP/APNG,
   image sequences and the webcam.

   Every source exposes: { el, width, height, animated, duration, time,
   play(), pause(), paused, dispose() }
   ========================================================================== */
(function (global) {
  'use strict';

  var SS = (global.SS = global.SS || {});

  var listeners = [];
  function emit(type, payload) {
    listeners.forEach(function (fn) { try { fn(type, payload); } catch (e) { console.error(e); } });
  }

  var current = null;

  function setSource(src) {
    if (current && current.dispose) { try { current.dispose(); } catch (e) {} }
    current = src;
    emit('source', src);
    return src;
  }

  /* --- still image ---------------------------------------------------------- */

  function makeStill(el, label) {
    return {
      kind: 'image',
      label: label || 'image',
      el: el,
      width: el.naturalWidth || el.width,
      height: el.naturalHeight || el.height,
      animated: false,
      duration: 0,
      time: 0,
      paused: true,
      play: function () {},
      pause: function () {},
      seek: function () {},
      dispose: function () { if (el.src && el.src.indexOf('blob:') === 0) URL.revokeObjectURL(el.src); }
    };
  }

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve(makeStill(img, file.name)); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not decode ' + file.name)); };
      img.src = url;
    });
  }

  function loadImageURL(url, label) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(makeStill(img, label || url)); };
      img.onerror = function () { reject(new Error('Could not load image')); };
      img.src = url;
    });
  }

  /* --- video ---------------------------------------------------------------- */

  function loadVideoFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      v.src = url;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.onloadeddata = function () {
        v.currentTime = 0;
        resolve({
          kind: 'video',
          label: file.name,
          el: v,
          width: v.videoWidth,
          height: v.videoHeight,
          animated: true,
          // Browser- and OBS-recorded WebM often reports Infinity here until
          // it has been played through. Report 0 (= unknown) so the transport
          // falls back to its own loop length instead of scaling by Infinity.
          get duration() { return isFinite(v.duration) && v.duration > 0 ? v.duration : 0; },
          get time() { return v.currentTime; },
          set time(t) { try { v.currentTime = t; } catch (e) {} },
          get paused() { return v.paused; },
          play: function () { return v.play().catch(function () {}); },
          pause: function () { v.pause(); },
          seek: function (t) { try { v.currentTime = t; } catch (e) {} },
          dispose: function () { v.pause(); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); }
        });
      };
      v.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not decode ' + file.name)); };
    });
  }

  /* --- animated GIF / WebP / APNG via WebCodecs ------------------------------
     ImageDecoder handles animated formats that <img> can't be sampled from
     frame-by-frame. Where it's unavailable we degrade to a still.
     -------------------------------------------------------------------------- */

  function hasImageDecoder() {
    return typeof global.ImageDecoder === 'function';
  }

  function loadAnimatedFile(file) {
    if (!hasImageDecoder()) return loadImageFile(file);

    return file.arrayBuffer().then(function (bufArr) {
      var dec = new global.ImageDecoder({ data: bufArr, type: file.type || 'image/gif' });
      // tracks.selectedTrack is null until tracks.ready resolves — reading it
      // any earlier makes every animation look like a single-frame still.
      return dec.tracks.ready.then(function () {
        return dec.completed;
      }).then(function () {
        var track = dec.tracks.selectedTrack;
        var count = track ? track.frameCount : 1;
        if (count <= 1) { dec.close(); return loadImageFile(file); }

        var frames = [];
        var chain = Promise.resolve();
        for (var i = 0; i < count; i++) {
          (function (idx) {
            chain = chain.then(function () {
              return dec.decode({ frameIndex: idx }).then(function (res) {
                var vf = res.image;
                var cv = document.createElement('canvas');
                cv.width = vf.displayWidth || vf.codedWidth;
                cv.height = vf.displayHeight || vf.codedHeight;
                cv.getContext('2d').drawImage(vf, 0, 0);
                // duration is in microseconds
                frames.push({ cv: cv, dur: (vf.duration || 100000) / 1e6 });
                vf.close();
              });
            });
          })(i);
        }

        return chain.then(function () {
          dec.close();
          return makeSequence(frames, file.name, 'animation');
        });
      });
    }).catch(function (err) {
      // Degrade to a still rather than failing outright, but leave a trace —
      // a silent fallback here is indistinguishable from a one-frame GIF.
      console.warn('Animated decode failed for ' + file.name + ', using first frame.', err);
      return loadImageFile(file);
    });
  }

  /* --- frame sequence (GIF frames, or a folder of stills) --------------------- */

  function makeSequence(frames, label, kind) {
    // frames: [{ cv, dur }]
    var total = frames.reduce(function (a, f) { return a + f.dur; }, 0);
    var t = 0;
    var paused = true;
    var idx = 0;

    function frameAt(time) {
      if (total <= 0) return 0;
      var m = ((time % total) + total) % total;
      var acc = 0;
      for (var i = 0; i < frames.length; i++) {
        acc += frames[i].dur;
        if (m < acc) return i;
      }
      return frames.length - 1;
    }

    var src = {
      kind: kind || 'sequence',
      label: label,
      frames: frames,
      frameCount: frames.length,
      get el() { return frames[idx].cv; },
      width: frames[0].cv.width,
      height: frames[0].cv.height,
      animated: true,
      duration: total,
      get time() { return t; },
      set time(v) { t = v; idx = frameAt(t); },
      get frameIndex() { return idx; },
      set frameIndex(i) {
        idx = Math.max(0, Math.min(frames.length - 1, i | 0));
        var acc = 0;
        for (var k = 0; k < idx; k++) acc += frames[k].dur;
        t = acc;
      },
      get paused() { return paused; },
      play: function () { paused = false; },
      pause: function () { paused = true; },
      seek: function (v) { src.time = v; },
      // Driven by the app clock.
      advance: function (dt) { if (!paused) { t += dt; idx = frameAt(t); } },
      dispose: function () { frames.length = 0; }
    };
    return src;
  }

  function loadSequenceFiles(files) {
    var sorted = Array.prototype.slice.call(files).sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    var fps = 12;
    return Promise.all(sorted.map(function (f) {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(f);
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement('canvas');
          cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          cv.getContext('2d').drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve({ cv: cv, dur: 1 / fps });
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    })).then(function (list) {
      var frames = list.filter(Boolean);
      if (!frames.length) throw new Error('No readable images in that selection.');
      return makeSequence(frames, sorted.length + ' frames', 'sequence');
    });
  }

  /* --- webcam ---------------------------------------------------------------- */

  /**
   * @param {string} [facingMode] 'user' or 'environment'. Phones need it to
   *   choose a camera; omitted (as the desktop app does) it is not sent at all.
   */
  function startWebcam(facingMode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('This browser exposes no camera API.'));
    }
    function attempt(strict) {
      var video = { width: { ideal: 1280 }, height: { ideal: 720 } };
      if (facingMode) {
        // `ideal` lets the browser quietly hand back the camera you already
        // had, so a flip silently does nothing. Ask for `exact` first and fall
        // back for single-camera devices, which reject it outright.
        video.facingMode = strict ? { exact: facingMode } : { ideal: facingMode };
      }
      return navigator.mediaDevices.getUserMedia({ video: video, audio: false });
    }

    var request = facingMode
      ? attempt(true).catch(function () { return attempt(false); })
      : attempt(false);

    return request.then(function (stream) {
      var v = document.createElement('video');
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      return v.play().then(function () {
        return {
          kind: 'webcam',
          label: 'camera',
          el: v,
          get width() { return v.videoWidth; },
          get height() { return v.videoHeight; },
          animated: true,
          live: true,
          duration: 0,
          time: 0,
          paused: false,
          play: function () {},
          pause: function () {},
          seek: function () {},
          dispose: function () {
            stream.getTracks().forEach(function (t) { t.stop(); });
            v.srcObject = null;
          }
        };
      });
    });
  }

  /* --- screen capture --------------------------------------------------------- */

  function startScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return Promise.reject(new Error('Screen capture is not available here.'));
    }
    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      .then(function (stream) {
        var v = document.createElement('video');
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        return v.play().then(function () {
          return {
            kind: 'screen',
            label: 'screen',
            el: v,
            get width() { return v.videoWidth; },
            get height() { return v.videoHeight; },
            animated: true,
            live: true,
            duration: 0,
            time: 0,
            paused: false,
            play: function () {}, pause: function () {}, seek: function () {},
            dispose: function () {
              stream.getTracks().forEach(function (t) { t.stop(); });
              v.srcObject = null;
            }
          };
        });
      });
  }

  /* --- dispatch --------------------------------------------------------------- */

  function classify(file) {
    var t = (file.type || '').toLowerCase();
    var n = (file.name || '').toLowerCase();
    if (t.indexOf('video/') === 0 || /\.(mp4|webm|mov|m4v|ogv|mkv)$/.test(n)) return 'video';
    if (t === 'image/gif' || /\.gif$/.test(n)) return 'animated';
    if (t === 'image/webp' || /\.webp$/.test(n)) return 'maybeAnimated';
    if (t === 'image/apng' || /\.apng$/.test(n)) return 'animated';
    if (t.indexOf('image/') === 0 || /\.(png|jpe?g|bmp|svg|avif|ico|tiff?)$/.test(n)) return 'image';
    return 'unknown';
  }

  function loadFiles(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) {
      return classify(f) !== 'unknown';
    });
    if (!list.length) return Promise.reject(new Error('No image or video files in that drop.'));

    if (list.length > 1) {
      var allStill = list.every(function (f) { return classify(f) === 'image'; });
      if (allStill) return loadSequenceFiles(list).then(setSource);
    }

    var file = list[0];
    var kind = classify(file);
    var p;
    if (kind === 'video') p = loadVideoFile(file);
    else if (kind === 'animated' || kind === 'maybeAnimated') p = loadAnimatedFile(file);
    else p = loadImageFile(file);
    return p.then(setSource);
  }

  /* --- procedural default -----------------------------------------------------
     A shaded sphere with an orbital ring and a tone strip: enough gradient,
     hard edges and flat field to judge every control at a glance.
     ---------------------------------------------------------------------------- */

  function buildDefault() {
    var W = 900, H = 900;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);

    // soft ground haze
    var haze = c.createRadialGradient(W * 0.5, H * 0.62, 20, W * 0.5, H * 0.62, W * 0.62);
    haze.addColorStop(0, 'rgba(70,60,40,0.55)');
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = haze; c.fillRect(0, 0, W, H);

    // orbital ring (drawn behind the sphere)
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.38);
    c.scale(1, 0.30);
    c.lineWidth = 16;
    var ringGrad = c.createLinearGradient(-330, 0, 330, 0);
    ringGrad.addColorStop(0, '#2a2118');
    ringGrad.addColorStop(0.45, '#d9bb70');
    ringGrad.addColorStop(1, '#3a2c1a');
    c.strokeStyle = ringGrad;
    c.beginPath(); c.arc(0, 0, 330, 0, Math.PI * 2); c.stroke();
    c.restore();

    // sphere with a warm key light from upper-left
    var cxp = W * 0.5, cyp = H * 0.5, R = 250;
    var sph = c.createRadialGradient(cxp - R * 0.42, cyp - R * 0.46, R * 0.05, cxp, cyp, R);
    sph.addColorStop(0, '#fffaf0');
    sph.addColorStop(0.22, '#e8c98a');
    sph.addColorStop(0.55, '#9a6a34');
    sph.addColorStop(0.82, '#3c2513');
    sph.addColorStop(1, '#0d0805');
    c.fillStyle = sph;
    c.beginPath(); c.arc(cxp, cyp, R, 0, Math.PI * 2); c.fill();

    // bounce light from below-right
    c.save();
    c.beginPath(); c.arc(cxp, cyp, R, 0, Math.PI * 2); c.clip();
    var rim = c.createRadialGradient(cxp + R * 0.55, cyp + R * 0.5, R * 0.1, cxp + R * 0.4, cyp + R * 0.4, R * 1.1);
    rim.addColorStop(0, 'rgba(120,180,220,0.42)');
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rim; c.fillRect(cxp - R, cyp - R, R * 2, R * 2);
    c.restore();

    // A thin backlight around the whole circumference. Without a hard
    // silhouette the edge pass has nothing to find here, and this is the
    // chart people judge the edge controls on.
    c.save();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(198,214,236,0.75)';
    c.beginPath(); c.arc(cxp, cyp, R - 1, 0, Math.PI * 2); c.stroke();
    c.restore();

    // Hard-edged wireframe triangle: three known orientations for the Sobel
    // pass, one of them a true vertical.
    c.save();
    c.strokeStyle = 'rgba(226,214,186,0.62)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(W * 0.5, H * 0.145);
    c.lineTo(W * 0.845, H * 0.735);
    c.lineTo(W * 0.155, H * 0.735);
    c.closePath();
    c.stroke();
    c.restore();

    // ring front arc
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.38);
    c.scale(1, 0.30);
    c.lineWidth = 16;
    c.strokeStyle = '#f0d79a';
    c.beginPath(); c.arc(0, 0, 330, 0.15, Math.PI - 0.15); c.stroke();
    c.restore();

    // tone strip: 16 flat steps, the fastest way to read a character ramp
    var steps = 16, sw = W / steps;
    for (var i = 0; i < steps; i++) {
      var v = Math.round((i / (steps - 1)) * 255);
      c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      c.fillRect(i * sw, H - 74, sw + 1, 74);
    }

    // fine grain so dithering has something to bite on
    var id = c.getImageData(0, 0, W, H);
    for (var p = 0; p < id.data.length; p += 4) {
      var nz = (Math.random() - 0.5) * 9;
      id.data[p] += nz; id.data[p + 1] += nz; id.data[p + 2] += nz;
    }
    c.putImageData(id, 0, 0);

    return {
      kind: 'image',
      label: 'forge sigil (built in)',
      el: cv, width: W, height: H,
      animated: false, duration: 0, time: 0, paused: true,
      play: function () {}, pause: function () {}, seek: function () {},
      dispose: function () {}
    };
  }

  /**
   * Release a live camera or screen capture and clear the source.
   *
   * Needed before switching cameras: a phone can only serve one at a time, so
   * requesting the second while the first still holds the hardware fails with
   * NotReadableError. Only touches live sources — stills and video are left
   * alone. Returns true if something was released.
   */
  function stopLive() {
    if (!current || !current.live) return false;
    if (current.dispose) { try { current.dispose(); } catch (e) {} }
    current = null;
    emit('source', null);
    return true;
  }

  SS.media = {
    get current() { return current; },
    setSource: setSource,
    stopLive: stopLive,
    loadFiles: loadFiles,
    loadImageURL: function (u, l) { return loadImageURL(u, l).then(setSource); },
    loadSequenceFiles: function (f) { return loadSequenceFiles(f).then(setSource); },
    startWebcam: function (facingMode) { return startWebcam(facingMode).then(setSource); },
    startScreen: function () { return startScreen().then(setSource); },
    buildDefault: buildDefault,
    hasImageDecoder: hasImageDecoder,
    classify: classify,
    on: function (fn) { listeners.push(fn); }
  };
})(window);
