// References — bring in stills and clips, break them down into element sheets.

import React, { useState } from 'react'
import { useProject, uid } from '../stores/project'
import { analyzeReference, elementSheetToSetups } from '../lib/brainTasks'
import type { ElementSheet, Reference, SectionId } from '../../../shared/types'

export default function ReferencesPanel(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addRefs = async (): Promise<void> => {
    const paths = await window.slate.pickMedia()
    for (const path of paths) {
      setBusy(path)
      setError(null)
      try {
        const { kind, frames } = await window.slate.ingestMedia(project.id, path)
        store.addReference({
          id: uid('ref'),
          path,
          kind,
          label: path.split('/').pop() ?? path,
          frames,
          elements: null,
          addedAt: new Date().toISOString()
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    setBusy(null)
  }

  const analyze = async (ref: Reference): Promise<void> => {
    setBusy(ref.id)
    setError(null)
    const res = await analyzeReference(project, ref.frames, ref.kind)
    setBusy(null)
    if (res.ok && res.json) {
      store.mutate((p) => {
        const r = p.references.find((x) => x.id === ref.id)
        if (r) r.elements = res.json as ElementSheet
      })
    } else setError(res.error ?? 'Analysis failed — is the brain signed in?')
  }

  const saveElements = (ref: Reference): void => {
    if (!ref.elements) return
    for (const s of elementSheetToSetups(ref.elements)) {
      store.upsertSetup({
        id: uid('setup'),
        label: `${s.label} (${ref.label.slice(0, 18)})`,
        snippet: s.snippet,
        section: s.section as SectionId,
        tags: ['reference'],
        favorite: false
      })
    }
  }

  return (
    <div className="scroll">
      <div style={{ padding: 10 }}>
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => void addRefs()} disabled={!!busy}>
          + Add images or clips
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
          Clips are broken into key frames locally (ffmpeg). Media stays where it lives — Slate links
          it, never copies it.
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>

      {project.references.length === 0 && (
        <div className="empty" style={{ height: 'auto', padding: '30px 20px' }}>
          <p>Drop in a frame from a film you love or a take you generated — the brain breaks down its lensing, light, palette and movement into elements you can prompt with.</p>
        </div>
      )}

      {project.references.map((ref) => (
        <div key={ref.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {ref.label}
            </b>
            <span className="row-meta">
              {ref.kind}
              {ref.kind === 'video' ? ` · ${ref.frames.length} frames` : ''}
            </span>
          </div>

          {ref.frames.length > 0 && (
            <div className="ref-frames">
              {ref.frames.slice(0, 6).map((f) => (
                <img key={f} src={`file://${f}`} alt="" />
              ))}
            </div>
          )}

          {ref.elements ? (
            <details style={{ fontSize: 12, color: 'var(--ink-2)', margin: '6px 0' }} open>
              <summary style={{ cursor: 'pointer', color: 'var(--key)' }}>Element sheet</summary>
              {(['lensing', 'lighting', 'palette', 'composition', 'movement', 'texture', 'mood', 'notes'] as const).map((k) => (
                <p key={k} style={{ margin: '5px 0' }}>
                  <b style={{ color: 'var(--ink-1)', textTransform: 'capitalize' }}>{k}:</b> {ref.elements![k]}
                </p>
              ))}
            </details>
          ) : null}

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {!ref.elements && (
              <button className="btn btn-sm btn-key" disabled={busy === ref.id} onClick={() => void analyze(ref)}>
                {busy === ref.id ? 'Breaking down…' : 'Break Down'}
              </button>
            )}
            {ref.elements && (
              <button className="btn btn-sm" onClick={() => saveElements(ref)} title="Save each element as a My Setup for one-click reuse">
                Save Elements as Setups
              </button>
            )}
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeReference(ref.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
