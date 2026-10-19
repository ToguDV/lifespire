import { createRoute } from '@tanstack/react-router';

import { TaskScreenPlaceholder } from '../features/task/TaskScreenPlaceholder';
import { rootRoute } from './rootRoute';

/** `/day/$nodeId` — placeholder for the task screen (next M0 step). */
export const dayNodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/day/$nodeId',
  component: TaskScreenPlaceholder,
});
