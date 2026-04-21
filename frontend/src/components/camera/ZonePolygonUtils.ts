/**
 * Polygon geometry utilities for Zone drawing/editing.
 */

export interface NormPoint {
  x: number;
  y: number;
}

export function polygonBounds(points: NormPoint[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function polygonArea(points: NormPoint[]): number {
  if (points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += (a.x * b.y) - (b.x * a.y);
  }
  return Math.abs(s) / 2;
}

export function rectToPolygon(x: number, y: number, w: number, h: number): NormPoint[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/**
 * Ramer-Douglas-Peucker simplification (epsilon in normalized space).
 * Keeps endpoints; removes redundant points along straight-ish edges.
 */
export function simplifyPolygon(points: NormPoint[], epsilon = 0.008): NormPoint[] {
  if (points.length < 3) return points;

  function dSq(a: NormPoint, b: NormPoint): number {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  function perpDistSq(p: NormPoint, a: NormPoint, b: NormPoint): number {
    if (a.x === b.x && a.y === b.y) return dSq(p, a);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    const px = a.x + clampedT * dx, py = a.y + clampedT * dy;
    const ex = p.x - px, ey = p.y - py;
    return ex * ex + ey * ey;
  }
  function rdp(start: number, end: number): number[] {
    let maxD = 0, idx = 0;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistSq(points[i], points[start], points[end]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > epsilon * epsilon) {
      const l = rdp(start, idx);
      const r = rdp(idx, end);
      return [...l.slice(0, -1), ...r];
    }
    return [start, end];
  }
  const keptIdx = rdp(0, points.length - 1);
  return keptIdx.map((i) => points[i]);
}

/**
 * Check if two axis-aligned rectangles overlap (bounds check only).
 */
export function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

/**
 * Serialize polygon points into SVG "points" string (percentage-based).
 */
export function pointsToSvgString(points: NormPoint[]): string {
  return points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
}
