import type { TimelineData } from '../model';

function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  if (typeof field === 'string') {
    return `"${field.replace(/"/g, '""')}"`;
  }
  const str = String(field);
  return str;
}

export function toCSV(timeline: TimelineData): string {
  const headers = [
    'segment_id',
    'type',
    'start_time',
    'end_time',
    'activity',
    'activity_confidence',
    'distance_m',
    'duration_ms',
    'start_lat',
    'start_lon',
    'end_lat',
    'end_lon',
    'place_name',
    'place_address',
    'semantic_type',
    'place_id',
    'points_count',
  ];

  const rows: string[] = [headers.join(',')];

  for (const s of timeline.segments) {
    rows.push(
      [
        s.id,
        s.type,
        new Date(s.startTime).toISOString(),
        new Date(s.endTime).toISOString(),
        s.activity?.type ?? '',
        s.activity?.confidence ?? '',
        Math.round(s.distanceMeters),
        s.durationMs,
        s.start.latitude,
        s.start.longitude,
        s.end.latitude,
        s.end.longitude,
        s.place?.name ?? '',
        s.place?.address ?? '',
        s.place?.semanticType ?? '',
        s.place?.placeId ?? '',
        s.points.length,
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }

  return rows.join('\n');
}
