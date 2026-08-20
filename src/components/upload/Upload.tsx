import React, { useCallback, useRef, useState, DragEvent } from 'react';
import type { TimelineData } from '../../core/model';
import { parseGoogleTimeline } from '../../core/parser';
import { useTimeline } from '../../stores/TimelineStore';
import demoData from '../../sample/demo-timeline.json';

export default function Upload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const { setTimeline, state, setStorageEnabled } = useTimeline();

  const processFile = useCallback(
    async (file: File) => {
      setStatus('Reading file…');
      try {
        // A new import supersedes any in-flight import. This avoids stale worker
        // results replacing the timeline the user selected most recently.
        workerRef.current?.terminate();
        const text = await file.text();
        setStatus('Parsing in background…');
        const worker = new Worker(
          new URL('../../../workers/timeline.worker.ts', import.meta.url),
          { type: 'module' },
        );
        workerRef.current = worker;
        worker.postMessage({ type: 'parse', text });
        worker.onmessage = (ev) => {
          const msg = ev.data;
          if (msg.type === 'progress') {
            const detail =
              msg.current != null && msg.total != null
                ? ` (${msg.current.toLocaleString()} / ${msg.total.toLocaleString()})`
                : '';
            setStatus(`${msg.phase}${detail}`);
          } else if (msg.type === 'done') {
            const data = msg.data as TimelineData;
            const warningCount = Number(msg.warningCount ?? 0);
            setStatus(
              `Ready — ${data.segments.length.toLocaleString()} segments, ${data.totalPoints.toLocaleString()} points${warningCount ? ` (${warningCount} malformed records skipped)` : ''}`,
            );
            setTimeline(data);
            worker.terminate();
            if (workerRef.current === worker) workerRef.current = null;
          } else if (msg.type === 'error') {
            setStatus(msg.message);
            worker.terminate();
            if (workerRef.current === worker) workerRef.current = null;
          }
        };
        worker.onerror = () => {
          setStatus('The browser could not process this Timeline file. Try a smaller export or free device memory.');
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setStatus('Error reading file: ' + message);
      }
    },
    [setTimeline],
  );

  const loadDemo = useCallback(() => {
    workerRef.current?.terminate();
    setStatus('Loading demo data…');
    try {
      const actualData = (demoData as { default?: unknown }).default ?? demoData;
      const { data } = parseGoogleTimeline(actualData);
      setTimeline(data);
      setStatus(
        `Demo loaded — ${data.segments.length} segments, ${data.totalPoints} points`,
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus('Error loading demo: ' + message);
    }
  }, [setTimeline]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  // If data is already loaded, show a minimal re-upload option
  if (state.hasData) {
    const isRestored = state.status === 'Restored from cache';
    return (
      <div className="upload-compact">
        <span className="upload-compact-status">{status || (isRestored ? 'Restored from cache' : 'Timeline loaded')}</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setTimeline(null)}
        >
          Clear timeline data
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => inputRef.current?.click()}
        >
          Load different file
        </button>
        <input
          ref={inputRef}
          style={{ display: 'none' }}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
        />
      </div>
    );
  }

  // Full landing upload experience
  return (
    <div className="upload-landing">
      <div className="upload-landing-inner">
        <h1 className="upload-title">Timeline Visualizer</h1>
        <p className="upload-subtitle">
          Visualize your Google Maps Timeline — entirely in your browser.
        </p>

        <div
          className={`upload-drop ${isDragging ? 'upload-drop--active' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Drop your Timeline.json file here or click to browse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
        >
          <div className="upload-drop-icon">📂</div>
          <div className="upload-drop-text">
            Drop your <strong>Timeline.json</strong> here
          </div>
          <div className="upload-drop-or">or</div>
          <button type="button" className="btn btn-primary" tabIndex={-1}>
            Choose a file
          </button>
          <input
            ref={inputRef}
            style={{ display: 'none' }}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
            }}
          />
        </div>

        {status && <div className="upload-status">{status}</div>}

        <section className="upload-instructions" aria-labelledby="export-instructions-title">
          <h2 id="export-instructions-title">How to export your Timeline JSON</h2>
          <div className="upload-instructions-grid">
            <div className="upload-instruction-card">
              <h3>Android</h3>
              <ol>
                <li>Open your phone’s <strong>Settings</strong> app.</li>
                <li>Go to <strong>Location → Location services → Timeline</strong>.</li>
                <li>Tap <strong>Export Timeline data</strong>, then save the JSON file.</li>
              </ol>
            </div>
            <div className="upload-instruction-card">
              <h3>iPhone</h3>
              <ol>
                <li>Open <strong>Google Maps</strong> and tap your profile picture.</li>
                <li>Go to <strong>Settings → Personal content</strong>.</li>
                <li>Tap <strong>Export Timeline data</strong>, then choose <strong>Save to Files</strong>.</li>
              </ol>
            </div>
          </div>
          <p className="upload-instructions-note">
            Upload the exported <strong>Timeline.json</strong> or <strong>location-history.json</strong> file here.
          </p>
        </section>

        <div className="upload-privacy">
          <span className="upload-privacy-icon">🔒</span>
          <span>
            Your location data never leaves your device. All processing happens locally in your
            browser.
          </span>
        </div>

        <label className="upload-persistence">
          <input
            type="checkbox"
            checked={state.storageEnabled}
            onChange={(event) => setStorageEnabled(event.target.checked)}
          />
          Remember this Timeline on this device (optional)
        </label>

        <div className="upload-demo">
          <button type="button" className="btn btn-ghost" onClick={loadDemo}>
            Load demo data
          </button>
        </div>
      </div>
    </div>
  );
}
