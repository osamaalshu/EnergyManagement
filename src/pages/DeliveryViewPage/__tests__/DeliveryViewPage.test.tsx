import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DeliveryViewPage from '../DeliveryViewPage';

describe('DeliveryViewPage', () => {
  it('renders Decide content first and hides finish-window proof until drawer expansion', () => {
    const { container } = render(<DeliveryViewPage onBack={() => undefined} />);
    const view = within(container);

    expect(view.getAllByText('Orders at risk').length).toBeGreaterThan(0);
    expect(view.getByText('Worst lateness')).toBeInTheDocument();
    expect(view.getByText('Finish window (P80)')).toBeInTheDocument();
    expect(view.getByText('Recommended changes')).toBeInTheDocument();
    expect(container.textContent!.indexOf('Recommended changes')).toBeLessThan(container.textContent!.indexOf('Product'));

    expect(view.queryByText('Finish window — current way vs this plan')).not.toBeInTheDocument();

    const drawer = view.getByRole('button', { name: /Details & evidence/i });
    expect(drawer).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(drawer);

    expect(drawer).toHaveAttribute('aria-expanded', 'true');
    expect(view.getByText('Finish window — current way vs this plan')).toBeInTheDocument();
  });
});
