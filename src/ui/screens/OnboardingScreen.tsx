import { createDemoSetup } from '../../content/demo'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import { Button, Icon, ThemeToggle } from '../components'

export function OnboardingScreen() {
  const draftName = useAppStore((state) => state.document.onboardingDraft?.name ?? '')
  const updateOnboardingDraft = useAppStore((state) => state.updateOnboardingDraft)
  const completeOnboarding = useAppStore((state) => state.completeOnboarding)
  const startRun = useAppStore((state) => state.startRun)
  const navigate = useAppStore((state) => state.navigate)

  const beginDemo = () => {
    const at = getNow()
    const setup = createDemoSetup(at)
    const name = draftName.trim() || setup.name
    completeOnboarding({ ...setup, name }, at)
    if (!useAppStore.getState().document.profile) return
    startRun(undefined, at)
    if (useAppStore.getState().document.run) {
      navigate({ name: 'home' })
    }
  }

  return (
    <section
      className="screen screen--welcome"
      data-screen="welcome"
      aria-labelledby="welcome-title"
    >
      <div className="welcome-top">
        <span className="brand" aria-label="LifeSpire">
          <Icon name="spire" className="brand__mark" />
          <span className="brand__word">LifeSpire</span>
        </span>
        <ThemeToggle />
      </div>

      <div className="welcome-grid">
        <div className="welcome-copy">
          <span className="kicker">A seven-day run</span>
          <h1 id="welcome-title">
            A day is a <em>path</em>.
          </h1>
          <p>
            Turn the routines that matter into a seven-day climb. Choose a route, keep a
            small promise, gather what you find.
          </p>

          <form
            className="welcome-form"
            onSubmit={(event) => {
              event.preventDefault()
              beginDemo()
            }}
          >
            <div className="field">
              <label htmlFor="traveller-name">What should we call you?</label>
              <input
                className="input"
                id="traveller-name"
                type="text"
                placeholder="Traveller"
                autoComplete="nickname"
                value={draftName}
                onChange={(event) => updateOnboardingDraft({ name: event.target.value })}
              />
            </div>
            <div className="welcome-actions">
              <Button type="submit" variant="primary">
                Begin with demo data
                <Icon name="chevron-right" />
              </Button>
              <Button
                variant="secondary"
                disabled
                title="Custom aims and routines arrive in a later release."
              >
                Create my own path
              </Button>
            </div>
          </form>

          <p className="mini-note welcome-custom-note">
            Custom aims open in a later release. The demo creates two aims and five routines
            you can explore now.
          </p>

          <p className="welcome-foot">
            <Icon name="lock" />
            Your data stays in this browser. No account, no cloud.
          </p>

          <div className="welcome-ornament" aria-hidden="true">
            <span />
          </div>
        </div>

        <div className="welcome-art" aria-hidden="true">
          <svg viewBox="0 0 560 640" preserveAspectRatio="xMidYMin slice" role="presentation">
            <g className="art-contour">
              <path d="M-40 580c110-38 170 26 280-2s180-58 360-20" />
              <path d="M-40 500c110-34 170 24 280-4s180-54 360-18" />
              <path d="M-40 420c110-30 170 20 280-6s180-50 360-16" />
              <path d="M-40 340c110-26 170 18 280-8s180-46 360-14" />
              <path d="M-40 260c110-22 170 14 280-10s180-42 360-12" />
              <path d="M-40 180c110-18 170 10 280-12s180-38 360-10" />
            </g>
            <path
              className="art-path"
              d="M138 606C172 568 202 530 240 494C272 466 306 446 330 412C344 392 348 370 356 348"
            />
            <path className="art-path-open" d="M356 348C366 326 374 316 382 306" />
            <circle className="art-halo" cx="382" cy="215" r="112" />
            <circle className="art-halo" cx="382" cy="215" r="84" />
            <use href="#i-pine" x="64" y="460" width="22" height="22" className="art-pine" />
            <use href="#i-pine" x="94" y="490" width="15" height="15" className="art-pine" />
            <use href="#i-pine" x="488" y="438" width="24" height="24" className="art-pine" />
            <use href="#i-pine" x="458" y="474" width="16" height="16" className="art-pine" />
            <use href="#i-moon" x="72" y="80" width="34" height="34" className="art-pine" />

            <path className="art-crown" d="M352 306V216h60v90" />
            <path className="art-crown" d="m338 216 44-102 44 102z" />
            <path className="art-crown" d="M370 306v-26a12 12 0 0 1 24 0v26" />
            <path className="art-crown" d="M378 268v-28a4 4 0 0 1 8 0v28" />
            <path className="art-crown" d="m382 88 6 12-6 12-6-12z" />
            <path className="art-crown" d="M344 306h76M350 312h64" />

            <circle className="art-node art-node--done" cx="138" cy="606" r="15" />
            <use href="#i-tent" x="130.5" y="598.5" width="15" height="15" className="art-node-glyph" />
            <circle className="art-node art-node--done" cx="240" cy="494" r="16" />
            <use href="#i-check" x="232" y="486" width="16" height="16" className="art-node-glyph" />
            <circle className="art-node art-node--done" cx="330" cy="412" r="17" />
            <use href="#i-scroll" x="321" y="403" width="18" height="18" className="art-node-glyph" />
            <circle className="art-node art-node--open" cx="356" cy="348" r="19" />
            <use href="#i-scroll" x="346" y="338" width="20" height="20" className="art-node-open" />

            <g className="art-contour">
              <path d="M462 138c10-4 18-4 28 0" />
              <path d="M96 280c8-3 15-3 23 0" />
              <path d="M476 552c8-3 15-3 23 0" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  )
}
