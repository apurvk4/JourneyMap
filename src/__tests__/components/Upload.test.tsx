import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import Upload from '../../components/upload/Upload';
import * as TimelineStore from '../../stores/TimelineStore';

vi.mock('../../stores/TimelineStore', () => ({
  useTimeline: vi.fn(),
}));

describe('Upload Component', () => {
  const mockSetTimeline = vi.fn();

  beforeEach(() => {
    vi.mocked(TimelineStore.useTimeline).mockReturnValue({
      state: { hasData: false, status: '' },
      setTimeline: mockSetTimeline,
    } as unknown as ReturnType<typeof TimelineStore.useTimeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders landing page initially', () => {
    render(<Upload />);
    expect(screen.getByText('Timeline Visualizer')).toBeInTheDocument();
    expect(screen.getByText('Load demo data')).toBeInTheDocument();
  });

  it('loads demo data when clicked', () => {
    render(<Upload />);
    const demoBtn = screen.getByText('Load demo data');
    fireEvent.click(demoBtn);
    expect(mockSetTimeline).toHaveBeenCalled();
  });

  it('handles file drop', async () => {
    render(<Upload />);
    const dropzone = screen.getByRole('button', { name: /Drop your Timeline.json/i });
    const file = new File(['{}'], 'timeline.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
      await Promise.resolve();
    });
    expect(screen.getByText(/Reading file/i)).toBeInTheDocument();
  });
});
