import { createRouter } from '@tanstack/react-router';

import { dayNodeRoute } from './routes/dayNodeRoute';
import { dayRoute } from './routes/dayRoute';
import { indexRoute } from './routes/indexRoute';
import { rootRoute } from './routes/rootRoute';

const routeTree = rootRoute.addChildren([indexRoute, dayRoute, dayNodeRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
