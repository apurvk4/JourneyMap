import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../../components/theme/ThemeToggle';
import { TimelineProvider } from '../../stores/TimelineStore';

describe('ThemeToggle Component', () => {
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
