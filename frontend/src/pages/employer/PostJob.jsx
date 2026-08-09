import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';

/**
 * PostJob — create AND edit form for job posts.
 *
 * - Create:    reached at /employer/jobs/new          → POST /api/jobs
 * - Edit:      reached at /employer/jobs/edit/:id     → GET + PUT /api/jobs/{id}
 *
 * Client-side validation mirrors the backend JobPostRequest rules:
 *   title 3–150 chars, description 10–5000 chars,
 *   wagePerDay > 0, location 2–150 chars.
 */
export default function PostJob() {
  const { currentUser } = useAuth();
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(jobId);

  const [form, setForm] = useState({
    title: '',
    description: '',
    wagePerDay: '',
    location: '',
  });
  const [errors, setErrors] = useState({});
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
        const { data } = await axiosInstance.get(`/api/jobs/${jobId}`, {
          signal: controller.signal,
        });
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          wagePerDay: data.wagePerDay ?? '',
          location: data.location ?? '',
        });
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED') {
          setLoadError(
            err.response?.data?.message || 'Unable to load this job. It may have been deleted.'
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isEdit, jobId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear the inline error for a field as soon as the user edits it.
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    if (!currentUser?.id) {
      setServerError('Unable to identify your account. Please sign in again.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      employerId: currentUser.id,
      wagePerDay: Number(form.wagePerDay),
      location: form.location.trim(),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`/api/jobs/${jobId}`, payload);
      } else {
        await axiosInstance.post('/api/jobs', payload);
      }
      navigate('/employer/jobs');
    } catch (err) {
      setServerError(
        err.response?.data?.message ||
          `Unable to ${isEdit ? 'save changes' : 'post the job'}. Please try again.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5" data-testid="postjob-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading job…</span>
        </div>
        <p className="text-muted mt-3 mb-0">Loading job details…</p>
      </div>
    );
  }

  // Edit mode: the job could not be fetched (e.g. it was deleted) — show a
  // clear dead-end instead of a form that would PUT to a missing job.
  if (isEdit && loadError) {
    return (
      <div className="row justify-content-center">
        <div className="col-lg-8 col-xl-7">
          <div className="alert alert-danger shadow-sm" role="alert">
            <h4 className="alert-heading h6">Couldn&apos;t load this job</h4>
            <p className="mb-2">{loadError}</p>
            <Link to="/employer/jobs" className="btn btn-outline-secondary btn-sm">
              ← Back to my jobs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8 col-xl-7">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="h5 mb-0">{isEdit ? 'Edit job' : 'Post a new job'}</h3>
          <Link to="/employer/jobs" className="btn btn-outline-secondary btn-sm">
            ← Back to my jobs
          </Link>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-4">
            {serverError && (
              <div className="alert alert-danger py-2" role="alert">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label htmlFor="title" className="form-label">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  className={`form-control ${errors.title ? 'is-invalid' : ''}`}
                  placeholder="e.g. Household Helper needed for a family of four"
                  value={form.title}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.title)}
                  maxLength={150}
                />
                {errors.title && <div className="invalid-feedback">{errors.title}</div>}
              </div>

              <div className="mb-3">
                <label htmlFor="description" className="form-label">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  className={`form-control ${errors.description ? 'is-invalid' : ''}`}
                  placeholder="Describe the work, expectations, schedule and any special requirements…"
                  value={form.description}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.description)}
                  maxLength={5000}
                />
                {errors.description && (
                  <div className="invalid-feedback">{errors.description}</div>
                )}
              </div>

              <div className="row g-3 mb-4">
                <div className="col-sm-5">
                  <label htmlFor="wagePerDay" className="form-label">
                    Wage per day (₹)
                  </label>
                  <input
                    id="wagePerDay"
                    name="wagePerDay"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className={`form-control ${errors.wagePerDay ? 'is-invalid' : ''}`}
                    placeholder="500"
                    value={form.wagePerDay}
                    onChange={handleChange}
                    aria-invalid={Boolean(errors.wagePerDay)}
                  />
                  {errors.wagePerDay && (
                    <div className="invalid-feedback">{errors.wagePerDay}</div>
                  )}
                </div>
                <div className="col-sm-7">
                  <label htmlFor="location" className="form-label">
                    Location
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    className={`form-control ${errors.location ? 'is-invalid' : ''}`}
                    placeholder="e.g. Bengaluru, Karnataka"
                    value={form.location}
                    onChange={handleChange}
                    aria-invalid={Boolean(errors.location)}
                    maxLength={150}
                  />
                  {errors.location && (
                    <div className="invalid-feedback">{errors.location}</div>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    {isEdit ? 'Saving…' : 'Posting…'}
                  </>
                ) : isEdit ? (
                  'Save changes'
                ) : (
                  'Post job'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
