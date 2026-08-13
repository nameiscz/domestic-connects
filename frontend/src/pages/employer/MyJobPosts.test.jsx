import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import MyJobPosts from './MyJobPosts';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 5, name: 'Mark', role: 'EMPLOYER' };

const JOBS = [
  {
    id: 1,
    title: 'Household Helper',
    description: 'Daily cleaning and cooking for a family.',
    employerId: 5,
    wagePerDay: 500,
    location: 'Bengaluru, Karnataka',
    status: 'OPEN',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 2,
    title: 'Gardener',
    description: 'Weekly gardening.',
    employerId: 7,
    wagePerDay: 400,
    location: 'Mysuru, Karnataka',
    status: 'OPEN',
    createdAt: '2026-08-02T10:00:00Z',
  },
  {
    id: 3,
    title: 'Cook',
    description: 'Evening meal preparation.',
    employerId: 5,
    wagePerDay: 600,
    location: 'Pune, Maharashtra',
    status: 'ASSIGNED',
    createdAt: '2026-08-03T10:00:00Z',
  },
];

const WORKERS = [
  {
    id: 11,
    name: 'Ana',
    email: 'ana@example.com',
    role: 'WORKER',
    active: true,
  },
  {
    id: 12,
    name: 'Ben',
    email: 'ben@example.com',
    role: 'WORKER',
    active: true,
  },
];

function EditStub() {
  const { id } = useParams();
  return <div>Edit Job {id}</div>;
}

const renderMyJobs = () =>
  render(
    <MemoryRouter
      initialEntries={['/employer/jobs']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/employer/jobs" element={<MyJobPosts />} />
        <Route path="/employer/jobs/edit/:id" element={<EditStub />} />
        <Route path="/employer/jobs/new" element={<div>Post Job Page</div>} />
      </Routes>
    </MemoryRouter>
  );

const findRowFor = async (title) => {
  const cell = await screen.findByText(title);
  return cell.closest('tr');
};

describe('MyJobPosts', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: CURRENT_USER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.delete.mockReset();
    // Per-URL mock: /api/jobs returns the job list, /api/auth/workers returns
    // the worker pool (wrapped in the auth-service ApiResponse envelope).
    axiosInstance.get.mockImplementation((url) => {
      if (url === '/api/auth/workers') {
        return Promise.resolve({ data: { data: WORKERS } });
      }
      return Promise.resolve({ data: JOBS });
    });
  });

  it('shows a spinner while fetching, then renders the table', async () => {
    let resolveGet;
    axiosInstance.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        })
    );
    renderMyJobs();

    expect(screen.getByTestId('myjobs-loading')).toBeInTheDocument();

    await act(async () => {
      resolveGet({ data: JOBS });
    });

    expect(await screen.findByText('Household Helper')).toBeInTheDocument();
    expect(screen.queryByTestId('myjobs-loading')).not.toBeInTheDocument();
  });

  it('lists only the logged-in employer’s jobs, newest first', async () => {
    renderMyJobs();

    expect(await screen.findByText('Household Helper')).toBeInTheDocument();
    expect(screen.getByText('Cook')).toBeInTheDocument();
    // Another employer's job is filtered out.
    expect(screen.queryByText('Gardener')).not.toBeInTheDocument();

    // Header row + body rows; Cook (Aug 03) sorts above Household Helper (Aug 01).
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Cook');
    expect(rows[2]).toHaveTextContent('Household Helper');
  });

  it('shows wage, location, status badge and posted date for each job', async () => {
    renderMyJobs();

    const row = await findRowFor('Household Helper');
    // \s? keeps the check tolerant of ICU locale formatting variants.
    expect(row).toHaveTextContent(/₹\s?500/);
    expect(row).toHaveTextContent('Bengaluru, Karnataka');
    expect(row).toHaveTextContent('Open');
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('navigates to the edit form when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderMyJobs();

    const row = await findRowFor('Household Helper');
    await user.click(within(row).getByRole('button', { name: /edit/i }));

    expect(await screen.findByText('Edit Job 1')).toBeInTheDocument();
  });

  it('opens a confirm modal, deletes on confirmation and removes the row', async () => {
    const user = userEvent.setup();
    axiosInstance.delete.mockResolvedValue({ data: { success: true, message: 'ok' } });
    renderMyJobs();

    const row = await findRowFor('Cook');
    await user.click(within(row).getByRole('button', { name: /delete/i }));

    // The confirmation modal names the job being deleted.
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent('Cook');

    await user.click(within(modal).getByRole('button', { name: /delete job/i }));

    expect(axiosInstance.delete).toHaveBeenCalledWith('/api/jobs/3');
    expect(await screen.findByText('"Cook" was deleted.')).toBeInTheDocument();
    expect(screen.queryByText('Cook')).not.toBeInTheDocument();
    expect(screen.getByText('Household Helper')).toBeInTheDocument();
    // The modal closes once the delete finishes.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not delete when the modal is cancelled', async () => {
    const user = userEvent.setup();
    renderMyJobs();

    const row = await findRowFor('Cook');
    await user.click(within(row).getByRole('button', { name: /delete/i }));

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /cancel/i }));

    expect(axiosInstance.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Cook')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the modal without deleting when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderMyJobs();

    const row = await findRowFor('Cook');
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(axiosInstance.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Cook')).toBeInTheDocument();
  });

  it('closes the modal without deleting when clicking outside the dialog', async () => {
    renderMyJobs();

    const row = await findRowFor('Cook');
    const user = userEvent.setup();
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    await screen.findByRole('dialog');

    // mousedown directly on the modal shell simulates clicking the dimmed
    // area outside the dialog (target === currentTarget closes the modal).
    fireEvent.mouseDown(screen.getByRole('dialog'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(axiosInstance.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Cook')).toBeInTheDocument();
  });

  it('keeps the row and shows an error toast when DELETE fails', async () => {
    const user = userEvent.setup();
    axiosInstance.delete.mockRejectedValue({
      response: { data: { message: 'Cannot delete an assigned job' } },
    });
    renderMyJobs();

    const row = await findRowFor('Cook');
    await user.click(within(row).getByRole('button', { name: /delete/i }));

    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /delete job/i }));

    expect(await screen.findByText('Cannot delete an assigned job')).toBeInTheDocument();
    expect(screen.getByText('Cook')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('assign worker flow', () => {
    it('only offers Assign for OPEN jobs', async () => {
      renderMyJobs();

      const openRow = await findRowFor('Household Helper'); // status OPEN
      const assignedRow = screen.getByText('Cook').closest('tr'); // status ASSIGNED

      expect(within(openRow).getByRole('button', { name: /^assign$/i })).toBeInTheDocument();
      expect(
        within(assignedRow).queryByRole('button', { name: /^assign$/i })
      ).not.toBeInTheDocument();
    });

    it('shows an error with retry when the worker list fails to load', async () => {
      const user = userEvent.setup();
      let workersCallCount = 0;
      axiosInstance.get.mockImplementation((url) => {
        if (url === '/api/auth/workers') {
          workersCallCount += 1;
          if (workersCallCount === 1) {
            return Promise.reject({
              response: { data: { message: 'Service unavailable' } },
            });
          }
          return Promise.resolve({ data: { data: WORKERS } });
        }
        return Promise.resolve({ data: JOBS });
      });
      renderMyJobs();

      const row = await findRowFor('Household Helper');
      await user.click(within(row).getByRole('button', { name: /assign/i }));

      const modal = await screen.findByRole('dialog');
      expect(await within(modal).findByText('Service unavailable')).toBeInTheDocument();

      // Retry recovers and loads the worker picker.
      await user.click(within(modal).getByRole('button', { name: /try again/i }));
      expect(await within(modal).findByLabelText('Worker')).toBeInTheDocument();
    });

    it('assigns a selected worker and marks the job ASSIGNED', async () => {
      const user = userEvent.setup();
      axiosInstance.post.mockResolvedValue({ data: { id: 1, status: 'ASSIGNED' } });
      renderMyJobs();

      const row = await findRowFor('Household Helper');
      await user.click(within(row).getByRole('button', { name: /assign/i }));

      const modal = await screen.findByRole('dialog');
      await user.selectOptions(await within(modal).findByLabelText('Worker'), '11');
      await user.click(within(modal).getByRole('button', { name: /assign worker/i }));

      expect(axiosInstance.post).toHaveBeenCalledWith('/api/jobs/1/assign/11');
      expect(
        await screen.findByText(/Worker assigned to "Household Helper"/)
      ).toBeInTheDocument();
      expect(within(row).getByText('Assigned')).toBeInTheDocument();
      // The Assign action disappears once the job is no longer OPEN.
      expect(
        within(row).queryByRole('button', { name: /^assign$/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the confirm button disabled until a worker is chosen', async () => {
      const user = userEvent.setup();
      renderMyJobs();

      const row = await findRowFor('Household Helper');
      await user.click(within(row).getByRole('button', { name: /assign/i }));

      const modal = await screen.findByRole('dialog');
      const confirm = within(modal).getByRole('button', { name: /assign worker/i });
      expect(confirm).toBeDisabled();

      await user.selectOptions(await within(modal).findByLabelText('Worker'), '12');
      expect(confirm).toBeEnabled();
    });

    it('does not assign when the modal is cancelled', async () => {
      const user = userEvent.setup();
      renderMyJobs();

      const row = await findRowFor('Household Helper');
      await user.click(within(row).getByRole('button', { name: /assign/i }));

      const modal = await screen.findByRole('dialog');
      await user.click(within(modal).getByRole('button', { name: /cancel/i }));

      expect(axiosInstance.post).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(row).getByRole('button', { name: /^assign$/i })).toBeInTheDocument();
    });

    it('keeps the modal open and shows an error toast when assignment fails', async () => {
      const user = userEvent.setup();
      axiosInstance.post.mockRejectedValue({
        response: {
          data: { message: 'Job 1 cannot be assigned: current status is ASSIGNED' },
        },
      });
      renderMyJobs();

      const row = await findRowFor('Household Helper');
      await user.click(within(row).getByRole('button', { name: /assign/i }));

      const modal = await screen.findByRole('dialog');
      await user.selectOptions(await within(modal).findByLabelText('Worker'), '11');
      await user.click(within(modal).getByRole('button', { name: /assign worker/i }));

      expect(
        await screen.findByText(/Job 1 cannot be assigned/)
      ).toBeInTheDocument();
      // The modal stays open so the employer can retry or cancel.
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows an error alert with retry when the fetch fails', async () => {
    const user = userEvent.setup();
    axiosInstance.get.mockRejectedValueOnce({
      response: { data: { message: 'Service unavailable' } },
    });
    renderMyJobs();

    expect(
      await screen.findByRole('heading', { name: /couldn't load your jobs/i })
    ).toBeInTheDocument();
    // Shown in both the inline alert and the error toast.
    expect(screen.getAllByText('Service unavailable').length).toBeGreaterThan(0);

    // Retry uses the default resolved mock from beforeEach.
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Household Helper')).toBeInTheDocument();
  });

  it('shows an empty state when the employer has no jobs', async () => {
    axiosInstance.get.mockResolvedValue({ data: [] });
    renderMyJobs();

    expect(await screen.findByText('No job posts yet')).toBeInTheDocument();
  });
});
