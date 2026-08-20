/* eslint-disable react-hooks/refs */
import React, { useMemo } from 'react';
import { useTimeline } from '../../stores/TimelineStore';
import { localDayRange } from '../../core/time';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DateFilter() {
  const { state, dispatch, years, timelineRef } = useTimeline();
  const data = timelineRef.current;

  const selectedYear = useMemo(() => {
    if (!state.dateRange) return null;
    return new Date(state.dateRange.start).getFullYear();
  }, [state.dateRange]);

  const selectedMonth = useMemo(() => {
    if (!state.dateRange) return null;
    const d = state.dateRange;
    const s = new Date(d.start);
    const e = new Date(d.end);
    // Only consider it a "month" selection if the range spans roughly one month
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return s.getMonth();
    }
    return null;
  }, [state.dateRange]);

  const selectedDay = useMemo(() => {
    if (!state.dateRange) return null;
    const span = state.dateRange.end - state.dateRange.start;
    if (span <= 86400000) {
      return new Date(state.dateRange.start).getDate();
    }
    return null;
  }, [state.dateRange]);

  // Months that have data for the selected year
  const monthsWithData = useMemo(() => {
    if (!data || selectedYear === null) return new Set<number>();
    const set = new Set<number>();
    for (const s of data.segments) {
      const d = new Date(s.startTime);
      if (d.getFullYear() === selectedYear) set.add(d.getMonth());
    }
    return set;
  }, [data, selectedYear]);

  // Days that have data for the selected year+month
  const daysWithData = useMemo(() => {
    if (!data || selectedYear === null || selectedMonth === null) return new Set<number>();
    const set = new Set<number>();
    for (const s of data.segments) {
      const d = new Date(s.startTime);
      if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) set.add(d.getDate());
    }
    return set;
  }, [data, selectedYear, selectedMonth]);

  const selectYear = (y: number) => {
    const start = new Date(y, 0, 1).getTime();
    const end = new Date(y + 1, 0, 1).getTime() - 1;
    dispatch({ type: 'SET_DATE_RANGE', range: { start, end } });
  };

  const selectMonth = (m: number) => {
    if (selectedYear === null) return;
    const start = new Date(selectedYear, m, 1).getTime();
    const end = new Date(selectedYear, m + 1, 1).getTime() - 1;
    dispatch({ type: 'SET_DATE_RANGE', range: { start, end } });
  };

  const selectDay = (d: number) => {
    if (selectedYear === null || selectedMonth === null) return;
    dispatch({ type: 'SET_DATE_RANGE', range: localDayRange(selectedYear, selectedMonth, d) });
  };

  const reset = () => {
    dispatch({ type: 'SET_DATE_RANGE', range: null });
  };

  const shiftRange = (direction: -1 | 1) => {
    if (!state.dateRange) return;
    const span = state.dateRange.end - state.dateRange.start + 1;
    const start = state.dateRange.start + direction * span;
    dispatch({ type: 'SET_DATE_RANGE', range: { start, end: start + span - 1 } });
  };

  const selectToday = () => {
    const now = new Date();
    dispatch({ type: 'SET_DATE_RANGE', range: localDayRange(now.getFullYear(), now.getMonth(), now.getDate()) });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Date</h3>
        {state.dateRange && (
          <>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => shiftRange(-1)} aria-label="Previous date range">‹</button>
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => shiftRange(1)} aria-label="Next date range">›</button>
            <button type="button" className="btn btn-xs btn-ghost" onClick={reset}>Show all</button>
          </>
        )}
      </div>
      <div className="text-muted text-xs" style={{ marginBottom: 8 }}>
        {state.dateRange
          ? `${new Date(state.dateRange.start).toLocaleDateString()} – ${new Date(state.dateRange.end).toLocaleDateString()}`
          : 'All history'}
      </div>
      <button type="button" className="btn btn-xs btn-ghost" onClick={selectToday}>Today</button>

      {/* Year pills */}
      <div className="pill-row" role="group" aria-label="Date filters">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            className={`pill ${selectedYear === y ? 'pill--active' : ''}`}
            onClick={() => selectYear(y)}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Month pills — shown when a year is selected */}
      {selectedYear !== null && (
        <div className="pill-row" style={{ marginTop: 8 }}>
          {MONTH_NAMES.map((name, i) => {
            const hasData = monthsWithData.has(i);
            return (
              <button
                key={i}
                type="button"
                className={`pill ${selectedMonth === i ? 'pill--active' : ''} ${!hasData ? 'pill--disabled' : ''}`}
                disabled={!hasData}
                onClick={() => selectMonth(i)}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Day pills — shown when a month is selected */}
      {selectedYear !== null && selectedMonth !== null && (
        <div className="pill-row" style={{ marginTop: 8 }}>
          {Array.from(daysWithData)
            .sort((a, b) => a - b)
            .map((d) => (
              <button
                key={d}
                type="button"
                className={`pill ${selectedDay === d ? 'pill--active' : ''}`}
                onClick={() => selectDay(d)}
              >
                {d}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
