// Deliver — compile the shot for a target model, preflight its limits,
// copy the result, log takes, and export the scene.

import React, { useMemo, useState } from 'react'
import { useProject, uid } from '../stores/project'
import profilesData from '../../../../data/model-profiles.json'
import { compileForModel, preflight, exportSceneMarkdown, exportSceneCsv, type ModelProfile } from '../lib/compile'
import type { Take } from '../../../shared/types'

const PROFILES = (profilesData as { profiles: ModelProfile[] }).profiles

export default function DeliverPanel(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const scene = store.currentScene()
  const shot = store.currentShot()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compiled, setCompiled] = useState<{ prompt: string; negativePrompt?: string; params?: Record<string, unknown> } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const profile = useMemo(
    () => PROFILES.find((p) => p.id === (shot?.targetModel ?? project.defaults.targetModel)) ?? PROFILES[0] ?? null,
    [shot?.targetModel, project.defaults.targetModel]
  )

  if (!shot || !scene) {
    return (
      <div className="empty" style={{ height: 'auto', padding: '40px 20px' }}>
        <p>Select a shot to compile deliverables{scene ? ' — or export the whole scene below.' : '.'}</p>
        {scene && <SceneExport />}
      </div>
    )
  }

  const warnings = profile ? preflight(shot, profile) : []

  const compile = async (): Promise<void> => {
    if (!profile || !shot.prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    setCompiled(null)
    const res = await compileForModel(project, scene, shot, profile)
    setBusy(false)
    if (res.ok && res.json) setCompiled(res.json as typeof compiled)
    else setError(res.error ?? 'Compile failed.')
  }

  const copy = (text: string, tag: string): void => {
    void window.slate.copyText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1400)
  }

  const logTake = (rating: Take['rating']): void => {
    store.mutate((p) => {
      const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
      if (!s) return
      s.takes.unshift({
        id: uid('take'),
        loggedAt: new Date().toISOString(),
        model: profile?.label ?? 'unknown',
        prompt: compiled?.prompt ?? s.prompt,
        rating,
        notes: ''
      })
    })
  }

  return (
    <div className="scroll">
      <div style={{ padding: 10 }}>
        <label>Target model</label>
        <select
          value={shot.targetModel ?? ''}
          onChange={(e) =>
            store.mutate((p) => {
              const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
              if (s) s.targetModel = e.target.value || null
            })
          }
          style={{ width: '100%' }}
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} · {p.kind}
            </option>
          ))}
        </select>

        {profile && (
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
            {[
              profile.limits.maxDurationSec ? `max ${profile.limits.maxDurationSec}s` : null,
              profile.limits.durations ? `${profile.limits.durations.join('/')}s` : null,
              profile.limits.maxChars ? `${profile.limits.maxChars} chars` : null,
              profile.features.negativePrompt ? 'negatives' : null,
              profile.features.timecodeBeats ? 'timecode beats' : null,
              profile.features.imageInput ? 'image input' : null
            ]
              .filter(Boolean)
              .join(' · ') || 'no published limits'}
          </div>
        )}

        {warnings.map((w, i) => (
          <div key={i} className="preflight-warn">
            ⚠ {w.message}
          </div>
        ))}

        <button
          className="btn btn-key"
          style={{ width: '100%', marginTop: 10 }}
          disabled={busy || !shot.prompt.trim() || !profile}
          onClick={() => void compile()}
        >
          {busy ? 'Compiling…' : `Compile for ${profile?.label ?? '—'}`}
        </button>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>

      {compiled && (
        <div style={{ padding: '0 10px 10px' }}>
          <div className="compiled-box">
            <div className="compiled-head">
              <span className="panel-title">Prompt</span>
              <button className="btn btn-sm" onClick={() => copy(compiled.prompt, 'p')}>
                {copied === 'p' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre>{compiled.prompt}</pre>
          </div>
          {compiled.negativePrompt && (
            <div className="compiled-box">
              <div className="compiled-head">
                <span className="panel-title">Negative</span>
                <button className="btn btn-sm" onClick={() => copy(compiled.negativePrompt!, 'n')}>
                  {copied === 'n' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre>{compiled.negativePrompt}</pre>
            </div>
          )}
          {compiled.params && Object.keys(compiled.params).length > 0 && (
            <div className="compiled-box">
              <div className="compiled-head">
                <span className="panel-title">Params</span>
              </div>
              <pre>
                {Object.entries(compiled.params)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join('\n')}
              </pre>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Log the take:</span>
            <button className="btn btn-sm" onClick={() => logTake('circled')} title="The keeper">
              ⭕ Circle
            </button>
            <button className="btn btn-sm" onClick={() => logTake('good')}>
              Good
            </button>
            <button className="btn btn-sm" onClick={() => logTake('no-good')}>
              NG
            </button>
          </div>
        </div>
      )}

      <History />
      <Takes />
      <SceneExport />
    </div>
  )
}

function History(): React.JSX.Element {
  const store = useProject()
  const shot = store.currentShot()!
  if (!shot.history.length) return <></>
  return (
    <div className="setup-group">
      <div className="setup-group-title">Version History</div>
      {shot.history.slice(0, 12).map((v) => (
        <div key={v.id} className="setup-row" title={v.prompt.slice(0, 400)}>
          <span className="setup-label">
            {v.label} <span className="row-meta">{new Date(v.savedAt).toLocaleTimeString()}</span>
          </span>
          <button className="btn btn-ghost btn-sm" title="Restore this version" onClick={() => store.restoreVersion(v)}>
            ↺
          </button>
        </div>
      ))}
    </div>
  )
}

function Takes(): React.JSX.Element {
  const store = useProject()
  const scene = store.currentScene()!
  const shot = store.currentShot()!
  if (!shot.takes.length) return <></>
  const glyph = { circled: '⭕', good: '·', 'no-good': '✕' }
  return (
    <div className="setup-group">
      <div className="setup-group-title">Takes Log</div>
      {shot.takes.slice(0, 10).map((t) => (
        <div key={t.id} className="setup-row" title={t.prompt.slice(0, 400)}>
          <span className="setup-label">
            {glyph[t.rating]} {t.model} <span className="row-meta">{new Date(t.loggedAt).toLocaleDateString()}</span>
          </span>
          <button
            className="btn btn-ghost btn-sm"
            title="Delete take"
            onClick={() =>
              store.mutate((p) => {
                const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
                if (s) s.takes = s.takes.filter((x) => x.id !== t.id)
              })
            }
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

function SceneExport(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const scene = store.currentScene()
  const [copied, setCopied] = useState<string | null>(null)
  if (!scene || !scene.shots.length) return <></>
  const copy = (text: string, tag: string): void => {
    void window.slate.copyText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1400)
  }
  return (
    <div className="setup-group">
      <div className="setup-group-title">Export Scene</div>
      <div style={{ padding: '4px 10px 10px', display: 'flex', gap: 6 }}>
        <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => copy(exportSceneMarkdown(project, scene), 'md')}>
          {copied === 'md' ? '✓' : 'Markdown shot list'}
        </button>
        <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => copy(exportSceneCsv(project, scene), 'csv')}>
          {copied === 'csv' ? '✓' : 'CSV'}
        </button>
      </div>
    </div>
  )
}
