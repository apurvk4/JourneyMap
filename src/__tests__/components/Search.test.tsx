import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Search from '../../components/search/Search';
import * as TimelineStore from '../../stores/TimelineStore';

vi.mock('../../stores/TimelineStore', () => ({
  useTimeline: vi.fn(),
}));

describe('Search Component', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.mocked(TimelineStore.useTimeline).mockReturnValue({
      timelineRef: {
        current: {
          segments: [
            { id: '1', place: { name: 'Eiffel Tower', address: '', semanticType: '' } },
            { id: '2', place: { name: 'Louvre Museum', address: '', semanticType: '' } },
          ]
        }
      },
      dispatch: mockDispatch,
    } as unknown as ReturnType<typeof TimelineStore.useTimeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input', () => {
    render(<Search />);
    expect(screen.getByPlaceholderText(/Search places/i)).toBeInTheDocument();
  });

  it('shows results and dispatches on click', () => {
    render(<Search />);
    const input = screen.getByPlaceholderText(/Search places/i);
    fireEvent.change(input, { target: { value: 'eiffel' } });
    
    const result = screen.getByText('Eiffel Tower');
    expect(result).toBeInTheDocument();
    
    fireEvent.click(result);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SELECT_SEGMENT',
      id: '1'
    });
  });
});
