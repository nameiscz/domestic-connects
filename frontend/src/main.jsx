import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
// Bootstrap JS powers interactive components used by the app, e.g. the
// collapsible navbar menu on small screens.
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
