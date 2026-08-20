import { describe, it, expect } from 'vitest';
import { distanceMeters, polylineDistance, computeBounds, interpolatePosition, formatDistance, formatDuration, generateFlightArc, computeBearing } from '../core/geo';

describe('geo', () => {
  it('computes Haversine distance between two points', () => {
    // Delhi to Agra ≈ 200 km
    const d = distanceMeters(
      { latitude: 28.6139, longitude: 77.2090 },
      { latitude: 27.1767, longitude: 78.0081 },
    );
    expect(d).toBeGreaterThan(150_000);
    expect(d).toBeLessThan(250_000);
  });

  it('returns 0 for same point', () => {
    const d = distanceMeters(
      { latitude: 28.6139, longitude: 77.2090 },
      { latitude: 28.6139, longitude: 77.2090 },
    );
    expect(d).toBe(0);
  });

  it('computes polyline distance', () => {
    const coords = [
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ];
    const d = polylineDistance(coords);
    expect(d).toBeGreaterThan(200_000);
  });

  it('returns 0 for single-point polyline', () => {
    expect(polylineDistance([{ latitude: 0, longitude: 0 }])).toBe(0);
  });

  it('returns 0 for empty polyline', () => {
    expect(polylineDistance([])).toBe(0);
  });

  it('computes bounding box', () => {
    const bounds = computeBounds([
      { latitude: 10, longitude: 20 },
      { latitude: 30, longitude: 40 },
      { latitude: 5, longitude: 50 },
    ]);
    expect(bounds).toEqual([20, 5, 50, 30]); // [minLon, minLat, maxLon, maxLat]
  });

  it('returns null for empty coords', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('interpolates position at midpoint', () => {
    const points = [
      { timestamp: 0, coordinate: { latitude: 0, longitude: 0 } },
      { timestamp: 100, coordinate: { latitude: 10, longitude: 10 } },
    ];
    const pos = interpolatePosition(points, 50);
    expect(pos).not.toBeNull();
    expect(pos!.latitude).toBeCloseTo(5);
    expect(pos!.longitude).toBeCloseTo(5);
  });

  it('interpolates at start', () => {
    const points = [
      { timestamp: 100, coordinate: { latitude: 10, longitude: 20 } },
      { timestamp: 200, coordinate: { latitude: 30, longitude: 40 } },
    ];
    const pos = interpolatePosition(points, 50); // before start
    expect(pos!.latitude).toBeCloseTo(10);
  });

  it('interpolates at end', () => {
    const points = [
      { timestamp: 100, coordinate: { latitude: 10, longitude: 20 } },
      { timestamp: 200, coordinate: { latitude: 30, longitude: 40 } },
    ];
    const pos = interpolatePosition(points, 300); // after end
    expect(pos!.latitude).toBeCloseTo(30);
  });

  it('returns null for empty points', () => {
    expect(interpolatePosition([], 50)).toBeNull();
  });

  it('formats distance', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(12483000)).toBe('12483.0 km');
  });

  it('formats duration', () => {
    expect(formatDuration(1800000)).toBe('30m'); // 30 min
    expect(formatDuration(5400000)).toBe('1h 30m'); // 1.5 hours
    expect(formatDuration(7200000)).toBe('2h'); // exact 2 hours
  });

  it('generates smooth parabolic flight arc', () => {
    const start = { latitude: 28.6139, longitude: 77.2090 }; // Delhi
    const end = { latitude: 22.5726, longitude: 88.3639 }; // Kolkata
    const arc = generateFlightArc(start, end, 1000, 5000, 20);

    expect(arc.length).toBe(21);
    expect(arc[0].timestamp).toBe(1000);
    expect(arc[0].coordinate.latitude).toBeCloseTo(start.latitude, 2);
    expect(arc[0].coordinate.longitude).toBeCloseTo(start.longitude, 2);

    expect(arc[20].timestamp).toBe(5000);
    expect(arc[20].coordinate.latitude).toBeCloseTo(end.latitude, 2);
    expect(arc[20].coordinate.longitude).toBeCloseTo(end.longitude, 2);

    // Intermediate point should be smoothly curved
    const mid = arc[10];
    expect(mid.timestamp).toBe(3000);
    expect(mid.coordinate.latitude).toBeGreaterThan(20);
    expect(mid.coordinate.longitude).toBeGreaterThan(77);
  });

  it('computes forward azimuth bearing accurately', () => {
    // North: 0 deg
    expect(computeBearing({ latitude: 10, longitude: 10 }, { latitude: 20, longitude: 10 })).toBeCloseTo(0, 1);
    // East along equator: 90 deg
    expect(computeBearing({ latitude: 0, longitude: 10 }, { latitude: 0, longitude: 20 })).toBeCloseTo(90, 1);
    // South: 180 deg
    expect(computeBearing({ latitude: 20, longitude: 10 }, { latitude: 10, longitude: 10 })).toBeCloseTo(180, 1);
    // West along equator: 270 deg
    expect(computeBearing({ latitude: 0, longitude: 20 }, { latitude: 0, longitude: 10 })).toBeCloseTo(270, 1);
  });
});
