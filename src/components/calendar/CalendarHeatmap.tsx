import React, { useMemo } from 'react';
import { useTimeline } from '../../stores/TimelineStore';
import { localDayKey, localDayKeyToRange } from '../../core/time';

/**
 * GitHub-style contribution-graph calendar heatmap.
 * Each cell = 1 day. Intensity = total distance traveled that day.
 */
export default function CalendarHeatmap() {
  const { stats, dispatch, state } = useTimeline();

  // Build grid: sorted list of days with their values
  const { days, maxVal } = useMemo(() => {
    const dailyDistance = stats?.dailyDistance ?? {};
    const entries = Object.entries(dailyDistance).sort(([a], [b]) => a.localeCompare(b));
    const max = entries.reduce((m, [, v]) => Math.max(m, v), 1);
    return { days: entries, maxVal: max };
  }, [stats?.dailyDistance]);

  // Determine the currently selected day (if any)
  const selectedDay = useMemo(() => {
    if (!state.dateRange) return null;
    const span = state.dateRange.end - state.dateRange.start;
    if (span <= 86400000) {
      return localDayKey(state.dateRange.start);
    }
    return null;
  }, [state.dateRange]);

  if (days.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Calendar</h3>
        <div className="text-muted">No data</div>
      </div>
    );
  }

  const handleDayClick = (dayStr: string) => {
    const range = localDayKeyToRange(dayStr);
    if (range) dispatch({ type: 'SET_DATE_RANGE', range });
  };

  return (
    <div className="card">
      <h3 className="card-title">Calendar</h3>
      <div className="heatmap-scroll">
        <div className="heatmap-grid" role="grid">
          {days.map(([day, val]) => {
            const intensity = Math.min(1, val / maxVal);
            const alpha = 0.1 + intensity * 0.9;
            const isSelected = selectedDay === day;
            const distKm = (val / 1000).toFixed(1);
            return (
              <div
                key={day}
                className={`heatmap-cell ${isSelected ? 'heatmap-cell--selected' : ''}`}
                style={{ backgroundColor: `rgba(59,130,246,${alpha})` }}
                title={`${day}: ${distKm} km`}
                onClick={() => handleDayClick(day)}
                role="button"
                tabIndex={0}
                aria-label={`${day}: ${distKm} km`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleDayClick(day);
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="heatmap-legend">
        <span className="text-muted text-xs">Less</span>
        <div className="heatmap-legend-cells">
          {[0.1, 0.3, 0.5, 0.7, 1.0].map((a) => (
            <div
              key={a}
              className="heatmap-legend-cell"
              style={{ backgroundColor: `rgba(59,130,246,${a})` }}
            />
          ))}
        </div>
        <span className="text-muted text-xs">More</span>
      </div>
    </div>
  );
}
