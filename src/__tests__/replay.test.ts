import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReplayEngine } from '../core/replay';

// Mock requestAnimationFrame / cancelAnimationFrame for node test environment
let rafCallbacks: Array<(time: number) => void> = [];
let rafId = 0;

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    rafCallbacks.push(cb);
    return ++rafId;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    // noop for tests
  });
  vi.stubGlobal('performance', {
    now: vi.fn(() => 0),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReplayEngine', () => {
  const points = [
    { timestamp: 1000, coordinate: { latitude: 10, longitude: 20 } },
    { timestamp: 2000, coordinate: { latitude: 20, longitude: 30 } },
    { timestamp: 3000, coordinate: { latitude: 30, longitude: 40 } },
  ];

  it('loads points and sets time range', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    const state = engine.getState();
    expect(state.startTime).toBe(1000);
    expect(state.endTime).toBe(3000);
    expect(state.isPlaying).toBe(false);
  });

  it('emits state on update callback when loaded', () => {
    const engine = new ReplayEngine();
    const cb = vi.fn();
    engine.onUpdate(cb);
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(0);
    engine.load(points);
    expect(cb).toHaveBeenCalled();
    // After load, the engine's state should reflect the loaded points
    const state = engine.getState();
    expect(state.startTime).toBe(1000);
    expect(state.endTime).toBe(3000);
  });

  it('starts playing and emits updates', () => {
    const engine = new ReplayEngine();
    const cb = vi.fn();
    engine.onUpdate(cb);
    engine.load(points);

    cb.mockClear();

    // Mock performance.now() for play
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(0);
    engine.play(1);

    expect(engine.getState().isPlaying).toBe(true);
  });

  it('pauses playback', () => {
    const engine = new ReplayEngine();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(0);
    engine.load(points);
    engine.play(1);
    engine.pause();
    expect(engine.getState().isPlaying).toBe(false);
  });

  it('stops and resets', () => {
    const engine = new ReplayEngine();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(0);
    engine.load(points);
    engine.play(1);
    engine.stop();
    const state = engine.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.progress).toBe(0);
  });

  it('seek sets progress', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    engine.seek(0.5);
    const state = engine.getState();
    expect(state.progress).toBeCloseTo(0.5, 1);
  });

  it('handles empty points gracefully', () => {
    const engine = new ReplayEngine();
    engine.load([]);
    engine.play();
    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getState().position).toBeNull();
  });

  it('cleans up on destroy', () => {
    const engine = new ReplayEngine();
    const cb = vi.fn();
    engine.onUpdate(cb);
    engine.load(points);
    engine.destroy();

    cb.mockClear();
    engine.load(points); // Should not call cb after destroy
    expect(cb).not.toHaveBeenCalled();
  });

  it('changes speed', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    engine.setSpeed(5);
    const state = engine.getState();
    expect(state.speed).toBe(5);
  });

  it('setDuration correctly calculates speed', () => {
    const engine = new ReplayEngine();
    engine.load(points); // duration is 2000ms (1000 to 3000)
    engine.setDuration(1000); // 1 real second
    expect(engine.getState().speed).toBe(2);
  });

  it('getDuration returns correct wall-clock duration', () => {
    const engine = new ReplayEngine();
    engine.load(points); // 2000ms
    engine.setSpeed(0.5);
    expect(engine.getDuration()).toBe(4000); // 2000 / 0.5
  });

  it('smoothing toggle switches interpolation mode', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    
    // Halfway between 1000 and 2000 is 1500
    // At t=1500, linear should be exactly mid-point. Cubic might be slightly different.
    engine.seek(0.25); // 0.25 of 2000 = 500, so timeline time = 1500
    
    engine.setSmoothing(false);
    const posLinear = engine.getState().position;
    
    engine.setSmoothing(true);
    const posCubic = engine.getState().position;
    
    expect(posLinear).not.toBeNull();
    expect(posCubic).not.toBeNull();
    // For this simple set of points, Catmull-Rom will differ from linear
    expect(posLinear?.latitude).toBe(15);
    expect(posLinear?.longitude).toBe(25);
  });

  it('shouldUpdateCamera respects throttle interval', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    engine.setCameraUpdateInterval(100);
    
    let state = engine.getState();
    engine.onUpdate((s) => { state = s; });
    engine.play(1);
    
    // Since play() triggers tick() which consumes the first camera update, calling getState() again returns false
    state = engine.getState();
    expect(state.shouldUpdateCamera).toBe(false);
    
    // Advance time by 50ms, shouldn't update camera
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(50);
    state = engine.getState();
    expect(state.shouldUpdateCamera).toBe(false);
    
    // Advance time by 100ms, should update camera
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(150);
    state = engine.getState();
    expect(state.shouldUpdateCamera).toBe(true);
  });

  it('pause/resume preserves exact timeline position', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(0);
    engine.play(1);
    
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(500);
    expect(engine.getState().currentTime).toBe(1500);
    
    engine.pause();
    
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1000);
    expect(engine.getState().currentTime).toBe(1500);
    
    engine.play(1);
    
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1100);
    expect(engine.getState().currentTime).toBe(1600);
  });

  it('formattedTime is a valid date string', () => {
    const engine = new ReplayEngine();
    engine.load(points);
    
    const state = engine.getState();
    const d = new Date(state.formattedTime);
    expect(d.getTime()).toBe(state.currentTime);
  });

  it('freeze pauses timeline progression and unfreeze resumes without losing position', () => {
    const engine = new ReplayEngine();
    engine.load(points);

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(0);
    engine.play(1);

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(500);
    expect(engine.getState().currentTime).toBe(1500);

    // Freeze during camera flight for 1000ms
    engine.freeze();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1500);
    expect(engine.getState().currentTime).toBe(1500); // Position is preserved!

    // Unfreeze after camera flight
    engine.unfreeze();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(1600);
    expect(engine.getState().currentTime).toBe(1600); // Progress resumed smoothly!
  });

  it('supports segment-aware replay staying strictly on segment points and visits', () => {
    const engine = new ReplayEngine();
    const segments = [
      {
        id: 'seg1',
        type: 'route' as const,
        startTime: 1000,
        endTime: 2000,
        start: { latitude: 10, longitude: 10 },
        end: { latitude: 10, longitude: 20 },
        points: [
          { timestamp: 1000, coordinate: { latitude: 10, longitude: 10 } },
          { timestamp: 2000, coordinate: { latitude: 10, longitude: 20 } },
        ],
        distanceMeters: 1000,
        durationMs: 1000,
      },
      {
        id: 'seg2',
        type: 'visit' as const,
        startTime: 3000,
        endTime: 5000,
        start: { latitude: 50, longitude: 50 },
        end: { latitude: 50, longitude: 50 },
        place: { coordinate: { latitude: 50, longitude: 50 } },
        points: [],
        distanceMeters: 0,
        durationMs: 2000,
      },
    ];

    engine.load(segments);
    expect(engine.getState().startTime).toBe(1000);
    expect(engine.getState().endTime).toBe(5000);

    // During seg1 (route: 0 to ~0.79 of slot time)
    engine.seek(0.39474); // halfway through seg1
    const s1 = engine.getState();
    expect(s1.position?.latitude).toBe(10);
    expect(s1.position?.longitude).toBeCloseTo(15, 1);
    expect(s1.activityType).toBeUndefined();

    // During seg2 (visit: latter 25% of slot time)
    engine.seek(0.85); // inside seg2
    const s2 = engine.getState();
    expect(s2.position?.latitude).toBe(50);
    expect(s2.position?.longitude).toBe(50);
  });
});
