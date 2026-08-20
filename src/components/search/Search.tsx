/* eslint-disable react-hooks/refs */
import React, { useMemo, useState } from 'react';
import { useTimeline } from '../../stores/TimelineStore';

function getSegmentSearchName(s: { id: string; type?: string; place?: { name?: string; semanticType?: string }; activity?: { type?: string } }): string {
  if (s.place?.name) return s.place.name;
  if (s.place?.semanticType) {
    return s.place.semanticType
      .replace(/^TYPE_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (s.activity?.type) {
    return s.activity.type
      .replace(/^IN_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s.type === 'visit' ? 'Visit' : 'Route';
}

/** Local search over the user's timeline places and segments. */
export default function Search() {
  const { timelineRef, dispatch } = useTimeline();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const data = timelineRef.current;
    if (!data || query.trim().length < 2) return [];

    const q = query.toLowerCase().trim();
    const matches: Array<{
      segmentId: string;
      name: string;
      type: string;
      count: number;
    }> = [];

    // Group by place name
    const placeMap = new Map<string, { segmentId: string; count: number }>();

    for (const s of data.segments) {
      const name = getSegmentSearchName(s);
      const rawName = s.place?.name ?? s.activity?.type ?? '';
      const addr = s.place?.address ?? '';
      const semType = s.place?.semanticType ?? '';
      const searchable = `${name} ${rawName} ${addr} ${semType}`.toLowerCase();

      if (searchable.includes(q)) {
        const key = name || s.id;
        const existing = placeMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          placeMap.set(key, { segmentId: s.id, count: 1 });
        }
      }
    }

    for (const [name, { segmentId, count }] of placeMap) {
      matches.push({ segmentId, name, type: 'place', count });
    }

    return matches.slice(0, 20);
  }, [query, timelineRef]);

  return (
    <div className="card">
      <h3 className="card-title">Search</h3>
      <input
        type="search"
        className="search-input"
        placeholder="Search places, activities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search timeline"
      />
      {results.length > 0 && (
        <div className="search-results" role="listbox">
          {results.map((r) => (
            <div
              key={r.segmentId}
              className="search-result-item"
              onClick={() => dispatch({ type: 'SELECT_SEGMENT', id: r.segmentId })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  dispatch({ type: 'SELECT_SEGMENT', id: r.segmentId });
              }}
            >
              <div className="search-result-name">{r.name}</div>
              {r.count > 1 && (
                <div className="search-result-count text-muted text-xs">
                  {r.count} occurrence{r.count !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <div className="text-muted" style={{ padding: '8px 0' }}>
          No results found
        </div>
      )}
    </div>
  );
}
