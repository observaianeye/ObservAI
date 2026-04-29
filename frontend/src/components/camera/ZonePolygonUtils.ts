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
 * Faz 10 / Issue #3: detect if a 4-point polygon is an axis-aligned
 * rectangle. The backend stores every zone as a polygon coords array, so
 * after a save/reload round-trip the canvas has no first-class signal that
 * the user originally drew a rect. Without this detection the zone gets
 * re-rendered as a polygon (different overlay, different drag affordance,
 * impossible to resize via 4 corner handles), which the user reads as
 * "Rect → Poly mutation". Tolerance is in normalized canvas space —
 * 0.005 ≈ 0.5% of the canvas, generous enough to absorb floating-point
 * drift but tight enough to reject genuinely off-axis quadrilaterals.
 */
export function coordsLookLikeRect(
  coords: NormPoint[],
  bbox?: { x: number; y: number; width: number; height: number },
  tol = 0.005,
): boolean {
  if (coords.length !== 4) return false;
  const b = bbox ?? polygonBounds(coords);
  const onLeft = (p: NormPoint) => Math.abs(p.x - b.x) < tol;
  const onRight = (p: NormPoint) => Math.abs(p.x - (b.x + b.width)) < tol;
  const onTop = (p: NormPoint) => Math.abs(p.y - b.y) < tol;
  const onBottom = (p: NormPoint) => Math.abs(p.y - (b.y + b.height)) < tol;
  return coords.every((p) => (onLeft(p) || onRight(p)) && (onTop(p) || onBottom(p)));
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

// Yan #31: real polygon-polygon overlap (mirrors backend lib/polygonOverlap.ts).
// Used by ZoneCanvas for the live overlap warning so the frontend agrees with
// the backend's 409 verdict before the user clicks Save.
function bboxOverlap(a: NormPoint[], b: NormPoint[]): boolean {
  const ba = polygonBounds(a), bb = polygonBounds(b);
  return !(ba.x + ba.width <= bb.x || bb.x + bb.width <= ba.x || ba.y + ba.height <= bb.y || bb.y + bb.height <= ba.y);
}

function cross3(p1: NormPoint, p2: NormPoint, p3: NormPoint): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

function segmentsCross(p1: NormPoint, p2: NormPoint, p3: NormPoint, p4: NormPoint): boolean {
  const d1 = cross3(p3, p4, p1);
  const d2 = cross3(p3, p4, p2);
  const d3 = cross3(p1, p2, p3);
  const d4 = cross3(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPoly(p: NormPoint, poly: NormPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const hits = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi);
    if (hits) inside = !inside;
  }
  return inside;
}

export function polygonsOverlap(a: NormPoint[], b: NormPoint[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (!bboxOverlap(a, b)) return false;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const p3 = b[j], p4 = b[(j + 1) % b.length];
      if (segmentsCross(p1, p2, p3, p4)) return true;
    }
  }
  if (pointInPoly(a[0], b)) return true;
  if (pointInPoly(b[0], a)) return true;
  return false;
}

/**
 * Serialize polygon points into SVG "points" string (percentage-based).
 */
export function pointsToSvgString(points: NormPoint[]): string {
  return points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
}
