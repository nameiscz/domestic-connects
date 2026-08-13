import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePageTitle } from '../constants/pageTitles';

const APP_NAME = 'Domestic Connects';

/**
 * Keeps the browser tab title in sync with the current route
 * ("<Page> · Domestic Connects", falling back to just the app name).
 * Rendered once inside the Router in App.jsx; routes without a known
 * title keep the generic app title.
 */
export default function PageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = resolvePageTitle(pathname);
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [pathname]);

  return null;
}
