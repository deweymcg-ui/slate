import React, { useMemo, useState } from 'react'
import { useProject, uid } from '../stores/project'
import setupsData from '../../../../data/setups.json'
import coverageData from '../../../../data/coverage-plans.json'
import Studios from './Studios'
import ReferencesPanel from './ReferencesPanel'
import DeliverPanel from './DeliverPanel'
import { generateCoverage, chunkSequence, secondUnit, continuityCheck, type CoverageShotPlan } from '../lib/brainTasks'
import { blankShot } from '../stores/project'
import type { SectionId, CustomSetup } from '../../../shared/types'

type Tab = 'setups' | 'coverage' | 'studios' | 'refs' | 'deliver'

interface SetupItem {
  id: string
  label: string
  snippet: string
  tags: string[]
  section: string
}

interface SetupCategory {
  id: string
  label: string
  group: string
  setups: SetupItem[]
}

interface CoveragePlan {
  id: string
  label: string
  group: string
  description: string
  shots: CoverageShotPlan[]
}

const CATEGORIES = (setupsData as { categories: SetupCategory[] }).categories
const PLANS = (coverageData as { plans: CoveragePlan[] }).plans

export default function RightRail(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('setups')
  return (
    <>
      <div className="tabs">
        {(
          [
            ['setups', 'Setups'],
            ['coverage', 'Coverage'],
            ['studios', 'Studios'],
            ['refs', 'Refs'],
            ['deliver', 'Deliver']
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'setups' && <SetupsPanel />}
      {tab === 'coverage' && <CoveragePanel />}
      {tab === 'studios' && <Studios />}
      {tab === 'refs' && <ReferencesPanel />}
      {tab === 'deliver' && <DeliverPanel />}
    </>
  )
}

// ---------- Setups ----------

function SetupsPanel(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const shot = store.currentShot()
  const [q, setQ] = useState('')
  const [openCat, setOpenCat] = useState<string | null>(null)

  const query = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!query) return CATEGORIES
    return CATEGORIES.map((c) => ({
      ...c,
      setups: c.setups.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.snippet.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      )
    })).filter((c) => c.setups.length > 0)
  }, [query])

  const insert = (snippet: string, section: string): void => {
    if (!shot) return
    const scene = store.currentScene()!
    store.mutate((p) => {
      const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
      if (!s) return
      const header = `# ${section.charAt(0).toUpperCase() + section.slice(1)}`
      if (s.prompt.includes(header)) {
        // Append to the existing section.
        const lines = s.prompt.split('\n')
        const idx = lines.findIndex((l) => l.trim() === header)
        let end = idx + 1
        while (end < lines.length && !lines[end].startsWith('# ')) end++
        lines.splice(end, 0, snippet)
        s.prompt = lines.join('\n')
      } else {
        s.prompt = (s.prompt.trim() ? s.prompt.trimEnd() + '\n\n' : '') + `${header}\n${snippet}`
      }
    })
  }

  const saveCustom = (): void => {
    if (!shot) return
    const sel = window.getSelection()?.toString().trim()
    const snippet = sel || shot.prompt
    if (!snippet.trim()) return
    const label = prompt('Name this Setup:')
    if (!label) return
    store.upsertSetup({
      id: uid('setup'),
      label,
      snippet,
      section: 'style' as SectionId,
      tags: [],
      favorite: true
    })
  }

  const groups = [...new Set(filtered.map((c) => c.group))]

  return (
    <>
      <div style={{ padding: '10px 10px 6px' }}>
        <input
          placeholder="Search all setups…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <div className="scroll">
        {project.mySetups.length > 0 && (
          <div className="setup-group">
            <div className="setup-group-title">My Setups</div>
            {project.mySetups.map((s) => (
              <SetupRow
                key={s.id}
                label={s.label}
                snippet={s.snippet}
                onInsert={() => insert(s.snippet, s.section)}
                onDelete={() => store.removeSetup(s.id)}
              />
            ))}
          </div>
        )}
        {groups.map((g) => (
          <div key={g} className="setup-group">
            <div className="setup-group-title">{g}</div>
            {filtered
              .filter((c) => c.group === g)
              .map((c) => (
                <div key={c.id}>
                  <div
                    className="row"
                    onClick={() => setOpenCat(openCat === c.id ? null : c.id)}
                    style={{ fontWeight: 550 }}
                  >
                    <span className="row-label">{c.label}</span>
                    <span className="row-meta">{c.setups.length}</span>
                  </div>
                  {(openCat === c.id || query) &&
                    c.setups.map((s) => (
                      <SetupRow key={s.id} label={s.label} snippet={s.snippet} onInsert={() => insert(s.snippet, s.section)} />
                    ))}
                </div>
              ))}
          </div>
        ))}
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={saveCustom} disabled={!shot}>
          + Save selection as My Setup
        </button>
      </div>
    </>
  )
}

function SetupRow({
  label,
  snippet,
  onInsert,
  onDelete
}: {
  label: string
  snippet: string
  onInsert(): void
  onDelete?(): void
}): React.JSX.Element {
  return (
    <div className="setup-row" title={snippet}>
      <span className="setup-label">{label}</span>
      <button className="btn btn-ghost btn-sm" title="Insert into prompt" onClick={onInsert}>
        ↩
      </button>
      {onDelete && (
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete}>
          ✕
        </button>
      )}
    </div>
  )
}

// ---------- Coverage ----------

function CoveragePanel(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const scene = store.currentScene()
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customAsk, setCustomAsk] = useState('')
  const [chunkTotal, setChunkTotal] = useState(180)
  const [chunkSize, setChunkSize] = useState(20)
  const [beatDirected, setBeatDirected] = useState(true)
  const [report, setReport] = useState<Array<{ severity: string; shots: string[]; issue: string; fix: string }> | null>(null)

  if (!scene) {
    return (
      <div className="empty">
        <p>Select a scene to direct coverage.</p>
      </div>
    )
  }

  const addShots = (shots: Array<{ name: string; intent?: string; prompt: string; size?: string; angle?: string; movement?: string }>): void => {
    store.mutate((p) => {
      const sc = p.scenes.find((x) => x.id === scene.id)
      if (!sc) return
      for (const s of shots) {
        const shot = blankShot(s.name, p.defaults)
        shot.intent = s.intent ?? ''
        shot.prompt = s.prompt
        if (s.size) shot.spec.size = s.size
        if (s.angle) shot.spec.angle = s.angle
        if (s.movement) shot.spec.movement = s.movement
        sc.shots.push(shot)
      }
    })
  }

  const runPlan = async (plan: CoveragePlan | null): Promise<void> => {
    const description = desc.trim() || scene.synopsis
    if (!description) {
      setError('Describe the scene first (or fill the scene synopsis).')
      return
    }
    setBusy(plan?.id ?? 'custom')
    setError(null)
    const res = await generateCoverage(project, scene, description, plan, plan ? null : customAsk.trim())
    setBusy(null)
    if (res.ok && res.json) {
      addShots((res.json as { shots: Array<{ name: string; intent: string; prompt: string; size: string; angle: string; movement: string }> }).shots)
    } else setError(res.error ?? 'Coverage failed.')
  }

  const runChunks = async (): Promise<void> => {
    const description = desc.trim() || scene.synopsis
    if (!description) {
      setError('Describe the sequence first.')
      return
    }
    setBusy('chunks')
    setError(null)
    const res = await chunkSequence(project, scene, description, chunkTotal, chunkSize, beatDirected)
    setBusy(null)
    if (res.ok && res.json) {
      const chunks = (res.json as { chunks: Array<{ name: string; startSec: number; endSec: number; prompt: string; handoff: string }> }).chunks
      addShots(
        chunks.map((c) => ({
          name: c.name,
          intent: `Handoff: ${c.handoff}`,
          prompt: c.prompt
        }))
      )
      store.mutate((p) => {
        const sc = p.scenes.find((x) => x.id === scene.id)
        if (!sc) return
        const added = sc.shots.slice(-chunks.length)
        added.forEach((s, i) => {
          s.spec.durationSec = chunks[i].endSec - chunks[i].startSec
        })
      })
    } else setError(res.error ?? 'Chunking failed.')
  }

  const runSecondUnit = async (): Promise<void> => {
    setBusy('second-unit')
    setError(null)
    const last = scene.shots[scene.shots.length - 1] ?? null
    const res = await secondUnit(project, scene, last)
    setBusy(null)
    if (res.ok && res.json) {
      addShots((res.json as { shots: Array<{ name: string; intent: string; prompt: string }> }).shots)
    } else setError(res.error ?? 'Second unit failed.')
  }

  const runContinuity = async (): Promise<void> => {
    if (!scene.shots.length) return
    setBusy('continuity')
    setError(null)
    const res = await continuityCheck(project, scene)
    setBusy(null)
    if (res.ok && res.json) setReport((res.json as { issues: typeof report }).issues ?? [])
    else setError(res.error ?? 'Continuity check failed.')
  }

  const groups = [...new Set(PLANS.map((p) => p.group))]

  return (
    <div className="scroll">
      <div style={{ padding: '10px 10px 4px' }}>
        <label>Scene / sequence description</label>
        <textarea
          rows={4}
          placeholder={scene.synopsis ? `Defaults to synopsis: “${scene.synopsis.slice(0, 80)}…”` : 'What happens in this scene? Who, where, what changes…'}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      {error && <div style={{ color: 'var(--danger)', padding: '4px 12px', fontSize: 12 }}>{error}</div>}
      {busy && (
        <div className="thinking" style={{ padding: '4px 12px' }}>
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          &nbsp;directing coverage
        </div>
      )}

      {groups.map((g) => (
        <div key={g} className="setup-group">
          <div className="setup-group-title">{g}</div>
          {PLANS.filter((p) => p.group === g).map((plan) => (
            <div key={plan.id} className="setup-row" title={plan.description}>
              <span className="setup-label">
                {plan.label} <span className="row-meta">({plan.shots.length})</span>
              </span>
              <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void runPlan(plan)} title={`Generate ${plan.shots.length} shots`}>
                {busy === plan.id ? '…' : '⚡'}
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="setup-group">
        <div className="setup-group-title">Call Your Own</div>
        <div style={{ padding: '4px 10px 8px' }}>
          <input
            placeholder='e.g. "give me 5 shots, mostly long lens, no drone"'
            value={customAsk}
            onChange={(e) => setCustomAsk(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
          />
          <button className="btn btn-sm" style={{ width: '100%' }} disabled={!!busy || !customAsk.trim()} onClick={() => void runPlan(null)}>
            Direct It
          </button>
        </div>
      </div>

      <div className="setup-group">
        <div className="setup-group-title">Sequence Chunks</div>
        <div style={{ padding: '4px 10px 8px' }}>
          <div className="grid-2" style={{ marginBottom: 6 }}>
            <div>
              <label>Total (s)</label>
              <input type="number" min={10} value={chunkTotal} onChange={(e) => setChunkTotal(Number(e.target.value) || 60)} style={{ width: '100%' }} />
            </div>
            <div>
              <label>Chunk (s)</label>
              <input type="number" min={4} value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value) || 15)} style={{ width: '100%' }} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={beatDirected} onChange={(e) => setBeatDirected(e.target.checked)} style={{ width: 'auto' }} />
            Timecoded beats inside each chunk
          </label>
          <button className="btn btn-sm" style={{ width: '100%', marginTop: 6 }} disabled={!!busy} onClick={() => void runChunks()}>
            {busy === 'chunks' ? '…' : `Break into ~${chunkSize}s chunks`}
          </button>
        </div>
      </div>

      <div className="setup-group">
        <div className="setup-group-title">Scene Tools</div>
        <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-sm" disabled={!!busy} onClick={() => void runSecondUnit()} title="3 shots a second-unit director would grab next">
            {busy === 'second-unit' ? '…' : 'Second Unit — extend the scene'}
          </button>
          <button className="btn btn-sm" disabled={!!busy || !scene.shots.length} onClick={() => void runContinuity()}>
            {busy === 'continuity' ? '…' : 'Continuity Check'}
          </button>
        </div>
      </div>

      {report && (
        <div className="modal-scrim" onClick={() => setReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Continuity Report — {scene.name}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setReport(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {report.length === 0 ? (
                <p style={{ color: 'var(--ok)' }}>✓ Clean. No continuity issues found across {scene.shots.length} shots.</p>
              ) : (
                report.map((r, i) => (
                  <div key={i} className="card" style={{ margin: '0 0 10px' }}>
                    <div style={{ color: r.severity === 'error' ? 'var(--danger)' : 'var(--warn)', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                      {r.severity.toUpperCase()} · {r.shots.join(' ↔ ')}
                    </div>
                    <div style={{ marginBottom: 4 }}>{r.issue}</div>
                    <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>Fix: {r.fix}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
