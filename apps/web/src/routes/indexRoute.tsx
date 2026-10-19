import { createRoute, redirect } from '@tanstack/react-router';

import { rootRoute } from './rootRoute';

/** `/` opens today's run directly. */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/day' });
  },
});
