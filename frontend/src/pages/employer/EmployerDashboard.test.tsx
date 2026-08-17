import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EmployerDashboard from './EmployerDashboard';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 5, name: 'Mark', role: 'EMPLOYER' };

const JOBS = [
  { id: 1, title: 'Cook', employerId: 5, wagePerDay: 600, status: 'ASSIGNED', workerId: 11 },
  { id: 2, title: 'Driver', employerId: 5, wagePerDay: 700, status: 'ASSIGNED', workerId: 12 },
  { id: 3, title: 'Open Helper', employerId: 5, wagePerDay: 500, status: 'OPEN', workerId: null },
  { id: 4, title: 'Other Employer', employerId: 9, wagePerDay: 400, status: 'ASSIGNED', workerId: 99 },
];

const WORKERS = [
  { id: 11, name: 'Ana', email: 'ana@example.com', role: 'WORKER', active: true },
  { id: 12, name: 'Ben', email: 'ben@example.com', role: 'WORKER', active: true },
];

const PERF: Record<number, { workerId: number; reviewCount: number; averageRating: number | null }> = {
  11: { workerId: 11, reviewCount: 3, averageRating: 4.5 },
  12: { workerId: 12, reviewCount: 0, averageRating: null },
};

const renderPage = (currentUser: typeof CURRENT_USER | null = CURRENT_USER) => {
  useAuth.mockReturnValue({ currentUser });
  return render(
    <MemoryRouter initialEntries={['/employer']}>
      <Routes>
        <Route path="/employer" element={<EmployerDashboard />} />
      </Routes>
    </MemoryRouter>
  );
};

// Default mock: jobs, the worker directory, and per-worker performance.
const mockData = ({ jobs = JOBS, workers = WORKERS }: { jobs?: typeof JOBS; workers?: typeof WORKERS } = {}) => {
  axiosInstance.get.mockImplementation((url: string) => {
    if (url === '/api/jobs') return Promise.resolve({ data: jobs });
    if (url === '/api/auth/workers') {
      return Promise.resolve({ data: { data: workers } });
    }
    const match = /\/api\/performance\/worker\/(\d+)/.exec(url);
    if (match && PERF[Number(match[1])]) {
      return Promise.resolve({ data: PERF[Number(match[1])] });
    }
    return Promise.resolve({ data: [] });
  });
};

describe('EmployerDashboard', () => {
  beforeEach(() => {
    useAuth.mockReset();
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
    mockData();
  });

  it('renders the pooled rating card and the per-worker breakdown', async () => {
    renderPage();

    // Pooled card: Ana is the only rated worker (4.5).
    expect(await screen.findByText('4.50 / 5')).toBeInTheDocument();
    expect(screen.getByText('3 reviews across 2 workers')).toBeInTheDocument();

    // Breakdown rows with names, ratings and review counts.
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('4.5/5')).toBeInTheDocument();
    expect(screen.getByText('3 reviews')).toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getByText('0 reviews')).toBeInTheDocument();
  });

  it('shows an empty breakdown when the employer has no hired workers', async () => {
    mockData({ jobs: [JOBS[2]] }); // only an OPEN posting, nothing assigned
    renderPage();

    expect(
      await screen.findByText(/no hired workers yet/i)
    ).toBeInTheDocument();
    // The card still renders with zeros.
    expect(screen.getByText('Avg. worker rating')).toBeInTheDocument();
    expect(screen.getAllByText('—')).not.toHaveLength(0);
  });

  it('keeps a worker row with an unavailable label when their report fails', async () => {
    axiosInstance.get.mockImplementation((url: string) => {
      if (url === '/api/jobs') return Promise.resolve({ data: JOBS });
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url === '/api/performance/worker/11') {
        return Promise.reject({ response: { data: { message: 'service down' } } });
      }
      if (url === '/api/performance/worker/12') {
        return Promise.resolve({ data: { workerId: 12, reviewCount: 2, averageRating: 4.0 } });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Ratings unavailable')).toBeInTheDocument();
    // Ben's report loaded fine and still shows.
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('2 reviews')).toBeInTheDocument();
  });

  it('shows a spinner while the dashboard loads', () => {
    axiosInstance.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('employer-dashboard-loading')).toBeInTheDocument();
  });

  it('shows an error with retry that recovers', async () => {
    const user = userEvent.setup();
    let calls = 0;
    axiosInstance.get.mockImplementation((url: string) => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ response: { data: { message: 'Dashboard unavailable' } } });
      }
      if (url === '/api/jobs') return Promise.resolve({ data: JOBS });
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      if (url.startsWith('/api/performance/worker/')) {
        const id = Number(url.split('/').pop());
        return Promise.resolve({ data: PERF[id] || { reviewCount: 0, averageRating: null } });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /couldn't load your dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Dashboard unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Worker rating breakdown')).toBeInTheDocument();
  });

  it('renders the job stat cards', async () => {
    renderPage();

    await screen.findByText('Worker rating breakdown');
    expect(screen.getByText('Active job posts')).toBeInTheDocument();
    expect(screen.getByText('Total job posts')).toBeInTheDocument();
    // "Workers hired" appears in the hero quick metrics and the stat card.
    expect(screen.getAllByText('Workers hired').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg. wage / day')).toBeInTheDocument();
    expect(screen.getByText('Avg. worker rating')).toBeInTheDocument();
    // Two assigned postings for employer 5 — the value appears in the hero
    // quick metrics and stat cards.
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('explains when the account id is missing', () => {
    renderPage(null);
    expect(screen.getByText(/account not recognised/i)).toBeInTheDocument();
  });

  it('renders quick actions and recent postings', async () => {
    renderPage();

    await screen.findByText('Worker rating breakdown');

    // Quick actions panel.
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    // "Post a job" appears in the hero CTA and the quick actions panel.
    screen.getAllByRole('link', { name: /post a job/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/employer/jobs/new');
    });
    screen.getAllByRole('link', { name: /mark attendance|attendance/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/employer/attendance');
    });

    // Recent postings shows the employer's own jobs.
    expect(screen.getByText('Recent postings')).toBeInTheDocument();
    expect(screen.getByText('Cook')).toBeInTheDocument();
    expect(screen.getByText('Open Helper')).toBeInTheDocument();
    // The other employer's job never appears.
    expect(screen.queryByText('Other Employer')).not.toBeInTheDocument();
  });
});
