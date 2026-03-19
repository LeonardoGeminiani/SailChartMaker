// ── PolarData ─────────────────────────────────────────────────────────────────
// Parses a sailing polar CSV (TWA rows × TWS columns → BSP) and provides
// bilinear interpolation via getBSP(twa, tws).
//
// Supported format (comma or semicolon delimited):
//   twa\tws, 6, 8, 10, 12, 14, 16, 20
//   52,       5.08, 6.07, 6.98, ...
//   60,       5.49, 6.56, 7.41, ...
export class PolarData {
  readonly name: string;

  constructor(
    name: string,
    private readonly twsValues: readonly number[], // column headers
    private readonly twaValues: readonly number[], // row headers
    private readonly bsp: readonly (readonly number[])[], // bsp[twaIdx][twsIdx]
  ) {
    this.name = name;
  }

  static parse(text: string, filename = 'polar'): PolarData {
    const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
    if (lines.length < 2) throw new Error('Polar file has too few rows');

    const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(delim).map(s => s.trim());
    const twsValues = header.slice(1).map(Number);
    if (twsValues.some(isNaN) || twsValues.length === 0) {
      throw new Error('Could not parse TWS values from polar header');
    }

    const twaValues: number[] = [];
    const bsp: number[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(delim).map(s => s.trim());
      const twa = Number(cells[0]);
      if (isNaN(twa)) continue;
      const row = cells.slice(1, 1 + twsValues.length).map(Number);
      if (row.some(isNaN)) continue;
      twaValues.push(twa);
      bsp.push(row);
    }

    if (twaValues.length < 2) throw new Error('Polar file has too few TWA rows');
    return new PolarData(filename.replace(/\.[^.]+$/, ''), twsValues, twaValues, bsp);
  }

  get minTWS(): number { return this.twsValues[0]; }
  get maxTWS(): number { return this.twsValues[this.twsValues.length - 1]; }
  get minTWA(): number { return this.twaValues[0]; }
  get maxTWA(): number { return this.twaValues[this.twaValues.length - 1]; }
  get allTWA(): readonly number[] { return this.twaValues; }
  get allTWS(): readonly number[] { return this.twsValues; }

  /** Bilinear interpolation, clamped to polar grid bounds. */
  getBSP(twa: number, tws: number): number {
    const twaArr = this.twaValues;
    const twsArr = this.twsValues;

    const twaC = Math.max(twaArr[0], Math.min(twaArr[twaArr.length - 1], twa));
    const twsC = Math.max(twsArr[0], Math.min(twsArr[twsArr.length - 1], tws));

    let ti = 0;
    while (ti < twaArr.length - 2 && twaArr[ti + 1] <= twaC) ti++;
    let si = 0;
    while (si < twsArr.length - 2 && twsArr[si + 1] <= twsC) si++;

    const tf = (twaC - twaArr[ti]) / (twaArr[ti + 1] - twaArr[ti]);
    const sf = (twsC - twsArr[si]) / (twsArr[si + 1] - twsArr[si]);

    const b00 = this.bsp[ti    ][si    ];
    const b10 = this.bsp[ti + 1][si    ];
    const b01 = this.bsp[ti    ][si + 1];
    const b11 = this.bsp[ti + 1][si + 1];

    return (1 - tf) * (1 - sf) * b00
         + tf       * (1 - sf) * b10
         + (1 - tf) * sf       * b01
         + tf       * sf       * b11;
  }
}
