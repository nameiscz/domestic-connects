export interface PlaceholderPageProps {
  title: string;
  description?: string;
}

/**
 * Lightweight placeholder for sections that already appear in the navbar but
 * don't have their own page yet (e.g. salary slips, performance). Swap this
 * out for a real page as those features land.
 */
export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="card shadow-sm">
      <div className="card-body text-center py-5">
        <p className="fs-4 mb-1" role="img" aria-hidden="true">
          🚧
        </p>
        <h5 className="card-title">{title}</h5>
        <p className="card-text text-muted mb-0">
          {description || 'This section is coming soon.'}
        </p>
      </div>
    </div>
  );
}
