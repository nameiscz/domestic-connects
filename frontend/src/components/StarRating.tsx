/**
 * StarRating — a clickable 1–5 star picker. Stars up to the chosen rating
 * are filled. Implemented as a radiogroup of buttons so it works with
 * keyboard and assistive tech without extra dependencies.
 *
 * Used by SubmitReview (rating field) and ManageReviews (edit modal).
 */

export interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Rate ${n} out of 5`}
            onClick={() => onChange(n)}
            className={[
              'flex h-10 w-10 items-center justify-center rounded-xl text-xl leading-none transition-all duration-150',
              'hover:scale-110 active:scale-95',
              active
                ? 'bg-marigold-100 text-marigold-600'
                : 'border border-line bg-white text-ink-soft hover:border-marigold-500/40 hover:text-marigold-600',
            ].join(' ')}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
