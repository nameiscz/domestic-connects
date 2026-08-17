import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostJob from './PostJob';

// Mock auth context and axios instance so tests control both directly.
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth }));

const { default: axiosInstance } = vi.hoisted(() => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../api/axiosInstance', () => ({ default: axiosInstance }));

const CURRENT_USER = { id: 5, name: 'Mark', role: 'EMPLOYER' };

interface FillOverrides {
  title?: string;
  description?: string;
  wagePerDay?: number;
  location?: string;
}

const renderPostJob = (initialPath = '/employer/jobs/new') =>
  render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/employer/jobs/new" element={<PostJob />} />
        <Route path="/employer/jobs/edit/:id" element={<PostJob />} />
        <Route path="/employer/jobs" element={<div>My Job Posts Page</div>} />
      </Routes>
    </MemoryRouter>
  );

const fillJobForm = async (user: UserEvent, overrides: FillOverrides = {}) => {
  await user.type(
    screen.getByLabelText('Title'),
    overrides.title ?? 'Household Helper needed'
  );
  await user.type(
    screen.getByLabelText('Description'),
    overrides.description ??
      'Daily cleaning, cooking and errand support for a family of four in Bengaluru.'
  );
  await user.type(
    screen.getByLabelText(/wage per day/i),
    String(overrides.wagePerDay ?? 500)
  );
  await user.type(
    screen.getByLabelText('Location'),
    overrides.location ?? 'Bengaluru, Karnataka'
  );
};

const VALID_PAYLOAD = {
  title: 'Household Helper needed',
  description:
    'Daily cleaning, cooking and errand support for a family of four in Bengaluru.',
  employerId: 5,
  wagePerDay: 500,
  location: 'Bengaluru, Karnataka',
};

describe('PostJob', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ currentUser: CURRENT_USER });
    axiosInstance.get.mockReset();
    axiosInstance.post.mockReset();
    axiosInstance.put.mockReset();
    axiosInstance.delete.mockReset();
  });

  describe('create mode', () => {
    it('renders the job form fields and submit button', () => {
      renderPostJob();

      expect(
        screen.getByRole('heading', { name: /post a new job/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText(/wage per day/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Location')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /post job/i })).toBeInTheDocument();
    });

    it('shows inline errors and does not POST when submitting an empty form', async () => {
      const user = userEvent.setup();
      renderPostJob();

      await user.click(screen.getByRole('button', { name: /post job/i }));

      expect(await screen.findByText('Title is required.')).toBeInTheDocument();
      expect(screen.getByText('Description is required.')).toBeInTheDocument();
      expect(screen.getByText('Daily wage is required.')).toBeInTheDocument();
      expect(screen.getByText('Location is required.')).toBeInTheDocument();
      expect(axiosInstance.post).not.toHaveBeenCalled();
    });

    it('rejects out-of-range values (short title/description, zero wage)', async () => {
      const user = userEvent.setup();
      renderPostJob();

      await fillJobForm(user, { title: 'Hi', description: 'Too short', wagePerDay: 0 });
      await user.click(screen.getByRole('button', { name: /post job/i }));

      expect(
        await screen.findByText('Title must be between 3 and 150 characters.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Description must be at least 10 characters.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Daily wage must be greater than zero.')
      ).toBeInTheDocument();
      expect(axiosInstance.post).not.toHaveBeenCalled();
    });

    it('clears a field error as soon as the user edits that field', async () => {
      const user = userEvent.setup();
      renderPostJob();

      await user.click(screen.getByRole('button', { name: /post job/i }));
      expect(await screen.findByText('Title is required.')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Title'), 'H');
      expect(screen.queryByText('Title is required.')).not.toBeInTheDocument();
    });

    it('POSTs the job with the employer id and navigates to My Jobs on success', async () => {
      const user = userEvent.setup();
      axiosInstance.post.mockResolvedValue({
        data: { id: 1, ...VALID_PAYLOAD, status: 'OPEN' },
      });
      renderPostJob();

      await fillJobForm(user);
      await user.click(screen.getByRole('button', { name: /post job/i }));

      expect(await screen.findByText('My Job Posts Page')).toBeInTheDocument();
      expect(axiosInstance.post).toHaveBeenCalledWith('/api/jobs', VALID_PAYLOAD);
    });

    it('shows the backend message and stays on the page when POST fails', async () => {
      const user = userEvent.setup();
      axiosInstance.post.mockRejectedValue({
        response: { data: { message: 'Title must be between 3 and 150 characters' } },
      });
      renderPostJob();

      await fillJobForm(user);
      await user.click(screen.getByRole('button', { name: /post job/i }));

      expect(
        await screen.findByText('Title must be between 3 and 150 characters')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /post job/i })).toBeEnabled();
      expect(screen.queryByText('My Job Posts Page')).not.toBeInTheDocument();
    });

    it('disables the button and shows a spinner while the request is in flight', async () => {
      const user = userEvent.setup();
      let resolvePost: (value: unknown) => void;
      axiosInstance.post.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePost = resolve;
          })
      );
      renderPostJob();

      await fillJobForm(user);
      await user.click(screen.getByRole('button', { name: /post job/i }));

      const button = screen.getByRole('button', { name: /posting/i });
      expect(button).toBeDisabled();
      expect(axiosInstance.post).toHaveBeenCalledWith('/api/jobs', VALID_PAYLOAD);

      await act(async () => {
        resolvePost({ data: { id: 1, status: 'OPEN' } });
      });
      expect(await screen.findByText('My Job Posts Page')).toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('pre-fills the form from GET /api/jobs/:id and PUTs on save', async () => {
      const user = userEvent.setup();
      axiosInstance.get.mockResolvedValue({
        data: { id: 42, ...VALID_PAYLOAD, status: 'OPEN' },
      });
      axiosInstance.put.mockResolvedValue({
        data: { id: 42, ...VALID_PAYLOAD, status: 'OPEN' },
      });
      renderPostJob('/employer/jobs/edit/42');

      expect(
        await screen.findByDisplayValue('Household Helper needed')
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /edit job/i })).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Senior Household Helper needed');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(await screen.findByText('My Job Posts Page')).toBeInTheDocument();
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/api/jobs/42',
        expect.anything()
      );
      expect(axiosInstance.put).toHaveBeenCalledWith('/api/jobs/42', {
        ...VALID_PAYLOAD,
        title: 'Senior Household Helper needed',
      });
    });

    it('shows a spinner while the job is loading, then renders the form', async () => {
      let resolveGet: (value: unknown) => void;
      axiosInstance.get.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGet = resolve;
          })
      );
      renderPostJob('/employer/jobs/edit/42');

      expect(screen.getByTestId('postjob-loading')).toBeInTheDocument();

      await act(async () => {
        resolveGet({ data: { id: 42, ...VALID_PAYLOAD, status: 'OPEN' } });
      });

      expect(await screen.findByDisplayValue('Household Helper needed')).toBeInTheDocument();
      expect(screen.queryByTestId('postjob-loading')).not.toBeInTheDocument();
    });

    it('shows a dead-end alert instead of the form when the job cannot be loaded', async () => {
      axiosInstance.get.mockRejectedValue({
        response: { data: { message: 'JobPost not found with id: 42' } },
      });
      renderPostJob('/employer/jobs/edit/42');

      expect(
        await screen.findByRole('heading', { name: /couldn't load this job/i })
      ).toBeInTheDocument();
      expect(screen.getByText('JobPost not found with id: 42')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
      expect(axiosInstance.put).not.toHaveBeenCalled();
    });
  });
});
