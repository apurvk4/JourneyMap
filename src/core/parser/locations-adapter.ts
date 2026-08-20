import { polylineDistance } from '../geo';

function parseTimestamp(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000; // seconds vs ms
  if (typeof v === 'string') {
    // ISO 8601
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d;
    // numeric string (timestampMs)
    const n = Number(v);
    if (!Number.isNaN(n)) return n > 1e12 ? n : n * 1000;
  }
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    return parseTimestamp(obj.timestampMs ?? obj.timestamp ?? obj.value);
  }
  return null;
}

function parsePoint(obj: Record<string, unknown>): { timestamp: number; lat: number; lng: number } | null {
  if (!obj || typeof obj !== 'object') return null;
  const timestamp = parseTimestamp(obj.timestampMs ?? obj.timestamp ?? obj.time);
  if (timestamp === null) return null;

  const lat = obj.latitudeE7 != null ? Number(obj.latitudeE7) / 1e7 : (obj.latitude ?? obj.lat) as number;
  const lng = obj.longitudeE7 != null ? Number(obj.longitudeE7) / 1e7 : (obj.longitude ?? obj.lng) as number;
  
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return { timestamp, lat, lng };
}

export function convertLocationsToSegments(locations: unknown[]): { semanticSegments: unknown[] } {
  const points = (locations as Record<string, unknown>[]).map(parsePoint).filter((p): p is NonNullable<typeof p> => p !== null);
  
  points.sort((a, b) => a.timestamp - b.timestamp);

  const clusters: typeof points[] = [];
  let currentCluster: typeof points = [];

  for (const point of points) {
    if (currentCluster.length === 0) {
      currentCluster.push(point);
    } else {
      const lastPoint = currentCluster[currentCluster.length - 1];
      const gapMs = point.timestamp - lastPoint.timestamp;
      
      // 30 min threshold
      if (gapMs > 30 * 60 * 1000) {
        clusters.push(currentCluster);
        currentCluster = [point];
      } else {
        currentCluster.push(point);
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const semanticSegments = clusters.map(cluster => {
    const coords = cluster.map(p => ({ latitude: p.lat, longitude: p.lng }));
    const distanceMeters = polylineDistance(coords);
    const durationMs = cluster[cluster.length - 1].timestamp - cluster[0].timestamp;
    
    let type = 'UNKNOWN';
    if (durationMs > 0) {
      const speedKmh = (distanceMeters / 1000) / (durationMs / 3600000);
      if (speedKmh > 80) type = 'DRIVING';
      else if (speedKmh >= 15) type = 'DRIVING'; // 15-80 default DRIVING
      else if (speedKmh >= 5) type = 'CYCLING';
      else type = 'WALKING';
    }

    return {
      startTime: new Date(cluster[0].timestamp).toISOString(),
      endTime: new Date(cluster[cluster.length - 1].timestamp).toISOString(),
      activity: { topCandidate: { type } },
      timelinePath: cluster.map(p => ({
        point: `geo:${p.lat},${p.lng}`,
        time: new Date(p.timestamp).toISOString()
      }))
    };
  });

  return { semanticSegments };
}
