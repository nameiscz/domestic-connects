import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, IndianRupee, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { jobApi } from '../../api';
import { formatWageNumber } from '../../utils/jobFormat';
import { Button, Card, Input, Skeleton, Textarea } from '../../components/ui';
import type { CreateJobPayload } from '../../types';

/** Form state — wage is kept as a string so the input stays controlled. */
interface PostJobForm {
  title: string;
  description: string;
  wagePerDay: string;
  location: string;
}

type PostJobErrors = Partial<Record<keyof PostJobForm, string>>;

const EMPTY_FORM: PostJobForm = { title: '', description: '', wagePerDay: '', location: '' };

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-danger/20 border-l-4 border-l-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger-text"
    >
      {message}
    </div>
  );
}

/**
 * PostJob — create AND edit form for job posts.
 *
 * - Create: reached at /employer/jobs/new → POST /api/jobs
 * - Edit:   reached at /employer/jobs/edit/:id → GET + PUT /api/jobs/{id}
 *
 * Client-side validation mirrors the backend JobPostRequest rules:
 * title 3–150 chars, description 10–5000 chars, wagePerDay > 0,
 * location 2–150 chars. A live preview card shows how the posting reads
 * to workers as the employer types.
 */
export default function PostJob() {
  const { currentUser } = useAuth();
  const { id: jobIdParam } = useParams();
  const navigate = useNavigate();
  const jobId = jobIdParam ? Number(jobIdParam) : undefined;
  const isEdit = jobId !== undefined && Number.isFinite(jobId);

  const [form, setForm] = useState<PostJobForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<PostJobErrors>({});
  const [serverError, setServerError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // Edit mode: pre-fill the form from the existing job.
  useEffect(() => {
    if (!isEdit) return undefined;

    const controller = new AbortController();
    (async () => {
      try {
        const data = await jobApi.getJob(jobId as number, { signal: controller.signal });
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          wagePerDay: data.wagePerDay != null ? String(data.wagePerDay) : '',
          location: data.location ?? '',
        });
      } catch (err) {
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          setLoadError(
            (err as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Unable to load this job. It may have been deleted.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isEdit, jobId]);

  const handleChange = useCallback(
    (field: keyof PostJobForm, value: string) => {
      setForm((f) => ({ ...f, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [errors]
  );

  const validate = (): PostJobErrors => {
    const next: PostJobErrors = {};
    const title = form.title.trim();
    const description = form.description.trim();
    const location = form.location.trim();
    const wage = Number(form.wagePerDay);

    if (!title) {
      next.title = 'Title is required.';
    } else if (title.length < 3 || title.length > 150) {
      next.title = 'Title must be between 3 and 150 characters.';
    }

    if (!description) {
      next.description = 'Description is required.';
    } else if (description.length < 10) {
      next.description = 'Description must be at least 10 characters.';
    } else if (description.length > 5000) {
      next.description = 'Description must be 5000 characters or fewer.';
    }

    if (form.wagePerDay === '' || form.wagePerDay === null) {
      next.wagePerDay = 'Daily wage is required.';
    } else if (!Number.isFinite(wage) || wage <= 0) {
      next.wagePerDay = 'Daily wage must be greater than zero.';
    }

    if (!location) {
      next.location = 'Location is required.';
    } else if (location.length < 2 || location.length > 150) {
      next.location = 'Location must be between 2 and 150 characters.';
    }

    return next;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    if (!currentUser?.id) {
      setServerError('Unable to identify your account. Please sign in again.');
      return;
    }

    const payload: CreateJobPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      employerId: currentUser.id,
      wagePerDay: Number(form.wagePerDay),
      location: form.location.trim(),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await jobApi.updateJob(jobId as number, payload);
      } else {
        await jobApi.createJob(payload);
      }
      navigate('/employer/jobs');
    } catch (err) {
      setServerError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || `Unable to ${isEdit ? 'save changes' : 'post the job'}. Please try again.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="postjob-loading" className="mx-auto max-w-2xl">
        <Skeleton className="mb-4 h-7 w-48" />
        <Card className="space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-32" />
        </Card>
      </div>
    );
  }

  // Edit mode: the job could not be fetched (e.g. it was deleted) — show a
  // clear dead-end instead of a form that would PUT to a missing job.
  if (isEdit && loadError) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-danger/30 bg-danger-soft/40">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-display text-base font-semibold text-ink">
                Couldn&apos;t load this job
              </h4>
              <p className="mt-0.5 text-sm text-ink-soft">{loadError}</p>
            </div>
            <Link
              to="/employer/jobs"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back to my jobs
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const previewTitle = form.title.trim();
  const previewWage = Number(form.wagePerDay);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-ink">
          {isEdit ? 'Edit job' : 'Post a new job'}
        </h3>
        <Link
          to="/employer/jobs"
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-teal-500 hover:text-teal-700"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to my jobs
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <Card>
            {serverError && <ErrorBanner message={serverError} />}

            <form onSubmit={handleSubmit} noValidate>
              <Input
                id="title"
                name="title"
                type="text"
                label="Title"
                placeholder="e.g. Household Helper needed for a family of four"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && (v.length < 3 || v.length > 150)) {
                    setErrors((prev) => ({
                      ...prev,
                      title: 'Title must be between 3 and 150 characters.',
                    }));
                  }
                }}
                error={errors.title}
                maxLength={150}
                className="mb-4"
              />

              <Textarea
                id="description"
                name="description"
                label="Description"
                rows={6}
                placeholder="Describe the work, expectations, schedule and any special requirements…"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v.length < 10) {
                    setErrors((prev) => ({
                      ...prev,
                      description: 'Description must be at least 10 characters.',
                    }));
                  }
                }}
                error={errors.description}
                maxLength={5000}
                className="mb-4"
              />

              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <Input
                  id="wagePerDay"
                  name="wagePerDay"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  label="Wage per day (₹)"
                  placeholder="500"
                  value={form.wagePerDay}
                  onChange={(e) => handleChange('wagePerDay', e.target.value)}
                  onBlur={() => {
                    if (form.wagePerDay !== '') {
                      const wage = Number(form.wagePerDay);
                      if (!Number.isFinite(wage) || wage <= 0) {
                        setErrors((prev) => ({
                          ...prev,
                          wagePerDay: 'Daily wage must be greater than zero.',
                        }));
                      }
                    }
                  }}
                  error={errors.wagePerDay}
                />
                <Input
                  id="location"
                  name="location"
                  type="text"
                  label="Location"
                  placeholder="e.g. Bengaluru, Karnataka"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && (v.length < 2 || v.length > 150)) {
                      setErrors((prev) => ({
                        ...prev,
                        location: 'Location must be between 2 and 150 characters.',
                      }));
                    }
                  }}
                  error={errors.location}
                  maxLength={150}
                />
              </div>

              <Button type="submit" isLoading={submitting}>
                {submitting
                  ? isEdit
                    ? 'Saving…'
                    : 'Posting…'
                  : isEdit
                    ? 'Save changes'
                    : 'Post job'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Live preview — exactly what a worker sees */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Worker preview
          </p>
          <Card hover className="card flex h-full flex-col">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="font-display text-lg font-semibold leading-snug text-ink">
                {previewTitle || 'Job title appears here'}
              </h4>
              <span className="inline-flex flex-none items-center rounded-full border border-success/20 bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-text">
                Open
              </span>
            </div>
            <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">
              {form.description.trim() ||
                'Your description will appear here — tell workers about the work, schedule and expectations.'}
            </p>
            <div className="mt-auto border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-baseline gap-1.5 rounded-full bg-teal-100 px-3 py-1 font-display text-lg font-bold text-teal-700">
                  <IndianRupee
                    size={15}
                    strokeWidth={2.25}
                    className="self-center text-teal-700"
                    aria-hidden="true"
                  />
                  {Number.isFinite(previewWage) && previewWage > 0
                    ? formatWageNumber(previewWage)
                    : '—'}
                  <span className="font-sans text-xs font-semibold text-teal-700">/day</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  <MapPin size={13} aria-hidden="true" />
                  {form.location.trim() || 'Location'}
                </span>
              </div>
              <Button
                type="button"
                className="mt-4 w-full"
                disabled
                aria-disabled="true"
              >
                Apply
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
