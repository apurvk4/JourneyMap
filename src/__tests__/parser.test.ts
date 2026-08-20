import { describe, it, expect } from 'vitest';
import { parseGoogleTimeline } from '../core/parser';

describe('parser', () => {
  // ── 2024+ semanticSegments format ──
  it('parses 2024+ semanticSegments with timelinePath and geo: URIs', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-03-15T09:00:00.000Z',
          endTime: '2024-03-15T09:45:00.000Z',
          activity: { topCandidate: { type: 'IN_PASSENGER_VEHICLE', probability: 0.92 } },
          timelinePath: [
            { point: 'geo:28.6139,77.2090', time: '2024-03-15T09:00:00.000Z' },
            { point: 'geo:28.6500,77.2300', time: '2024-03-15T09:30:00.000Z' },
          ],
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments.length).toBe(1);
    expect(data.segments[0].type).toBe('route');
    expect(data.segments[0].activity?.type).toBe('DRIVING');
    expect(data.segments[0].points.length).toBe(2);
    expect(data.segments[0].points[0].coordinate.latitude).toBeCloseTo(28.6139);
    expect(data.segments[0].distanceMeters).toBeGreaterThan(0);
  });

  it('parses 2024+ visit with topCandidate', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-03-15T09:45:00.000Z',
          endTime: '2024-03-15T12:00:00.000Z',
          visit: {
            topCandidate: {
              placeId: 'ChIJtest',
              semanticType: 'TYPE_WORK',
              probability: 0.85,
              placeLocation: 'geo:28.6700,77.2400',
            },
          },
          startLocation: 'geo:28.6700,77.2400',
          endLocation: 'geo:28.6700,77.2400',
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments.length).toBe(1);
    expect(data.segments[0].type).toBe('visit');
    expect(data.segments[0].place?.coordinate.latitude).toBeCloseTo(28.67);
    expect(data.segments[0].place?.semanticType).toBe('TYPE_WORK');
  });

  // ── Older timelineObjects format ──
  it('parses older timelineObjects with placeVisit', () => {
    const raw = {
      timelineObjects: [
        {
          placeVisit: {
            location: {
              latitudeE7: 286139000,
              longitudeE7: 772090000,
              name: 'Test Place',
              address: '123 Test St',
            },
            duration: {
              startTimestampMs: '1696003600000',
              endTimestampMs: '1696007200000',
            },
          },
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments.length).toBe(1);
    expect(data.segments[0].type).toBe('visit');
    expect(data.segments[0].place?.name).toBe('Test Place');
    expect(data.segments[0].place?.address).toBe('123 Test St');
    expect(data.segments[0].start.latitude).toBeCloseTo(28.6139);
  });

  it('parses older timelineObjects with activitySegment', () => {
    const raw = {
      timelineObjects: [
        {
          activitySegment: {
            activityType: 'WALKING',
            confidence: 92,
            duration: {
              startTimestampMs: '1696000000000',
              endTimestampMs: '1696003600000',
            },
            waypointPath: {
              waypoints: [
                { latE7: 286139000, lngE7: 772090000 },
                { latE7: 287000000, lngE7: 772400000 },
              ],
            },
          },
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments.length).toBe(1);
    expect(data.segments[0].type).toBe('route');
    expect(data.segments[0].activity?.type).toBe('WALKING');
    expect(data.segments[0].points.length).toBe(2);
  });

  // ── Activity normalization ──
  it('normalizes IN_PASSENGER_VEHICLE to DRIVING', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          activity: { topCandidate: { type: 'IN_PASSENGER_VEHICLE' } },
          timelinePath: [
            { point: 'geo:10,20', time: '2024-01-01T00:00:00Z' },
            { point: 'geo:11,21', time: '2024-01-01T01:00:00Z' },
          ],
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments[0].activity?.type).toBe('DRIVING');
  });

  it('normalizes IN_FLIGHT to FLYING', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          activity: { topCandidate: { type: 'IN_FLIGHT' } },
          timelinePath: [
            { point: 'geo:10,20', time: '2024-01-01T00:00:00Z' },
            { point: 'geo:20,30', time: '2024-01-01T01:00:00Z' },
          ],
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments[0].activity?.type).toBe('FLYING');
  });

  // ── Edge cases ──
  it('skips segments with missing coordinates', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          activity: { topCandidate: { type: 'WALKING' } },
          timelinePath: [], // empty path
        },
        {
          startTime: '2024-01-01T01:00:00Z',
          endTime: '2024-01-01T02:00:00Z',
          activity: { topCandidate: { type: 'DRIVING' } },
          timelinePath: [
            { point: 'geo:10,20', time: '2024-01-01T01:00:00Z' },
            { point: 'geo:11,21', time: '2024-01-01T02:00:00Z' },
          ],
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments.length).toBe(1);
    expect(data.segments[0].activity?.type).toBe('DRIVING');
  });

  it('skips segments with lat/lon of (0,0)', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          visit: {
            topCandidate: { placeLocation: 'geo:0,0' },
          },
        },
      ],
    };
    // When the only segment has (0,0) coords, parser throws since no valid segments remain
    expect(() => parseGoogleTimeline(raw)).toThrow(/no valid segments/);
  });

  it('handles malformed segments gracefully', () => {
    const raw = {
      semanticSegments: [
        null,
        undefined,
        { garbage: true },
        42,
        'not an object',
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          activity: { topCandidate: { type: 'WALKING' } },
          timelinePath: [
            { point: 'geo:10,20', time: '2024-01-01T00:00:00Z' },
          ],
        },
      ],
    };
    // Should not throw
    const { data } = parseGoogleTimeline(raw as unknown);
    expect(data.segments.length).toBe(1);
  });

  it('throws on non-object input', () => {
    expect(() => parseGoogleTimeline('not json')).toThrow();
    expect(() => parseGoogleTimeline(42)).toThrow();
    expect(() => parseGoogleTimeline(null)).toThrow();
  });

  it('throws on valid JSON with no recognizable structure', () => {
    expect(() => parseGoogleTimeline({ foo: 'bar' })).toThrow(/couldn't find any location data/);
  });

  it('handles ISO timestamp strings', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-06-15T14:30:00.000Z',
          endTime: '2024-06-15T15:00:00.000Z',
          activity: { topCandidate: { type: 'WALKING' } },
          timelinePath: [
            { point: 'geo:40.7128,-74.0060', time: '2024-06-15T14:30:00.000Z' },
            { point: 'geo:40.7200,-74.0100', time: '2024-06-15T15:00:00.000Z' },
          ],
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.segments[0].startTime).toBe(Date.parse('2024-06-15T14:30:00.000Z'));
  });

  it('computes date range across all segments', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          activity: { topCandidate: { type: 'WALKING' } },
          timelinePath: [
            { point: 'geo:10,20', time: '2024-01-01T00:00:00Z' },
            { point: 'geo:11,21', time: '2024-01-01T01:00:00Z' },
          ],
        },
        {
          startTime: '2024-12-31T00:00:00Z',
          endTime: '2024-12-31T23:59:59Z',
          activity: { topCandidate: { type: 'DRIVING' } },
          timelinePath: [
            { point: 'geo:30,40', time: '2024-12-31T00:00:00Z' },
            { point: 'geo:31,41', time: '2024-12-31T23:59:59Z' },
          ],
        },
      ],
    };
    const { data } = parseGoogleTimeline(raw);
    expect(data.dateRange.start).toBe(Date.parse('2024-01-01T00:00:00Z'));
    expect(data.dateRange.end).toBe(Date.parse('2024-12-31T23:59:59Z'));
  });

  it('counts total points across segments', () => {
    const raw = {
      semanticSegments: [
        {
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-01T01:00:00Z',
          activity: { topCandidate: { type: 'WALKING' } },
          timelinePath: [
            { point: 'geo:10,20', time: '2024-01-01T00:00:00Z' },
            { point: 'geo:11,21', time: '2024-01-01T00:30:00Z' },
            { point: 'geo:12,22', time: '2024-01-01T01:00:00Z' },
          ],
        },
      ],
    };
    const data = parseGoogleTimeline(raw);
    expect(data.totalPoints).toBe(3);
  });

  // ── Phase 2: Parser Robustness Tests ──
  it('parses Records.json format with raw location array', () => {
    const raw = {
      locations: [
        { timestampMs: "1696000000000", latitudeE7: 286139000, longitudeE7: 772090000, accuracy: 20 },
        { timestampMs: "1696001000000", latitudeE7: 286140000, longitudeE7: 772100000, accuracy: 20 },
        { timestampMs: "1696002000000", latitudeE7: 286141000, longitudeE7: 772110000, accuracy: 20 },
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments.length).toBe(1);
    expect(result.data.segments[0].points.length).toBe(3);
  });

  it('parses locationHistory.locations wrapper variant', () => {
    const raw = {
      locationHistory: {
        locations: [
          { timestampMs: "1696000000000", latitudeE7: 286139000, longitudeE7: 772090000, accuracy: 20 },
          { timestampMs: "1696001000000", latitudeE7: 286140000, longitudeE7: 772100000, accuracy: 20 },
          { timestampMs: "1696002000000", latitudeE7: 286141000, longitudeE7: 772110000, accuracy: 20 },
        ]
      }
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments.length).toBe(1);
    expect(result.data.segments[0].points.length).toBe(3);
  });

  it('clusters points by time-gap threshold', () => {
    const raw = {
      locations: [
        // Cluster 1
        { timestampMs: "1696000000000", latitudeE7: 286139000, longitudeE7: 772090000 },
        { timestampMs: "1696001000000", latitudeE7: 286140000, longitudeE7: 772100000 },
        // Cluster 2 (> 30 min gap: 1696001000000 + 40*60*1000 = 1696003400000)
        { timestampMs: "1696004000000", latitudeE7: 286200000, longitudeE7: 772200000 },
        { timestampMs: "1696005000000", latitudeE7: 286210000, longitudeE7: 772210000 },
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments.length).toBe(2);
    expect(result.data.segments[0].points.length).toBe(2);
    expect(result.data.segments[1].points.length).toBe(2);
  });

  it('infers activity from velocity', () => {
    const t0 = 1696000000000;
    const t1 = t0 + 1200000;
    const raw = {
      locations: [
        { timestampMs: t0.toString(), latitudeE7: 280000000, longitudeE7: 770000000 },
        { timestampMs: t1.toString(), latitudeE7: 289000000, longitudeE7: 770000000 }, 
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments[0].activity?.type).toBe('DRIVING');
  });

  it('parses transitPath segment parsing', () => {
    const raw = {
      timelineObjects: [
        {
          activitySegment: {
            activityType: 'IN_TRAIN',
            duration: { startTimestampMs: '1696000000000', endTimestampMs: '1696003600000' },
            transitPath: {
              name: 'Red Line',
              transitStops: [
                { latE7: 286139000, lngE7: 772090000, timestampMs: '1696000000000' },
                { latE7: 287000000, lngE7: 772400000, timestampMs: '1696003600000' }
              ]
            }
          }
        }
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments.length).toBe(1);
    expect(result.data.segments[0].points.length).toBe(2);
  });

  it('parses simplifiedRawPath.points with E7 + timestampMs', () => {
    const raw = {
      timelineObjects: [
        {
          activitySegment: {
            activityType: 'WALKING',
            duration: { startTimestampMs: '1696000000000', endTimestampMs: '1696003600000' },
            simplifiedRawPath: {
              points: [
                { latE7: 286139000, lngE7: 772090000, timestampMs: '1696000000000' },
                { latE7: 287000000, lngE7: 772400000, timestampMs: '1696003600000' }
              ]
            }
          }
        }
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments.length).toBe(1);
    expect(result.data.segments[0].points.length).toBe(2);
  });

  it('extracts editConfirmationStatus and placeConfidence', () => {
    const raw = {
      timelineObjects: [
        {
          placeVisit: {
            location: { latitudeE7: 286139000, longitudeE7: 772090000 },
            duration: { startTimestampMs: '1696000000000', endTimestampMs: '1696003600000' },
            editConfirmationStatus: 'CONFIRMED',
            placeConfidence: 'HIGH_CONFIDENCE'
          }
        }
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments[0].place?.editConfirmationStatus).toBe('CONFIRMED');
    expect(result.data.segments[0].place?.placeConfidence).toBe('HIGH_CONFIDENCE');
  });

  it('extracts travelDistanceMeters', () => {
    const raw = {
      timelineObjects: [
        {
          activitySegment: {
            activityType: 'WALKING',
            duration: { startTimestampMs: '1696000000000', endTimestampMs: '1696003600000' },
            startLocation: { latitudeE7: 286139000, longitudeE7: 772090000 },
            endLocation: { latitudeE7: 287000000, longitudeE7: 772400000 },
            travelDistanceMeters: 4500
          }
        }
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data.segments[0].distanceMeters).toBe(4500);
  });

  it('returns ParserResult structure and accumulates warnings', () => {
    const raw = {
      timelineObjects: [
        { garbage: true }, 
        {
          placeVisit: {
            location: { latitudeE7: 286139000, longitudeE7: 772090000 },
            duration: { startTimestampMs: '1696000000000', endTimestampMs: '1696003600000' }
          }
        }
      ]
    };
    const result = parseGoogleTimeline(raw);
    expect(result.data).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].type).toBe('skipped_segment');
  });
});
