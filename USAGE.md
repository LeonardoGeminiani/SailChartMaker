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

All settings are in the **Appearance** tab of the sidebar and persist in localStorage and XML.

### Chart

| Setting | Description |
|---|---|
| Background Color | Canvas and page background colour |
| Axis Font Size | Size of the TWA/TWS axis labels |
| Sail Label Size | Size of the in-chart sail name labels |
| Pattern Scale | Tile size of fill patterns |
| Pattern Thickness | Line weight of fill patterns |
| Curve Smoothing | Moving-average smoothing applied to polar-derived curves |
| Show Legend | Sidebar legend on the right showing sail swatches and names |

### Axis range

Adjust the visible TWA (°) and TWS (kts) range. Enable **TWS Reversed** to place high wind speed at the bottom.

### Stroke widths

Independent line-weight controls for VMG lines, AWS iso-curves, and the axis/grid.

### Canvas

Choose the canvas aspect ratio (A4 horizontal, A4 vertical, square) and export resolution (screen, Full HD, 2K, 4K, 5K).

### Polar / AWS

Load a polar CSV file to unlock polar-derived overlays:

| Overlay | Description |
|---|---|
| **VMG curves** | Always shown when a polar is loaded. Red dashed lines marking the optimal upwind and downwind TWA for each TWS. |
| **AWS iso-curves** | Lines of constant Apparent Wind Speed across the TWA/TWS space. |
| **BSP speed labels** | Boat speed values displayed as numbers at grid intersections. Configurable density, font size, and colour. |

**BSP density** controls how many labels are shown — lower is sparser, higher is denser. The grid adapts automatically: if the polar has few data points (≤ 80), labels appear at the polar's own grid points; otherwise they snap to chart axis intersections.

#### Polar CSV format

```
twa\tws, 6,  8, 10, 12, 14, 16, 20
52,      5.08, 6.07, 6.98, 7.74, 8.29, 8.67, 9.08
60,      5.49, 6.56, 7.41, 8.15, 8.73, 9.11, 9.49
…
```

Comma or semicolon delimited. TWS values as column headers, TWA as row labels.

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
