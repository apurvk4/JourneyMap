import React from 'react';
import { useTimeline } from '../../stores/TimelineStore';
import { ACTIVITY_DISPLAY } from '../../core/model';

export default function ActivityFilter() {
  const { allActivityTypes, state, dispatch } = useTimeline();
  const segmentTypes = state.segmentTypes ?? new Set<'route' | 'visit'>();

  if (allActivityTypes.length === 0) return null;

  const isFiltering = state.activityTypes.size > 0 || segmentTypes.size > 0;

  const toggle = (type: string) => {
    dispatch({ type: 'TOGGLE_ACTIVITY_TYPE', activityType: type });
  };

  const showAll = () => {
    dispatch({ type: 'SET_ACTIVITY_TYPES', types: new Set() });
    dispatch({ type: 'SET_SEGMENT_TYPES', segmentTypes: new Set() });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Activities</h3>
        {isFiltering && (
          <button type="button" className="btn btn-xs btn-ghost" onClick={showAll}>
            Show all
          </button>
        )}
      </div>
      <div className="pill-row" style={{ marginBottom: 10 }} aria-label="Segment type filters">
        {(['route', 'visit'] as const).map((type) => {
          const isActive = segmentTypes.size === 0 || segmentTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              className={`pill ${isActive ? 'pill--active' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_SEGMENT_TYPE', segmentType: type })}
              aria-pressed={isActive}
            >
              {type === 'route' ? 'Routes' : 'Visits'}
            </button>
          );
        })}
      </div>
      <div className="activity-filter-list" role="group" aria-label="Activity type filters">
        {allActivityTypes.map((type) => {
          const display = ACTIVITY_DISPLAY[type] ?? { color: '#94a3b8', label: type };
          const isActive = !isFiltering || state.activityTypes.has(type);
          return (
            <label key={type} className={`activity-filter-item ${isActive ? '' : 'activity-filter-item--muted'}`}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => toggle(type)}
                aria-label={`Filter ${display.label}`}
              />
              <span
                className="activity-color-dot"
                style={{ backgroundColor: display.color }}
              />
              <span className="activity-filter-label">{display.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
