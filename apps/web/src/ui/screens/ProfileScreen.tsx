import { useState } from 'react'
import { xpIntoLevel } from '../../domain/selectors'
import { useAppStore } from '../../state/store'
import {
  Button,
  Icon,
  LootCard,
  Panel,
  PanelHead,
  ScreenHead,
  UndiscoveredLootCard,
} from '../components'
import {
  buildCollection,
  collectionFilterOptions,
  collectionOwnedCount,
  duplicateConversions,
  duplicateGoldTotal,
  filterCollection,
  type CollectionFilter,
} from '../lib/collection'
import { formatShortDayKey, lootIcon, percent } from '../lib/format'

export function ProfileScreen() {
  const profile = useAppStore((state) => state.document.profile)
  const run = useAppStore((state) => state.document.run)
  const navigate = useAppStore((state) => state.navigate)
  const [filter, setFilter] = useState<CollectionFilter>('all')

  const collection = buildCollection(profile?.loot ?? [])
  const filterOptions = collectionFilterOptions(collection)
  const visible = filterCollection(collection, filter)
  const ownedTotal = collectionOwnedCount(collection)
  const conversions = duplicateConversions(run)
  const conversionsGold = duplicateGoldTotal(conversions)
  const daysKept = run?.days.filter((day) => day.status === 'completed').length ?? 0
  const xpNow = profile ? xpIntoLevel(profile.xp) : 0

  return (
    <section
      className="screen screen--reliquary"
      data-screen="reliquary"
      aria-labelledby="reliquary-title"
    >
      <ScreenHead
        kicker="Profile"
        title="The Reliquary"
        titleId="reliquary-title"
        sub="Tokens found along the climb."
        meta={
          <span className="chip">
            <Icon name="gem" />
            {ownedTotal} of {collection.length}
          </span>
        }
      />

      <div className="reliquary-body">
        {profile ? (
          <Panel className="profile-strip" aria-label="Profile">
            <div className="profile-level">{profile.level}</div>
            <div className="profile-strip__id">
              <h2>{profile.name}</h2>
              <p>Wayfarer of the quiet path</p>
              <div className="xp-track">
                <div className="xp-track__meta">
                  <span>Experience</span>
                  <span>{xpNow} / 100</span>
                </div>
                <div
                  className="xp-track__bar"
                  role="progressbar"
                  aria-label="Experience in this level"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={xpNow}
                >
                  <span style={{ width: `${percent(xpNow, 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="profile-strip__stats">
              <div className="profile-stat">
                <strong>
                  <Icon name="coin" />
                  {profile.gold}
                </strong>
                <span>Gold</span>
              </div>
              <div className="profile-stat">
                <strong>{ownedTotal}</strong>
                <span>Relics</span>
              </div>
              <div className="profile-stat">
                <strong>
                  {daysKept} / 7
                </strong>
                <span>Days kept</span>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel pad className="reliquary-empty">
            <PanelHead label="No profile yet" />
            <p className="panel-note">
              The catalogue below is complete from the start. Relics are revealed as they are
              found during a run.
            </p>
            <Button variant="primary" onClick={() => navigate({ name: 'onboarding' })}>
              Begin the journey
            </Button>
          </Panel>
        )}

        <div
          className="segmented collection-filters"
          role="group"
          aria-label="Filter relics by rarity"
        >
          {filterOptions.map((option) => (
            <button
              key={option.filter}
              type="button"
              aria-pressed={filter === option.filter}
              aria-label={`${option.label}: ${option.owned} of ${option.total} found`}
              onClick={() => setFilter(option.filter)}
            >
              <span>{option.label}</span>
              <small aria-hidden="true">
                {option.owned}/{option.total}
              </small>
            </button>
          ))}
        </div>

        <div className="loot-grid loot-grid--collection">
          {visible.map(({ catalog, owned }) =>
            owned ? (
              <LootCard item={owned} detailed key={catalog.id} />
            ) : (
              <UndiscoveredLootCard key={catalog.id} />
            ),
          )}
        </div>

        {conversions.length > 0 ? (
          <Panel pad className="duplicate-panel">
            <PanelHead
              label="Duplicate conversions"
              aside={<span className="chip chip--quiet">+{conversionsGold} gold</span>}
            />
            <p className="panel-note">Duplicates become gold.</p>
            <ul className="duplicate-list">
              {conversions.map((conversion) => (
                <li className="duplicate-row" key={conversion.eventId}>
                  <span className="duplicate-row__mark" aria-hidden="true">
                    <Icon name={lootIcon(conversion.catalogId)} />
                  </span>
                  <span className="duplicate-row__body">
                    <strong>{conversion.name}</strong>
                    <span>
                      Day {conversion.dayNumber}
                      {conversion.date ? ` · ${formatShortDayKey(conversion.date)}` : ''}
                    </span>
                  </span>
                  <span className="duplicate-row__gold">
                    +{conversion.gold} <span className="micro">gold</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </section>
  )
}
