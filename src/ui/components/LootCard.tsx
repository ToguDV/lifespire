import type { LootItem } from '../../domain/types'
import { Icon } from './Icon'
import { formatShortIsoDay, lootIcon, rarityPips } from '../lib/format'

export function LootCard({ item }: { item: LootItem }) {
  const rarityClass = item.rarity === 'rare' ? 'loot-card--rare' : item.rarity === 'epic' ? 'loot-card--epic' : ''
  const filled = rarityPips(item.rarity)
  return (
    <article className={['loot-card', rarityClass].filter(Boolean).join(' ')}>
      <div className="loot-card__niche">
        <Icon name={lootIcon(item.catalogId)} />
      </div>
      <h3>{item.name}</h3>
      <p>
        {item.rarity} · {formatShortIsoDay(item.obtainedAt)}
      </p>
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
