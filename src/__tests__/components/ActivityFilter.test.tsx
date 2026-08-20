import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ActivityFilter from '../../components/filters/ActivityFilter';
import * as TimelineStore from '../../stores/TimelineStore';

vi.mock('../../stores/TimelineStore', () => ({
  useTimeline: vi.fn(),
}));

describe('ActivityFilter Component', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.mocked(TimelineStore.useTimeline).mockReturnValue({
      state: { activityTypes: new Set() },
      dispatch: mockDispatch,
      allActivityTypes: ['IN_PASSENGER_VEHICLE', 'VISIT', 'WALKING'],
    } as unknown as ReturnType<typeof TimelineStore.useTimeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all activity types', () => {
    render(<ActivityFilter />);
    expect(screen.getByText('IN_PASSENGER_VEHICLE')).toBeInTheDocument();
    expect(screen.getByText('VISIT')).toBeInTheDocument();
    expect(screen.getByText('Walking')).toBeInTheDocument();
  });

  it('dispatches TOGGLE_ACTIVITY_TYPE when an activity is clicked', () => {
    render(<ActivityFilter />);
    fireEvent.click(screen.getByText('Walking'));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_ACTIVITY_TYPE',
      activityType: 'WALKING'
    });
  });
});
