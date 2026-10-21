import { useAppStore } from '../../state/store'
import { Button, Icon } from '../components'

export function NodeScreen() {
  const navigate = useAppStore((state) => state.navigate)
  const run = useAppStore((state) => state.document.run)

  return (
    <section className="screen screen--node" data-screen="node" aria-labelledby="node-title">
      <button className="node-back" type="button" onClick={() => navigate({ name: 'map' })}>
        <Icon name="arrow-left" />
        Back to the map
      </button>

      <div className="node-detail">
        <article className="panel node-spread" data-variant="task">
          <header className="node-spread__art">
            <div className="node-medallion">
              <Icon name="scroll" />
            </div>
            <span className="micro">Node detail</span>
            <h1 id="node-title">A step not yet drawn.</h1>
            <p className="node-flavor">
              Once a day opens, this page will hold the task, its aim, its effort and the
              rewards waiting at the end of the path.
            </p>
          </header>

          <div className="node-spread__body">
            <div className="node-tags">
              <span className="chip chip--accent">
                <Icon name="scroll" />
                Task node
              </span>
              <span className="chip chip--quiet">Not yet drawn</span>
            </div>

            <div className="node-aim">
              <div className="node-aim__head">
                <strong>Nothing is attached yet</strong>
                <span>{run ? 'Run in progress' : 'No run'}</span>
              </div>
              <p className="panel-note">
                The task, aim, effort and rewards appear here when the deterministic map is
                generated. No step has been marked complete or skipped.
              </p>
            </div>

            <p className="node-note">
              <Icon name="check" />
              <span>Nothing has been marked complete. Your week is unchanged.</span>
            </p>

            <div className="node-actions">
              <Button variant="primary" onClick={() => navigate({ name: 'map' })}>
                <Icon name="arrow-left" />
                Return to the map
              </Button>
              <Button variant="quiet" onClick={() => navigate({ name: 'home' })}>
                Back to camp
              </Button>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
