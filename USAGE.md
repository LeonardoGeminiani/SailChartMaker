# Usage

---

## Editing sails

| Action | How |
|---|---|
| Select a sail | Click its region on the chart or its name in the sidebar |
| Move a region | Select it, then drag anywhere inside it |
| Reshape a region | Select it, then drag any white control point handle |
| Add a control point | Switch to **+ Point** mode, click near the edge to subdivide |
| Delete a control point | Switch to **− Remove** mode, click the red handle |
| Edit name / colour / opacity | Select a sail — the editor panel opens in the sidebar |
| Toggle fill / label | Per-sail checkboxes in the editor panel |
| Pattern overlay | Choose from lines, crosshatch, dots, dashes, fine dashes, etc. |
| Reorder sails | Use the up/down arrows in the sail list |
| Delete a sail | Select it, click **Delete Sail** in the editor, or press `Delete` |

### Adding a new sail

1. Click **+ Add Sail** in the header.
2. Enter a name, pick a colour, and set the approximate angle/speed for its centre point.
3. Click **Add Sail** — an oval region is created.
4. Select it and use **+ Point** mode to add more handles, then drag them to sculpt the exact shape.

---

## Splines

Generic open Catmull-Rom splines can be added independently of sails — useful for marking crossover boundaries, target curves, or annotations.

| Action | How |
|---|---|
| Add a spline | Click **+ Add** in the Splines section of the sidebar |
| Select / move | Click the spline body and drag |
| Reshape | Drag any handle |
| Add / remove points | Use **+ Point** / **− Remove** mode while the spline is selected |
| Edit name / colour / stroke style | Spline editor opens in the sidebar on selection |
| Delete | Select it and press `Delete`, or use the **Delete Spline** button |

Stroke styles: solid, dashed, dotted, dash·dot, fine dash, long dash.

---

## Labels

Free-floating text labels can be placed anywhere on the chart. Click **+ Add** in the Labels section, then edit the text and colour inline.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `V` | Select mode |
| `A` | Add point mode |
| `D` | Remove point mode |
| `Delete` / `Backspace` | Delete selected sail or spline |
| `Escape` | Deselect |
| `Ctrl Z` | Undo (up to 60 steps) |
| `Ctrl Y` / `Ctrl Shift Z` | Redo |

---

## Saving and loading

| Button | Action |
|---|---|
| **Save XML** | Download the chart as an XML file |
| **Load XML** | Open a previously saved XML file |
| **Export PNG** | Download the chart as a flat PNG image |
| **Export PDF** | Download the chart as an A4 PDF, fitted with margins |

Changes are automatically saved to your browser's local storage — your work persists across page refreshes.

---

## Appearance settings

All settings are in the **Appearance** tab of the sidebar and persist in localStorage and XML export.

### Appearance

| Setting | Control | Description |
|---|---|---|
| Background Color | Color picker | Canvas and page background colour |
| Axis Font Size | − / + | Point size of the TWA/TWS axis tick labels |
| Sail Label Size | − / + | Point size of the sail name labels drawn on the chart |
| Pattern Scale | − / + | Tile spacing of fill patterns (hatch, crosshatch, dots, etc.) |
| Pattern Thickness | − / + | Line weight of fill pattern strokes |
| Curve Smoothing | Slider 0–10 | Moving-average half-window applied to polar-derived VMG and AWS curves; 0 = raw, 10 = maximally smoothed |

### Axis Range

| Setting | Control | Description |
|---|---|---|
| TWA (°) | Min – Max | Visible true wind angle range on the X axis |
| TWS (kts) | Min – Max | Visible true wind speed range on the Y axis |
| TWA Step (°) | − / + | Major gridline and label interval on the X axis (minor grid = step ÷ 3) |
| TWS Step (kts) | − / + | Major gridline and label interval on the Y axis (minor grid = step ÷ 2.5) |
| TWS Reversed | Toggle | Places high wind speed at the bottom of the chart instead of the top |
| Show Legend | Toggle | Adds a colour swatch panel to the right of the chart with sail names |
| Cursor Indicators | Toggle | Shows TWA/TWS readout boxes on both axes as you hover (off by default) |

### Stroke Widths

| Setting | Control | Description |
|---|---|---|
| VMG lines | Slider | Line weight of the upwind/downwind VMG target curves |
| AWS lines | Slider | Line weight of the apparent wind speed iso-curves |
| Axis / Grid | Slider | Scale factor for all axis borders, gridlines, and tick marks |

### Chart Margins

| Setting | Control | Description |
|---|---|---|
| Border Offset | − / + | Adds extra padding around all four sides of the chart area, pushing the plot inward |

### Canvas

| Setting | Control | Description |
|---|---|---|
| Proportion | Dropdown | Canvas aspect ratio: A4 Horizontal, A4 Vertical, or Square |
| Resolution | Dropdown | Physical pixel count for export. **Screen** matches your display's device pixel ratio. Higher options (Full HD → 5K) fix the canvas width in pixels for print-quality export regardless of screen size |

## Polar

Click **Load Polar…** to load a `.csv` or `.pol` polar file and unlock polar-derived overlays.

A large library of boat polars is available at **[https://download.meltemus.com/polars/](https://download.meltemus.com/polars/)** — download any `.pol` or `.csv` file and load it directly.

| Setting | Control | Description |
|---|---|---|
| VMG curves | *(always on when polar loaded)* | Red dashed lines marking the optimal upwind and downwind TWA for each TWS |
| AWS Iso-Curves | Toggle | Lines of constant Apparent Wind Speed across the TWA/TWS space |
| BSP Speed Labels | Toggle | Boat speed values displayed as numbers at grid intersections |
| BSP Density | − / + | How many BSP labels are shown — lower is sparser, higher is denser. At the base level (2) labels land on major grid intersections. If the polar has ≤ 80 data points labels snap to the polar's own grid instead |
| BSP Font Size | − / + | Point size of the BSP speed label text |
| BSP Color | Color picker | Colour of the BSP speed labels |

#### Polar file format

Two variants are supported — both use the same structure: TWS values as column headers, TWA as row labels, boat speed as cell values.

**CSV** (comma or semicolon separated):
```
twa\tws;  6;  8; 10; 12; 14; 16; 20
52;    5.08;6.07;6.98;7.74;8.29;8.67;9.08
60;    5.49;6.56;7.41;8.15;8.73;9.11;9.49
…
```

**POL** (tab separated):
```
TWA\TWS	6	8	10	12	14	16	20
52	5.08	6.07	6.98	7.74	8.29	8.67	9.08
60	5.49	6.56	7.41	8.15	8.73	9.11	9.49
…
```

The delimiter is detected automatically (tab → semicolon → comma). The header label (`twa\tws`, `TWA/TWS`, etc.) is ignored.

---

## XML format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SailChart>
  <ChartSettings bgColor="#ffffff" fontSize="11" showAWS="false" showBSP="false" …/>
  <Sail name="J1" color="#ff9500" opacity="0.55" visible="true" showLabel="true"
        fillPattern="none" points="107.000,11.000 96.380,14.536 72.000,16.000 …"/>
  <Label text="Light air" x="75.000" y="6.000" color="#2a3f6f"/>
  <Spline name="Crossover" color="#e05020" strokeWidth="2" stroke="dashed"
          points="65.000,8.000 80.000,12.000 95.000,8.000"/>
</SailChart>
```

Each `points` value is a space-separated list of `angle,speed` pairs defining the Catmull-Rom spline control points.
