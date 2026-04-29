/**
 * Polygon-polygon overlap detection (Yan #31).
 *
 * Bbox AABB check is bbox-only — two zones whose bounding boxes overlap may
 * never actually intersect (classic U-shape false positive: an L cut into a
 * rectangle's bbox shares the rect's bbox without sharing any interior).
 *
 * This module replaces the bbox-only `rectsOverlap` heuristic with a real
 * polygon-polygon test:
 *   1. Bbox AABB quick reject (fast path).
 *   2. Edge-edge proper intersection (any edge of A crosses any edge of B,
 *      strictly — touching at a shared endpoint or a collinear adjacency
 *      does NOT count, so neighbouring zones with a shared border are
 *      allowed).
 *   3. Vertex containment fallback (one polygon fully inside the other —
 *      no edges intersect but interiors overlap).
 *
 * Handles convex AND concave polygons. Shapes are normalised 0-1 coords so
 * we don't need integer overflow guards. Capped at 128 vertices by Yan #32.
 */
export interface Point {
  x: number;
  y: number;
}

function bboxOverlap(a: Point[], b: Point[]): boolean {
  let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity;
  for (const p of a) {
    if (p.x < aMinX) aMinX = p.x;
    if (p.x > aMaxX) aMaxX = p.x;
    if (p.y < aMinY) aMinY = p.y;
    if (p.y > aMaxY) aMaxY = p.y;
  }
  let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
  for (const p of b) {
    if (p.x < bMinX) bMinX = p.x;
    if (p.x > bMaxX) bMaxX = p.x;
    if (p.y < bMinY) bMinY = p.y;
    if (p.y > bMaxY) bMaxY = p.y;
  }
  return !(aMaxX <= bMinX || bMaxX <= aMinX || aMaxY <= bMinY || bMaxY <= aMinY);
}

// 2D cross product of (p2 - p1) x (p3 - p1).
function cross(p1: Point, p2: Point, p3: Point): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

/**
 * True iff the open segments p1p2 and p3p4 cross at a single interior point.
 * Endpoint-touching (shared vertex) and collinear-overlap are intentionally
 * NOT considered intersections — neighbouring zones may legitimately share
 * a boundary segment without overlapping in interior.
 */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  // Strict opposite-side: each segment straddles the other's supporting line.
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Ray-casting point-in-polygon. Assumes the polygon is closed (last edge
 * connects vertices[n-1] -> vertices[0]). Robust against horizontal rays
 * passing through a vertex by using strict half-open edge tests.
 */
function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersects = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Returns true iff polygons `a` and `b` share interior points.
 * Touching at a single boundary point or along a shared edge segment
 * is NOT considered overlap (zones may be adjacent).
 */
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  if (!bboxOverlap(a, b)) return false;
  // Edge-edge proper intersection.
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const p3 = b[j], p4 = b[(j + 1) % b.length];
      if (segmentsIntersect(p1, p2, p3, p4)) return true;
    }
  }
  // Containment: one polygon fully inside the other (no edges cross).
  // Test a single representative vertex — if any one vertex of A is interior
  // to B (strict, not on boundary), the whole polygon is interior given no
  // edges crossed. Same for B-in-A.
  if (pointInPolygon(a[0], b)) return true;
  if (pointInPolygon(b[0], a)) return true;
  return false;
}
