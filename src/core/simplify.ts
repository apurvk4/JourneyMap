import type { Coordinate } from './model';
import { distanceMeters } from './geo';

/**
 * Perpendicular distance from point to line segment (in meters).
 */
function perpendicularDistance(point: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number {
  if (lineStart.latitude === lineEnd.latitude && lineStart.longitude === lineEnd.longitude) {
    return distanceMeters(point, lineStart);
  }

  const a = distanceMeters(lineStart, point);
  const b = distanceMeters(lineEnd, point);
  const c = distanceMeters(lineStart, lineEnd);

  // Check if projection falls outside the segment (obtuse angle at either end)
  if (b ** 2 > a ** 2 + c ** 2) return a;
  if (a ** 2 > b ** 2 + c ** 2) return b;

  // Heron's formula for the height of the triangle
  const s = (a + b + c) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  return (2 * area) / c;
}

/**
 * Douglas-Peucker polyline simplification.
 * @param points Array of coordinates to simplify
 * @param epsilon Tolerance in meters. Points closer than this to the simplified line are removed.
 * @returns Simplified array of coordinates
 */
export function simplifyPolyline(points: Coordinate[], epsilon: number): Coordinate[] {
  if (points.length < 3 || epsilon <= 0) {
    return points;
  }

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = simplifyPolyline(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyPolyline(points.slice(index), epsilon);
    return recResults1.slice(0, -1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Suggest an epsilon value based on zoom level.
 * Higher zoom = more detail = smaller epsilon.
 */
export function epsilonForZoom(zoom: number): number {
  // Typical map tile resolutions at equator (meters per pixel):
  // Zoom 0: ~156543
  // Zoom 10: ~152
  // Zoom 15: ~4.7
  // Epsilon is roughly half a pixel at that zoom level, or similar logic.
  return Math.max(1, 156543 / Math.pow(2, zoom + 1));
}
