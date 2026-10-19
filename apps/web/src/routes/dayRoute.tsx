import { createRoute } from '@tanstack/react-router';

import { DayRoute } from '../features/day/DayRoute';
import { rootRoute } from './rootRoute';

/** Home screen: the day's map. */
export const dayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/day',
  component: DayRoute,
});
