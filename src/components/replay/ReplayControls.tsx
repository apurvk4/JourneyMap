import React, { useEffect, useState } from 'react';
import { ReplayEngine } from '../../core/replay';
import { useTimeline } from '../../stores/TimelineStore';
import VideoExportModal from './VideoExportModal';

const SPEEDS = [0.5, 1, 2, 5, 10, 25];

export default function ReplayControls() {
  const { state, dispatch, filteredSegments } = useTimeline();
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const i = setInterval(() => {
      const mapEl = document.querySelector('.map-container') as HTMLElement & { __replayEngine?: ReplayEngine };
      if (mapEl && mapEl.__replayEngine) {
        const st = mapEl.__replayEngine.getState();
        setProgress(st.progress);
        if (st.currentTime > 0) {
          setCurrentTime(st.currentTime);
        }
      }
    }, 100);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mapEl = document.querySelector('.map-container') as HTMLElement & { __replayEngine?: ReplayEngine };
      const engine = mapEl?.__replayEngine as ReplayEngine | undefined;
      
      switch(e.key) {
        case ' ':
          e.preventDefault();
          dispatch({ type: 'SET_REPLAY', partial: { isPlaying: !state.replay.isPlaying } });
          break;
        case 'ArrowLeft':
          if (engine) engine.seek(Math.max(0, engine.getState().progress - 0.05));
          break;
        case 'ArrowRight':
          if (engine) engine.seek(Math.min(1, engine.getState().progress + 0.05));
          break;
        case 'ArrowUp': {
          const idx = SPEEDS.indexOf(state.replay.speed);
          const nextSpeed = idx >= 0 && idx + 1 < SPEEDS.length ? SPEEDS[idx + 1] : SPEEDS[SPEEDS.length - 1];
          dispatch({ type: 'SET_REPLAY', partial: { speed: nextSpeed } });
          break;
        }
        case 'ArrowDown': {
          const idx = SPEEDS.indexOf(state.replay.speed);
          const prevSpeed = idx > 0 ? SPEEDS[idx - 1] : SPEEDS[0];
          dispatch({ type: 'SET_REPLAY', partial: { speed: prevSpeed } });
          break;
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state.replay.isPlaying, state.replay.speed, dispatch]);

  const onProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const mapEl = document.querySelector('.map-container') as HTMLElement & { __replayEngine?: ReplayEngine };
    if (mapEl && mapEl.__replayEngine) {
      mapEl.__replayEngine.seek(val);
    }
    setProgress(val);
  };

  const hasData = filteredSegments.length > 0;
  const hasPoints = filteredSegments.some((s) => s.points.length > 0 || s.type === 'visit');

  const play = () => dispatch({ type: 'SET_REPLAY', partial: { isPlaying: true } });
  const pause = () => dispatch({ type: 'SET_REPLAY', partial: { isPlaying: false } });
  const stop = () =>
    dispatch({ type: 'SET_REPLAY', partial: { isPlaying: false } });

  if (!hasData) return null;

  return (
    <>
      <div className={`replay-bar ${collapsed ? 'collapsed' : ''}`}>
      <div className="replay-controls" role="toolbar" aria-label="Playback controls">
        {/* Play / Pause */}
        {!state.replay.isPlaying ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={play}
            disabled={!hasPoints}
            aria-label="Play"
          >
            ▶ Play
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            onClick={pause}
            aria-label="Pause"
          >
            ⏸ Pause
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={stop}
          disabled={!state.replay.isPlaying}
          aria-label="Stop"
        >
          ⏹
        </button>

        {/* Speed selector */}
        <div className="replay-speed">
          <label className="text-muted text-xs" htmlFor="replay-speed">
            Speed
          </label>
          <select
            id="replay-speed"
            className="replay-speed-select"
            value={state.replay.speed}
            onChange={(e) =>
              dispatch({
                type: 'SET_REPLAY',
                partial: { speed: Number(e.target.value) },
              })
            }
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Progress Slider */}
        <div className="replay-progress">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={onProgressChange}
            aria-label="Replay progress"
          />
        </div>

        {/* Time / Date Display */}
        <div className="replay-time">
          {currentTime ? (
            <span className="replay-time-details">
              {new Date(currentTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
              {new Date(currentTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <span className="replay-time-pct">{(progress * 100).toFixed(1)}%</span>
        </div>

        {/* Camera follow toggle */}
        <label className="replay-follow">
          <input
            type="checkbox"
            checked={state.replay.follow}
            onChange={(e) =>
              dispatch({
                type: 'SET_REPLAY',
                partial: { follow: e.target.checked },
              })
            }
            aria-label="Follow marker on map"
          />
          <span className="text-muted text-xs">Follow</span>
        </label>
      </div>

      {/* Export buttons */}
      <div className="replay-exports">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-export-video"
          onClick={() => setIsVideoModalOpen(true)}
          aria-label="Export Video"
        >
          🎬 {state.selectedSegmentId ? 'Selected Video' : 'Video'}
        </button>
        <ExportButton format="geojson" label="GeoJSON" />
        <ExportButton format="gpx" label="GPX" />
        <ExportButton format="kml" label="KML" />
        <ExportButton format="csv" label="CSV" />
      </div>

      <VideoExportModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
      />
      </div>

      {/* Mobile collapse handle */}
      <div className="replay-collapse-handle" onClick={() => setCollapsed((c) => !c)} role="button" aria-label={collapsed ? 'Expand replay controls' : 'Collapse replay controls'}>
        {collapsed ? '▲ Show playback' : '▼ Hide playback'}
      </div>

    </>
  );
}

function ExportButton({ format, label }: { format: string; label: string }) {
  const { filteredSegments, timelineRef, state } = useTimeline();

  const doExport = async () => {
    const segments = state.selectedSegmentId
      ? filteredSegments.filter((segment) => segment.id === state.selectedSegmentId)
      : filteredSegments;
    const data = {
      segments,
      dateRange: timelineRef.current?.dateRange ?? { start: 0, end: 0 },
      totalPoints: segments.reduce((s, seg) => s + seg.points.length, 0),
    };

    let blob: Blob;
    let filename: string;

    switch (format) {
      case 'geojson': {
        const { toGeoJSON } = await import('../../core/exporters/geojson');
        blob = new Blob([JSON.stringify(toGeoJSON(data), null, 2)], { type: 'application/json' });
        filename = 'timeline.geojson';
        break;
      }
      case 'gpx': {
        const { toGPX } = await import('../../core/exporters/gpx');
        blob = new Blob([toGPX(data)], { type: 'application/gpx+xml' });
        filename = 'timeline.gpx';
        break;
      }
      case 'kml': {
        const { toKML } = await import('../../core/exporters/kml');
        blob = new Blob([toKML(data)], { type: 'application/vnd.google-earth.kml+xml' });
        filename = 'timeline.kml';
        break;
      }
      case 'csv': {
        const { toCSV } = await import('../../core/exporters/csv');
        blob = new Blob([toCSV(data)], { type: 'text/csv' });
        filename = 'timeline.csv';
        break;
      }
      default:
        return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" className="btn btn-ghost btn-xs" onClick={doExport}>
      {state.selectedSegmentId ? `Selected ${label}` : label}
    </button>
  );
}
