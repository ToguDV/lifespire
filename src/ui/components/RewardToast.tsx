import { useEffect } from 'react'
import type { RewardEvent } from '../../domain/types'
import { useCountUp } from '../lib/countUp'
import { Icon } from './Icon'

export interface RewardToastProps {
  event: RewardEvent
  onDismiss: () => void
  duration?: number
}

function RewardBits({ event }: { event: RewardEvent }) {
  const xp = useCountUp(event.xp)
  const gold = useCountUp(event.gold)
  return (
    <span className="reward-toast__bits">
      {event.xp > 0 ? (
        <span className="reward-toast__bit">
          <Icon name="star" />+{xp} XP
        </span>
      ) : null}
      {event.gold > 0 ? (
        <span className="reward-toast__bit">
          <Icon name="coin" />+{gold} gold
        </span>
      ) : null}
      {event.progress > 0 ? (
        <span className="reward-toast__bit reward-toast__bit--progress">
          <Icon name="plus" />
          +1 weekly
        </span>
      ) : null}
      {event.lootItem ? (
        <span className="reward-toast__bit reward-toast__bit--loot">
          <Icon name="gem" />
          {event.lootItem.name}
        </span>
      ) : null}
      {event.duplicateCatalogId && event.duplicateGold > 0 ? (
        <span className="reward-toast__bit reward-toast__bit--dupe">
          +{event.duplicateGold} g duplicate
        </span>
      ) : null}
      {event.xp === 0 && event.gold === 0 && !event.lootItem ? (
        <span className="reward-toast__bit">Step kept</span>
      ) : null}
    </span>
  )
}

/**
 * Rich reward recap after a completion: icons, ticking counters and the
 * weekly-progress mark. Skips keep the plain text toast; only completions
 * arrive here.
 */
export function RewardToast({ event, onDismiss, duration = 5200 }: RewardToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [event, onDismiss, duration])

  const title =
    event.nodeType === 'wheel'
      ? event.wheelOutcome === 'task'
        ? `Wheel · ${event.taskTitle ?? 'a task'}`
        : event.wheelOutcome === 'gold'
          ? 'Wheel · gold cache'
          : event.wheelOutcome === 'xp'
            ? 'Wheel · surge of experience'
            : 'Wheel · quiet rest'
      : (event.taskTitle ?? 'Step kept')

  return (
    <div className="reward-toast" role="status" aria-live="polite">
      <span className="reward-toast__seal" aria-hidden="true">
        <Icon name="check" />
      </span>
      <span className="reward-toast__body">
        <strong>{title}</strong>
        <RewardBits event={event} />
      </span>
      <button type="button" className="toast__dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
