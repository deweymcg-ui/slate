import React, { useState } from 'react'
import { useProject } from '../stores/project'
import brandArt from '../assets/brand.webp'

import pkg from '../../../../package.json'

const APP_VERSION = (pkg as { version: string }).version

export default function Home(): React.JSX.Element {
  const { metas, create, open, remove, brain } = useProject()
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showAbout, setShowAbout] = useState(false)

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
          <img className="home-brand" src={brandArt} alt="Slate — prompt studio for AI filmmaking" />
          <p>
            Plan shots, direct coverage, spot your score, cast your voices, keep continuity — and
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

        <div className="home-foot">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAbout(true)}>
            About Slate
          </button>
        </div>
      </div>

      {showAbout && (
        <div className="modal-scrim" onClick={() => setShowAbout(false)}>
          <div className="modal about-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '22px 26px' }}>
              <img className="about-brand" src={brandArt} alt="Slate" />
              <p className="about-text">
                Slate is the prompt studio for AI filmmaking — plan shots, direct coverage, spot
                your score, cast your voices, and keep continuity across an entire film while an AI
                brain helps you craft every prompt. Compile each one for your generator of choice;
                Slate makes the prompts, your generators make the picture and sound.
              </p>
              <p className="about-meta">
                Version {APP_VERSION} · Apache-2.0 · Created by Sam Wasserman
                <br />
                Brain: your Claude Code or Codex sign-in, or a local model — no API keys.
                <br />
                <a href="https://wassermanproductions.com" target="_blank" rel="noreferrer">
                  wassermanproductions.com
                </a>{' '}
                ·{' '}
                <a href="https://wasserman.ai" target="_blank" rel="noreferrer">
                  wasserman.ai
                </a>
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <a
                  className="btn btn-key"
                  href="https://ko-fi.com/samwasserman"
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  ♥ Support on Ko-fi
                </a>
                <button className="btn" onClick={() => setShowAbout(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
