import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetailsDrawer from '../DetailsDrawer';

describe('DetailsDrawer', () => {
  it('renders its title, hides children by default, and reveals them on click', () => {
    render(
      <DetailsDrawer title="Evidence">
        <p>Hidden proof</p>
      </DetailsDrawer>,
    );

    const button = screen.getByRole('button', { name: /Evidence/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hidden proof')).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hidden proof')).toBeInTheDocument();
  });

  it('respects defaultOpen', () => {
    render(
      <DetailsDrawer defaultOpen>
        <p>Visible proof</p>
      </DetailsDrawer>,
    );

    expect(screen.getByRole('button', { name: /Details & evidence/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Visible proof')).toBeInTheDocument();
  });
});
