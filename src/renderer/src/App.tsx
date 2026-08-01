import React, { useEffect, useState } from 'react'
import { useProject } from './stores/project'
import Navigator from './components/Navigator'
import ShotWorkspace from './components/ShotWorkspace'
import RightRail from './components/RightRail'
import FirstADPanel from './components/FirstADPanel'
import Home from './components/Home'
import './styles/app.css'

export default function App(): React.JSX.Element {
  const { project, refreshMetas, refreshBrain, brain, dirty, close } = useProject()
  const [railOpen, setRailOpen] = useState(true)
  const [adOpen, setAdOpen] = useState(false)

  useEffect(() => {
    void refreshMetas()
    void refreshBrain()
    const off = window.slate.onProjectsChanged(() => {
      void refreshMetas()
    })
    return off
  }, [refreshMetas, refreshBrain])

  const brainReady = brain?.claude.available || brain?.codex.available

  return (
    <div className="shell">
      <div className="titlebar">
        <div className="wordmark">
          <b>◆</b>&nbsp;&nbsp;S L A T E
        </div>
        <div className="titlebar-side">
          {dirty && <span className="save-dot" title="Saving…" />}
          {project && (
            <>
              <span className="brain-pill" data-ok={brainReady ? '1' : '0'}>
                {brainReady
                  ? `Brain: ${project.defaults.brain === 'claude' ? 'Claude Code' : 'Codex'}`
                  : 'Brain offline'}
              </span>
              <button
                className={`btn btn-sm ad-toggle ${adOpen ? 'on' : ''}`}
                onClick={() => setAdOpen((v) => !v)}
                title="First AD — optional: talk through what you want and it operates Slate for you"
              >
                ✦ First AD
              </button>
              <button className="btn btn-ghost btn-sm" onClick={close}>
                Close Project
              </button>
            </>
          )}
        </div>
      </div>

      {!project ? (
        <Home />
      ) : (
        <div className="workspace" style={{ gridTemplateColumns: railOpen ? '240px 1fr 320px' : '240px 1fr 0px' }}>
          <div className="pane pane-left">
            <Navigator />
          </div>
          <div className="pane pane-center">
            <ShotWorkspace railOpen={railOpen} onToggleRail={() => setRailOpen((v) => !v)} />
          </div>
          <div className="pane pane-right" style={{ display: railOpen ? 'flex' : 'none' }}>
            <RightRail />
          </div>
          {adOpen && <FirstADPanel onClose={() => setAdOpen(false)} />}
        </div>
      )}
    </div>
  )
}
