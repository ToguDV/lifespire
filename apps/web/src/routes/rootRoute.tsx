import { createRootRoute, Outlet } from '@tanstack/react-router';

/** Root route: a plain outlet. The app shell (top bar) lives in the day screen. */
export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});
