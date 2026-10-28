import { Button, Icon } from './index'
import type { IconName } from './index'
import { TUTORIAL_ORDER } from '../lib/tutorial'
import type { TutorialCardId } from '../lib/tutorial'

export interface TutorialDialogProps {
  card: TutorialCardId
  speaker?: string
  icon?: IconName
  title: string
  body: string
  primaryLabel: string
  onPrimary: () => void
  onHide: () => void
}

/**
 * Small floating RPG-style dialog card used as the in-game tutorial.
 * In-flow (never a modal overlay) so it cannot block map or node actions.
 */
export function TutorialDialog({
  card,
  speaker = 'Guide',
  icon = 'spire',
  title,
  body,
  primaryLabel,
  onPrimary,
  onHide,
}: TutorialDialogProps) {
  const step = TUTORIAL_ORDER.indexOf(card) + 1
  const total = TUTORIAL_ORDER.length
  return (
    <aside className="tutorial-dialog" aria-label={`Tutorial ${step} of ${total}: ${title}`}>
      <span className="tutorial-dialog__portrait" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="tutorial-dialog__body">
        <p className="tutorial-dialog__speaker">
          {speaker} · {step}/{total}
        </p>
        <strong className="tutorial-dialog__title">{title}</strong>
        <p className="tutorial-dialog__text">{body}</p>
        <div className="tutorial-dialog__dots" aria-hidden="true">
          {TUTORIAL_ORDER.map((id) => (
            <span
              key={id}
              className={id === card ? 'tutorial-dialog__dot is-on' : 'tutorial-dialog__dot'}
            />
          ))}
        </div>
        <div className="tutorial-dialog__actions">
          <Button variant="primary" size="sm" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          <button type="button" className="text-link" onClick={onHide}>
            Hide tips
          </button>
        </div>
      </div>
    </aside>
  )
}
