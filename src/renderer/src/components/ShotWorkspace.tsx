import React, { useMemo, useState } from 'react'
import { useProject } from '../stores/project'
import PromptEditor from './PromptEditor'
import NotesDock from './NotesDock'
import {
  transformPrompt,
  pickupSpan,
  promptVariants,
  altTake,
  toneDial,
  punchUps,
  beatSheetForShot,
  type TransformKind
} from '../lib/brainTasks'
import type { Shot, Variant } from '../../../shared/types'

const TRANSFORMS: Array<{ kind: TransformKind; label: string; hint: string }> = [
  { kind: 'structure', label: 'Structure', hint: 'Organize into sections' },
  { kind: 'tighten', label: 'Tighten', hint: 'Cut a third, keep the facts' },
  { kind: 'enrich', label: 'Enrich', hint: 'Deepen the craft detail' },
  { kind: 'distill', label: 'Distill', hint: 'Strip to the core' },
  { kind: 'shot', label: 'Shot', hint: 'Rework framing & blocking' },
  { kind: 'angle', label: 'Angle', hint: 'Bolder camera perspective' }
]

const SIZES = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'Insert']
const ANGLES = ['eye level', 'low', 'high', 'overhead', 'dutch', 'over-shoulder', 'POV']
const MOVES = ['locked', 'handheld', 'push-in', 'pull-back', 'orbit', 'pan', 'tilt', 'track', 'crane', 'drone', 'steadicam']
const LENSES = ['14mm', '24mm', '35mm', '50mm', '85mm', '135mm', 'anamorphic', 'macro', 'tilt-shift']

interface Props {
  railOpen: boolean
  onToggleRail(): void
}

export default function ShotWorkspace({ railOpen, onToggleRail }: Props): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const scene = store.currentScene()
  const shot = store.currentShot()
  const [busy, setBusy] = useState<string | null>(null)
  const [selection, setSelection] = useState<{ text: string; from: number; to: number } | null>(null)
  const [pickupAsk, setPickupAsk] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [variants, setVariants] = useState<Variant[] | null>(null)
  const [showAlt, setShowAlt] = useState(false)
  const [showTone, setShowTone] = useState(false)

  const charCount = shot?.prompt.length ?? 0
  const budget = shot?.maxChars ?? null

  const runTransform = async (kind: TransformKind): Promise<void> => {
    if (!shot || !shot.prompt.trim() || busy) return
    setBusy(kind)
    setError(null)
    const res = await transformPrompt(project, scene, shot, kind)
    setBusy(null)
    if (res.ok && res.text.trim()) store.setPrompt(res.text.trim(), `before ${kind}`)
    else setError(res.error ?? 'The brain returned nothing — try again.')
  }

  const runPickup = async (): Promise<void> => {
    if (!shot || !selection || !pickupAsk.trim() || busy) return
    setBusy('pickup')
    setError(null)
    const res = await pickupSpan(project, scene, shot, selection.text, pickupAsk.trim())
    setBusy(null)
    if (res.ok && res.text.trim()) {
      const next =
        shot.prompt.slice(0, selection.from) + res.text.trim() + shot.prompt.slice(selection.to)
      store.setPrompt(next, 'before pickup')
      setSelection(null)
      setPickupAsk('')
    } else setError(res.error ?? 'Pickup failed — try again.')
  }

  const runVariants = async (): Promise<void> => {
    if (!shot || !shot.prompt.trim() || busy) return
    setBusy('variants')
    setError(null)
    const res = await promptVariants(project, scene, shot, 4)
    setBusy(null)
    if (res.ok && res.json) {
      const v = (res.json as { variants: Array<{ label: string; prompt: string }> }).variants
      setVariants(v.map((x, i) => ({ id: `var-${i}`, label: x.label, prompt: x.prompt })))
    } else setError(res.error ?? 'Variant generation failed.')
  }

  const runPunchUps = async (): Promise<void> => {
    if (!shot || !shot.prompt.trim() || busy) return
    setBusy('punch-ups')
    setError(null)
    const res = await punchUps(project, scene, shot)
    setBusy(null)
    if (res.ok && res.json) {
      const riffs = (res.json as { riffs: Array<{ pitch: string; prompt: string }> }).riffs
      setVariants(riffs.map((r, i) => ({ id: `riff-${i}`, label: r.pitch, prompt: r.prompt })))
    } else setError(res.error ?? 'Punch-ups failed.')
  }

  const runBeats = async (): Promise<void> => {
    if (!shot || !shot.prompt.trim() || busy) return
    setBusy('beats')
    setError(null)
    const res = await beatSheetForShot(project, scene, shot)
    setBusy(null)
    if (res.ok && res.json) {
      const beats = (res.json as { beats: Array<{ from: number; to: number; text: string }> }).beats
      store.mutate((p) => {
        const s = p.scenes.find((x) => x.id === scene?.id)?.shots.find((x) => x.id === shot.id)
        if (s) s.beatSheet = beats
      })
    } else setError(res.error ?? 'Beat sheet failed.')
  }

  if (!scene) {
    return (
      <div className="empty">
        <div className="glyph">◆</div>
        <h3>No scene selected</h3>
        <p>Pick a scene on the left, or create one to start building shots.</p>
      </div>
    )
  }

  if (!shot) {
    return (
      <div className="empty">
        <div className="glyph">🎞</div>
        <h3>{scene.name}</h3>
        <p>
          Add a shot from the left rail — or open <b>Coverage</b> on the right and let the brain lay
          out the whole scene.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Shot header + spec bar */}
      <div className="shot-head">
        <input
          className="shot-name"
          value={shot.name}
          onChange={(e) =>
            store.mutate((p) => {
              const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
              if (s) s.name = e.target.value
            })
          }
        />
        <input
          className="shot-intent"
          placeholder="Intent — what must this shot accomplish?"
          value={shot.intent}
          onChange={(e) =>
            store.mutate((p) => {
              const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
              if (s) s.intent = e.target.value
            })
          }
        />
        <button className="btn btn-ghost btn-sm" onClick={onToggleRail} title="Toggle right rail">
          {railOpen ? '⇥' : '⇤'}
        </button>
      </div>

      <SpecBar shot={shot} />

      {/* Transform toolbar */}
      <div className="toolbar">
        {TRANSFORMS.map((t) => (
          <button
            key={t.kind}
            className="btn btn-sm"
            title={t.hint}
            disabled={!!busy || !shot.prompt.trim()}
            onClick={() => void runTransform(t.kind)}
          >
            {busy === t.kind ? '…' : t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" disabled={!!busy || !shot.prompt.trim()} onClick={() => void runVariants()} title="4 differently-weighted versions to A/B in your generator">
          {busy === 'variants' ? '…' : 'Variants'}
        </button>
        <button className="btn btn-sm" disabled={!!busy || !shot.prompt.trim()} onClick={() => void runPunchUps()} title="Bold what-if riffs on this shot">
          {busy === 'punch-ups' ? '…' : 'Punch-Ups'}
        </button>
        <button className="btn btn-sm" disabled={!!busy || !shot.prompt.trim()} onClick={() => setShowAlt(true)} title="Roll chosen elements, keep the rest">
          Alt Take
        </button>
        <button className="btn btn-sm" disabled={!!busy || !shot.prompt.trim()} onClick={() => setShowTone(true)} title="Dial the emotional tone">
          Tone
        </button>
        <button className="btn btn-sm" disabled={!!busy || !shot.prompt.trim()} onClick={() => void runBeats()} title="Break the shot into timecoded beats">
          {busy === 'beats' ? '…' : 'Beats'}
        </button>
      </div>

      {/* Editor */}
      <div className="editor-wrap">
        <PromptEditor
          value={shot.prompt}
          lockedLines={shot.lockedLines}
          mutedLines={shot.mutedLines}
          onChange={(text) => store.setPrompt(text)}
          onToggleLock={(line) =>
            store.mutate((p) => {
              const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
              if (!s) return
              s.lockedLines = s.lockedLines.includes(line)
                ? s.lockedLines.filter((n) => n !== line)
                : [...s.lockedLines, line]
            })
          }
          onToggleMute={(line) =>
            store.mutate((p) => {
              const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
              if (!s) return
              s.mutedLines = s.mutedLines.includes(line)
                ? s.mutedLines.filter((n) => n !== line)
                : [...s.mutedLines, line]
            })
          }
          onSelection={setSelection}
        />

        {/* Pickups popover */}
        {selection && (
          <div className="pickup-bar">
            <span className="pickup-label">
              Pickup: <i>“{selection.text.length > 48 ? selection.text.slice(0, 48) + '…' : selection.text}”</i>
            </span>
            <input
              autoFocus
              placeholder="What should change in just this span?"
              value={pickupAsk}
              onChange={(e) => setPickupAsk(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runPickup()}
            />
            <button className="btn btn-key btn-sm" disabled={!pickupAsk.trim() || !!busy} onClick={() => void runPickup()}>
              {busy === 'pickup' ? '…' : 'Reshoot Span'}
            </button>
          </div>
        )}

        {/* Beat sheet strip */}
        {shot.beatSheet && shot.beatSheet.length > 0 && (
          <div className="beat-strip">
            <span className="panel-title" style={{ marginRight: 6 }}>
              Beats
            </span>
            {shot.beatSheet.map((b, i) => (
              <span key={i} className="chip" title={b.text}>
                {b.from}–{b.to}s
              </span>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                store.mutate((p) => {
                  const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
                  if (s) s.beatSheet = null
                })
              }
            >
              clear
            </button>
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="status-line">
        {busy && (
          <span className="thinking">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            &nbsp;the brain is working
          </span>
        )}
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
        <div style={{ flex: 1 }} />
        <span className="char-count" data-over={budget && charCount > budget ? '1' : '0'}>
          {charCount.toLocaleString()} chars{budget ? ` / ${budget.toLocaleString()}` : ''}
        </span>
      </div>

      <NotesDock />

      {/* Variants / riffs modal */}
      {variants && (
        <div className="modal-scrim" onClick={() => setVariants(null)}>
          <div className="modal" style={{ width: 'min(860px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Pick a take</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setVariants(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body variant-grid">
              {variants.map((v) => (
                <div key={v.id} className="variant-card">
                  <div className="variant-label">{v.label}</div>
                  <pre className="variant-prompt">{v.prompt}</pre>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-key btn-sm"
                      onClick={() => {
                        store.setPrompt(v.prompt, 'before variant')
                        setVariants(null)
                      }}
                    >
                      Use This
                    </button>
                    <button className="btn btn-sm" onClick={() => void window.slate.copyText(v.prompt)}>
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAlt && (
        <AltTakeModal
          onClose={() => setShowAlt(false)}
          onRun={async (roll, keep, rules) => {
            setShowAlt(false)
            setBusy('alt')
            const res = await altTake(project, scene, shot, roll, keep, rules)
            setBusy(null)
            if (res.ok && res.text.trim()) store.setPrompt(res.text.trim(), 'before alt take')
            else setError(res.error ?? 'Alt take failed.')
          }}
        />
      )}

      {showTone && (
        <ToneModal
          onClose={() => setShowTone(false)}
          onRun={async (emotion, intensity) => {
            setShowTone(false)
            setBusy('tone')
            const res = await toneDial(project, scene, shot, emotion, intensity)
            setBusy(null)
            if (res.ok && res.text.trim()) store.setPrompt(res.text.trim(), `before tone: ${emotion}`)
            else setError(res.error ?? 'Tone dial failed.')
          }}
        />
      )}
    </>
  )
}

function SpecBar({ shot }: { shot: Shot }): React.JSX.Element {
  const store = useProject()
  const scene = store.currentScene()!
  const set = (fn: (s: Shot) => void): void =>
    store.mutate((p) => {
      const s = p.scenes.find((x) => x.id === scene.id)?.shots.find((x) => x.id === shot.id)
      if (s) fn(s)
    })

  return (
    <div className="spec-bar">
      <span className="spec-item">
        <label>Len</label>
        <input
          type="number"
          min={1}
          max={600}
          value={shot.spec.durationSec ?? ''}
          placeholder="s"
          onChange={(e) => set((s) => (s.spec.durationSec = e.target.value ? Number(e.target.value) : null))}
        />
      </span>
      <span className="spec-item">
        <label>FPS</label>
        <input
          type="number"
          min={1}
          max={240}
          value={shot.spec.fps ?? ''}
          onChange={(e) => set((s) => (s.spec.fps = e.target.value ? Number(e.target.value) : null))}
        />
      </span>
      <span className="spec-item">
        <label>AR</label>
        <select value={shot.spec.aspectRatio ?? ''} onChange={(e) => set((s) => (s.spec.aspectRatio = e.target.value || null))}>
          <option value="">—</option>
          {['16:9', '2.39:1', '1.85:1', '9:16', '4:5', '1:1', '4:3'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </span>
      <span className="spec-item">
        <label>Size</label>
        <select value={shot.spec.size ?? ''} onChange={(e) => set((s) => (s.spec.size = e.target.value || null))}>
          <option value="">—</option>
          {SIZES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </span>
      <span className="spec-item">
        <label>Angle</label>
        <select value={shot.spec.angle ?? ''} onChange={(e) => set((s) => (s.spec.angle = e.target.value || null))}>
          <option value="">—</option>
          {ANGLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </span>
      <span className="spec-item">
        <label>Lens</label>
        <select value={shot.spec.lens ?? ''} onChange={(e) => set((s) => (s.spec.lens = e.target.value || null))}>
          <option value="">—</option>
          {LENSES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </span>
      <span className="spec-item">
        <label>Move</label>
        <select value={shot.spec.movement ?? ''} onChange={(e) => set((s) => (s.spec.movement = e.target.value || null))}>
          <option value="">—</option>
          {MOVES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </span>
      <span className="spec-item">
        <label>Max Chars</label>
        <input
          type="number"
          min={0}
          step={50}
          value={shot.maxChars ?? ''}
          placeholder="∞"
          onChange={(e) => set((s) => (s.maxChars = e.target.value ? Number(e.target.value) : null))}
        />
      </span>
    </div>
  )
}

function AltTakeModal({
  onClose,
  onRun
}: {
  onClose(): void
  onRun(roll: string[], keep: string[], rules: string): void
}): React.JSX.Element {
  const ELEMENTS = ['angle', 'lens', 'lighting', 'palette', 'composition', 'movement', 'time of day', 'weather', 'mood']
  const [roll, setRoll] = useState<string[]>(['angle'])
  const [rules, setRules] = useState('')
  const toggle = (e: string): void => setRoll((r) => (r.includes(e) ? r.filter((x) => x !== e) : [...r, e]))
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Alt Take — roll the dice on…</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {ELEMENTS.map((e) => (
              <span key={e} className={`chip ${roll.includes(e) ? 'on' : ''}`} onClick={() => toggle(e)}>
                {e}
              </span>
            ))}
          </div>
          <div className="field">
            <label>Rules (optional)</label>
            <input
              placeholder='e.g. "if the angle goes low, keep the lens wide"'
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-key"
            disabled={!roll.length}
            onClick={() => onRun(roll, ELEMENTS.filter((e) => !roll.includes(e)), rules)}
          >
            Roll It
          </button>
        </div>
      </div>
    </div>
  )
}

function ToneModal({
  onClose,
  onRun
}: {
  onClose(): void
  onRun(emotion: string, intensity: number): void
}): React.JSX.Element {
  const EMOTIONS = ['tension', 'dread', 'wonder', 'melancholy', 'euphoria', 'isolation', 'menace', 'serenity', 'chaos', 'intimacy', 'triumph', 'nostalgia']
  const [emotion, setEmotion] = useState('tension')
  const [intensity, setIntensity] = useState(7)
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Tone Dial</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {EMOTIONS.map((e) => (
              <span key={e} className={`chip ${emotion === e ? 'on' : ''}`} onClick={() => setEmotion(e)}>
                {e}
              </span>
            ))}
          </div>
          <div className="field">
            <label>
              Intensity — {intensity}/10
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              style={{ width: '100%', padding: 0 }}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-key" onClick={() => onRun(emotion, intensity)}>
            Dial It In
          </button>
        </div>
      </div>
    </div>
  )
}
