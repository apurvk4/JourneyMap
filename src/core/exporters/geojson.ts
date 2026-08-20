import type { TimelineData } from '../model';
import { ACTIVITY_DISPLAY } from '../model';
import { computeBounds } from '../geo';

export function toGeoJSON(timeline: TimelineData): {
  type: string;
  bbox?: [number, number, number, number];
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: number[] | number[][] };
    properties: Record<string, unknown>;
  }>;
} {
  const allCoords = timeline.segments.flatMap(s => s.points.map(p => p.coordinate));
  const bbox = computeBounds(allCoords) || undefined;

  const features = timeline.segments.map((s) => {
    if (s.type === 'visit') {
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [s.start.longitude, s.start.latitude],
        },
        properties: {
          id: s.id,
          type: 'visit',
          startTime: s.startTime,
          endTime: s.endTime,
          placeName: s.place?.name,
          placeAddress: s.place?.address,
          semanticType: s.place?.semanticType,
          placeId: s.place?.placeId,
          durationMs: s.durationMs,
        },
      };
    }
    
    const activityType = s.activity?.type || 'UNKNOWN';
    const activityLabel = ACTIVITY_DISPLAY[activityType]?.label || activityType;

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: s.points.map((p) => [p.coordinate.longitude, p.coordinate.latitude]),
      },
      properties: {
        id: s.id,
        type: 'route',
        startTime: s.startTime,
        endTime: s.endTime,
        activity: activityType,
        activityConfidence: s.activity?.confidence,
        activityLabel: activityLabel,
        distanceMeters: s.distanceMeters,
        durationMs: s.durationMs,
        timestamps: s.points.map(p => p.timestamp),
      },
    };
  });

  return bbox ? { type: 'FeatureCollection', bbox, features } : { type: 'FeatureCollection', features };
}
