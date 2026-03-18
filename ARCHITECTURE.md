# Architecture

Technical reference for the Sail Chart codebase. See [README](./README.md) for installation and [USAGE](./USAGE.md) for the user guide.

---

## Tech stack

- **TypeScript** — ES modules, no framework, strict mode
- **HTML5 Canvas** — two-layer rendering (static background + interactive sails)
- **CSS custom properties** — nautical dark theme
- **[Vite](https://vite.dev)** — local dev server and bundler
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF export

Fonts: [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) · [Azeret Mono](https://fonts.google.com/specimen/Azeret+Mono) · [Outfit](https://fonts.google.com/specimen/Outfit)

---

## File structure

```
index.html              — HTML entry point and sidebar markup
css/
  style.css             — design system (nautical dark theme)
src/
  main.ts               — bootstraps App
  App.ts                — top-level wiring: settings, toolbar, resize, DPR watch
  model/
    types.ts            — shared TypeScript interfaces and union types
    UndoManager.ts      — generic fixed-depth undo/redo stack
    SailStore.ts        — data model, localStorage persistence, XML import/export
    PolarData.ts        — polar CSV parser and bilinear interpolation
  canvas/
    CoordinateSystem.ts   — pixel ↔ data coordinate transforms, chartRect, Catmull-Rom helpers
    BackgroundRenderer.ts — grid, axis labels, VMG curves, AWS iso-curves, BSP labels
    SailRenderer.ts       — sail fills, patterns, handles, legend, open splines
    HitTester.ts          — click/touch hit detection for sails and splines
  interaction/
    DragHandler.ts        — drag state machine for sail points, sail body, spline points, spline body
    InputController.ts    — pointer and keyboard event routing
  ui/
    SidebarPanel.ts       — sail list, sail editor, spline list, spline editor, annotation list
    AddSailModal.ts       — new sail dialog
```

---

## Canvas architecture

Two `<canvas>` elements are stacked on top of each other:

| Canvas | Renderer | Redrawn when |
|---|---|---|
| `bgCanvas` | `BackgroundRenderer` | Settings change, polar loaded, window resize |
| `mainCanvas` | `SailRenderer` | Any interaction, selection change, redraw request |

This separation avoids redrawing the expensive background (grid, polar curves) on every pointer move.

### Resolution and DPR

```
effectiveRes = resolution === 0
  ? devicePixelRatio          // "Screen" mode — match device pixels
  : targetPixelWidth / cssWidth  // Pixel-target mode (1920, 2560, 3840, 5120)

canvas.width  = cssWidth  * effectiveRes
canvas.height = cssHeight * effectiveRes
ctx.setTransform(effectiveRes, 0, 0, effectiveRes, 0, 0)
```

`_px(v) = v / dpr` converts a logical CSS-pixel value to a zoom-independent physical-pixel size. Use this for fonts and fixed UI offsets so they stay the same physical size regardless of browser zoom or display DPR.

---

## Coordinate system

`CoordinateSystem` holds the TWA/TWS axis range and the chart padding, and exposes:

- `toPixel(twa, tws) → [px, py]` — data coords → canvas logical px
- `fromPixel(px, py) → [twa, tws]` — canvas logical px → data coords
- `chartRect` — `{x, y, w, h}` of the plot area (excludes padding and legend)
- `legendWidth` — extra right-side space reserved for the legend panel (set to `LEGEND_W / dpr` when legend is visible, 0 otherwise)

---

## Spline rendering

Two Catmull-Rom helpers are exported from `CoordinateSystem.ts`:

- `splinePath(ctx, pts, coords)` — **closed** spline for sail regions
- `openSplinePath(ctx, pts, coords)` — **open** spline (clamped endpoints) for chart splines

Both operate in data coordinates and call `toPixel` internally.

---

## Pattern rendering

Fill patterns are generated with `CanvasPattern` on an off-screen canvas. Each tile is drawn at `resolution` scale then the pattern transform is corrected with:

```ts
pattern.setTransform(new DOMMatrix([1/resolution, 0, 0, 1/resolution, 0, 0]))
```

This keeps pattern tile sizes constant in physical pixels regardless of DPR or export resolution.

---

## Data model

`SailStore` holds all mutable state:

```ts
interface StoreState {
  sails:        SailData[];
  annotations:  LabelAnnotation[];
  splines:      ChartSpline[];
  nextId:       number;
  nextAnnId:    number;
  nextSplineId: number;
}
```

`ChartSettings` is stored separately and persisted alongside state in localStorage under the key `sailchart_v3`.

### Undo/redo

`UndoManager<T>` keeps a fixed-depth stack of deep-cloned `StoreState` snapshots. `store.pushUndo()` must be called **before** any mutation. `store.undo()` / `store.redo()` swap the current state with a snapshot and call `save()`.

---

## Drag state machine

`DragHandler` tracks the current drag type:

| Type | Description |
|---|---|
| `handle` | Dragging a sail control point |
| `move` | Dragging a sail region body |
| `splinepoint` | Dragging a spline control point |
| `splinemove` | Dragging a spline body |

`InputController` routes `pointerdown` → `pointermove` → `pointerup` through `DragHandler` and commits changes to `SailStore` on `pointerup`.

---

## Polar data

`PolarData` parses a CSV into a `bsp[twaIdx][twsIdx]` matrix and provides `getBSP(twa, tws)` via bilinear interpolation, clamped to the polar grid bounds.

Polar-derived overlays in `BackgroundRenderer`:

| Overlay | Algorithm |
|---|---|
| VMG curves | For each TWS step, find the TWA that maximises/minimises `BSP·cos(TWA)` over upwind/downwind halves |
| AWS iso-curves | For each target AWS and each TWA, binary-search for the TWS where `√(TWS²+BSP²+2·TWS·BSP·cos(TWA)) = target` |
| BSP labels | Display `getBSP(twa, tws)` as a number at each grid intersection; grid density is user-configurable |

---

## Legend

When `showLegend` is on, `SailRenderer` draws a panel to the right of the chart area. `CoordinateSystem.legendWidth` is set to `LEGEND_W / dpr` (a physical-pixel-constant value) so the legend and chart layout remain stable across browser zoom levels. `BackgroundRenderer` suppresses the right-side Y-axis ticks and labels when the legend is visible.
