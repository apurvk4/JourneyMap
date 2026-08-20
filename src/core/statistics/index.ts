import type { TimelineData, Stats } from '../model';
import { polylineDistance } from '../geo';
import { localDayKey } from '../time';

/** Compute comprehensive statistics from a TimelineData (or a filtered subset of segments). */
export function computeStatistics(timeline: TimelineData): Stats {
  let totalDistanceMeters = 0;
  let totalDurationMs = 0;
  let visitCount = 0;
  let routeCount = 0;
  const daySet = new Set<string>();
  const placeSet = new Set<string>();
  const breakdown: Record<string, { count: number; distanceMeters: number; durationMs: number }> = {};
  const dailyDistance: Record<string, number> = {};
  const yearlyStats: Record<number, { distanceMeters: number; travelDays: number; segments: number }> = {};
  const yearDaySets: Record<number, Set<string>> = {};

  for (const s of timeline.segments) {
    // Distance
    const segDist =
      s.distanceMeters > 0
        ? s.distanceMeters
        : polylineDistance(s.points.map((p) => p.coordinate));
    totalDistanceMeters += segDist;
    // "Movement time" intentionally excludes time spent at a visit.
    if (s.type === 'route') totalDurationMs += s.durationMs;

    // Type counts
    if (s.type === 'visit') {
      visitCount++;
      if (s.place?.name) placeSet.add(s.place.name);
      if (s.place?.semanticType) placeSet.add(s.place.semanticType);
    } else {
      routeCount++;
    }

    // Days from segment time range (attribute to start day)
    const dayStr = localDayKey(s.startTime);
    daySet.add(dayStr);

    // Daily distance — attribute to the day the segment starts
    dailyDistance[dayStr] = (dailyDistance[dayStr] ?? 0) + segDist;

    // Activity breakdown
    const actType = s.activity?.type ?? (s.type === 'visit' ? 'VISIT' : 'UNKNOWN');
    if (!breakdown[actType]) {
      breakdown[actType] = { count: 0, distanceMeters: 0, durationMs: 0 };
    }
    breakdown[actType].count++;
    breakdown[actType].distanceMeters += segDist;
    breakdown[actType].durationMs += s.durationMs;

    // Yearly aggregation
    const year = new Date(s.startTime).getFullYear();
    if (!yearlyStats[year]) {
      yearlyStats[year] = { distanceMeters: 0, travelDays: 0, segments: 0 };
      yearDaySets[year] = new Set();
    }
    yearlyStats[year].distanceMeters += segDist;
    yearlyStats[year].segments++;
    yearDaySets[year].add(dayStr);
  }

  // Finalize yearly travel days
  for (const [year, dayS] of Object.entries(yearDaySets)) {
    yearlyStats[Number(year)].travelDays = dayS.size;
  }

  // Collect unique place names
  const placeNames = Array.from(
    new Set(
      timeline.segments
        .filter((s) => s.place?.name)
        .map((s) => s.place!.name!),
    ),
  );

  return {
    totalDistanceMeters: Math.round(totalDistanceMeters),
    totalDurationMs,
    travelDays: daySet.size,
    segments: timeline.segments.length,
    visitCount,
    routeCount,
    placeNames,
    activityBreakdown: breakdown,
    dailyDistance,
    yearlyStats,
  };
}
