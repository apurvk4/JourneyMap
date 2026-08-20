/**
 * Independent replay engine — drives timeline playback independent of any UI or map library.
 * The engine tracks a virtual clock, interpolates positions, and calls back to the UI layer.
 */
import type { TimelinePoint, TimelineSegment, Coordinate } from '../model';
import { interpolatePosition, computeBearing } from '../geo';

export interface ReplayState {
  isPlaying: boolean;
  currentTime: number;
  startTime: number;
  endTime: number;
  speed: number;
  position: Coordinate | null;
  bearing?: number;
  activityType?: string;
  isFlight?: boolean;
  progress: number; // 0..1
  shouldUpdateCamera: boolean;
  formattedTime: string;
}

export type ReplayCallback = (state: ReplayState) => void;

interface SegmentReplaySlot {
  segment: TimelineSegment;
  startReplayMs: number;
  endReplayMs: number;
}

export class ReplayEngine {
  private segments: TimelineSegment[] = [];
  private segmentSlots: SegmentReplaySlot[] = [];
  private points: TimelinePoint[] = [];
  private startTime = 0;
  private endTime = 0;
  private userSpeed = 1;
  private baseDurationMs = 300000; // 5 minutes default at 1x for multi-hour timelines
  private isPlaying = false;
  private animFrame: number | null = null;
  private realStartMs = 0;
  private pauseOffset = 0;
  private callback: ReplayCallback | null = null;
  
  public smoothing = true;
  public cameraUpdateInterval = 200;
  private lastCameraUpdateTime = -Infinity;
  private isFrozen = false;
  private freezeStartMs = 0;

  /** Load segments or points for replay. */
  load(items: (TimelineSegment | TimelinePoint)[]): void {
    this.stop();
    if (items.length === 0) {
      this.segments = [];
      this.segmentSlots = [];
      this.points = [];
      this.startTime = 0;
      this.endTime = 0;
      this.baseDurationMs = 300000;
      this.pauseOffset = 0;
      this.isFrozen = false;
      this.lastCameraUpdateTime = -Infinity;
      this.emitState();
      return;
    }

    if ('type' in items[0] && 'startTime' in items[0]) {
      this.segments = (items as TimelineSegment[])
        .filter(s => s.startTime && s.endTime)
        .sort((a, b) => a.startTime - b.startTime);
      this.points = [];
      if (this.segments.length > 0) {
        this.startTime = this.segments[0].startTime;
        this.endTime = this.segments[this.segments.length - 1].endTime;
      }
    } else {
      this.points = (items as TimelinePoint[])
        .filter(p => p.timestamp && p.coordinate)
        .sort((a, b) => a.timestamp - b.timestamp);
      this.segments = [];
      if (this.points.length > 0) {
        this.startTime = this.points[0].timestamp;
        this.endTime = this.points[this.points.length - 1].timestamp;
      }
    }

    const span = this.endTime - this.startTime;
    if (span <= 300000) {
      this.baseDurationMs = Math.max(1000, span);
    } else {
      this.baseDurationMs = 300000; // 5 minutes at 1x
    }

    // Build segment replay slots for smooth travel pacing
    this.segmentSlots = [];
    if (this.segments.length > 0) {
      const rawWeights = this.segments.map((s) => {
        if (s.type === 'route') {
          const isFlight = s.activity?.type === 'FLYING';
          return isFlight
            ? Math.max(6000, Math.min(16000, s.points.length * 200))
            : Math.max(3000, Math.min(12000, s.points.length * 150));
        }
        return Math.min(2000, Math.max(800, s.durationMs * 0.0005));
      });

      const totalRawWeight = rawWeights.reduce((a, b) => a + b, 0);
      const targetDuration = this.baseDurationMs;
      const scale = totalRawWeight > 0 ? targetDuration / totalRawWeight : 1;

      let currentAccumMs = 0;
      for (let i = 0; i < this.segments.length; i++) {
        const segDuration = rawWeights[i] * scale;
        this.segmentSlots.push({
          segment: this.segments[i],
          startReplayMs: currentAccumMs,
          endReplayMs: currentAccumMs + segDuration,
        });
        currentAccumMs += segDuration;
      }
    }

    this.pauseOffset = 0;
    this.isFrozen = false;
    this.lastCameraUpdateTime = -Infinity;
    this.emitState();
  }

  /** Register a callback for state changes. */
  onUpdate(cb: ReplayCallback): void {
    this.callback = cb;
  }

  setDuration(durationMs: number): void {
    if (durationMs <= 0) return;
    const span = this.endTime - this.startTime;
    if (span <= 0) return;
    this.setSpeed(span / durationMs);
  }

  getDuration(): number {
    return this.baseDurationMs / this.userSpeed;
  }

  setSmoothing(enabled: boolean): void {
    this.smoothing = enabled;
  }

  setCameraUpdateInterval(ms: number): void {
    this.cameraUpdateInterval = ms;
  }

  /** Freeze the timeline playback clock during camera transitions without losing state. */
  freeze(): void {
    if (this.isFrozen || !this.isPlaying) return;
    this.isFrozen = true;
    this.freezeStartMs = performance.now();
  }

  /** Unfreeze the timeline playback clock after camera transition finishes. */
  unfreeze(): void {
    if (!this.isFrozen) return;
    this.isFrozen = false;
    const frozenDuration = performance.now() - this.freezeStartMs;
    this.realStartMs += frozenDuration;
  }

  /** Start or resume playback. */
  play(speed?: number): void {
    if (speed !== undefined) this.userSpeed = speed;
    if (this.segments.length === 0 && this.points.length === 0) return;
    this.isPlaying = true;
    this.realStartMs = performance.now() - this.pauseOffset;
    this.tick();
  }

  /** Pause playback, preserving position. */
  pause(): void {
    this.unfreeze();
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.pauseOffset = performance.now() - this.realStartMs;
    this.emitState();
  }

  /** Stop and reset to beginning. */
  stop(): void {
    this.unfreeze();
    this.isPlaying = false;
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.pauseOffset = 0;
    this.emitState();
  }

  /** Seek to a specific progress (0..1). */
  seek(progress: number): void {
    this.unfreeze();
    const clamped = Math.max(0, Math.min(1, progress));
    const targetReplayMs = clamped * (this.baseDurationMs / this.userSpeed);
    this.pauseOffset = targetReplayMs;
    if (this.isPlaying) {
      this.realStartMs = performance.now() - this.pauseOffset;
    }
    this.emitState();
  }

  /** Change playback speed. */
  setSpeed(speed: number): void {
    if (speed <= 0) return;
    const currentProgress = this.getState().progress;
    this.userSpeed = speed;
    this.pauseOffset = currentProgress * (this.baseDurationMs / this.userSpeed);
    if (this.isPlaying) {
      this.realStartMs = performance.now() - this.pauseOffset;
    }
  }

  /** Clean up. */
  destroy(): void {
    this.stop();
    this.callback = null;
    this.segments = [];
    this.segmentSlots = [];
    this.points = [];
  }

  getState(): ReplayState {
    const now = this.isFrozen ? this.freezeStartMs : performance.now();
    const elapsedReal = this.isPlaying
      ? (now - this.realStartMs)
      : this.pauseOffset;
    const elapsedReplayMs = Math.max(0, Math.min(this.baseDurationMs, elapsedReal * this.userSpeed));
    const progress = this.baseDurationMs > 0 ? elapsedReplayMs / this.baseDurationMs : 0;

    let position: Coordinate | null = null;
    let bearing: number | undefined;
    let currentTime = this.startTime;
    let activityType: string | undefined;
    let isFlight = false;

    if (this.segmentSlots.length > 0) {
      let slotIdx = 0;
      while (slotIdx + 1 < this.segmentSlots.length && this.segmentSlots[slotIdx + 1].startReplayMs <= elapsedReplayMs) {
        slotIdx++;
      }
      const slot = this.segmentSlots[slotIdx];
      const slotSpan = Math.max(1, slot.endReplayMs - slot.startReplayMs);
      const slotRatio = Math.max(0, Math.min(1, (elapsedReplayMs - slot.startReplayMs) / slotSpan));
      const seg = slot.segment;

      activityType = seg.activity?.type;
      isFlight = activityType === 'FLYING';
      currentTime = Math.round(seg.startTime + slotRatio * (seg.endTime - seg.startTime));

      if (seg.type === 'visit') {
        position = seg.place?.coordinate ?? seg.start;
      } else if (seg.points.length >= 2) {
        const pts = seg.points;
        const ptStart = pts[0].timestamp;
        const ptEnd = pts[pts.length - 1].timestamp;
        const ptTime = ptStart + slotRatio * (ptEnd - ptStart);
        position = interpolatePosition(pts, ptTime);

        // Compute forward tangent bearing
        const lookAheadRatio = Math.min(1, slotRatio + 0.02);
        const lookAheadTime = ptStart + lookAheadRatio * (ptEnd - ptStart);
        const nextPos = interpolatePosition(pts, lookAheadTime) ?? pts[pts.length - 1].coordinate;
        if (position && nextPos && (position.latitude !== nextPos.latitude || position.longitude !== nextPos.longitude)) {
          bearing = computeBearing(position, nextPos);
        } else if (pts.length >= 2) {
          bearing = computeBearing(pts[0].coordinate, pts[pts.length - 1].coordinate);
        }
      } else {
        position = seg.points[0]?.coordinate ?? seg.start;
      }
    } else if (this.points.length > 0) {
      currentTime = Math.round(this.startTime + progress * (this.endTime - this.startTime));
      position = interpolatePosition(this.points, currentTime);
      const nextTime = Math.min(this.endTime, currentTime + 100);
      const nextPos = interpolatePosition(this.points, nextTime);
      if (position && nextPos && (position.latitude !== nextPos.latitude || position.longitude !== nextPos.longitude)) {
        bearing = computeBearing(position, nextPos);
      }
    }

    let shouldUpdateCamera = false;
    if (!this.isPlaying) {
      shouldUpdateCamera = true;
    } else if (now - this.lastCameraUpdateTime >= this.cameraUpdateInterval) {
      shouldUpdateCamera = true;
    }

    return {
      isPlaying: this.isPlaying,
      currentTime,
      startTime: this.startTime,
      endTime: this.endTime,
      speed: this.userSpeed,
      position,
      bearing,
      activityType,
      isFlight,
      progress: Math.max(0, Math.min(1, progress)),
      shouldUpdateCamera,
      formattedTime: new Date(currentTime).toISOString(),
    };
  }

  // ── Private ──

  private tick = (): void => {
    if (!this.isPlaying) return;

    const state = this.getState();

    if (state.progress >= 1) {
      this.isPlaying = false;
      this.pauseOffset = this.baseDurationMs / this.userSpeed;
      this.callback?.({
        ...state,
        isPlaying: false,
        progress: 1,
        shouldUpdateCamera: true,
      });
      return;
    }
    
    if (state.shouldUpdateCamera) {
      this.lastCameraUpdateTime = performance.now();
    }

    this.callback?.(state);
    this.animFrame = requestAnimationFrame(this.tick);
  };

  private emitState(): void {
    this.lastCameraUpdateTime = -Infinity; 
    this.callback?.(this.getState());
  }
}
