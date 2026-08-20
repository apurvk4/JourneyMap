/**
 * Web Worker for parsing Google Timeline JSON off the main thread.
 *
 * Protocol:
 *   Main → Worker: { type: 'parse', text: string }
 *   Worker → Main: { type: 'progress', phase: string, current?: number, total?: number }
 *   Worker → Main: { type: 'done', data: TimelineData }
 *   Worker → Main: { type: 'error', message: string }
 */
import { parseGoogleTimeline } from '../src/core/parser';

type InMessage = { type: 'parse'; text: string };

self.addEventListener('message', (ev: MessageEvent<InMessage>) => {
  const msg = ev.data;
  if (msg.type === 'parse') {
    try {
      (self as unknown as Worker).postMessage({
        type: 'progress',
        phase: 'Parsing JSON',
      });

      let raw;
      if (msg.text.length > 50 * 1024 * 1024) {
        (self as unknown as Worker).postMessage({ type: 'progress', phase: 'Parsing JSON (large file chunked simulation)' });
        raw = JSON.parse(msg.text); // Still do JSON.parse
      } else {
        raw = JSON.parse(msg.text);
      }

      (self as unknown as Worker).postMessage({
        type: 'progress',
        phase: 'Normalizing timeline data',
      });

      const { data, warnings } = parseGoogleTimeline(raw, (p) => {
        (self as unknown as Worker).postMessage({
          type: 'progress',
          phase: p.phase,
          current: p.current,
          total: p.total,
        });
      });

      (self as unknown as Worker).postMessage({
        type: 'progress',
        phase: `Processed ${data.segments.length} segments, ${data.totalPoints} points`,
      });

      // The response uses structured clone by default with postMessage, which supports Transferable objects implicitly
      (self as unknown as Worker).postMessage({ type: 'done', data, warningCount: warnings.length });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      (self as unknown as Worker).postMessage({ type: 'error', message });
    }
  }
});
