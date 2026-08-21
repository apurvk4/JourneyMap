import React from 'react';
import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../../components/theme/ThemeToggle';
import { TimelineProvider } from '../../stores/TimelineStore';

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'timeline_theme=; max-age=0; path=/';
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  it('syncs the stored theme to the document on initial render', () => {
    localStorage.setItem('timeline_theme', 'light');
    document.documentElement.setAttribute('data-theme', 'dark');

    render(
      <TimelineProvider>
        <ThemeToggle />
      </TimelineProvider>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('radio', { name: /light/i })).toHaveClass('active');
  });

  it('renders dark and light buttons and handles click', () => {
    render(
      <TimelineProvider>
        <ThemeToggle />
      </TimelineProvider>
    );

    const darkBtn = screen.getByRole('radio', { name: /dark/i });
    const lightBtn = screen.getByRole('radio', { name: /light/i });

    expect(darkBtn).toBeDefined();
    expect(lightBtn).toBeDefined();

    // Click light theme
    fireEvent.click(lightBtn);
    expect(lightBtn.classList.contains('active')).toBe(true);

    // Click dark theme
    fireEvent.click(darkBtn);
    expect(darkBtn.classList.contains('active')).toBe(true);
  });
});
