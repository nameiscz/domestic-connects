/**
 * StarRating — a clickable 1–5 star picker. Stars up to the chosen rating
 * are filled. Implemented as a radiogroup of buttons so it works with
 * keyboard and assistive tech without extra dependencies.
 *
 * Used by SubmitReview (rating field) and ManageReviews (edit modal).
 */
export default function StarRating({ value, onChange }) {
  return (
    <div className="d-inline-flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value >= n}
          aria-label={`Rate ${n} out of 5`}
          className={`btn btn-sm p-1 lh-1 fs-4 ${value >= n ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
