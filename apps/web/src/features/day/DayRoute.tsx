import { useNavigate } from '@tanstack/react-router';

import { DayScreen } from './DayScreen';

/** Wires the day screen's navigation to the router (keeps `DayScreen` testable). */
export function DayRoute() {
  const navigate = useNavigate();

  return (
    <DayScreen
      onStartNode={(nodeId) => {
        void navigate({ to: '/day/$nodeId', params: { nodeId } });
      }}
    />
  );
}
