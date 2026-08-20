import type { TimelineData } from '../model';
import { ACTIVITY_DISPLAY } from '../model';
import { formatDistance, formatDuration } from '../geo';

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function toGPX(timeline: TimelineData) {
  const wpts: string[] = [];
  const tracks: string[] = [];

  for (const s of timeline.segments) {
    if (s.type === 'visit') {
      const name = s.place?.name ? escapeXml(s.place.name) : 'Visit';
      const desc = s.place?.address ? escapeXml(s.place.address) : '';
      const time = new Date(s.startTime).toISOString();
      let wpt = `  <wpt lat="${s.start.latitude}" lon="${s.start.longitude}">\n    <name>${name}</name>\n`;
      if (desc) wpt += `    <desc>${desc}</desc>\n`;
      wpt += `    <time>${time}</time>\n  </wpt>`;
      wpts.push(wpt);
    } else {
      const activityType = s.activity?.type || 'UNKNOWN';
      const name = ACTIVITY_DISPLAY[activityType]?.label || activityType;
      const desc = `${formatDistance(s.distanceMeters)} over ${formatDuration(s.durationMs)}`;
      const pts = s.points
        .map(
          (p) =>
            `      <trkpt lat="${p.coordinate.latitude}" lon="${p.coordinate.longitude}">\n        <time>${new Date(
              p.timestamp
            ).toISOString()}</time>\n      </trkpt>`
        )
        .join('\n');
      tracks.push(
        `  <trk>\n    <name>${escapeXml(name)}</name>\n    <desc>${escapeXml(
          desc
        )}</desc>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>`
      );
    }
  }

  const metadataTime = new Date(timeline.dateRange?.start || Date.now()).toISOString();
  const metadata = `  <metadata>\n    <name>Timeline Export</name>\n    <time>${metadataTime}</time>\n  </metadata>`;

  const elements = [metadata, ...wpts, ...tracks].filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Timeline Visualizer" xmlns="http://www.topografix.com/GPX/1/1">
${elements.join('\n')}
</gpx>`;
}
