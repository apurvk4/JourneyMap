/** Normalized internal data model — all UI and domain logic depends on these types, never on raw Google JSON. */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** Canonical activity type names normalized from Google's various representations. */
export type ActivityType =
  | 'DRIVING'
  | 'WALKING'
  | 'CYCLING'
  | 'RUNNING'
  | 'IN_BUS'
  | 'IN_TRAIN'
  | 'IN_SUBWAY'
  | 'IN_TRAM'
  | 'IN_FERRY'
  | 'FLYING'
  | 'MOTORCYCLING'
  | 'SKIING'
  | 'SAILING'
  | 'STILL'
  | 'UNKNOWN';

export type SegmentType = 'route' | 'visit';

export interface Place {
  name?: string;
  address?: string;
  placeId?: string;
  semanticType?: string;
  coordinate: Coordinate;
  editConfirmationStatus?: string;
  placeConfidence?: string;
}

export interface Activity {
  type: ActivityType;
  confidence?: number;
}

export interface TimelinePoint {
  timestamp: number;
  coordinate: Coordinate;
}

export interface TimelineSegment {
  id: string;
  type: SegmentType;
  startTime: number;
  endTime: number;
  start: Coordinate;
  end: Coordinate;
  activity?: Activity;
  place?: Place;
  points: TimelinePoint[];
  distanceMeters: number;
  durationMs: number;
}

export interface DateRange {
  start: number;
  end: number;
}

export interface TimelineData {
  segments: TimelineSegment[];
  dateRange: DateRange;
  totalPoints: number;
}

/** All active filters applied to the timeline view. */
export interface FilterState {
  dateRange: DateRange | null;
  activityTypes: Set<string>;
}

/** Pre-computed statistics about the entire timeline or a filtered subset. */
export interface Stats {
  totalDistanceMeters: number;
  totalDurationMs: number;
  travelDays: number;
  segments: number;
  visitCount: number;
  routeCount: number;
  placeNames: string[];
  activityBreakdown: Record<string, { count: number; distanceMeters: number; durationMs: number }>;
  dailyDistance: Record<string, number>;
  yearlyStats: Record<number, { distanceMeters: number; travelDays: number; segments: number }>;
}

/** Display info for activity types — color and human-readable label. */
export const ACTIVITY_DISPLAY: Record<string, { color: string; label: string }> = {
  DRIVING: { color: '#3b82f6', label: 'Driving' },
  WALKING: { color: '#22c55e', label: 'Walking' },
  CYCLING: { color: '#f59e0b', label: 'Cycling' },
  RUNNING: { color: '#ef4444', label: 'Running' },
  IN_BUS: { color: '#8b5cf6', label: 'Bus' },
  IN_TRAIN: { color: '#06b6d4', label: 'Train' },
  IN_SUBWAY: { color: '#6366f1', label: 'Subway' },
  IN_TRAM: { color: '#a855f7', label: 'Tram' },
  IN_FERRY: { color: '#14b8a6', label: 'Ferry' },
  FLYING: { color: '#f43f5e', label: 'Flight' },
  MOTORCYCLING: { color: '#fb923c', label: 'Motorcycle' },
  SKIING: { color: '#38bdf8', label: 'Skiing' },
  SAILING: { color: '#2dd4bf', label: 'Sailing' },
  STILL: { color: '#94a3b8', label: 'Still' },
  UNKNOWN: { color: '#64748b', label: 'Unknown' },
};
