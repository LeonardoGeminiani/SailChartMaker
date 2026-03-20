export function hexToRgb(hex: string): string {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ].join(',');
}

export function seg(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
