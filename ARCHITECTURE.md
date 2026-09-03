# Architecture

Plain `<script>` tags and a global `SS` namespace. No modules, no bundler, no
build step — it runs from the filesystem as readily as from a server. The only
network request is the Google Fonts stylesheet, which falls back to system
fonts offline.

```
index.html          desktop shell (redirects phones to mobile.html)
mobile.html         touch shell
run.bat             Windows launcher
serve.js            static server, no dependencies
css/app.css         desktop styling
css/mobile.css      touch styling
tests/test.html     38 self-tests
docs/               README images
js/
  charsets.js       101 sets, injection, measured density sorting
  palettes.js       27 palettes, 14 gradients, colour maths
  imageproc.js      sampling, tone, blur/sharpen, dithering, Sobel
  renderer.js       grid geometry, glyph selection, painting, post effects
  media.js          images, video, animated formats, sequences, camera, screen
  params.js         parameter schema — single source of truth
  anim.js           LFO waveforms and the transport clock
  presets.js        47 factory presets, localStorage, JSON portability
  exporters.js      PNG, JPEG, TXT, ANSI, SVG, HTML, GIF, WebM, ZIP
  ui.js             desktop control panel, armoury, modals, toasts
  main.js           desktop application controller
  mobile.js         touch controller — replaces ui.js + main.js
  lib/zip.js        store-only ZIP writer
  lib/gifenc.js     GIF89a encoder — median-cut quantiser + LZW
```

## Two shells, one engine

Everything from `charsets.js` down to `exporters.js` is shell-independent —
it takes a canvas context, a source and a state object, and touches no app DOM.
`ui.js` + `main.js` are the desktop front-end; `mobile.js` is a separate one.
Neither loads the other, so changing one cannot regress the other.

The touch build exposes a curated dozen controls rather than all 73, and
defaults to fewer columns with the edge pass off, because phone CPUs run this
several times slower. Presets and saved state are shared through the same
localStorage keys.

Phones are routed there by a guard in `index.html`. It tests `pointer: coarse`
and `navigator.userAgentData.mobile`, deliberately not `maxTouchPoints` —
Windows laptops with a touchscreen report 10 of those and would be sent to the
phone UI by mistake. `?desktop=1` overrides it.

## The render pipeline

`renderer.render()` runs one pass per frame:

1. **Sample** the source down to the cell grid. Large reductions halve
   repeatedly rather than in one `drawImage`, which browsers sample too
   sparsely to average properly.
2. **Tone** — exposure, brightness, contrast, saturation, gamma, posterize,
   invert.
3. **Luminance** to a `Float32Array`, then optional blur and unsharp mask.
4. **Quantise** to `depth` levels through the chosen dither.
5. **Edges** — Sobel on a separate, square-pixel supersample, reduced per cell
   into a weighted direction histogram.
6. **Map** level → glyph index, applying offset and jitter.
7. **Paint**, bucketed by colour so `fillStyle` is set as rarely as possible.

Everything downstream — PNG, TXT, ANSI, SVG, HTML — consumes the same `grid`
object the viewport was painted from, so every export of a frame agrees.

## Conventions

**Character sets run dark → light.** Index 0 is the emptiest glyph, the last is
the densest. That suits light glyphs on a dark ground. For dark ink on light
paper use **reverse**, not invert: invert flips the image, and on a light
ground it flips a second time and cancels out. `Ink on Vellum` and
`Halftone Press` are the reference setups.

**Cell aspect is load-bearing.** Monospace cells are roughly twice as tall as
they are wide; `Grid → Cell aspect` tells the renderer so the image isn't
stretched. If a circle in the source isn't a circle on the plate, check it.

## Extending

**A character set** — add an entry to a category in `js/charsets.js`, ordered
dark → light:

```js
{ id: 'myset', name: 'My Set', chars: ' ·:+*#@' }
```

It shows up in the armoury, the preset format and the tests automatically. Add
`mono: false` when the glyphs come from a proportional symbol font.

**A parameter** — add it to a group in `js/params.js`. The control, the preset
field and the LFO binding are all generated from that one entry. `anim: true`
makes it animatable.

**A preset** — add to `FACTORY` in `js/presets.js` listing only what it
changes; everything else falls back to schema defaults.

## Tests

Open `tests/test.html` from the same server as the app.

The suite renders all 101 character sets and all 47 presets, asserts that a
black source picks the emptiest glyph and a white source the densest, checks
every dither stays inside its level range, verifies Sobel orientation against
synthetic edges of each direction, bounds-checks every LFO, and round-trips the
ZIP and GIF encoders — decoding the GIF it just wrote back through
`ImageDecoder` to confirm the frame count and timings.
