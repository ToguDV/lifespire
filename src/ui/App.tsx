import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { currentDay, xpIntoLevel, xpToNextLevel } from '../domain/selectors'
import type { View } from '../domain/types'
import { useAppStore } from '../state/store'
import {
  DayPips,
  Icon,
  IconButton,
  IconSprite,
  LevelResource,
  Resource,
  ThemeToggle,
  Toast,
} from './components'
import type { IconName } from './components'
import { DaySummaryScreen } from './screens/DaySummaryScreen'
import { GoalsScreen } from './screens/GoalsScreen'
import { HomeScreen } from './screens/HomeScreen'
import { MapScreen } from './screens/MapScreen'
import { NodeScreen } from './screens/NodeScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { RecoveryScreen } from './screens/RecoveryScreen'
import { RunSummaryScreen } from './screens/RunSummaryScreen'
import { SettingsScreen } from './screens/SettingsScreen'

if (import.meta.env.DEV) {
  void import('../styles/dev.css')
}

const DevPanel = import.meta.env.DEV
  ? lazy(() => import('./dev/DevPanel'))
  : null

const SIDEBAR_ITEMS: Array<{ view: View; label: string; icon: IconName }> = [
  { view: { name: 'map' }, label: 'Map', icon: 'map' },
  { view: { name: 'home' }, label: 'Camp', icon: 'tent' },
  { view: { name: 'goals' }, label: 'Aims', icon: 'banner' },
  { view: { name: 'profile' }, label: 'Reliquary', icon: 'gem' },
  { view: { name: 'settings' }, label: 'Settings', icon: 'settings' },
]

const TAB_ITEMS: Array<{ view: View; label: string; icon: IconName }> = [
  { view: { name: 'map' }, label: 'Map', icon: 'map' },
  { view: { name: 'home' }, label: 'Camp', icon: 'tent' },
  { view: { name: 'goals' }, label: 'Aims', icon: 'banner' },
  { view: { name: 'profile' }, label: 'Relics', icon: 'gem' },
]

function viewKey(view: View): string {
  return JSON.stringify(view)
}

function tabForView(view: View): string {
  if (view.name === 'map' || view.name === 'node' || view.name === 'day-summary' || view.name === 'run-summary') {
    return 'map'
  }
  if (view.name === 'home') return 'home'
  if (view.name === 'goals') return 'goals'
  if (view.name === 'profile') return 'profile'
  return ''
}

function screenNameFor(view: View): string {
  if (view.name === 'onboarding') return 'welcome'
  if (view.name === 'home') return 'camp'
  if (view.name === 'goals') return 'aims'
  if (view.name === 'profile') return 'reliquary'
  if (view.name === 'day-summary' || view.name === 'run-summary') return 'summary'
  return view.name
}

const VIEW_TITLES: Record<string, string> = {
  welcome: 'A day is a path · LifeSpire',
  camp: 'Camp · LifeSpire',
  map: 'Map · LifeSpire',
  node: 'Node detail · LifeSpire',
  summary: 'Summary · LifeSpire',
  aims: 'Aims · LifeSpire',
  reliquary: 'Reliquary · LifeSpire',
  settings: 'Settings · LifeSpire',
  recovery: 'Recovery · LifeSpire',
}

export default function App() {
  const gameDocument = useAppStore((state) => state.document)
  const hydrated = useAppStore((state) => state.hydrated)
  const storageIssue = useAppStore((state) => state.storageIssue)
  const view = useAppStore((state) => state.view)
  const toast = useAppStore((state) => state.toast)
  const navigate = useAppStore((state) => state.navigate)
  const showToast = useAppStore((state) => state.showToast)

  const [devOpen, setDevOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLElement>(null)
  const lastViewKey = useRef<string | null>(null)

  const profile = gameDocument.profile
  const run = gameDocument.run
  const current = currentDay(run)

  const guardedView: View = storageIssue
    ? { name: 'recovery', reason: storageIssue.reason }
    : !profile
      ? { name: 'onboarding' }
      : view.name === 'onboarding'
        ? { name: 'home' }
        : (view.name === 'map' || view.name === 'node' || view.name === 'day-summary') &&
            (!run || run.status === 'closed' || !current)
          ? run?.status === 'closed'
            ? { name: 'run-summary' }
            : { name: 'home' }
          : view

  useEffect(() => {
    if (!hydrated) return
    if (storageIssue) {
      if (view.name !== 'recovery' || view.reason !== storageIssue.reason) {
        navigate({ name: 'recovery', reason: storageIssue.reason })
      }
      return
    }
    if (!profile) {
      if (view.name !== 'onboarding') navigate({ name: 'onboarding' })
      return
    }
    if (view.name === 'onboarding') {
      navigate({ name: 'home' })
      return
    }
    if (
      (view.name === 'map' || view.name === 'node' || view.name === 'day-summary') &&
      (!run || run.status === 'closed' || !current)
    ) {
      navigate(run?.status === 'closed' ? { name: 'run-summary' } : { name: 'home' })
    }
  }, [hydrated, storageIssue, profile, run, current, view, navigate])

  useEffect(() => {
    const root = window.document.documentElement
    const meta = window.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const theme = gameDocument.settings.theme

    const apply = () => {
      const effective = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      if (theme === 'system') {
        delete root.dataset.theme
      } else {
        root.dataset.theme = theme
      }
      meta?.setAttribute('content', effective === 'dark' ? '#131511' : '#f1f0ea')
    }

    apply()
    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
    return undefined
  }, [gameDocument.settings.theme])

  const screenName = screenNameFor(guardedView)

  useLayoutEffect(() => {
    window.document.body.dataset.screen = screenName
    window.document.title = VIEW_TITLES[screenName] ?? 'LifeSpire'
  }, [screenName])

  useEffect(() => {
    const key = viewKey(view)
    if (lastViewKey.current !== null && lastViewKey.current !== key) {
      mainRef.current?.focus({ preventScroll: true })
      if (viewportRef.current) viewportRef.current.scrollTop = 0
    }
    lastViewKey.current = key
  }, [view])

  const dismissToast = useCallback(() => showToast(null), [showToast])

  if (!hydrated) return null

  const activeTab = tabForView(guardedView)
  const dayLabel = current
    ? `Day ${current.index + 1} of 7`
    : !run
      ? 'No run yet'
      : run.status === 'closed'
        ? 'Week sealed'
        : 'Week spent'

  const renderScreen = (): ReactNode => {
    if (storageIssue) {
      return <RecoveryScreen reason={storageIssue.reason} />
    }
    if (!profile) {
      return <OnboardingScreen />
    }
    switch (guardedView.name) {
      case 'onboarding':
        return <OnboardingScreen />
      case 'home':
        return <HomeScreen />
      case 'map':
        return <MapScreen />
      case 'node':
        return <NodeScreen />
      case 'day-summary':
        return <DaySummaryScreen dayId={guardedView.dayId} />
      case 'run-summary':
        return <RunSummaryScreen />
      case 'goals':
        return <GoalsScreen />
      case 'profile':
        return <ProfileScreen />
      case 'settings':
        return <SettingsScreen />
      case 'recovery':
        return <RecoveryScreen reason={guardedView.reason} />
    }
  }

  return (
    <>
      <IconSprite />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <button
              className="brand"
              type="button"
              aria-label="LifeSpire, go to camp"
              onClick={() => navigate({ name: 'home' })}
            >
              <Icon name="spire" className="brand__mark" />
              <span className="brand__word">LifeSpire</span>
            </button>
            <span className="brand__claim">a quiet ascent</span>
          </div>

          <nav className="sidebar__nav" aria-label="Primary">
            <span className="micro sidebar__label">The run</span>
            {SIDEBAR_ITEMS.map((item) => {
              const active =
                activeTab === tabForView(item.view) ||
                (item.view.name === 'settings' && guardedView.name === 'settings')
              return (
                <button
                  key={item.label}
                  className="side-link"
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item.view)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="sidebar__foot">
            {profile ? (
              <button
                className="profile-card"
                type="button"
                onClick={() => navigate({ name: 'profile' })}
              >
                <span className="profile-card__level">{profile.level}</span>
                <span className="profile-card__body">
                  <strong>{profile.name}</strong>
                  <span>
                    Level {profile.level} · {xpIntoLevel(profile.xp)} / 100
                  </span>
                </span>
              </button>
            ) : null}

            {import.meta.env.DEV ? (
              <button
                className="dev-trigger dev-trigger--sidebar"
                type="button"
                onClick={() => setDevOpen(true)}
              >
                Dev panel
              </button>
            ) : null}

            <div className="appearance">
              <span className="appearance__label">
                <Icon name="moon" />
                Appearance
              </span>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <div className="app-main">
          <header className="topbar">
            <button
              className="brand topbar__brand"
              type="button"
              aria-label="LifeSpire, go to camp"
              onClick={() => navigate({ name: 'home' })}
            >
              <Icon name="spire" className="brand__mark" />
              <span className="brand__word">LifeSpire</span>
            </button>

            <div className="topbar__run">
              {run ? (
                <>
                  <span className="topbar__run-label">Run I</span>
                  <span className="vrule" aria-hidden="true" />
                  <DayPips days={run.days} currentIndex={current?.index} label={dayLabel} />
                  <span className="micro">{dayLabel}</span>
                </>
              ) : (
                <span className="micro">No run yet</span>
              )}
            </div>

            <div className="topbar__right">
              {profile ? (
                <>
                  <Resource
                    icon="coin"
                    value={profile.gold}
                    label={`${profile.gold} gold`}
                  />
                  <LevelResource
                    level={profile.level}
                    xpIntoLevel={xpIntoLevel(profile.xp)}
                    xpToNext={xpToNextLevel(profile.xp)}
                  />
                </>
              ) : null}
              <IconButton
                icon="settings"
                label="Settings"
                aria-current={guardedView.name === 'settings' ? 'page' : undefined}
                onClick={() => navigate({ name: 'settings' })}
              />
              <ThemeToggle />
            </div>
          </header>

          <main
            className="viewport"
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
          >
            {renderScreen()}
          </main>

          <nav className="tabbar" aria-label="Primary">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.label}
                className="tab"
                type="button"
                aria-current={activeTab === tabForView(item.view) ? 'page' : undefined}
                onClick={() => navigate(item.view)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <Toast message={toast} onDismiss={dismissToast} />

      {import.meta.env.DEV ? (
        <button
          className="dev-trigger dev-trigger--floating"
          type="button"
          onClick={() => setDevOpen(true)}
        >
          Dev
        </button>
      ) : null}

      {DevPanel && devOpen ? (
        <Suspense fallback={null}>
          <DevPanel open={devOpen} onClose={() => setDevOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
