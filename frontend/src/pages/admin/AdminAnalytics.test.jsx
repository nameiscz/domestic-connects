import { beforeAll, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminAnalytics from './AdminAnalytics';

// Mock the axios instance so tests control every fetch directly.
const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

// recharts v3 sizes its charts by measuring DOM layout (ResizeObserver +
// getBoundingClientRect), which jsdom doesn't provide. Stub ResizeObserver
// as a no-op and emulate enough layout for the charts to render:
//  - SVG tick text and the hidden text-measurement span report a text-sized
//    box (axes then reserve sensible space instead of 0 or the chart height);
//  - the chart surface/container report a fixed 640x300 viewport;
//  - other HTML (legend, tooltip) report a small 640x24 box so the layout
//    doesn't reserve the whole chart height for them.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = ResizeObserverStub;

  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const rect = originalGetBoundingClientRect.call(this);
    if (rect.width > 0 && rect.height > 0) return rect;

    const text = this.textContent || '';
    const tag = this.tagName;
    if (tag === 'text' || tag === 'tspan' || this.id === 'recharts_measurement_span') {
      return { ...rect, width: text.length * 7 + 4, height: 14 };
    }

    const classes = ((this.getAttribute && this.getAttribute('class')) || '').split(/\s+/);
    if (classes.includes('recharts-wrapper') || classes.includes('recharts-responsive-container')) {
      return { ...rect, width: 640, height: 300 };
    }
    if (this instanceof HTMLElement) {
      return { ...rect, width: 640, height: 24 };
    }
    return rect;
  };
});

const ANALYTICS = {
  usersByRole: { ADMIN: 1, EMPLOYER: 2, WORKER: 10 },
  jobsByStatus: { OPEN: 4, ASSIGNED: 2, CLOSED: 1 },
  activeJobs: 6,
  inactiveJobs: 1,
  monthlyAttendanceRate: 87.5,
  averagePerformanceRating: 4.2,
  totalReviews: 24,
};

const renderPage = () => render(<AdminAnalytics />);

describe('AdminAnalytics', () => {
  beforeEach(() => {
    axiosInstance.get.mockReset();
    axiosInstance.get.mockResolvedValue({ data: { data: ANALYTICS } });
  });

  it('renders the four analytics cards with their metrics', async () => {
    renderPage();

    expect(await screen.findByText('Users by role')).toBeInTheDocument();
    expect(screen.getByText('Active vs inactive jobs')).toBeInTheDocument();
    expect(screen.getByText("This month's attendance rate")).toBeInTheDocument();
    expect(screen.getByText('Average performance rating')).toBeInTheDocument();

    expect(screen.getByText('87.5%')).toBeInTheDocument();
    expect(screen.getByText('4.20 / 5')).toBeInTheDocument();
    expect(screen.getByText('24 reviews across workers')).toBeInTheDocument();

    // Fetches with the current month as query param.
    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/admin/dashboard/analytics',
      expect.objectContaining({ params: { month: expect.any(String) } })
    );
  });

  it('lets the admin pick a previous month and refetches analytics for it', async () => {
    // Compute the previous month relative to the run date so the test stays
    // valid no matter when it executes.
    const now = new Date();
    const monthLabel = (d) =>
      d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const currentValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevValue = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const prevLabel = monthLabel(prev);

    axiosInstance.get.mockImplementation((_url, config) =>
      Promise.resolve({
        data: {
          data: {
            ...ANALYTICS,
            monthlyAttendanceRate: config?.params?.month === prevValue ? 62.5 : 87.5,
          },
        },
      })
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('87.5%')).toBeInTheDocument();

    // The selector lists the last 12 months and defaults to the current one.
    const selector = screen.getByLabelText(/analytics month/i);
    expect(selector.options.length).toBe(12);
    expect(selector.value).toBe(currentValue);
    expect(screen.getByRole('option', { name: prevLabel })).toBeInTheDocument();

    await user.selectOptions(selector, prevValue);

    // Refetches for the selected month and re-renders with its attendance.
    // The month label now appears in the option and the attendance card note,
    // so scope the query to the card note.
    expect(await screen.findByText('62.5%')).toBeInTheDocument();
    expect(
      screen.getByText(prevLabel, { selector: '.card .text-muted.small' })
    ).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/admin/dashboard/analytics',
      expect.objectContaining({ params: { month: prevValue } })
    );
  });

  it('renders the chart labels for roles and job statuses', async () => {
    renderPage();

    // Pie legend (users by role). Scoped selectors avoid recharts' hidden
    // text-measurement span, which can duplicate the same string.
    expect(
      await screen.findByText('Workers', { selector: '.recharts-legend-item-text' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Employers', { selector: '.recharts-legend-item-text' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Admins', { selector: '.recharts-legend-item-text' })
    ).toBeInTheDocument();

    // Bar chart x-axis ticks (active vs inactive jobs). The label text lives
    // in a <tspan> inside the SVG <text>, and testing-library's getByText
    // only reads direct text nodes — so match the <tspan>.
    expect(screen.getByText('Active', { selector: 'tspan' })).toBeInTheDocument();
    expect(screen.getByText('Inactive', { selector: 'tspan' })).toBeInTheDocument();
  });

  it('shows empty states when metrics are unavailable', async () => {
    axiosInstance.get.mockResolvedValue({
      data: { data: { usersByRole: {}, activeJobs: 0, inactiveJobs: 0 } },
    });
    renderPage();

    // Pie + bar cards both fall back to the empty placeholder.
    expect(await screen.findAllByText('No data yet.')).toHaveLength(2);
    expect(screen.getByText('No attendance data yet.')).toBeInTheDocument();
    expect(screen.getByText('No ratings yet.')).toBeInTheDocument();
  });

  it('shows an error with retry when analytics fail to load', async () => {
    let calls = 0;
    axiosInstance.get.mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({
          response: { data: { message: 'Admin service unavailable' } },
        });
      }
      return Promise.resolve({ data: { data: ANALYTICS } });
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Admin service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('87.5%')).toBeInTheDocument();
  });
});
