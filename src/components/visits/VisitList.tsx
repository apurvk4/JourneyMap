import React, { useMemo } from 'react';
import { useTimeline } from '../../stores/TimelineStore';
import { ACTIVITY_DISPLAY } from '../../core/model';
import { formatDistance, formatDuration } from '../../core/geo';
import type { TimelineSegment } from '../../core/model';

/** Group segments by day and display an itinerary-style list. */
export default function VisitList() {
  const { filteredSegments, state, dispatch } = useTimeline();

  const grouped = useMemo(() => {
    const groups: Array<{ date: string; segments: TimelineSegment[] }> = [];
    let currentDate = '';
    let currentGroup: TimelineSegment[] = [];

    for (const seg of filteredSegments) {
      const day = new Date(seg.startTime).toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      if (day !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, segments: currentGroup });
        }
        currentDate = day;
        currentGroup = [seg];
      } else {
        currentGroup.push(seg);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, segments: currentGroup });
    }

    return groups;
  }, [filteredSegments]);

  if (grouped.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Timeline</h3>
        <div className="text-muted">No segments to display</div>
      </div>
    );
  }

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="card visit-list-card">
      <h3 className="card-title">Timeline</h3>
      <div className="visit-list-scroll" role="list">
        {grouped.map((group) => (
          <div key={group.date} className="visit-group">
            <div className="visit-group-date">{group.date}</div>
            {group.segments.map((seg) => {
              const isSelected = state.selectedSegmentId === seg.id;
              const isVisit = seg.type === 'visit';
              const display = isVisit
                ? { color: '#f59e0b', label: seg.place?.name ?? 'Visit' }
                : ACTIVITY_DISPLAY[seg.activity?.type ?? 'UNKNOWN'] ?? {
                    color: '#64748b',
                    label: seg.activity?.type ?? 'Route',
                  };

              return (
                <div
                  key={seg.id}
                  className={`visit-item ${isSelected ? 'visit-item--selected' : ''}`}
                  onClick={() =>
                    dispatch({
                      type: 'SELECT_SEGMENT',
                      id: isSelected ? null : seg.id,
                    })
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${display.label} ${formatTime(seg.startTime)} to ${formatTime(seg.endTime)}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      dispatch({
                        type: 'SELECT_SEGMENT',
                        id: isSelected ? null : seg.id,
                      });
                  }}
                >
                  <div className="visit-item-icon">
                    <span
                      className="activity-color-dot activity-color-dot--lg"
                      style={{ backgroundColor: display.color }}
                    />
                  </div>
                  <div className="visit-item-content">
                    <div className="visit-item-title">{display.label}</div>
                    <div className="visit-item-meta">
                      {formatTime(seg.startTime)} — {formatTime(seg.endTime)}
                      <span className="visit-item-sep">·</span>
                      {formatDuration(seg.durationMs)}
                      {seg.distanceMeters > 0 && (
                        <>
                          <span className="visit-item-sep">·</span>
                          {formatDistance(seg.distanceMeters)}
                        </>
                      )}
                    </div>
                    {/* Show place details when selected */}
                    {isSelected && isVisit && seg.place && (
                      <div className="visit-item-detail">
                        {seg.place.address && (
                          <div className="text-muted text-xs">{seg.place.address}</div>
                        )}
                        {seg.place.semanticType && (
                          <div className="text-muted text-xs">
                            {seg.place.semanticType.replace('TYPE_', '').replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                    )}
                    {isSelected && !isVisit && (
                      <div className="visit-item-detail text-muted text-xs">
                        <div>Start: {seg.start.latitude.toFixed(5)}, {seg.start.longitude.toFixed(5)}</div>
                        <div>End: {seg.end.latitude.toFixed(5)}, {seg.end.longitude.toFixed(5)}</div>
                        <div>{seg.activity?.type ?? 'Unknown activity'} · {formatDistance(seg.distanceMeters)} · {formatDuration(seg.durationMs)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
