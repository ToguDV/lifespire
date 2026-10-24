import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { dayKey } from '../../domain/dates'
import { serializeDocument } from '../../domain/schema'
import { getNow } from '../../state/clock'
import { useAppStore } from '../../state/store'
import { RESET_CONFIRMATION, isResetConfirmation } from '../lib/reset'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  confirmingReset: boolean
  resetPhrase: string
  actionError: string | null
}

const INITIAL_STATE: ErrorBoundaryState = {
  hasError: false,
  confirmingReset: false,
  resetPhrase: '',
  actionError: null,
}

/**
 * Last-resort recovery screen. It deliberately uses plain design-system
 * classes instead of shared components so a crash inside a component cannot
 * also break the fallback. Technical details stay in the console.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = INITIAL_STATE

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      confirmingReset: false,
      resetPhrase: '',
      actionError: null,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LifeSpire could not render this screen.', error, info.componentStack)
  }

  private downloadSave = () => {
    try {
      const gameDocument = useAppStore.getState().document
      const payload = serializeDocument(gameDocument)
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `lifespire-recovery-${dayKey(getNow())}.json`
      window.document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      this.setState({ actionError: null })
    } catch {
      this.setState({
        actionError:
          'The save could not be downloaded from this browser. Try again before resetting.',
      })
    }
  }

  private startReset = () => {
    this.setState({ confirmingReset: true, resetPhrase: '', actionError: null })
  }

  private cancelReset = () => {
    this.setState({ confirmingReset: false, resetPhrase: '' })
  }

  private resetLocalData = () => {
    if (!isResetConfirmation(this.state.resetPhrase)) return
    try {
      useAppStore.getState().resetAll()
      window.location.reload()
    } catch {
      this.setState({
        actionError: 'Local data could not be reset. Reload the app and try again.',
      })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { confirmingReset, resetPhrase, actionError } = this.state
    const resetReady = isResetConfirmation(resetPhrase)

    return (
      <section
        className="screen screen--recovery"
        data-screen="recovery"
        aria-labelledby="error-boundary-title"
      >
        <div className="recovery-grid">
          <header className="screen-head" role="alert">
            <div className="screen-head__copy">
              <span className="kicker">Something went wrong</span>
              <h1 id="error-boundary-title">LifeSpire could not draw this screen.</h1>
            </div>
          </header>

          <section className="panel panel--pad">
            <p className="panel-note">
              Your local save is still in this browser. Download a copy before resetting if
              you may need it.
            </p>

            <div className="settings-actions">
              <button
                type="button"
                className="btn btn--primary"
                autoFocus
                onClick={() => window.location.reload()}
              >
                Reload app
              </button>
              <button type="button" className="btn btn--secondary" onClick={this.downloadSave}>
                Download save
              </button>
              {confirmingReset ? null : (
                <button type="button" className="btn btn--danger" onClick={this.startReset}>
                  Reset local data
                </button>
              )}
            </div>

            {actionError ? (
              <p className="settings-error" role="alert">
                {actionError}
              </p>
            ) : null}

            {confirmingReset ? (
              <div className="reset-confirmation">
                <label className="field__label" htmlFor="error-reset-confirmation">
                  Type {RESET_CONFIRMATION} to confirm
                </label>
                <input
                  id="error-reset-confirmation"
                  className="input"
                  type="text"
                  value={resetPhrase}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder={RESET_CONFIRMATION}
                  aria-describedby="error-reset-hint"
                  onChange={(event) => this.setState({ resetPhrase: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && resetReady) {
                      event.preventDefault()
                      this.resetLocalData()
                    }
                  }}
                />
                <p className="panel-note" id="error-reset-hint">
                  This removes the local save and returns to onboarding. Download the save
                  first if you may need it. This cannot be undone.
                </p>
                <div className="settings-actions">
                  <button type="button" className="btn btn--ghost" onClick={this.cancelReset}>
                    Keep my data
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={!resetReady}
                    onClick={this.resetLocalData}
                  >
                    Reset everything
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    )
  }
}
