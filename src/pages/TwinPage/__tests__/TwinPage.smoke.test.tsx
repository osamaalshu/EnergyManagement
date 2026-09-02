import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TwinPage from '../TwinPage';

describe('TwinPage', () => {
  it('renders the monitor, replays an hour, and opens array details', () => {
    render(<TwinPage crumbs={[]} onOpenAnalytics={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Solar + storage monitor' })).toBeInTheDocument();
    for (const label of ['Measured', 'Worked out', 'Simulated', 'No data']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    // Noon of the recorded day: 202.9 kW of solar in the dataset.
    const solar = screen.getAllByText('Solar')[0].closest('div')?.parentElement as HTMLElement;
    expect(within(solar).getByText('203 kW')).toBeInTheDocument();

    // Midnight: nothing from the sun.
    fireEvent.change(screen.getByRole('slider', { name: 'Hour of the day' }), { target: { value: '0' } });
    expect(within(solar).getByText('0 kW')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Array 1 (A1)' }));
    expect(screen.getByText('A1', { selector: 'p' })).toBeInTheDocument();
  });
});
