import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="text-center">
        <h1 className="display-1 fw-bold text-primary">404</h1>
        <p className="lead text-muted">This page could not be found.</p>
        <Link to="/" className="btn btn-outline-primary mt-2">
          Back to home
        </Link>
      </div>
    </div>
  );
}
