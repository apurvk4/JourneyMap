/**
 * Google Timeline JSON parser.
 *
 * Supports multiple export formats:
 * 1. 2024+ "semanticSegments" with timelinePath/visit/activity.topCandidate
 * 2. Older "timelineObjects" with placeVisit/activitySegment
 * 3. Legacy "locations" / "locationHistory" arrays
 *
 * All formats are normalized into the internal TimelineData model.
 * The parser is defensive — malformed segments are skipped, not fatal.
 */
import type {
  TimelineData,
  TimelineSegment,
  TimelinePoint,
  Coordinate,
  ActivityType,
  Place,
  Activity,
} from '../model';
import { polylineDistance, generateFlightArc } from '../geo';
import { convertLocationsToSegments } from './locations-adapter';

export interface ParserWarning {
  type: 'skipped_segment' | 'invalid_coordinate' | 'missing_timestamp' | 'unknown_format';
  message: string;
  index?: number;
}

export interface ParserResult extends TimelineData {
  data: TimelineData;
  warnings: ParserWarning[];
}

// ─── Timestamp parsing ─────────────────────────────────────────────
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

// ─── Coordinate parsing ─────────────────────────────────────────────
function toCoordinateE7(latE7: number, lonE7: number): Coordinate {
  return { latitude: latE7 / 1e7, longitude: lonE7 / 1e7 };
}

function parseCoordString(s: string): Coordinate | null {
  // Format 1: "geo:28.6139,77.2090" or "geo:28.6139,77.2090,0"
  const geoMatch = s.match(/^geo:([-\d.]+),([-\d.]+)/);
  if (geoMatch) {
    const lat = parseFloat(geoMatch[1]);
    const lon = parseFloat(geoMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { latitude: lat, longitude: lon };
  }

  // Format 2: "28.5773279°, 77.442277°" (degree-symbol format from real Google exports)
  const degMatch = s.match(/([-\d.]+)°?\s*,\s*([-\d.]+)°?/);
  if (degMatch) {
    const lat = parseFloat(degMatch[1]);
    const lon = parseFloat(degMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { latitude: lat, longitude: lon };
  }

  return null;
}

function parseCoordinate(obj: Record<string, unknown>): Coordinate | null {
  // String coordinate fields: "point", "latLng"
  if (typeof obj.point === 'string') return parseCoordString(obj.point);
  if (typeof obj.latLng === 'string') return parseCoordString(obj.latLng);

  // Direct lat/lng numbers
  if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number')
    return { latitude: obj.latitude, longitude: obj.longitude };
  if (typeof obj.lat === 'number' && typeof obj.lng === 'number')
    return { latitude: obj.lat, longitude: obj.lng };

  // E7 format
  if (typeof obj.latitudeE7 === 'number' && typeof obj.longitudeE7 === 'number')
    return toCoordinateE7(obj.latitudeE7 as number, obj.longitudeE7 as number);
  if (typeof obj.latE7 === 'number' && typeof obj.lngE7 === 'number')
    return toCoordinateE7(obj.latE7 as number, obj.lngE7 as number);

  return null;
}

function parseLocationCoordinate(s: unknown): Coordinate | null {
  if (typeof s === 'string') return parseCoordString(s);
  if (typeof s === 'object' && s !== null) return parseCoordinate(s as Record<string, unknown>);
  return null;
}

// ─── Activity normalization ─────────────────────────────────────────
const ACTIVITY_MAP: Record<string, ActivityType> = {
  IN_PASSENGER_VEHICLE: 'DRIVING',
  IN_VEHICLE: 'DRIVING',
  DRIVING: 'DRIVING',
  ON_FOOT: 'WALKING',
  WALKING: 'WALKING',
  ON_BICYCLE: 'CYCLING',
  CYCLING: 'CYCLING',
  RUNNING: 'RUNNING',
  IN_BUS: 'IN_BUS',
  IN_TRAIN: 'IN_TRAIN',
  IN_SUBWAY: 'IN_SUBWAY',
  IN_TRAM: 'IN_TRAM',
  IN_FERRY: 'IN_FERRY',
  FLYING: 'FLYING',
  IN_FLIGHT: 'FLYING',
  MOTORCYCLING: 'MOTORCYCLING',
  SKIING: 'SKIING',
  SAILING: 'SAILING',
  STILL: 'STILL',
};

function normalizeActivityType(raw: string | undefined | null): ActivityType {
  if (!raw) return 'UNKNOWN';
  return ACTIVITY_MAP[raw.toUpperCase()] ?? 'UNKNOWN';
}

function parseActivity(obj: unknown): Activity | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const a = obj as Record<string, unknown>;

  // 2024+ format: { topCandidate: { type: "WALKING", probability: 0.9 } }
  if (a.topCandidate && typeof a.topCandidate === 'object') {
    const tc = a.topCandidate as Record<string, unknown>;
    return {
      type: normalizeActivityType(tc.type as string),
      confidence: typeof tc.probability === 'number' ? tc.probability : undefined,
    };
  }

  // Older: { type: "WALKING" } or { activityType: "WALKING" }
  const rawType = (a.type ?? a.activityType) as string | undefined;
  if (rawType) {
    return {
      type: normalizeActivityType(rawType),
      confidence: typeof a.confidence === 'number' ? a.confidence : undefined,
    };
  }

  // Array of candidates
  if (Array.isArray(a.activities)) {
    const best = (a.activities as Array<Record<string, unknown>>).reduce(
      (best: Record<string, unknown> | null, c) => {
        if (!best) return c;
        return (c.confidence as number) > (best.confidence as number) ? c : best;
      },
      null,
    );
    if (best) {
      return {
        type: normalizeActivityType((best.type ?? best.activityType) as string),
        confidence: typeof best.confidence === 'number' ? best.confidence : undefined,
      };
    }
  }

  return undefined;
}

// ─── Place parsing ──────────────────────────────────────────────────
function parsePlace(obj: unknown): Place | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const v = obj as Record<string, unknown>;

  // 2024+ visit.topCandidate
  if (v.topCandidate && typeof v.topCandidate === 'object') {
    const tc = v.topCandidate as Record<string, unknown>;
    const coord = parseLocationCoordinate(tc.placeLocation);
    if (!coord) return undefined;
    return {
      coordinate: coord,
      placeId: tc.placeId as string | undefined,
      semanticType: tc.semanticType as string | undefined,
      name: tc.name as string | undefined,
      address: tc.address as string | undefined,
      placeConfidence: (v.placeConfidence as string) || (tc.placeConfidence as string),
      editConfirmationStatus: v.editConfirmationStatus as string | undefined,
    };
  }

  // Older: { location: { latitudeE7, name, address, ... } }
  const loc = (v.location ?? v) as Record<string, unknown>;
  const coord = parseCoordinate(loc);
  if (!coord) return undefined;
  return {
    coordinate: coord,
    placeId: loc.placeId as string | undefined,
    semanticType: loc.semanticType as string | undefined,
    name: loc.name as string | undefined,
    address: loc.address as string | undefined,
    placeConfidence: (v.placeConfidence as string) || (loc.placeConfidence as string),
    editConfirmationStatus: v.editConfirmationStatus as string | undefined,
  };
}

// ─── Path point parsing ─────────────────────────────────────────────
function parsePathPoints(
  path: unknown[],
  fallbackStart: number,
): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (const p of path) {
    if (!p || typeof p !== 'object') continue;
    const obj = p as Record<string, unknown>;
    const coord = parseCoordinate(obj);
    if (!coord) continue;
    const ts = parseTimestamp(obj.time ?? obj.timestamp ?? obj.timestampMs) ?? fallbackStart;
    points.push({ timestamp: ts, coordinate: coord });
  }
  return points;
}

function normalizePoints(points: TimelinePoint[]): TimelinePoint[] {
  return points
    .filter((point) => Number.isFinite(point.timestamp) && isValidCoordinate(point.coordinate))
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((point, index, all) => {
      const previous = all[index - 1];
      return !previous || previous.timestamp !== point.timestamp ||
        previous.coordinate.latitude !== point.coordinate.latitude ||
        previous.coordinate.longitude !== point.coordinate.longitude;
    });
}

// ─── Segment validation ─────────────────────────────────────────────
function isValidCoordinate(c: Coordinate): boolean {
  return (
    c.latitude >= -90 &&
    c.latitude <= 90 &&
    c.longitude >= -180 &&
    c.longitude <= 180 &&
    (c.latitude !== 0 || c.longitude !== 0)
  );
}

// ─── Main parser ────────────────────────────────────────────────────
export interface ParseProgress {
  phase: string;
  current?: number;
  total?: number;
}

export function parseGoogleTimeline(
  raw: unknown,
  onProgress?: (p: ParseProgress) => void,
): ParserResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error("That doesn't appear to be a Google Timeline export.");
  }

  const root = raw as Record<string, unknown>;
  const segments: TimelineSegment[] = [];
  const warnings: ParserWarning[] = [];
  let idSeq = 0;

  // Determine which array of objects to iterate
  const objects: unknown[] = findSegmentArray(root);

  if (objects.length === 0) {
    throw new Error(
      "Your Timeline file is valid JSON, but we couldn't find any location data. " +
        'Expected semanticSegments, timelineObjects, or activitySegments.',
    );
  }

  onProgress?.({ phase: 'Processing segments', current: 0, total: objects.length });

  for (let i = 0; i < objects.length; i++) {
    if (i % 500 === 0) {
      onProgress?.({ phase: 'Processing segments', current: i, total: objects.length });
    }
    try {
      const seg = parseOneSegment(objects[i], idSeq);
      if (seg) {
        segments.push(seg);
        idSeq++;
      } else {
        warnings.push({ type: 'skipped_segment', message: 'Segment could not be parsed', index: i });
      }
    } catch (e) {
      warnings.push({ type: 'skipped_segment', message: e instanceof Error ? e.message : 'Unknown error', index: i });
    }
  }

  if (segments.length === 0) {
    throw new Error(
      'Your Timeline file was parsed, but no valid segments with coordinates were found.',
    );
  }

  // Sort by start time
  segments.sort((a, b) => a.startTime - b.startTime);

  // Compute date range
  let totalPoints = 0;
  for (const s of segments) totalPoints += s.points.length;

  const dateRange = {
    start: segments[0].startTime,
    end: segments[segments.length - 1].endTime,
  };

  const data: TimelineData = { segments, dateRange, totalPoints };
  
  onProgress?.({ phase: 'Ready', current: segments.length, total: segments.length });

  return { ...data, data, warnings };
}

function findSegmentArray(root: Record<string, unknown>): unknown[] {
  // 2024+ format
  if (Array.isArray(root.semanticSegments)) return root.semanticSegments;
  // Older Takeout
  if (Array.isArray(root.timelineObjects)) return root.timelineObjects;
  // Very old format
  if (Array.isArray(root.activitySegments)) return root.activitySegments;

  // Raw locations array
  if (Array.isArray(root.locations)) {
    return convertLocationsToSegments(root.locations).semanticSegments;
  }
  if (root.locationHistory && typeof root.locationHistory === 'object') {
    const lh = root.locationHistory as Record<string, unknown>;
    if (Array.isArray(lh.locations)) {
      return convertLocationsToSegments(lh.locations).semanticSegments;
    }
  }

  // Single-day or raw list
  if (Array.isArray(root)) return root as unknown[];
  return [];
}

function parseOneSegment(raw: unknown, idSeq: number): TimelineSegment | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // ── 2024+ semantic format with visit ──
  if (obj.visit) {
    return parseVisitSegment(obj, idSeq);
  }

  // ── 2024+ semantic format with activity + timelinePath ──
  if (obj.activity || obj.timelinePath) {
    return parseActivitySegment(obj, idSeq);
  }

  // ── Older timelineObjects wrapper ──
  if (obj.placeVisit) {
    return parseLegacyVisit(obj.placeVisit as Record<string, unknown>, idSeq);
  }
  if (obj.activitySegment) {
    return parseLegacyActivity(obj.activitySegment as Record<string, unknown>, idSeq);
  }

  return null;
}

// ── 2024+ Visit segment ──
function parseVisitSegment(obj: Record<string, unknown>, id: number): TimelineSegment | null {
  const startTime = parseTimestamp(obj.startTime);
  if (startTime === null) return null;
  const endTime = parseTimestamp(obj.endTime) ?? startTime;
  if (endTime < startTime) return null;
  const place = parsePlace(obj.visit);
  const locCoord =
    place?.coordinate ??
    parseLocationCoordinate(obj.startLocation) ??
    parseLocationCoordinate(obj.endLocation);

  if (!locCoord || !isValidCoordinate(locCoord)) return null;

  return {
    id: `seg_${id}`,
    type: 'visit',
    startTime,
    endTime,
    start: locCoord,
    end: locCoord,
    place: place ?? { coordinate: locCoord },
    points: [{ timestamp: startTime, coordinate: locCoord }],
    distanceMeters: 0,
    durationMs: endTime - startTime,
  };
}

// ── 2024+ Activity segment ──
function parseActivitySegment(obj: Record<string, unknown>, id: number): TimelineSegment | null {
  const startTime = parseTimestamp(obj.startTime);
  if (startTime === null) return null;
  const endTime = parseTimestamp(obj.endTime) ?? startTime;
  if (endTime < startTime) return null;
  const activity = parseActivity(obj.activity);

  const path = Array.isArray(obj.timelinePath)
    ? obj.timelinePath
    : Array.isArray(obj.path)
      ? obj.path
      : [];

  const points = normalizePoints(parsePathPoints(path, startTime));

  // If no timelinePath, try to build points from activity start/end
  if (points.length === 0 && obj.activity) {
    const act = obj.activity as Record<string, unknown>;
    const startCoord = parseLocationCoordinate(act.start);
    const endCoord = parseLocationCoordinate(act.end);
    if (startCoord) points.push({ timestamp: startTime, coordinate: startCoord });
    if (endCoord && endCoord !== startCoord) points.push({ timestamp: endTime, coordinate: endCoord });
  }

  if (points.length === 0) return null;

  // Add dummy end point if only one point exists (so it renders as a tiny line segment or point)
  if (points.length === 1) {
    points.push({ timestamp: endTime, coordinate: points[0].coordinate });
  }

  const normalizedPoints = normalizePoints(points);
  if (normalizedPoints.length === 0) return null;
  const coords = normalizedPoints.map((p) => p.coordinate);
  const start = coords[0];
  const end = coords[coords.length - 1];

  if (!isValidCoordinate(start)) return null;

  let distanceMeters = polylineDistance(coords);
  if (obj.activity) {
    const act = obj.activity as Record<string, unknown>;
    if (typeof act.distanceMeters === 'number') {
      distanceMeters = act.distanceMeters;
    }
  }

  let finalPoints = normalizedPoints;
  const isFlight = activity?.type === 'FLYING' || (!activity?.type && distanceMeters > 250000 && normalizedPoints.length <= 2);
  if (isFlight && normalizedPoints.length <= 3 && start && end && distanceMeters > 5000) {
    finalPoints = generateFlightArc(start, end, startTime, endTime, 60);
  }

  return {
    id: `seg_${id}`,
    type: 'route',
    startTime,
    endTime,
    start,
    end,
    activity,
    points: finalPoints,
    distanceMeters,
    durationMs: endTime - startTime,
  };
}

// ── Legacy placeVisit ──
function parseLegacyVisit(
  visit: Record<string, unknown>,
  id: number,
): TimelineSegment | null {
  const loc = visit.location as Record<string, unknown> | undefined;
  const coord = loc ? parseCoordinate(loc) : null;
  if (!coord || !isValidCoordinate(coord)) return null;

  const dur = visit.duration as Record<string, unknown> | undefined;
  const startTime =
    parseTimestamp(dur?.startTimestampMs ?? dur?.startTimestamp ?? visit.startTime);
  if (startTime === null) return null;
  const endTime = parseTimestamp(dur?.endTimestampMs ?? dur?.endTimestamp ?? visit.endTime) ?? startTime;
  if (endTime < startTime) return null;

  return {
    id: `seg_${id}`,
    type: 'visit',
    startTime,
    endTime,
    start: coord,
    end: coord,
    place: {
      coordinate: coord,
      name: loc?.name as string | undefined,
      address: loc?.address as string | undefined,
      placeId: loc?.placeId as string | undefined,
      editConfirmationStatus: visit.editConfirmationStatus as string | undefined,
      placeConfidence: visit.placeConfidence as string | undefined,
    },
    points: [{ timestamp: startTime, coordinate: coord }],
    distanceMeters: 0,
    durationMs: endTime - startTime,
  };
}

// ── Legacy activitySegment ──
function parseLegacyActivity(
  seg: Record<string, unknown>,
  id: number,
): TimelineSegment | null {
  const startTime =
    parseTimestamp(
      (seg.duration as Record<string, unknown>)?.startTimestampMs ??
        seg.startTime ??
        seg.startTimestampMs,
    );
  if (startTime === null) return null;
  const endTime =
    parseTimestamp(
      (seg.duration as Record<string, unknown>)?.endTimestampMs ??
        seg.endTime ??
        seg.endTimestampMs,
    ) ?? startTime;
  if (endTime < startTime) return null;

  // Path can be in waypointPath.waypoints, simplifiedRawPath.points, transitPath.transitStops or direct
  let path: unknown[] = [];
  if (seg.waypointPath && typeof seg.waypointPath === 'object') {
    const wp = seg.waypointPath as Record<string, unknown>;
    if (Array.isArray(wp.waypoints)) path = wp.waypoints;
  }
  if (path.length === 0 && seg.simplifiedRawPath && typeof seg.simplifiedRawPath === 'object') {
    const srp = seg.simplifiedRawPath as Record<string, unknown>;
    if (Array.isArray(srp.points)) path = srp.points;
  }
  if (path.length === 0 && seg.transitPath && typeof seg.transitPath === 'object') {
    const tp = seg.transitPath as Record<string, unknown>;
    if (Array.isArray(tp.transitStops)) path = tp.transitStops;
  }
  if (path.length === 0 && Array.isArray(seg.path)) path = seg.path;

  const points = normalizePoints(parsePathPoints(path, startTime));
  if (points.length === 0) {
    // Try start/end location
    const startLoc = parseCoordinate({
      latitudeE7: (seg.startLocation as Record<string, unknown>)?.latitudeE7,
      longitudeE7: (seg.startLocation as Record<string, unknown>)?.longitudeE7,
    } as Record<string, unknown>);
    const endLoc = parseCoordinate({
      latitudeE7: (seg.endLocation as Record<string, unknown>)?.latitudeE7,
      longitudeE7: (seg.endLocation as Record<string, unknown>)?.longitudeE7,
    } as Record<string, unknown>);
    if (startLoc && isValidCoordinate(startLoc)) {
      points.push({ timestamp: startTime, coordinate: startLoc });
      if (endLoc && isValidCoordinate(endLoc)) {
        points.push({ timestamp: endTime, coordinate: endLoc });
      }
    }
  }
  if (points.length === 0) return null;

  const activity = parseActivity(seg) ?? parseActivity(seg.activityType);
  const normalizedPoints = normalizePoints(points);
  if (normalizedPoints.length === 0) return null;
  const coords = normalizedPoints.map((p) => p.coordinate);
  
  let distanceMeters = polylineDistance(coords);
  if (typeof seg.distanceMeters === 'number') distanceMeters = seg.distanceMeters;
  else if (typeof seg.distance === 'number') distanceMeters = seg.distance;
  else if (typeof seg.travelDistanceMeters === 'number') distanceMeters = seg.travelDistanceMeters;

  let finalPoints = normalizedPoints;
  const isFlight = activity?.type === 'FLYING' || (!activity?.type && distanceMeters > 250000 && normalizedPoints.length <= 2);
  if (isFlight && normalizedPoints.length <= 3 && coords[0] && coords[coords.length - 1] && distanceMeters > 5000) {
    finalPoints = generateFlightArc(coords[0], coords[coords.length - 1], startTime, endTime, 60);
  }

  return {
    id: `seg_${id}`,
    type: 'route',
    startTime,
    endTime,
    start: coords[0],
    end: coords[coords.length - 1],
    activity,
    points: finalPoints,
    distanceMeters,
    durationMs: endTime - startTime,
  };
}
