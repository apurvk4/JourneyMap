import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import DateFilter from '../../components/filters/DateFilter';
import * as TimelineStore from '../../stores/TimelineStore';

vi.mock('../../stores/TimelineStore', () => ({
  useTimeline: vi.fn(),
}));

describe('DateFilter Component', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.mocked(TimelineStore.useTimeline).mockReturnValue({
      state: { dateRange: null },
      dispatch: mockDispatch,
      years: [2022, 2023, 2024],
      timelineRef: { current: { segments: [] } },
    } as unknown as ReturnType<typeof TimelineStore.useTimeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders year pills based on data', () => {
    render(<DateFilter />);
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
  });

  it('dispatches SET_DATE_RANGE when a year is clicked', () => {
    render(<DateFilter />);
    fireEvent.click(screen.getByText('2023'));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_DATE_RANGE' })
    );
  });
});
