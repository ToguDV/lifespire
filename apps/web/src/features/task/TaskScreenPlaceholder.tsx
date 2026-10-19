import { useTranslation } from 'react-i18next';

/**
 * Placeholder for the task / timer / evidence screen.
 *
 * TODO(task-screen): replace with the real screen (M0, next step). It carries no
 * logic yet; it only proves the navigation target from the map exists.
 */
export function TaskScreenPlaceholder() {
  const { t } = useTranslation('node');

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-8 text-sm text-muted">
      {t('taskScreenPlaceholder')}
    </div>
  );
}
