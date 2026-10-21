import { xpIntoLevel, xpToNextLevel } from '../../domain/selectors'
import { useAppStore } from '../../state/store'
import {
  Button,
  EmptyLootCard,
  Icon,
  LootCard,
  Panel,
  ScreenHead,
} from '../components'
import { percent } from '../lib/format'

export function ProfileScreen() {
  const profile = useAppStore((state) => state.document.profile)
  const run = useAppStore((state) => state.document.run)
  const navigate = useAppStore((state) => state.navigate)

  if (!profile) {
    return (
      <section className="screen screen--reliquary" data-screen="reliquary" aria-labelledby="reliquary-empty-title">
        <ScreenHead
          kicker="Profile"
          title="No profile yet."
          titleId="reliquary-empty-title"
          sub="Your level, gold and collection appear after onboarding."
          meta={
            <Button variant="secondary" size="sm" onClick={() => navigate({ name: 'home' })}>
              Go to camp
            </Button>
          }
        />
      </section>
    )
  }

  const daysKept = run?.days.filter((day) => day.status === 'completed').length ?? 0
  const xpNow = xpIntoLevel(profile.xp)
  const xpLeft = xpToNextLevel(profile.xp)

  return (
    <section className="screen screen--reliquary" data-screen="reliquary" aria-labelledby="reliquary-title">
      <ScreenHead
        kicker="Profile · The Reliquary"
        title="The Reliquary"
        titleId="reliquary-title"
        sub="Tokens found along the climb. No powers, only proof."
        meta={
          <span className="chip">
            <Icon name="gem" />
            {profile.loot.length} of 12
          </span>
        }
      />

      <div className="reliquary-body">
        <Panel className="profile-strip" aria-label="Profile">
          <div className="profile-level">{profile.level}</div>
          <div className="profile-strip__id">
            <h2>{profile.name}</h2>
            <p>Wayfarer of the quiet path</p>
            <div className="xp-track">
              <div className="xp-track__meta">
                <span>Experience</span>
                <span>
                  {xpNow} / 100
                </span>
              </div>
              <div className="xp-track__bar">
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
              <strong>{profile.loot.length}</strong>
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

        <div className="collection-head">
          <h2>Found so far</h2>
          <span>{profile.loot.length === 1 ? 'One small proof' : `${profile.loot.length} small proofs`}</span>
        </div>

        {profile.loot.length === 0 ? (
          <div className="loot-grid">
            <EmptyLootCard />
            <EmptyLootCard />
          </div>
        ) : (
          <div className="loot-grid">
            {profile.loot.map((item) => (
              <LootCard item={item} key={item.id} />
            ))}
          </div>
        )}

        <p className="quiet-note">
          <Icon name="star" />
          <span>
            Level {profile.level} · {xpNow} / 100 experience · {xpLeft} to the next level.
          </span>
        </p>
      </div>
    </section>
  )
}
