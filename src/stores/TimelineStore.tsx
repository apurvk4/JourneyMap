/* eslint-disable react-hooks/refs */
/**
 * Centralized application state using React Context.
 *
 * All UI components consume state from here instead of using
 * global DOM events. Large immutable data (TimelineData) lives in a ref
 * to avoid expensive re-renders on every state tick.
 */
import React, { createContext, useContext, useReducer, useRef, useCallback, useMemo } from 'react';
import type { TimelineData, TimelineSegment, DateRange, Stats, SegmentType } from '../core/model';
import { computeStatistics } from '../core/statistics';
import { saveTimeline, loadTimeline, clearTimeline } from '../core/storage';
import { applyStoredTheme, getStoredTheme, setStoredTheme, type Theme } from '../core/theme';
import { clipSegmentToRange } from '../core/filter';

const PERSISTENCE_PREFERENCE_KEY = 'timeline_persistence_enabled';

function getStoragePreference(): boolean {
  try {
    return localStorage.getItem(PERSISTENCE_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setStoragePreference(enabled: boolean): void {
  try {
    localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private browsing; the app remains usable.
  }
}

// ─── State shape ─────────────────────────────────────────────────────
export interface AppState {
  /** Current loading status, empty when idle. */
  status: string;
  /** Whether timeline data has been loaded. */
  hasData: boolean;
  /** Selected date range filter. */
  dateRange: DateRange | null;
  /** Active activity-type filters (empty = show all). */
  activityTypes: Set<string>;
  segmentTypes: Set<SegmentType>;
  /** Currently selected segment ID for inspection. */
  selectedSegmentId: string | null;
  /** Active theme (dark or light). */
  theme: Theme;
  /** Replay state. */
  replay: {
    isPlaying: boolean;
    speed: number;
    follow: boolean;
    duration: number | null;
    progress: number;
  };
  storageEnabled: boolean;
}

const getInitialState = (): AppState => {
  const theme = getStoredTheme();
  applyStoredTheme(theme);

  return {
    status: '',
    hasData: false,
    dateRange: null,
    activityTypes: new Set(),
    segmentTypes: new Set(),
    selectedSegmentId: null,
    theme,
    replay: {
      isPlaying: false,
      speed: 1,
      follow: true,
      duration: null,
      progress: 0,
    },
    storageEnabled: getStoragePreference(),
  };
};

// ─── Actions ─────────────────────────────────────────────────────────
type Action =
  | { type: 'SET_STATUS'; status: string }
  | { type: 'SET_DATA_LOADED'; loaded: boolean }
  | { type: 'SET_DATE_RANGE'; range: DateRange | null }
  | { type: 'SET_ACTIVITY_TYPES'; types: Set<string> }
  | { type: 'TOGGLE_ACTIVITY_TYPE'; activityType: string }
  | { type: 'TOGGLE_SEGMENT_TYPE'; segmentType: SegmentType }
  | { type: 'SET_SEGMENT_TYPES'; segmentTypes: Set<SegmentType> }
  | { type: 'SELECT_SEGMENT'; id: string | null }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'SET_REPLAY'; partial: Partial<AppState['replay']> }
  | { type: 'SET_STORAGE_ENABLED'; enabled: boolean }
  | { type: 'RESET_FILTERS' }
  | { type: 'CLEAR_SAVED_DATA' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_DATA_LOADED':
      return { ...state, hasData: action.loaded };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.range };
    case 'SET_ACTIVITY_TYPES':
      return { ...state, activityTypes: action.types };
    case 'TOGGLE_ACTIVITY_TYPE': {
      const next = new Set(state.activityTypes);
      if (next.has(action.activityType)) next.delete(action.activityType);
      else next.add(action.activityType);
      return { ...state, activityTypes: next };
    }
    case 'TOGGLE_SEGMENT_TYPE': {
      const next = new Set(state.segmentTypes);
      if (next.has(action.segmentType)) next.delete(action.segmentType);
      else next.add(action.segmentType);
      return { ...state, segmentTypes: next };
    }
    case 'SET_SEGMENT_TYPES':
      return { ...state, segmentTypes: action.segmentTypes };
    case 'SELECT_SEGMENT':
      return { ...state, selectedSegmentId: action.id };
    case 'SET_THEME':
      setStoredTheme(action.theme);
      return { ...state, theme: action.theme };
    case 'SET_REPLAY':
      return { ...state, replay: { ...state.replay, ...action.partial } };
    case 'SET_STORAGE_ENABLED':
      setStoragePreference(action.enabled);
      return { ...state, storageEnabled: action.enabled };
    case 'RESET_FILTERS':
      return { ...state, dateRange: null, activityTypes: new Set(), segmentTypes: new Set(), selectedSegmentId: null };
    case 'CLEAR_SAVED_DATA':
      clearTimeline('current').catch(() => {});
      return state;
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────
interface TimelineContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** The full timeline data ref (not in reactive state to avoid re-renders). */
  timelineRef: React.MutableRefObject<TimelineData | null>;
  /** Set timeline data after parsing. */
  setTimeline: (data: TimelineData | null) => void;
  setStorageEnabled: (enabled: boolean) => void;
  clearStoredTimeline: () => Promise<void>;
  /** Get currently filtered segments. */
  filteredSegments: TimelineSegment[];
  /** Stats for the currently filtered view. */
  stats: Stats | null;
  /** All unique activity types present in the data. */
  allActivityTypes: string[];
  /** All years present in the data. */
  years: number[];
  segmentsByYear: Record<number, TimelineSegment[]>;
  totalPointCount: number;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const timelineRef = useRef<TimelineData | null>(null);
  // We use a counter to force re-render when timeline data changes
  const [, setVersion] = React.useState(0);

  React.useEffect(() => {
    setStoredTheme(state.theme);
  }, [state.theme]);

  React.useEffect(() => {
    if (!state.storageEnabled) return;
    loadTimeline('current').then(data => {
      if (data) {
        timelineRef.current = data as TimelineData;
        dispatch({ type: 'SET_DATA_LOADED', loaded: true });
        dispatch({ type: 'SET_STATUS', status: 'Restored from cache' });
        setVersion(v => v + 1);
      }
    }).catch(() => {});
  }, [state.storageEnabled]);

  const setTimeline = useCallback(
    (data: TimelineData | null) => {
      timelineRef.current = data;
      dispatch({ type: 'SET_DATA_LOADED', loaded: data !== null });
      dispatch({ type: 'RESET_FILTERS' });
      setVersion((v) => v + 1);
      if (data && state.storageEnabled) {
        saveTimeline('current', data).catch(() => {});
      } else if (!state.storageEnabled) {
        clearTimeline('current').catch(() => {});
      }
    },
    [state.storageEnabled],
  );

  const setStorageEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_STORAGE_ENABLED', enabled });
    if (!enabled) clearTimeline('current').catch(() => {});
    else if (timelineRef.current) saveTimeline('current', timelineRef.current).catch(() => {});
  }, []);

  const clearStoredTimeline = useCallback(async () => {
    await clearTimeline('current');
  }, []);

  const filteredSegments = useMemo(() => {
    const data = timelineRef.current;
    if (!data) return [];

    let segs = data.segments;

    // Date range filter
    if (state.dateRange) {
      const { start, end } = state.dateRange;
      segs = segs.flatMap((s) => {
        // A segment overlaps the range if it starts before range end and ends after range start
        const clipped = s.startTime <= end && s.endTime >= start
          ? clipSegmentToRange(s, { start, end })
          : null;
        return clipped ? [clipped] : [];
      });
    }

    // Activity type filter
    if (state.activityTypes.size > 0) {
      segs = segs.filter((s) => {
        if (s.type === 'visit') return state.activityTypes.has('VISIT');
        return state.activityTypes.has(s.activity?.type ?? 'UNKNOWN');
      });
    }

    if (state.segmentTypes.size > 0) {
      segs = segs.filter((segment) => state.segmentTypes.has(segment.type));
    }

    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dateRange, state.activityTypes, state.segmentTypes, state.hasData]);

  const stats = useMemo(() => {
    if (filteredSegments.length === 0) return null;
    return computeStatistics({
      segments: filteredSegments,
      dateRange: timelineRef.current?.dateRange ?? { start: 0, end: 0 },
      totalPoints: filteredSegments.reduce((sum, s) => sum + s.points.length, 0),
    });
  }, [filteredSegments]);

  const allActivityTypes = useMemo(() => {
    const data = timelineRef.current;
    if (!data) return [];
    const types = new Set<string>();
    for (const s of data.segments) {
      if (s.type === 'visit') {
        types.add('VISIT');
      } else {
        types.add(s.activity?.type ?? 'UNKNOWN');
      }
    }
    return Array.from(types).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hasData]);

  const segmentsByYear = useMemo(() => {
    const data = timelineRef.current;
    if (!data) return {};
    const grouped: Record<number, TimelineSegment[]> = {};
    for (const s of filteredSegments) {
      const y = new Date(s.startTime).getFullYear();
      if (!grouped[y]) grouped[y] = [];
      grouped[y].push(s);
    }
    return grouped;
  }, [filteredSegments]);

  const totalPointCount = useMemo(() => {
    return filteredSegments.reduce((sum, s) => sum + s.points.length, 0);
  }, [filteredSegments]);

  const years = useMemo(() => {
    const data = timelineRef.current;
    if (!data) return [];
    const set = new Set<number>();
    for (const s of data.segments) set.add(new Date(s.startTime).getFullYear());
    return Array.from(set).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hasData]);

  const value: TimelineContextValue = {
    state,
    dispatch,
    timelineRef,
    setTimeline,
    setStorageEnabled,
    clearStoredTimeline,
    filteredSegments,
    stats,
    allActivityTypes,
    years,
    segmentsByYear,
    totalPointCount,
  };

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineContextValue {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('useTimeline must be used within TimelineProvider');
  return ctx;
}
