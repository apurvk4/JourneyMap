import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ReplayControls from '../../components/replay/ReplayControls';
import * as TimelineStore from '../../stores/TimelineStore';

vi.mock('../../stores/TimelineStore', () => ({
  useTimeline: vi.fn(),
}));

describe('ReplayControls Component', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.mocked(TimelineStore.useTimeline).mockReturnValue({
      state: { replay: { isPlaying: false, speed: 1, follow: true } },
      dispatch: mockDispatch,
      filteredSegments: [{ points: [{}, {}] }], // Mock at least one segment with points
    } as unknown as ReturnType<typeof TimelineStore.useTimeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders Play button when paused', () => {
    render(<ReplayControls />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('dispatches play action on click', () => {
    render(<ReplayControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_REPLAY',
      partial: { isPlaying: true }
    });
  });

  it('changes speed', () => {
    render(<ReplayControls />);
    const select = screen.getByLabelText('Speed');
    fireEvent.change(select, { target: { value: '2' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_REPLAY',
      partial: { speed: 2 }
    });
  });
});
