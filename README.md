# Roughpad

A small Excalidraw-style sketchboard that turns rough pen strokes into clean,
hand-drawn diagrams. Draw a wobbly rectangle, circle, arrow, star, or cloud and
[Roughpad](#how-it-works) snaps it to real geometry while keeping a sketchy
rough.js texture.

Powered by [Shapes](https://desertant.com/models/shapes/) from Desert Ant Labs.
Recognition runs entirely on-device in the browser; strokes never leave the
machine.

## Features

- **Smart pen** — recognizes 12 shape kinds on stroke end: line, curve, arrow,
  rectangle, ellipse, triangle, diamond, pentagon, hexagon, star, heart, cloud.
  Unrecognized strokes stay as freehand ink. (`scribble` is intentionally
  excluded so the app never mistakes a doodle for an erase gesture.)
- **Freehand ink** — perfect-freehand pressure simulation with the same rough
  aesthetic.
- **Text, eraser, pan and zoom** — double-click anywhere to add text.
- **Selection** — move, resize with 8 handles, drag line/arrow endpoints,
  multi-select, marquee, duplicate, reorder (front/back), and delete.
- **Style panel** — stroke/fill colors, hachure/cross-hatch/solid/dots fill,
  stroke width, dashed/dotted lines, roughness, and font size.
- **Undo / redo** with grouped drag operations, keyboard nudging, copy/paste.
- **Local persistence** — the board autosaves to `localStorage` under
  `roughpad.board.v1`.
- **PNG export** — renders the board to a 2x offscreen canvas with padding.

## Run it

```bash
pnpm install
pnpm dev
```

Then open the printed URL (Vite defaults to http://localhost:5173).

```bash
pnpm build     # typecheck + production bundle
pnpm preview   # serve the production build
pnpm lint      # oxlint
```

## How it works

`@desert-ant-labs/shapes` runs a WASM pipeline backed by LiteRT.js. On first
use the SDK downloads its small model from Hugging Face
(`desert-ant-labs/shapes`) and caches it; after that, recognition is offline.

The browser bundle includes a **~46 MB WASM binary** (~19 MB gzipped). To keep
the app shell fast, `src/hooks/useShapes.ts` does not import the SDK eagerly:
it dynamic-imports it during idle time (`requestIdleCallback`, with a short
timeout fallback) and reports load progress in the status pill. The production
build splits the SDK and WASM into separate chunks from the app shell.

Each completed smart-pen stroke is sent to `recognize(points, { rotation:
"upright" })`. The exported `Shape` is converted to a scene element whose
geometry is normalized to a bounding box (`src/scene/create.ts`). Rendering uses
rough.js with a stable per-element seed, perfect-freehand for ink, and direct
canvas text for labels (`src/scene/render.ts`).

### Project layout

```
src/
  App.tsx                 board state, history, shortcuts, autosave, export
  components/
    Canvas.tsx            canvas render loop, pointer interactions, selection UI
    Toolbar.tsx           tool rail and undo/redo
    StylePanel.tsx        style controls and element actions
    ZoomBar.tsx           zoom / fit controls
    TextEditor.tsx        textarea overlay for labels
    Dialogs.tsx           help and clear-board modals
  hooks/
    useHistory.ts         past/present/future with live updates + snapshot commits
    useShapes.ts          lazy Shapes loader and recognition singleton
  scene/
    types.ts              element/style types, palettes, defaults
    geometry.ts           bounds, hit testing, resize, endpoints, viewport math
    create.ts             Shape -> scene element conversion, text measurement
    render.ts             rough.js/perfect-freehand canvas rendering + caches
  lib/export.ts           offscreen PNG export
  index.css               full visual design
```

### Notes

- Element geometry is stored in scene coordinates; the viewport applies pan and
  zoom at draw time, so resize/drag math stays resolution-independent.
- Shape drawables are cached by element id plus geometry/style signature, so
  throwing a shape around does not re-run rough.js every frame.
- The app is frontend-only: no server, accounts, or telemetry.

## Attribution

[Shapes](https://desertant.com/models/shapes/) is by
[Desert Ant Labs](https://desertant.com/), distributed under the
[Desert Ant Labs Source-Available License 1.0](https://license.desertant.com/1.0)
(free below 100,000 monthly active devices per platform). The model weights are
downloaded from Hugging Face and are not bundled in this repository.
