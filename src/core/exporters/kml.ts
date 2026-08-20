import type { TimelineData } from '../model';
import { ACTIVITY_DISPLAY } from '../model';
import { formatDistance, formatDuration } from '../geo';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hexToKmlColor(hex: string): string {
  if (!hex || hex.length !== 7) return 'ffffffff';
  const r = hex.substring(1, 3);
  const g = hex.substring(3, 5);
  const b = hex.substring(5, 7);
  return `ff${b}${g}${r}`; // AABBGGRR
}

export function toKML(timeline: TimelineData): string {
  const styles: string[] = [];
  for (const [key, value] of Object.entries(ACTIVITY_DISPLAY)) {
    styles.push(`  <Style id="style-${key}">
    <LineStyle>
      <color>${hexToKmlColor(value.color)}</color>
      <width>4</width>
    </LineStyle>
  </Style>`);
  }

  const placemarks = timeline.segments.map((s) => {
    if (s.type === 'visit') {
      const name = s.place?.name ?? 'Visit';
      const desc = s.place?.address ?? '';
      return `  <Placemark>
    <name>${escapeXml(name)}</name>
    <description>${escapeXml(desc)}</description>
    <ExtendedData>
      <Data name="durationMs"><value>${s.durationMs}</value></Data>
    </ExtendedData>
    <Point>
      <coordinates>${s.start.longitude},${s.start.latitude},0</coordinates>
    </Point>
    <TimeSpan>
      <begin>${new Date(s.startTime).toISOString()}</begin>
      <end>${new Date(s.endTime).toISOString()}</end>
    </TimeSpan>
  </Placemark>`;
    }

    const activityType = s.activity?.type || 'UNKNOWN';
    const name = ACTIVITY_DISPLAY[activityType]?.label || activityType;
    const desc = `${formatDistance(s.distanceMeters)} over ${formatDuration(s.durationMs)}`;
    
    const coords = s.points
      .map((p) => `${p.coordinate.longitude},${p.coordinate.latitude},0`)
      .join(' ');
      
    return `  <Placemark>
    <name>${escapeXml(name)}</name>
    <description>${escapeXml(desc)}</description>
    <styleUrl>#style-${activityType}</styleUrl>
    <ExtendedData>
      <Data name="activityType"><value>${activityType}</value></Data>
      <Data name="distanceMeters"><value>${s.distanceMeters}</value></Data>
      <Data name="durationMs"><value>${s.durationMs}</value></Data>
    </ExtendedData>
    <LineString>
      <coordinates>${coords}</coordinates>
    </LineString>
    <TimeSpan>
      <begin>${new Date(s.startTime).toISOString()}</begin>
      <end>${new Date(s.endTime).toISOString()}</end>
    </TimeSpan>
  </Placemark>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Timeline Export</name>
${styles.join('\n')}
${placemarks.join('\n')}
</Document>
</kml>`;
}
