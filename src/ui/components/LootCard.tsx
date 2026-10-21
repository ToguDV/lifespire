import type { LootItem } from '../../domain/types'
import { Icon } from './Icon'
import { RARITY_LABEL, formatShortIsoDay, lootIcon, rarityPips } from '../lib/format'

export interface LootCardProps {
  item: LootItem
  /** Profile cards repeat rarity, obtained date and the flavour description. */
  detailed?: boolean
}

export function LootCard({ item, detailed = false }: LootCardProps) {
  const rarityClass = item.rarity === 'rare' ? 'loot-card--rare' : item.rarity === 'epic' ? 'loot-card--epic' : ''
  const filled = rarityPips(item.rarity)
  return (
    <article className={['loot-card', rarityClass].filter(Boolean).join(' ')}>
      <div className="loot-card__niche">
        <Icon name={lootIcon(item.catalogId)} />
      </div>
      <h3>{item.name}</h3>
      {detailed ? (
        <>
          <p>
            {RARITY_LABEL[item.rarity]} · Found {formatShortIsoDay(item.obtainedAt)}
          </p>
          <p className="loot-card__description">{item.description}</p>
        </>
      ) : (
        <p>
          {item.rarity} · {formatShortIsoDay(item.obtainedAt)}
        </p>
      )}
      <div className="rarity" aria-label={`Rarity ${filled} of 3`}>
        {[1, 2, 3].map((step) => (
          <i key={step} className={step <= filled ? 'on' : undefined} aria-hidden="true" />
        ))}
      </div>
    </article>
  )
}

export function EmptyLootCard() {
  return (
    <article className="loot-card loot-card--empty">
      <Icon name="lock" />
      <span>Not yet found</span>
    </article>
  )
}

/**
 * The catalogue keeps a slot for every relic, but an unowned one reveals only
 * the locked niche and its state. Its name, rarity, description and art stay
 * hidden until it is actually found.
 */
export function UndiscoveredLootCard() {
  return (
    <article className="loot-card loot-card--empty loot-card--undiscovered">
      <div className="loot-card__niche loot-card__niche--locked" aria-hidden="true">
        <Icon name="lock" />
      </div>
      <span>Undiscovered</span>
    </article>
  )
}
