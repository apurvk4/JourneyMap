import React, { useState, useRef } from 'react';
import { useTimeline } from '../../stores/TimelineStore';
import { exportTimelineVideo, isVideoExportSupported, getSupportedVideoMimeType } from '../../core/exporters/video';
import type { VideoExportOptions } from '../../core/exporters/video';

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ResolutionPreset = '1080p' | '720p' | 'viewport';

export default function VideoExportModal({ isOpen, onClose }: VideoExportModalProps) {
  const { filteredSegments, state } = useTimeline();
  const [durationSec, setDurationSec] = useState<number>(30);
  const [customDuration, setCustomDuration] = useState<string>('30');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [resolution, setResolution] = useState<ResolutionPreset>('1080p');
  const [includeOverlay, setIncludeOverlay] = useState<boolean>(true);
  const [format, setFormat] = useState<'auto' | 'webm' | 'mp4'>('auto');
  const [scope, setScope] = useState<'all' | 'selected'>(state.selectedSegmentId ? 'selected' : 'all');

  // Recording status
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Recording Video Animation...');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const supported = isVideoExportSupported();
  const { extension } = getSupportedVideoMimeType(format);

  const selectedSegment = state.selectedSegmentId
    ? filteredSegments.find((s) => s.id === state.selectedSegmentId)
    : null;

  const segmentsToExport =
    scope === 'selected' && selectedSegment ? [selectedSegment] : filteredSegments;

  const handleDurationPreset = (secs: number) => {
    setIsCustom(false);
    setDurationSec(secs);
    setCustomDuration(String(secs));
  };

  const handleCustomDurationChange = (val: string) => {
    setCustomDuration(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDurationSec(Math.min(300, Math.max(3, parsed)));
    }
  };

  const handleStartExport = async () => {
    setError(null);
    setIsRecording(true);
    setProgress(0);
    setElapsedSec(0);
    setStatusText('Preloading map tiles along journey...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const map = (window as unknown as { __map?: import('maplibre-gl').Map }).__map;
    if (!map) {
      setError('Map instance is not ready.');
      setIsRecording(false);
      return;
    }

    let width: number | undefined;
    let height: number | undefined;
    if (resolution === '1080p') {
      width = 1920;
      height = 1080;
    } else if (resolution === '720p') {
      width = 1280;
      height = 720;
    }

    const options: VideoExportOptions = {
      width,
      height,
      durationSec,
      fps: 30,
      includeOverlay,
      format,
      theme: state.theme,
      signal: abortController.signal,
      onProgress: (p, elapsed, _total, status) => {
        setProgress(p);
        setElapsedSec(elapsed);
        if (status) setStatusText(status);
      },
    };

    try {
      const result = await exportTimelineVideo(map, segmentsToExport, options);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Video recording was cancelled.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred during video export.');
      }
      setIsRecording(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  if (isRecording) {
    return (
      <div className="video-recording-floating-hud" role="status" aria-live="polite">
        <div className="video-recording-floating-card">
          <div className="video-recording-indicator">
            <span className="video-recording-dot"></span>
            <span className="video-recording-text">{statusText}</span>
          </div>
          <div className="video-progress-bar-container">
            <div className="video-progress-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }}></div>
          </div>
          <div className="video-progress-stats">
            <span>{Math.round(progress * 100)}% completed</span>
            <span>{elapsedSec.toFixed(1)}s / {durationSec}s</span>
          </div>
          <div className="video-recording-actions">
            <button type="button" className="btn btn-danger btn-xs" onClick={handleCancel}>
              Cancel Recording
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="video-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
    >
      <div className="video-modal-content">
        <div className="video-modal-header">
          <div className="video-modal-title-group">
            <span className="video-modal-icon">🎬</span>
            <div>
              <h2 id="video-modal-title" className="video-modal-title">Export Journey Video</h2>
              <p className="video-modal-subtitle">Generate an animated travel replay video with camera tracking</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {!supported ? (
          <div className="video-modal-alert video-modal-alert-error">
            Your current browser does not support HTML5 Canvas stream recording. Please use modern Chrome, Edge, or Firefox.
          </div>
        ) : (
          <div className="video-modal-body">
            {error && (
              <div className="video-modal-alert video-modal-alert-error">
                {error}
              </div>
            )}
              <>
                {/* Scope Selection */}
                {state.selectedSegmentId && (
                  <div className="video-modal-form-group">
                    <label className="video-modal-label">Export Target</label>
                    <div className="video-modal-pills">
                      <button
                        type="button"
                        className={`video-pill ${scope === 'all' ? 'video-pill-active' : ''}`}
                        onClick={() => setScope('all')}
                      >
                        All Timeline ({filteredSegments.length} segments)
                      </button>
                      <button
                        type="button"
                        className={`video-pill ${scope === 'selected' ? 'video-pill-active' : ''}`}
                        onClick={() => setScope('selected')}
                      >
                        Selected Route Only
                      </button>
                    </div>
                  </div>
                )}

                {/* Duration Presets */}
                <div className="video-modal-form-group">
                  <label className="video-modal-label">Duration</label>
                  <div className="video-modal-pills">
                    <button
                      type="button"
                      className={`video-pill ${!isCustom && durationSec === 15 ? 'video-pill-active' : ''}`}
                      onClick={() => handleDurationPreset(15)}
                    >
                      15s (Quick Reel)
                    </button>
                    <button
                      type="button"
                      className={`video-pill ${!isCustom && durationSec === 30 ? 'video-pill-active' : ''}`}
                      onClick={() => handleDurationPreset(30)}
                    >
                      30s (Social Story)
                    </button>
                    <button
                      type="button"
                      className={`video-pill ${!isCustom && durationSec === 60 ? 'video-pill-active' : ''}`}
                      onClick={() => handleDurationPreset(60)}
                    >
                      60s (Cinematic Recap)
                    </button>
                    <button
                      type="button"
                      className={`video-pill ${isCustom ? 'video-pill-active' : ''}`}
                      onClick={() => setIsCustom(true)}
                    >
                      Custom
                    </button>
                  </div>
                  {isCustom && (
                    <div className="video-modal-custom-input">
                      <input
                        type="number"
                        min="3"
                        max="300"
                        value={customDuration}
                        onChange={(e) => handleCustomDurationChange(e.target.value)}
                        className="input-number"
                        placeholder="Seconds"
                      />
                      <span className="text-muted text-xs">seconds (3 - 300s)</span>
                    </div>
                  )}
                </div>

                {/* Resolution Presets */}
                <div className="video-modal-form-group">
                  <label className="video-modal-label">Resolution</label>
                  <div className="video-modal-pills">
                    <button
                      type="button"
                      className={`video-pill ${resolution === '1080p' ? 'video-pill-active' : ''}`}
                      onClick={() => setResolution('1080p')}
                    >
                      1080p Full HD (1920×1080)
                    </button>
                    <button
                      type="button"
                      className={`video-pill ${resolution === '720p' ? 'video-pill-active' : ''}`}
                      onClick={() => setResolution('720p')}
                    >
                      720p HD (1280×720)
                    </button>
                    <button
                      type="button"
                      className={`video-pill ${resolution === 'viewport' ? 'video-pill-active' : ''}`}
                      onClick={() => setResolution('viewport')}
                    >
                      Current Viewport
                    </button>
                  </div>
                </div>

                {/* Telemetry Overlays & Format Options */}
                <div className="video-modal-row">
                  <div className="video-modal-form-group flex-1">
                    <label className="video-modal-label">Format</label>
                    <select
                      className="video-select"
                      value={format}
                      onChange={(e) => setFormat(e.target.value as 'auto' | 'webm' | 'mp4')}
                    >
                      <option value="auto">Auto ({extension.toUpperCase()})</option>
                      <option value="webm">WebM (VP9/VP8)</option>
                      <option value="mp4">MP4 (H.264)</option>
                    </select>
                  </div>
                  <div className="video-modal-form-group flex-1">
                    <label className="video-modal-label">Overlays</label>
                    <label className="video-checkbox-label">
                      <input
                        type="checkbox"
                        checked={includeOverlay}
                        onChange={(e) => setIncludeOverlay(e.target.checked)}
                      />
                      <span>Include HUD & Progress Bar</span>
                    </label>
                  </div>
                </div>

                <div className="video-modal-footer">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleStartExport}
                    disabled={segmentsToExport.length === 0}
                  >
                    🎬 Start Video Export ({durationSec}s)
                  </button>
                </div>
              </>
          </div>
        )}
      </div>
    </div>
  );
}
