# ASCII_DOVE

Turn images, video and your webcam into glyph art — in the browser, on your machine, nothing uploaded.

**[Open ASCII_DOVE →](https://dozer3530.github.io/ASCII_DOVE/)**

![ASCII_DOVE output: a shaded sphere rendered in a 70-level ASCII ramp with gold contour strokes](docs/hero.png)

Export it as a PNG, or as `.txt`, `.svg`, `.html` and `.ans` that keep every character as real, selectable text.

---

![The same image through six different presets](docs/gallery.png)

Six of the 47 presets. One click each, and every parameter stays open underneath.

---

## What it does

|  |  |
|---|---|
| **Character sets** | 101 sets, 12 categories. ASCII ramps, blocks and shading, all 256 Braille patterns, 12 writing systems, box drawing, cards, chess, numerals, alchemical marks. Each one previews its own tone strip in your font before you pick it. |
| **Edge detection** | A Sobel pass replaces cells on strong contours with directional strokes — `- / \| \` — so shapes hold their edges instead of dissolving into tone. Eight stroke sets; overlay or replace. |
| **Ramp control** | Character depth, character offset, reverse, and custom injection of up to 10 glyphs. Or let it measure the real ink coverage of every glyph in your font and sort the ramp for you. |
| **Colour** | Single colour, sampled from source, 27 palettes (Game Boy, C64, NES, PICO-8, CGA, EGA, phosphor), 14 gradients, or duotone. Transparent, solid, gradient or image backgrounds. |
| **Dithering** | Floyd–Steinberg, Atkinson, Jarvis, Stucki, Burkes, Sierra, ordered Bayer 2/4/8/16, white noise. |
| **Sources** | Images, video, animated GIF/WebP/APNG, frame folders, webcam, screen capture. |
| **Animation** | Bind an LFO to any of 31 parameters. Eleven waveforms with rate, amount, phase and seed. |
| **Export** | PNG, JPEG, TXT, ANSI, SVG, HTML, animated GIF, WebM, and ZIPs of PNG or text frame sequences. |
| **Presets** | 47 built in across seven groups. Save your own, import and export as JSON. |

![The character offset animated on a saw wave](docs/motion.gif)

Only the character offset is moving here. The source is a still.

---

## Quickstart

1. Drop an image on the window, or press <kbd>O</kbd>.
2. Pick a character set from the left rail.
3. Set **Characters → Depth** and **Tone → Contrast** until it reads.
4. Switch **Edges → Overlay** on. This is usually the biggest single improvement.
5. <kbd>E</kbd> to export.

<kbd>R</kbd> rolls a random treatment and keeps your framing. <kbd>Ctrl</kbd>+<kbd>Z</kbd> takes it back.

### Shortcuts

| | | | |
|---|---|---|---|
| <kbd>O</kbd> | open a file | <kbd>Space</kbd> | play / pause |
| <kbd>E</kbd> | export | <kbd>T</kbd> | plain-text view |
| <kbd>S</kbd> | save preset | <kbd>R</kbd> | random look |
| <kbd>F</kbd> | fit to view | <kbd>1</kbd> | actual pixels |
| <kbd>[</kbd> <kbd>]</kbd> | offset − / + | <kbd>,</kbd> <kbd>.</kbd> | depth − / + |
| <kbd>&lt;</kbd> <kbd>&gt;</kbd> | columns − / + | <kbd>↑</kbd> <kbd>↓</kbd> | prev / next set |
| <kbd>I</kbd> | invert | <kbd>X</kbd> | reverse ramp |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | undo | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | redo |

<kbd>Shift</kbd> with the bracket and comma keys takes bigger steps. Double-click a slider to reset it. Scroll to zoom, drag to pan.

---

## Run it locally

**Windows** — double-click `run.bat`.

**Everything else** — `node serve.js`, then open <http://localhost:8777>.

Opening `index.html` straight from disk works too, but the camera, screen capture and clipboard-image features need a secure origin — `https://` or `http://localhost`.

---

## Performance

On a 3839×2400 photo:

| | without edges | with edges |
|---|---|---|
| 120 columns | 29 ms | — |
| 200 columns | 34 ms | 67–75 ms |
| 300 columns | 39 ms | — |

The edge pass roughly doubles the cost — leave it off while you set up tone. The grid caps at 600,000 cells.

GIF and ZIP sequences render frame by frame and are exact. WebM records through `MediaRecorder` in real time, so a slow frame gets held; prefer GIF or PNG frames for anything heavy.

## Browser support

Chromium browsers get everything. Firefox and Safari render and export normally, but animated GIF/WebP *input* needs `ImageDecoder` and falls back to the first frame; clipboard image copy needs `ClipboardItem`.

---

Built with no dependencies and no build step. See [ARCHITECTURE.md](ARCHITECTURE.md) to work on it.

MIT — [LICENSE](LICENSE)
