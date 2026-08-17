import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardChart from './DashboardChart';

describe('DashboardChart', () => {
  it('renders the title and the chart content', () => {
    render(
      <DashboardChart title="Users by role">
        <div data-testid="chart">chart content</div>
      </DashboardChart>
    );

    expect(screen.getByText('Users by role')).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });

  it('shows the empty message instead of the content when emptyMessage is set', () => {
    render(
      <DashboardChart title="Attendance" emptyMessage="No attendance data yet.">
        <div data-testid="chart">chart content</div>
      </DashboardChart>
    );

    expect(screen.getByText('No attendance data yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  it('applies bodyClassName to the card body', () => {
    const { container } = render(
      <DashboardChart title="Rating" bodyClassName="d-flex flex-column justify-content-center">
        content
      </DashboardChart>
    );

    const body = container.querySelector('.card-body');
    expect(body).toBeInTheDocument();
    expect(body).toHaveClass('d-flex', 'flex-column', 'justify-content-center');
    // Sits on a 2-column grid slot like the other dashboard cards.
    expect(body!.closest('.col-lg-6')).not.toBeNull();
  });
});
