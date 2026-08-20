import type { Coordinate, TimelinePoint } from './model';

const R = 6371000; // Earth radius in meters

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two geographic coordinates in meters. */
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const u = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(u), Math.sqrt(1 - u));
  return R * c;
}

/** Sum of Haversine distances along a sequence of coordinates. */
export function polylineDistance(points: Coordinate[]): number {
  let d = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    d += distanceMeters(points[i], points[i + 1]);
  }
  return d;
}

/** Compute [minLon, minLat, maxLon, maxLat] bounding box, or null if empty. */
export function computeBounds(coords: Coordinate[]): [number, number, number, number] | null {
  if (coords.length === 0) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const c of coords) {
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** Linearly interpolate a position along a sequence of timestamped points. */
export function interpolatePosition(
  points: TimelinePoint[],
  timestamp: number,
): Coordinate | null {
  if (points.length === 0) return null;
  if (timestamp <= points[0].timestamp) return points[0].coordinate;
  if (timestamp >= points[points.length - 1].timestamp)
    return points[points.length - 1].coordinate;

  let idx = 0;
  while (idx + 1 < points.length && points[idx + 1].timestamp <= timestamp) idx++;

  const a = points[idx];
  const b = points[Math.min(idx + 1, points.length - 1)];
  const span = b.timestamp - a.timestamp;
  if (span <= 0) return a.coordinate;

  const ratio = (timestamp - a.timestamp) / span;
  return {
    latitude: a.coordinate.latitude + (b.coordinate.latitude - a.coordinate.latitude) * ratio,
    longitude:
      a.coordinate.longitude + (b.coordinate.longitude - a.coordinate.longitude) * ratio,
  };
}

/** Format a distance in meters to a human-readable string (e.g. "12.5 km" or "832 m"). */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
  return Math.round(meters) + ' m';
}

/** Format a duration in milliseconds to human-readable "Xh Ym" or "Xm". */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return totalMin + 'm';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Catmull-Rom spline (a type of cubic Hermite) */
export function catmullRomInterpolate(
  p0: Coordinate, p1: Coordinate, p2: Coordinate, p3: Coordinate, t: number
): Coordinate {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    latitude: 0.5 * (
      (2 * p1.latitude) +
      (-p0.latitude + p2.latitude) * t +
      (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
      (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3
    ),
    longitude: 0.5 * (
      (2 * p1.longitude) +
      (-p0.longitude + p2.longitude) * t +
      (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
      (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3
    )
  };
}

/** Smoothly interpolate position using Catmull-Rom spline */
export function smoothInterpolatePosition(
  points: TimelinePoint[],
  timestamp: number
): Coordinate | null {
  if (points.length === 0) return null;
  if (timestamp <= points[0].timestamp) return points[0].coordinate;
  if (timestamp >= points[points.length - 1].timestamp)
    return points[points.length - 1].coordinate;

  let idx = 0;
  while (idx + 1 < points.length && points[idx + 1].timestamp <= timestamp) idx++;

  const p1 = points[idx];
  const p2 = points[Math.min(idx + 1, points.length - 1)];
  const span = p2.timestamp - p1.timestamp;
  if (span <= 0) return p1.coordinate;

  const t = (timestamp - p1.timestamp) / span;

  const p0 = points[Math.max(0, idx - 1)];
  const p3 = points[Math.min(idx + 2, points.length - 1)];

  return catmullRomInterpolate(p0.coordinate, p1.coordinate, p2.coordinate, p3.coordinate, t);
}

/** Generate intermediate points along a curved geodesic/parabolic flight arc between two coordinates. */
export function generateFlightArc(
  start: Coordinate,
  end: Coordinate,
  startTime: number,
  endTime: number,
  numPoints: number = 60,
): TimelinePoint[] {
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);
  const lat2 = toRadians(end.latitude);
  const lon2 = toRadians(end.longitude);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLon2 = Math.sin(dLon / 2);
  const a = sinDLat2 * sinDLat2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon2 * sinDLon2;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (d < 1e-6) {
    return [
      { timestamp: startTime, coordinate: { ...start } },
      { timestamp: endTime, coordinate: { ...end } },
    ];
  }

  const sinD = Math.sin(d);
  const points: TimelinePoint[] = [];

  // Vector from start to end in 2D degrees for perpendicular arching
  const deltaLonDeg = end.longitude - start.longitude;
  const deltaLatDeg = end.latitude - start.latitude;
  const chordLen = Math.sqrt(deltaLonDeg * deltaLonDeg + deltaLatDeg * deltaLatDeg);

  // Perpendicular unit vector (prefer arching northward/upward)
  let perpX = -deltaLatDeg / (chordLen || 1);
  let perpY = deltaLonDeg / (chordLen || 1);
  if (perpY < 0) {
    perpX = -perpX;
    perpY = -perpY;
  }
  // Parabolic bulge height (proportional to distance, visually pleasing)
  const maxBulge = Math.min(chordLen * 0.15, 6.0);

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const t = startTime + f * (endTime - startTime);

    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    let latDeg = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI;
    let lonDeg = (Math.atan2(y, x) * 180) / Math.PI;

    // Apply smooth parabolic arch: 4 * f * (1 - f)
    const arch = 4 * f * (1 - f) * maxBulge;
    latDeg += arch * perpY;
    lonDeg += arch * perpX;

    latDeg = Math.max(-89.9, Math.min(89.9, latDeg));
    lonDeg = Math.max(-180, Math.min(180, lonDeg));

    points.push({
      timestamp: Math.round(t),
      coordinate: {
        latitude: latDeg,
        longitude: lonDeg,
      },
    });
  }

  return points;
}

/**
 * Calculate forward azimuth/bearing from coordinate `a` to `b` in degrees [0, 360).
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function computeBearing(a: Coordinate, b: Coordinate): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

