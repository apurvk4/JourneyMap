import { describe, it, expect } from 'vitest';
import { computeStatistics } from '../core/statistics';
import type { TimelineData, TimelineSegment } from '../core/model';

function makeSeg(overrides: Partial<TimelineSegment> & { id: string }): TimelineSegment {
  return {
    type: 'route',
    startTime: 0,
    endTime: 3600000,
    start: { latitude: 0, longitude: 0 },
    end: { latitude: 1, longitude: 1 },
    points: [
      { timestamp: 0, coordinate: { latitude: 0, longitude: 0 } },
      { timestamp: 3600000, coordinate: { latitude: 1, longitude: 1 } },
    ],
    distanceMeters: 157000,
    durationMs: 3600000,
    ...overrides,
  };
}

function makeTimeline(segments: TimelineSegment[]): TimelineData {
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  return {
    segments: sorted,
    dateRange: {
      start: sorted[0]?.startTime ?? 0,
      end: sorted[sorted.length - 1]?.endTime ?? 0,
    },
    totalPoints: sorted.reduce((s, seg) => s + seg.points.length, 0),
  };
}

describe('statistics', () => {
  it('computes total distance and duration', () => {
    const tl = makeTimeline([
      makeSeg({ id: 's1', distanceMeters: 10000, durationMs: 1800000 }),
      makeSeg({ id: 's2', distanceMeters: 20000, durationMs: 3600000 }),
    ]);
    const s = computeStatistics(tl);
    expect(s.totalDistanceMeters).toBe(30000);
    expect(s.totalDurationMs).toBe(5400000);
  });

  it('counts travel days (unique start dates)', () => {
    const tl = makeTimeline([
      makeSeg({
        id: 's1',
        startTime: Date.parse('2024-01-01T10:00:00Z'),
        endTime: Date.parse('2024-01-01T11:00:00Z'),
      }),
      makeSeg({
        id: 's2',
        startTime: Date.parse('2024-01-01T14:00:00Z'),
        endTime: Date.parse('2024-01-01T15:00:00Z'),
      }),
      makeSeg({
        id: 's3',
        startTime: Date.parse('2024-01-02T10:00:00Z'),
        endTime: Date.parse('2024-01-02T11:00:00Z'),
      }),
    ]);
    const s = computeStatistics(tl);
    expect(s.travelDays).toBe(2);
  });

  it('separates visit vs route counts', () => {
    const tl = makeTimeline([
      makeSeg({ id: 's1', type: 'route' }),
      makeSeg({ id: 's2', type: 'visit', distanceMeters: 0 }),
      makeSeg({ id: 's3', type: 'route' }),
    ]);
    const s = computeStatistics(tl);
    expect(s.routeCount).toBe(2);
    expect(s.visitCount).toBe(1);
  });

  it('computes activity breakdown', () => {
    const tl = makeTimeline([
      makeSeg({ id: 's1', activity: { type: 'DRIVING' }, distanceMeters: 50000, durationMs: 3600000 }),
      makeSeg({ id: 's2', activity: { type: 'WALKING' }, distanceMeters: 5000, durationMs: 1800000 }),
      makeSeg({ id: 's3', activity: { type: 'DRIVING' }, distanceMeters: 30000, durationMs: 2400000 }),
    ]);
    const s = computeStatistics(tl);
    expect(s.activityBreakdown['DRIVING'].count).toBe(2);
    expect(s.activityBreakdown['DRIVING'].distanceMeters).toBe(80000);
    expect(s.activityBreakdown['WALKING'].count).toBe(1);
    expect(s.activityBreakdown['WALKING'].distanceMeters).toBe(5000);
  });

  it('computes daily distance', () => {
    const tl = makeTimeline([
      makeSeg({
        id: 's1',
        startTime: Date.parse('2024-06-01T10:00:00Z'),
        endTime: Date.parse('2024-06-01T11:00:00Z'),
        distanceMeters: 10000,
      }),
      makeSeg({
        id: 's2',
        startTime: Date.parse('2024-06-01T14:00:00Z'),
        endTime: Date.parse('2024-06-01T15:00:00Z'),
        distanceMeters: 5000,
      }),
      makeSeg({
        id: 's3',
        startTime: Date.parse('2024-06-02T10:00:00Z'),
        endTime: Date.parse('2024-06-02T11:00:00Z'),
        distanceMeters: 20000,
      }),
    ]);
    const s = computeStatistics(tl);
    expect(s.dailyDistance['2024-06-01']).toBe(15000);
    expect(s.dailyDistance['2024-06-02']).toBe(20000);
  });

  it('computes yearly stats', () => {
    const tl = makeTimeline([
      makeSeg({
        id: 's1',
        startTime: Date.parse('2023-01-15T10:00:00Z'),
        endTime: Date.parse('2023-01-15T11:00:00Z'),
        distanceMeters: 50000,
      }),
      makeSeg({
        id: 's2',
        startTime: Date.parse('2024-06-01T10:00:00Z'),
        endTime: Date.parse('2024-06-01T11:00:00Z'),
        distanceMeters: 100000,
      }),
    ]);
    const s = computeStatistics(tl);
    expect(s.yearlyStats[2023].distanceMeters).toBe(50000);
    expect(s.yearlyStats[2024].distanceMeters).toBe(100000);
    expect(s.yearlyStats[2023].travelDays).toBe(1);
  });

  it('handles empty timeline', () => {
    const tl = makeTimeline([]);
    const s = computeStatistics(tl);
    expect(s.totalDistanceMeters).toBe(0);
    expect(s.segments).toBe(0);
    expect(s.travelDays).toBe(0);
  });

  it('collects unique place names', () => {
    const tl = makeTimeline([
      makeSeg({
        id: 's1',
        type: 'visit',
        place: { name: 'Central Park', coordinate: { latitude: 40, longitude: -74 } },
        distanceMeters: 0,
      }),
      makeSeg({
        id: 's2',
        type: 'visit',
        place: { name: 'Central Park', coordinate: { latitude: 40, longitude: -74 } },
        distanceMeters: 0,
      }),
      makeSeg({
        id: 's3',
        type: 'visit',
        place: { name: 'Times Square', coordinate: { latitude: 40.7, longitude: -74 } },
        distanceMeters: 0,
      }),
    ]);
    const s = computeStatistics(tl);
    expect(s.placeNames).toContain('Central Park');
    expect(s.placeNames).toContain('Times Square');
    expect(s.placeNames.length).toBe(2); // deduplicated
  });
});
