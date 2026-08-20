import { describe, it, expect } from 'vitest';
import { toGeoJSON } from '../core/exporters/geojson';
import { toGPX } from '../core/exporters/gpx';
import { toKML } from '../core/exporters/kml';
import { toCSV } from '../core/exporters/csv';
import type { TimelineData } from '../core/model';

const timeline: TimelineData = {
  segments: [
    {
      id: 's1',
      type: 'route',
      startTime: Date.parse('2024-01-01T10:00:00Z'),
      endTime: Date.parse('2024-01-01T11:00:00Z'),
      start: { latitude: 28.6, longitude: 77.2 },
      end: { latitude: 28.7, longitude: 77.3 },
      activity: { type: 'DRIVING' },
      points: [
        { timestamp: Date.parse('2024-01-01T10:00:00Z'), coordinate: { latitude: 28.6, longitude: 77.2 } },
        { timestamp: Date.parse('2024-01-01T11:00:00Z'), coordinate: { latitude: 28.7, longitude: 77.3 } },
      ],
      distanceMeters: 15000,
      durationMs: 3600000,
    },
    {
      id: 's2',
      type: 'visit',
      startTime: Date.parse('2024-01-01T11:00:00Z'),
      endTime: Date.parse('2024-01-01T13:00:00Z'),
      start: { latitude: 28.7, longitude: 77.3 },
      end: { latitude: 28.7, longitude: 77.3 },
      place: { name: 'Test Place', coordinate: { latitude: 28.7, longitude: 77.3 } },
      points: [
        { timestamp: Date.parse('2024-01-01T11:00:00Z'), coordinate: { latitude: 28.7, longitude: 77.3 } },
      ],
      distanceMeters: 0,
      durationMs: 7200000,
    },
  ],
  dateRange: {
    start: Date.parse('2024-01-01T10:00:00Z'),
    end: Date.parse('2024-01-01T13:00:00Z'),
  },
  totalPoints: 3,
};

describe('exporters', () => {
  describe('GeoJSON', () => {
    it('creates FeatureCollection with route and visit features', () => {
      const g = toGeoJSON(timeline);
      expect(g.type).toBe('FeatureCollection');
      expect(g.features.length).toBe(2);
    });

    it('route is LineString, visit is Point', () => {
      const g = toGeoJSON(timeline);
      expect(g.features[0].geometry.type).toBe('LineString');
      expect(g.features[1].geometry.type).toBe('Point');
    });

    it('includes activity type in route properties', () => {
      const g = toGeoJSON(timeline);
      expect(g.features[0].properties.activity).toBe('DRIVING');
    });

    it('includes place name in visit properties', () => {
      const g = toGeoJSON(timeline);
      expect(g.features[1].properties.placeName).toBe('Test Place');
    });
  });

  describe('GPX', () => {
    it('produces valid XML', () => {
      const xml = toGPX(timeline);
      expect(xml.startsWith('<?xml')).toBe(true);
      expect(xml).toContain('<gpx');
      expect(xml).toContain('</gpx>');
    });

    it('contains track segments', () => {
      const xml = toGPX(timeline);
      expect(xml).toContain('<trk>');
      expect(xml).toContain('<trkpt');
    });
  });

  describe('KML', () => {
    it('produces valid KML', () => {
      const xml = toKML(timeline);
      expect(xml.startsWith('<?xml')).toBe(true);
      expect(xml).toContain('<kml');
      expect(xml).toContain('</kml>');
    });

    it('contains Placemarks', () => {
      const xml = toKML(timeline);
      expect(xml).toContain('<Placemark>');
    });

    it('has LineString for routes and Point for visits', () => {
      const xml = toKML(timeline);
      expect(xml).toContain('<LineString>');
      expect(xml).toContain('<Point>');
    });
  });

  describe('CSV', () => {
    it('produces header and data rows', () => {
      const csv = toCSV(timeline);
      const lines = csv.split('\n');
      expect(lines.length).toBe(3); // header + 2 data rows
      expect(lines[0]).toContain('segment_id');
      expect(lines[0]).toContain('activity');
    });

    it('includes segment data', () => {
      const csv = toCSV(timeline);
      expect(csv).toContain('DRIVING');
      expect(csv).toContain('Test Place');
    });
  });

  describe('Enriched GPX', () => {
    it('includes <wpt> for visits with name and description', () => {
      const gpx = toGPX(timeline);
      expect(gpx).toContain('<wpt');
      expect(gpx).toContain('<name>Test Place</name>');
    });

    it('includes proper namespace', () => {
      const gpx = toGPX(timeline);
      expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    });

    it('track names use activity type labels', () => {
      const gpx = toGPX(timeline);
      expect(gpx).toContain('<name>Driving</name>');
    });
  });

  describe('Enriched GeoJSON', () => {
    it('includes bbox on FeatureCollection', () => {
      const geojson = toGeoJSON(timeline);
      expect(geojson.bbox).toBeDefined();
      expect(geojson.bbox?.length).toBe(4);
    });

    it('visit features include placeAddress, semanticType', () => {
      const t: TimelineData = {
        ...timeline,
        segments: [
          {
            ...timeline.segments[1],
            place: {
              name: 'Store',
              address: '123 Main St',
              semanticType: 'SHOPPING',
              coordinate: { latitude: 0, longitude: 0 },
            },
          },
        ],
      };
      const geojson = toGeoJSON(t);
      const visit = geojson.features[0];
      expect(visit.properties.placeAddress).toBe('123 Main St');
      expect(visit.properties.semanticType).toBe('SHOPPING');
    });

    it('route features include activityConfidence and timestamps', () => {
      const t: TimelineData = {
        ...timeline,
        segments: [
          {
            ...timeline.segments[0],
            activity: { type: 'WALKING', confidence: 95 },
          },
        ],
      };
      const geojson = toGeoJSON(t);
      const route = geojson.features[0];
      expect(route.properties.activityConfidence).toBe(95);
      expect(route.properties.timestamps).toBeDefined();
      expect(Array.isArray(route.properties.timestamps)).toBe(true);
    });
  });

  describe('Enriched KML', () => {
    it('includes Style elements with colors', () => {
      const kml = toKML(timeline);
      expect(kml).toContain('<Style id="style-DRIVING">');
      expect(kml).toContain('<color>');
    });

    it('includes ExtendedData', () => {
      const kml = toKML(timeline);
      expect(kml).toContain('<ExtendedData>');
      expect(kml).toContain('durationMs');
    });

    it('includes description text', () => {
      const kml = toKML(timeline);
      expect(kml).toContain('<description>');
    });
  });

  describe('Enriched CSV', () => {
    it('has new columns in header', () => {
      const csv = toCSV(timeline);
      const header = csv.split('\n')[0];
      expect(header).toContain('place_address');
      expect(header).toContain('semantic_type');
      expect(header).toContain('place_id');
      expect(header).toContain('activity_confidence');
      expect(header).toContain('points_count');
    });

    it('properly escapes fields with commas and quotes', () => {
      const t: TimelineData = {
        ...timeline,
        segments: [
          {
            ...timeline.segments[1],
            place: {
              name: 'Store, Inc.',
              address: 'Line1\nLine2',
              semanticType: 'SHOPPING',
              coordinate: { latitude: 0, longitude: 0 },
            },
          },
        ],
      };
      const csv = toCSV(t);
      expect(csv).toContain('"Store, Inc."');
      expect(csv).toContain('"Line1\nLine2"');
    });
  });

  describe('Per-segment export', () => {
    it('single segment TimelineData works correctly', () => {
      const singleSegmentTimeline: TimelineData = {
        ...timeline,
        segments: [timeline.segments[0]],
      };
      const gpx = toGPX(singleSegmentTimeline);
      expect(gpx).toContain('<trk>');
      expect(gpx).not.toContain('<wpt');
    });
  });
});