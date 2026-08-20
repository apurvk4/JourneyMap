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

function AppContent() {
  const { state } = useTimeline();

  // Landing / upload view
  if (!state.hasData) {
    return <Upload />;
  }

  // Main dashboard
  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">Timeline Visualizer</h1>
          <span className="header-privacy">🔒 Your data stays in your browser</span>
        </div>
        <div className="header-right">
          <ThemeToggle />
          <Upload />
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="main">
        {/* Sidebar */}
        <aside className="sidebar" aria-label="Timeline controls and information">
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
      </main>

      {/* Bottom bar */}
      <footer className="footer">
        <ReplayControls />
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <TimelineProvider>
      <AppContent />
    </TimelineProvider>
  );
}
