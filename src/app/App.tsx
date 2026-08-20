import React from 'react';
import { TimelineProvider, useTimeline } from '../stores/TimelineStore';
import Upload from '../components/upload/Upload';
import MapView from '../components/map/MapView';
import DateFilter from '../components/filters/DateFilter';
import ActivityFilter from '../components/filters/ActivityFilter';
import Statistics from '../components/statistics/Statistics';
import CalendarHeatmap from '../components/calendar/CalendarHeatmap';
import VisitList from '../components/visits/VisitList';
import ReplayControls from '../components/replay/ReplayControls';
import Search from '../components/search/Search';

import ThemeToggle from '../components/theme/ThemeToggle';
import demoData from '../sample/demo-timeline.json';
import { parseGoogleTimeline } from '../core/parser';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Map ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return (
      <div className="map-container" style={{ padding: '20px', backgroundColor: '#1e293b', color: '#f87171', overflow: 'auto' }}>
        <h3>Map Initialization Error</h3>
        <p>The map could not be displayed. Check your connection or reload the page.</p>
      </div>
    );
    return this.props.children;
  }
}

function AppContentInner({ drawerOpen, setDrawerOpen }: { drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  const { state, setTimeline, dispatch } = useTimeline();

  // Render header always so navbar items are available on landing and dashboard
  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button
            className="btn btn-ghost btn-sm mobile-drawer-toggle"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          {state.hasData ? <h1 className="header-title">Timeline Visualizer</h1> : null}
          <span className="header-privacy">🔒 Your data stays in your browser</span>
        </div>
        <div className="header-center">
          {state.status ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: 12 }}>{state.status}</span>
              {state.hasData ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTimeline(null)}>Clear timeline</button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="header-right">
          <ThemeToggle />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
            try {
              const actualData = (demoData as { default?: unknown }).default ?? demoData;
              const { data } = parseGoogleTimeline(actualData);
              setTimeline(data);
              // update global status so header-center shows message
              dispatch({ type: 'SET_STATUS', status: `Demo loaded — ${data.segments.length} segments` });
            } catch (e) {
              // ignore here; Upload handles errors in its UI
            }
          }} title="Load demo data">Demo</button>
          <button type="button" className="btn btn-ghost btn-sm header-clear-mobile" onClick={() => setTimeline(null)} style={{ display: 'none' }}>Clear timeline</button>
          {state.hasData ? <Upload /> : null}
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="main">
        {/* If no data, show upload landing */}
        {!state.hasData ? (
          <Upload />
        ) : (
          <>
            {/* Desktop sidebar (visible on larger screens) */}
            <aside className="sidebar desktop-sidebar" aria-label="Timeline controls and information">
              <Search />
              <DateFilter />
              <ActivityFilter />
              <Statistics />
              <CalendarHeatmap />
              <VisitList />
            </aside>

              {/* Map */}
              <div className="content">
                <ErrorBoundary>
                  <MapView />
                </ErrorBoundary>
            </div>

            {/* Mobile drawer overlay is rendered globally below so it works on landing and dashboard */}
          </>
        )}
        {/* Always-render mobile drawer/backdrop so it works on the landing page too */}
        {drawerOpen && (
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        )}
        <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`} role="dialog" aria-hidden={!drawerOpen}>
          {drawerOpen ? (
            <div className="mobile-drawer-inner">
              <div className="mobile-drawer-header">
                <h2 style={{ margin: 0 }}>Menu</h2>
                <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)} aria-label="Close menu">✕</button>
              </div>
              <div className="mobile-drawer-content">
                <Search />
                <DateFilter />
                <ActivityFilter />
                <Statistics />
                <CalendarHeatmap />
                <VisitList />
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="footer">
        <ReplayControls />
      </footer>
    </div>
  );
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <TimelineProvider>
      <AppContentInner drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
    </TimelineProvider>
  );
}
