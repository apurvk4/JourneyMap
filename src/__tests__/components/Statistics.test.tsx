import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Statistics from '../../components/statistics/Statistics';
import * as TimelineStore from '../../stores/TimelineStore';

vi.mock('../../stores/TimelineStore', () => ({
  useTimeline: vi.fn(),
}));

describe('Statistics Component', () => {
  beforeEach(() => {
    vi.mocked(TimelineStore.useTimeline).mockReturnValue({
      filteredSegments: [{}], // Non-empty
      stats: {
        totalDistanceMeters: 5000,
        totalDurationMs: 3600000,
        travelDays: 1,
        visitCount: 2,
        routeCount: 3,
        segments: 4,
        activityBreakdown: {
          WALKING: { distanceMeters: 5000, durationMs: 3600000, count: 1 }
        },
        yearlyStats: {}
      }
    } as unknown as ReturnType<typeof TimelineStore.useTimeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats grid values', () => {
    render(<Statistics />);
    expect(screen.getAllByText('5.0 km')[0]).toBeInTheDocument(); // formatDistance output
    expect(screen.getByText('1')).toBeInTheDocument(); // travelDays
    expect(screen.getByText('2')).toBeInTheDocument(); // visitCount
    expect(screen.getByText('3')).toBeInTheDocument(); // routeCount
    expect(screen.getByText('4')).toBeInTheDocument(); // segments
  });
});
