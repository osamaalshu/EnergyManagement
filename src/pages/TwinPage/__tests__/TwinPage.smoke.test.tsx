import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TwinPage from '../TwinPage';

describe('TwinPage', () => {
  it('renders the default twin, opens array details, and switches presets', () => {
    render(<TwinPage crumbs={[]} onOpenAnalytics={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Digital twin' })).toBeInTheDocument();
    for (const label of [
      'Measured here',
      'Worked out, not measured here',
      'Estimated from a reference',
      'Simulated for the demo',
      'No data',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Array 1 (A1)' }));
    expect(screen.getByText('A1', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ground-mount plant' }));
    const stringsStat = screen.getByText('Strings').parentElement;
    expect(stringsStat).not.toBeNull();
    expect(within(stringsStat as HTMLElement).getByText('2,304')).toBeInTheDocument();
  });
});
