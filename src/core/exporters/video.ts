/**
 * Timeline Video Exporter for JourneyMap.
 * Records high-resolution animated travel replay videos using HTML5 Canvas,
 * MapLibre WebGL canvas capture, and MediaRecorder API.
 */
import type { TimelineSegment, Coordinate } from '../model';
import { ACTIVITY_DISPLAY } from '../model';
import { ReplayEngine } from '../replay';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface VideoExportOptions {
  width?: number;
  height?: number;
  fps?: number;
  durationSec?: number;
  includeOverlay?: boolean;
  format?: 'webm' | 'mp4' | 'auto';
  quality?: 'high' | 'medium' | 'low';
  theme?: 'dark' | 'light';
  onProgress?: (progress: number, elapsedSec: number, totalSec: number, statusText?: string) => void;
  signal?: AbortSignal;
}

export interface VideoExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  durationSec: number;
}

/** Check browser support and select the best video container/codec */
export function getSupportedVideoMimeType(preferred: 'webm' | 'mp4' | 'auto' = 'auto'): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];

  const webmTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  if (preferred === 'mp4') {
    for (const type of mp4Types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, extension: 'mp4' };
      }
    }
  }

  if (preferred === 'webm') {
    for (const type of webmTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return { mimeType: type, extension: 'webm' };
      }
    }
  }

  // Auto: Try MP4 first if supported, else WebM VP9/VP8
  for (const type of mp4Types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'mp4' };
    }
  }
  for (const type of webmTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'webm' };
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

/** Check if the current browser supports video export via MediaRecorder and Canvas */
export function isVideoExportSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** Convert longitude to tile X coordinate */
function lng2tile(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

/** Convert latitude to tile Y coordinate */
function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom));
}

/** Pre-cache all map tiles along the route so there are no blank tiles during video recording */
export async function prefetchRouteTiles(
  segments: TimelineSegment[],
  theme: 'dark' | 'light',
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const tileUrls = new Set<string>();
  const subdomains = ['a', 'b', 'c', 'd'];
  const stylePath = theme === 'light' ? 'rastertiles/voyager' : 'dark_all';

  for (const seg of segments) {
    const isFlight = seg.activity?.type === 'FLYING';
    const isTrain = seg.activity?.type === 'IN_TRAIN';
    const isWalk = seg.activity?.type === 'WALKING';
    const targetZoom = isFlight ? 6 : (isTrain ? 10 : (isWalk ? 14 : 13));

    const zoomLevels = isFlight ? [5, 6, 7] : [targetZoom - 1, targetZoom];

    const coords: Coordinate[] = [];
    if (seg.type === 'visit') {
      coords.push(seg.place?.coordinate ?? seg.start);
    } else {
      const pts = seg.points;
      const step = Math.max(1, Math.floor(pts.length / 30));
      for (let i = 0; i < pts.length; i += step) {
        coords.push(pts[i].coordinate);
      }
      if (pts.length > 0) coords.push(pts[pts.length - 1].coordinate);
    }

    for (const c of coords) {
      for (const z of zoomLevels) {
        const centerTileX = lng2tile(c.longitude, z);
        const centerTileY = lat2tile(c.latitude, z);

        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const tx = centerTileX + dx;
            const ty = centerTileY + dy;
            const maxTile = Math.pow(2, z);
            if (tx >= 0 && tx < maxTile && ty >= 0 && ty < maxTile) {
              const sub = subdomains[Math.abs(tx + ty) % subdomains.length];
              tileUrls.add(`https://${sub}.basemaps.cartocdn.com/${stylePath}/${z}/${tx}/${ty}.png`);
            }
          }
        }
      }
    }
  }

  const urls = Array.from(tileUrls);
  if (urls.length === 0) return;

  const chunkSize = 16;
  let loadedCount = 0;

  for (let i = 0; i < urls.length; i += chunkSize) {
    if (signal?.aborted) return;
    const chunk = urls.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            loadedCount++;
            onProgress?.(loadedCount / urls.length);
            resolve();
          };
          img.onerror = () => {
            loadedCount++;
            onProgress?.(loadedCount / urls.length);
            resolve();
          };
          img.src = url;
        })
      )
    );
  }
}

/** Pre-warm MapLibre WebGL textures along the journey waypoints */
export async function prewarmMapTilesAlongRoute(
  map: MapLibreMap,
  segments: TimelineSegment[],
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  const waypoints: { lat: number; lng: number; zoom: number }[] = [];

  for (const seg of segments) {
    const isFlight = seg.activity?.type === 'FLYING';
    const isTrain = seg.activity?.type === 'IN_TRAIN';
    const isWalk = seg.activity?.type === 'WALKING';
    const targetZoom = isFlight ? 6.0 : (isTrain ? 10.5 : (isWalk ? 14.5 : 13.0));

    if (seg.type === 'visit') {
      const coord = seg.place?.coordinate ?? seg.start;
      waypoints.push({ lat: coord.latitude, lng: coord.longitude, zoom: targetZoom });
    } else {
      const pts = seg.points;
      const step = Math.max(1, Math.floor(pts.length / 15));
      for (let i = 0; i < pts.length; i += step) {
        waypoints.push({
          lat: pts[i].coordinate.latitude,
          lng: pts[i].coordinate.longitude,
          zoom: targetZoom,
        });
      }
      if (pts.length > 0) {
        const last = pts[pts.length - 1].coordinate;
        waypoints.push({ lat: last.latitude, lng: last.longitude, zoom: targetZoom });
      }
    }
  }

  if (waypoints.length === 0) return;

  const total = waypoints.length;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) return;
    const wp = waypoints[i];
    onProgress?.((i + 1) / total);

    map.jumpTo({
      center: [wp.lng, wp.lat],
      zoom: wp.zoom,
    });

    // 1. Force MapLibre render cycle to register new tile requests
    await new Promise<void>((r) => {
      map.once('render', () => r());
      map.triggerRepaint();
    });

    // 2. Wait until all tiles for this view are fully loaded and rendered
    await new Promise<void>((resolve) => {
      if (map.areTilesLoaded()) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 1200);
      const onIdle = () => {
        clearTimeout(timer);
        map.off('idle', onIdle);
        resolve();
      };
      map.on('idle', onIdle);
    });
  }
}

/** Format timestamp for Telemetry HUD badge (e.g. "Jul 3, 2026 • 7:08 PM") */
function formatTelemetryTime(timeMs: number): string {
  if (!timeMs || isNaN(timeMs)) return 'Timeline Replay';
  const d = new Date(timeMs);
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} • ${timeStr}`;
}

/** Draw vehicle indicator on composite canvas */
function drawVehicleMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  activityType: string | undefined,
  isFlight: boolean | undefined,
  bearing: number | undefined,
  scale: number
): void {
  ctx.save();
  ctx.translate(x, y);

  const radius = 18 * scale;
  const activityInfo = ACTIVITY_DISPLAY[activityType ?? 'UNKNOWN'];
  const color = isFlight ? '#3b82f6' : (activityInfo?.color ?? '#2563eb');

  // Ambient outer pulse glow
  ctx.beginPath();
  ctx.arc(0, 0, radius + 10 * scale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.fill();

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10 * scale;
  ctx.shadowOffsetY = 3 * scale;

  // Outer white circle
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Inner colored circle
  ctx.beginPath();
  ctx.arc(0, 0, radius - 3 * scale, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Reset shadow for inner icon
  ctx.shadowColor = 'transparent';

  // Draw rotated icon / arrow
  const rotAngle = ((bearing ?? 0) * Math.PI) / 180;
  ctx.rotate(rotAngle);

  ctx.fillStyle = '#ffffff';
  if (isFlight) {
    // Airplane shape pointing up (0 deg)
    ctx.beginPath();
    ctx.moveTo(0, -10 * scale);
    ctx.lineTo(3 * scale, -2 * scale);
    ctx.lineTo(9 * scale, 1 * scale);
    ctx.lineTo(9 * scale, 3 * scale);
    ctx.lineTo(3 * scale, 2 * scale);
    ctx.lineTo(2 * scale, 8 * scale);
    ctx.lineTo(5 * scale, 10 * scale);
    ctx.lineTo(5 * scale, 11.5 * scale);
    ctx.lineTo(0, 10.5 * scale);
    ctx.lineTo(-5 * scale, 11.5 * scale);
    ctx.lineTo(-5 * scale, 10 * scale);
    ctx.lineTo(-2 * scale, 8 * scale);
    ctx.lineTo(-3 * scale, 2 * scale);
    ctx.lineTo(-9 * scale, 3 * scale);
    ctx.lineTo(-9 * scale, 1 * scale);
    ctx.lineTo(-3 * scale, -2 * scale);
    ctx.closePath();
    ctx.fill();
  } else {
    // Directional chevron
    ctx.beginPath();
    ctx.moveTo(0, -8 * scale);
    ctx.lineTo(6 * scale, 6 * scale);
    ctx.lineTo(0, 3 * scale);
    ctx.lineTo(-6 * scale, 6 * scale);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/** Draw modern telemetry HUD overlay on the recorded video */
function drawTelemetryHUD(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  formattedTime: string,
  activityType: string | undefined,
  isFlight: boolean | undefined,
  progress: number
): void {
  const scale = Math.max(0.8, Math.min(1.6, width / 1280));
  const pad = 24 * scale;

  // ── Top-Left Info Card ──
  const cardW = 340 * scale;
  const cardH = 80 * scale;
  const cardX = pad;
  const cardY = pad;
  const radius = 14 * scale;

  ctx.save();
  // Card background
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  // Activity pill badge
  const activityInfo = ACTIVITY_DISPLAY[activityType ?? 'UNKNOWN'];
  const label = isFlight ? 'Flight' : (activityInfo?.label ?? 'Travel');
  const badgeColor = isFlight ? '#3b82f6' : (activityInfo?.color ?? '#64748b');

  const badgeX = cardX + 16 * scale;
  const badgeY = cardY + 14 * scale;
  const badgeW = 96 * scale;
  const badgeH = 22 * scale;

  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6 * scale);
  ctx.fillStyle = badgeColor;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), badgeX + badgeW / 2, badgeY + badgeH / 2);

  // App branding
  ctx.fillStyle = 'rgba(148, 163, 184, 0.95)';
  ctx.font = `500 ${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('JourneyMap', cardX + cardW - 16 * scale, badgeY + badgeH / 2);

  // Formatted date & time
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${15 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedTime, cardX + 16 * scale, cardY + 56 * scale);

  ctx.restore();

  // ── Bottom Progress Bar ──
  const barH = 5 * scale;
  const barY = height - barH;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, barY, width, barH);

  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(0, barY, width * Math.min(1, Math.max(0, progress)), barH);
}

/**
 * Record an animated timeline journey video from the MapLibre map with
 * frame-by-frame tile load synchronization and deterministic canvas capture.
 */
export async function exportTimelineVideo(
  map: MapLibreMap,
  segments: TimelineSegment[],
  options: VideoExportOptions = {}
): Promise<VideoExportResult> {
  if (!isVideoExportSupported()) {
    throw new Error('Video recording is not supported in this browser environment.');
  }

  if (segments.length === 0) {
    throw new Error('No timeline segments provided to export.');
  }

  const mapCanvas = map.getCanvas();
  if (!mapCanvas) {
    throw new Error('Map canvas is not available for video export.');
  }

  const fps = options.fps ?? 30;
  const durationSec = options.durationSec ?? 30;
  const targetDurationMs = durationSec * 1000;
  const totalFrames = Math.max(30, Math.round(durationSec * fps));
  const includeOverlay = options.includeOverlay ?? true;
  const theme = options.theme ?? (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const { mimeType, extension } = getSupportedVideoMimeType(options.format ?? 'auto');

  // 1. Pre-fetch all raster PNG tiles into browser HTTP cache
  options.onProgress?.(0, 0, durationSec, 'Pre-caching map tiles for smooth export...');
  await prefetchRouteTiles(segments, theme, (pct) => {
    options.onProgress?.(pct * 0.1, 0, durationSec, `Downloading map tiles (${Math.round(pct * 100)}%)...`);
  }, options.signal);

  // Video resolution matching map canvas (or scaled evenly)
  let exportWidth = options.width ?? mapCanvas.width;
  let exportHeight = options.height ?? mapCanvas.height;
  exportWidth = Math.floor(exportWidth / 2) * 2;
  exportHeight = Math.floor(exportHeight / 2) * 2;

  // Bitrate
  let bitsPerSecond = 20_000_000;
  if (options.quality === 'low') bitsPerSecond = 6_000_000;
  if (options.quality === 'high') bitsPerSecond = 28_000_000;
  if (exportWidth <= 1280) bitsPerSecond = Math.round(bitsPerSecond * 0.6);

  // Composite 2D canvas
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = exportWidth;
  compositeCanvas.height = exportHeight;
  const ctx = compositeCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Failed to create composite 2D canvas context.');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const stream = compositeCanvas.captureStream(0);
  const videoTrack = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  const supportsRequestFrame = typeof videoTrack?.requestFrame === 'function';

  const activeStream = supportsRequestFrame ? stream : compositeCanvas.captureStream(fps);
  const recordedChunks: Blob[] = [];

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(activeStream, {
      mimeType,
      videoBitsPerSecond: bitsPerSecond,
    });
  } catch {
    recorder = new MediaRecorder(activeStream);
  }

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  const engine = new ReplayEngine();
  engine.load(segments);
  engine.setDuration(targetDurationMs);

  return new Promise<VideoExportResult>((resolve, reject) => {
    let isAborted = false;

    const cleanup = () => {
      activeStream.getTracks().forEach((track) => track.stop());
    };

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        isAborted = true;
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(new DOMException('Video export was cancelled.', 'AbortError'));
      });
    }

    recorder.onstop = () => {
      cleanup();
      if (isAborted) return;
      const finalBlob = new Blob(recordedChunks, { type: mimeType });
      const filename = `journey-${new Date().toISOString().slice(0, 10)}.${extension}`;
      resolve({ blob: finalBlob, filename, mimeType, durationSec });
    };

    recorder.onerror = (err) => {
      cleanup();
      reject(err);
    };

    const runCapture = async () => {
      // Pre-position map to start of journey and render first frame
      const startCoord = segments[0]?.start ?? { latitude: 20.5937, longitude: 78.9629 };
      const firstIsFlight = segments[0]?.activity?.type === 'FLYING';
      const initZoom = firstIsFlight ? 6.0 : 13.0;
      map.jumpTo({ center: [startCoord.longitude, startCoord.latitude], zoom: initZoom });
      map.triggerRepaint();
      await new Promise<void>((r) => map.once('render', () => r()));

      recorder.start(250);

      const frameIntervalMs = 1000 / fps;

      for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
        if (isAborted) return;

        const progress = frameIdx / totalFrames;
        engine.seek(progress);
        const st = engine.getState();

        if (st.position) {
          const targetZoom = st.isFlight ? 6.0 : (st.activityType === 'IN_TRAIN' ? 10.5 : (st.activityType === 'WALKING' ? 14.5 : 13.0));
          map.jumpTo({
            center: [st.position.longitude, st.position.latitude],
            zoom: targetZoom,
          });
        }

        // Step 1: Trigger WebGL render cycle to process camera update
        await new Promise<void>((r) => {
          map.once('render', () => r());
          map.triggerRepaint();
        });

        // Step 2: Ensure all tiles are 100% loaded for this frame
        if (!map.areTilesLoaded()) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 800);
            const onIdle = () => {
              clearTimeout(timeout);
              map.off('idle', onIdle);
              resolve();
            };
            map.on('idle', onIdle);
          });

          // Step 3: Repaint to draw newly loaded tiles into WebGL buffer
          await new Promise<void>((r) => {
            map.once('render', () => r());
            map.triggerRepaint();
          });
        }

        // Step 4: Draw pristine WebGL map canvas frame
        ctx.drawImage(mapCanvas, 0, 0, exportWidth, exportHeight);

        // Step 5: Draw vehicle marker with exact subpixel coordinate mapping
        if (st.position) {
          const container = map.getContainer();
          const containerW = container.clientWidth || mapCanvas.width;
          const containerH = container.clientHeight || mapCanvas.height;
          const point = map.project([st.position.longitude, st.position.latitude]);

          const normX = point.x / containerW;
          const normY = point.y / containerH;

          const posX = normX * exportWidth;
          const posY = normY * exportHeight;

          const markerScale = Math.max(0.9, Math.min(1.8, exportWidth / 1280));
          drawVehicleMarker(
            ctx,
            posX,
            posY,
            st.activityType,
            st.isFlight,
            st.bearing,
            markerScale
          );
        }

        // Step 6: Draw Telemetry HUD Overlay
        if (includeOverlay) {
          const displayTime = formatTelemetryTime(st.currentTime);
          drawTelemetryHUD(
            ctx,
            exportWidth,
            exportHeight,
            displayTime,
            st.activityType,
            st.isFlight,
            progress
          );
        }

        // Step 7: Push frame to video stream
        if (supportsRequestFrame && videoTrack?.requestFrame) {
          videoTrack.requestFrame();
        }

        // Step 8: Progress reporting
        if (options.onProgress) {
          options.onProgress(progress, (frameIdx / totalFrames) * durationSec, durationSec, 'Recording Video Animation...');
        }

        // Step 9: Constant frame pacing for smooth encoder timing
        await new Promise<void>((r) => setTimeout(r, frameIntervalMs));
      }

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    runCapture().catch(reject);
  });
}
