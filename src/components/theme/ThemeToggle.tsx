import React from 'react';
import { useTimeline } from '../../stores/TimelineStore';

export default function ThemeToggle() {
  const { state, dispatch } = useTimeline();
  const currentTheme = state.theme || 'dark';

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    if (newTheme !== currentTheme) {
      dispatch({ type: 'SET_THEME', theme: newTheme });
    }
  };

  return (
    <div className="theme-toggle-group" role="radiogroup" aria-label="Theme selector">
      <button
        type="button"
        className={`theme-toggle-btn ${currentTheme === 'dark' ? 'active' : ''}`}
        onClick={() => toggleTheme('dark')}
        role="radio"
        aria-checked={currentTheme === 'dark'}
        aria-label="Dark theme"
        title="Switch to Dark Theme"
      >
        <span className="theme-icon">🌙</span>
        <span className="theme-label">Dark</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${currentTheme === 'light' ? 'active' : ''}`}
        onClick={() => toggleTheme('light')}
        role="radio"
        aria-checked={currentTheme === 'light'}
        aria-label="Light theme"
        title="Switch to Light Theme"
      >
        <span className="theme-icon">☀️</span>
        <span className="theme-label">Light</span>
      </button>
    </div>
  );
}
