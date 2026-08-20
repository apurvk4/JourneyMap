import React, { useMemo } from 'react';
import { useTimeline } from '../../stores/TimelineStore';
import { formatDistance, formatDuration } from '../../core/geo';
import { ACTIVITY_DISPLAY } from '../../core/model';

export default function Statistics() {
  const { stats, filteredSegments } = useTimeline();

  // Activity breakdown sorted by distance
  const breakdownEntries = useMemo(() => {
    return Object.entries(stats?.activityBreakdown ?? {})
      .filter(([type]) => type !== 'VISIT')
      .sort(([, a], [, b]) => b.distanceMeters - a.distanceMeters);
  }, [stats]);

  if (!stats || filteredSegments.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Statistics</h3>
        <div className="text-muted">No data to display</div>
      </div>
    );
  }

  const totalRouteDistance = breakdownEntries.reduce((sum, [, v]) => sum + v.distanceMeters, 0);

  return (
    <div className="card">
      <h3 className="card-title">Statistics</h3>

      {/* Summary grid */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{formatDistance(stats.totalDistanceMeters)}</div>
          <div className="stat-label">Total distance</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{formatDuration(stats.totalDurationMs)}</div>
          <div className="stat-label">Total duration</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.travelDays}</div>
          <div className="stat-label">Travel days</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.visitCount}</div>
          <div className="stat-label">Visits</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.routeCount}</div>
          <div className="stat-label">Routes</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.segments}</div>
          <div className="stat-label">Segments</div>
        </div>
      </div>

      {/* Activity breakdown */}
      {breakdownEntries.length > 0 && (
        <div className="stats-breakdown">
          <h4 className="stats-breakdown-title">Transport modes</h4>
          {breakdownEntries.map(([type, data]) => {
            const display = ACTIVITY_DISPLAY[type] ?? { color: '#94a3b8', label: type };
            const pct = totalRouteDistance > 0 ? (data.distanceMeters / totalRouteDistance) * 100 : 0;
            return (
              <div key={type} className="breakdown-row">
                <div className="breakdown-header">
                  <span
                    className="activity-color-dot"
                    style={{ backgroundColor: display.color }}
                  />
                  <span className="breakdown-label">{display.label}</span>
                  <span className="breakdown-pct">{pct.toFixed(0)}%</span>
                  <span className="breakdown-dist text-muted">
                    {formatDistance(data.distanceMeters)}
                  </span>
                </div>
                <div className="breakdown-bar-bg">
                  <div
                    className="breakdown-bar"
                    style={{ width: `${pct}%`, backgroundColor: display.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Year comparison */}
      {Object.keys(stats.yearlyStats).length > 1 && (
        <div className="stats-years">
          <h4 className="stats-breakdown-title">By year</h4>
          <table className="year-table">
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Distance</th>
                <th scope="col">Days</th>
                <th scope="col">Segments</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.yearlyStats)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([year, ys]) => (
                  <tr key={year}>
                    <td>{year}</td>
                    <td>{formatDistance(ys.distanceMeters)}</td>
                    <td>{ys.travelDays}</td>
                    <td>{ys.segments}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
