# Sail Chart

**Live app: [https://leonardogeminiani.github.io/SailChartMaker/](https://leonardogeminiani.github.io/SailChartMaker/)**

An interactive sail performance matrix for visualising **when to use each sail** based on True Wind Angle (TWA) and True Wind Speed (TWS).

![Sail Chart screenshot](./screenshots/SailChart.png)

A sail chart maps each sail's usable wind range as a region on a two-axis grid — TWA on the X axis, TWS on the Y axis. Where regions overlap you can choose between sails; the boundaries of those overlaps are the **crossover points**, the exact conditions where you'd typically gybe or change sail.

---

## Install and run (development)

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages** and set the source to the `main` branch, root (`/`).
3. The site is served directly — no build step required.

> **Note:** The app uses native ES modules (`type="module"`), which require a proper HTTP server (not `file://`). Use `npm run dev` locally, or any static host for production.

---

- [Usage guide](./USAGE.md)
- [Architecture reference](./ARCHITECTURE.md)
