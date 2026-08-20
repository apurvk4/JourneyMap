import type { DateRange, TimelinePoint, TimelineSegment } from './model';
import { interpolatePosition, polylineDistance } from './geo';

/** Return a display/statistics-safe portion of a segment that overlaps a range. */
export function clipSegmentToRange(segment: TimelineSegment, range: DateRange): TimelineSegment | null {
  const startTime = Math.max(segment.startTime, range.start);
  const endTime = Math.min(segment.endTime, range.end);
  if (startTime > endTime) return null;

  if (segment.type === 'visit') {
    return { ...segment, startTime, endTime, durationMs: endTime - startTime };
  }

  const sorted = [...segment.points].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length === 0) return null;
  const points: TimelinePoint[] = [];
  const start = interpolatePosition(sorted, startTime) ?? sorted[0].coordinate;
  const end = interpolatePosition(sorted, endTime) ?? sorted[sorted.length - 1].coordinate;
  points.push({ timestamp: startTime, coordinate: start });
  for (const point of sorted) {
    if (point.timestamp > startTime && point.timestamp < endTime) points.push(point);
  }
  if (endTime !== startTime || points.length === 1) points.push({ timestamp: endTime, coordinate: end });

  const deduped = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || point.timestamp !== previous.timestamp ||
      point.coordinate.latitude !== previous.coordinate.latitude ||
      point.coordinate.longitude !== previous.coordinate.longitude;
  });
  const originalSpan = Math.max(1, segment.endTime - segment.startTime);
  const clippedDistance = segment.points.length >= 2
    ? segment.distanceMeters * ((endTime - startTime) / originalSpan)
    : polylineDistance(deduped.map((point) => point.coordinate));
  return {
    ...segment,
    startTime,
    endTime,
    start: deduped[0].coordinate,
    end: deduped[deduped.length - 1].coordinate,
    points: deduped,
    distanceMeters: clippedDistance,
    durationMs: endTime - startTime,
  };
}
