import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
// App-wide custom styles (hover lifts, toast animation, reduced-motion).
import './index.css';
// Bootstrap JS powers interactive components used by the app, e.g. the
// collapsible navbar menu on small screens.
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
