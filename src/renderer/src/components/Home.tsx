import React, { useState } from 'react'
import { useProject } from '../stores/project'

export default function Home(): React.JSX.Element {
  const { metas, create, open, remove, brain } = useProject()
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const submit = (): void => {
    const n = name.trim()
    if (n) {
      void create(n)
      setName('')
    }
  }

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-hero">
          <div className="home-mark">◆</div>
          <h1>Slate</h1>
          <p>
            The prompt studio for AI filmmaking. Plan shots, direct coverage, keep continuity — and
            compile production-ready prompts for any generator.
          </p>
          {brain && !brain.claude.available && !brain.codex.available && (
            <div className="brain-warning">
              No local brain found. Install and sign in to Claude Code (or Codex CLI) — Slate uses
              your existing subscription, no API keys.
            </div>
          )}
        </div>

        <div className="home-new">
          <input
            placeholder="New project title — e.g. Night Market"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn btn-key" onClick={submit} disabled={!name.trim()}>
            Create Project
          </button>
        </div>

        {metas.length > 0 && (
          <div className="home-list">
            <div className="panel-title" style={{ margin: '18px 2px 8px' }}>
              Projects
            </div>
            {metas.map((m) => (
              <div
                key={m.id}
                className="home-project"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && void open(m.id)}
                onClick={() => void open(m.id)}
              >
                <div className="home-project-main">
                  <div className="home-project-name">{m.name}</div>
                  {m.logline && <div className="home-project-log">{m.logline}</div>}
                </div>
                <div className="row-meta">
                  {m.sceneCount} scenes · {m.shotCount} shots
                </div>
                {confirmDelete === m.id ? (
                  <span onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        void remove(m.id)
                        setConfirmDelete(null)
                      }}
                    >
                      Delete forever
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(m.id)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
