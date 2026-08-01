// Sound Department — Score (music cues) and Voice Casting, compiled per target.

import React, { useState } from 'react'
import { useProject, uid } from '../stores/project'
import {
  MUSIC_PROFILES,
  VOICE_PROFILES,
  fillMusicCue,
  writeLyrics,
  fillVoice,
  compileMusicPrompt,
  compileVoicePrompt,
  analyzeMusicRef,
  analyzeVoiceRef,
  blankCue,
  blankVoice
} from '../lib/sound'
import type { MusicCue, VoiceSheet, AudioFingerprint } from '../../../shared/types'

/** Drop or pick an audio/video file → local acoustic fingerprint → brain style breakdown. */
function AudioRefZone({
  label,
  onAnalyzed
}: {
  label: string
  onAnalyzed(fp: AudioFingerprint, hint: string): Promise<void>
}): React.JSX.Element {
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = async (path: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const fp = await window.slate.analyzeAudio(path)
      await onAnalyzed(fp, hint.trim())
      setHint('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const pick = async (): Promise<void> => {
    const paths = await window.slate.pickAudio()
    if (paths[0]) await analyze(paths[0])
  }

  return (
    <div
      className={`audio-drop ${drag ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const file = e.dataTransfer.files[0]
        if (!file) return
        const path = window.slate.pathForFile(file)
        if (path) void analyze(path)
      }}
    >
      <div className="audio-drop-label" onClick={() => void pick()}>
        {busy ? (
          <span className="thinking">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            &nbsp;listening to the reference
          </span>
        ) : (
          <>♫ {label} — drop a file or click</>
        )}
      </div>
      <input
        placeholder='Optional: what is it? — "vault-heist score", "70s radio DJ"'
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      {error && <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 4 }}>{error}</div>}
    </div>
  )
}

interface Compiled {
  prompt: string
  lyrics?: string
  previewText?: string
  params?: Record<string, unknown>
  warnings?: string[]
}

export default function SoundDept(): React.JSX.Element {
  const [mode, setMode] = useState<'score' | 'voices'>('score')
  return (
    <>
      <div className="tabs" style={{ margin: '8px 8px 0' }}>
        <button className={`tab ${mode === 'score' ? 'active' : ''}`} onClick={() => setMode('score')}>
          Score
        </button>
        <button className={`tab ${mode === 'voices' ? 'active' : ''}`} onClick={() => setMode('voices')}>
          Voices
        </button>
      </div>
      {mode === 'score' ? <Score /> : <Voices />}
    </>
  )
}

function CompiledView({ c, onClose }: { c: Compiled & { label: string }; onClose(): void }): React.JSX.Element {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, tag: string): void => {
    void window.slate.copyText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1400)
  }
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Prompt for {c.label}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {c.warnings?.map((w, i) => (
            <div key={i} className="preflight-warn" style={{ marginTop: 0, marginBottom: 10 }}>
              ⚠ {w}
            </div>
          ))}
          <div className="compiled-box">
            <div className="compiled-head">
              <span className="panel-title">Prompt</span>
              <button className="btn btn-sm" onClick={() => copy(c.prompt, 'p')}>
                {copied === 'p' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <pre>{c.prompt}</pre>
          </div>
          {c.lyrics && (
            <div className="compiled-box">
              <div className="compiled-head">
                <span className="panel-title">Lyrics</span>
                <button className="btn btn-sm" onClick={() => copy(c.lyrics!, 'l')}>
                  {copied === 'l' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre>{c.lyrics}</pre>
            </div>
          )}
          {c.previewText && (
            <div className="compiled-box">
              <div className="compiled-head">
                <span className="panel-title">Audition Text</span>
                <button className="btn btn-sm" onClick={() => copy(c.previewText!, 't')}>
                  {copied === 't' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre>{c.previewText}</pre>
            </div>
          )}
          {c.params && Object.keys(c.params).length > 0 && (
            <div className="compiled-box">
              <div className="compiled-head">
                <span className="panel-title">Settings</span>
              </div>
              <pre>
                {Object.entries(c.params)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join('\n')}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Score ----------

function Score(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const cues = project.music ?? []
  const [editing, setEditing] = useState<MusicCue | null>(null)
  const [describe, setDescribe] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState(MUSIC_PROFILES[0]?.id ?? '')
  const [compiled, setCompiled] = useState<(Compiled & { label: string }) | null>(null)

  const autoFill = async (): Promise<void> => {
    if (!describe.trim() || !editing) return
    setBusy('fill')
    setError(null)
    const res = await fillMusicCue(project, describe.trim(), store.currentScene())
    setBusy(null)
    if (res.ok && res.json) {
      const f = res.json as Record<string, unknown>
      setEditing({
        ...editing,
        name: String(f.name ?? editing.name),
        intent: String(f.intent ?? ''),
        genre: String(f.genre ?? ''),
        mood: String(f.mood ?? ''),
        tempo: String(f.tempo ?? ''),
        instrumentation: String(f.instrumentation ?? ''),
        era: String(f.era ?? ''),
        structure: String(f.structure ?? ''),
        vocals: (['instrumental', 'vocals', 'either'].includes(String(f.vocals)) ? f.vocals : 'instrumental') as MusicCue['vocals'],
        lyricTheme: String(f.lyricTheme ?? ''),
        durationSec: typeof f.durationSec === 'number' ? f.durationSec : editing.durationSec
      })
    } else setError(res.error ?? 'Fill failed.')
  }

  const genLyrics = async (): Promise<void> => {
    if (!editing) return
    setBusy('lyrics')
    setError(null)
    const res = await writeLyrics(project, editing)
    setBusy(null)
    if (res.ok && res.text.trim()) setEditing({ ...editing, lyrics: res.text.trim() })
    else setError(res.error ?? 'Lyrics failed.')
  }

  const compile = async (cue: MusicCue): Promise<void> => {
    const profile = MUSIC_PROFILES.find((m) => m.id === target)
    if (!profile) return
    setBusy(cue.id)
    setError(null)
    const res = await compileMusicPrompt(project, cue, profile)
    setBusy(null)
    if (res.ok && res.json) setCompiled({ ...(res.json as Compiled), label: profile.label })
    else setError(res.error ?? 'Compile failed.')
  }

  if (editing) {
    const set = (patch: Partial<MusicCue>): void => setEditing({ ...editing, ...patch })
    return (
      <div className="scroll" style={{ padding: 12 }}>
        <div className="fill-bar">
          <input
            placeholder='Describe the cue — "tense pulse for the vault break-in"'
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void autoFill()}
          />
          <button className="btn btn-key btn-sm" disabled={busy === 'fill' || !describe.trim()} onClick={() => void autoFill()}>
            {busy === 'fill' ? '…' : '✦ Fill'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div className="grid-2">
          <div className="field">
            <label>Cue name</label>
            <input value={editing.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <label>Scene</label>
            <input value={editing.sceneRef} placeholder="optional" onChange={(e) => set({ sceneRef: e.target.value })} />
          </div>
        </div>
        {(
          [
            ['intent', 'Dramatic intent'],
            ['genre', 'Genre'],
            ['mood', 'Mood'],
            ['tempo', 'Tempo / BPM feel'],
            ['instrumentation', 'Instrumentation'],
            ['era', 'Era / sonic character'],
            ['structure', 'Structure / arc']
          ] as Array<[keyof MusicCue, string]>
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<MusicCue>)} />
          </div>
        ))}
        <div className="grid-2">
          <div className="field">
            <label>Vocals</label>
            <select value={editing.vocals} onChange={(e) => set({ vocals: e.target.value as MusicCue['vocals'] })}>
              <option value="instrumental">Instrumental</option>
              <option value="vocals">Vocals</option>
              <option value="either">Either</option>
            </select>
          </div>
          <div className="field">
            <label>Length (s)</label>
            <input
              type="number"
              min={5}
              value={editing.durationSec ?? ''}
              placeholder="—"
              onChange={(e) => set({ durationSec: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
        {editing.vocals !== 'instrumental' && (
          <>
            <div className="field">
              <label>Lyric theme</label>
              <input value={editing.lyricTheme} onChange={(e) => set({ lyricTheme: e.target.value })} />
            </div>
            <div className="field">
              <label>
                Lyrics{' '}
                <button className="btn btn-ghost btn-sm" style={{ textTransform: 'none', marginLeft: 6 }} disabled={busy === 'lyrics'} onClick={() => void genLyrics()}>
                  {busy === 'lyrics' ? 'writing…' : '✦ Write them'}
                </button>
              </label>
              <textarea rows={6} value={editing.lyrics} placeholder="[Verse]…" onChange={(e) => set({ lyrics: e.target.value })} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-key"
            disabled={!editing.name.trim()}
            onClick={() => {
              store.upsertMusic(editing)
              setEditing(null)
            }}
          >
            Save Cue
          </button>
          <button className="btn btn-ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll">
      <div style={{ padding: 10 }}>
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => setEditing(blankCue(uid('cue')))}>
          + New Music Cue
        </button>
        <AudioRefZone
          label="Match a track's vibe"
          onAnalyzed={async (fp, hint) => {
            const res = await analyzeMusicRef(project, fp, hint)
            if (res.ok && res.json) {
              const f = res.json as Record<string, unknown>
              setEditing({
                ...blankCue(uid('cue')),
                name: String(f.name ?? 'From reference'),
                intent: String(f.intent ?? ''),
                genre: String(f.genre ?? ''),
                mood: String(f.mood ?? ''),
                tempo: String(f.tempo ?? ''),
                instrumentation: String(f.instrumentation ?? ''),
                era: String(f.era ?? ''),
                structure: String(f.structure ?? ''),
                vocals: (['instrumental', 'vocals', 'either'].includes(String(f.vocals)) ? f.vocals : 'instrumental') as MusicCue['vocals'],
                lyricTheme: String(f.lyricTheme ?? ''),
                durationSec: typeof f.durationSec === 'number' ? f.durationSec : Math.round(fp.durationSec),
                notes: String(f.styleNotes ?? '')
              })
            } else setError(res.error ?? 'Style breakdown failed.')
          }}
        />
        <div style={{ marginTop: 8 }}>
          <label>Target</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: '100%' }}>
            {MUSIC_PROFILES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>
      {cues.length === 0 && (
        <div className="empty" style={{ height: 'auto', padding: '30px 20px' }}>
          <p>Spot your score. Describe a cue, let the brain design it, then compile the prompt for your music generator.</p>
        </div>
      )}
      {cues.map((cue) => (
        <div key={cue.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)' }}>{cue.name}</b>
            <span className="row-meta">
              {[cue.genre, cue.durationSec ? `${cue.durationSec}s` : null, cue.vocals].filter(Boolean).join(' · ')}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>{cue.intent.slice(0, 110)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-key" disabled={busy === cue.id} onClick={() => void compile(cue)}>
              {busy === cue.id ? 'Compiling…' : `Prompt →`}
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(cue)}>
              Edit
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeMusic(cue.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
      {compiled && <CompiledView c={compiled} onClose={() => setCompiled(null)} />}
    </div>
  )
}

// ---------- Voices ----------

function Voices(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const voices = project.voices ?? []
  const [editing, setEditing] = useState<VoiceSheet | null>(null)
  const [describe, setDescribe] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState(VOICE_PROFILES[0]?.id ?? '')
  const [compiled, setCompiled] = useState<(Compiled & { label: string }) | null>(null)

  const autoFill = async (): Promise<void> => {
    if (!describe.trim() || !editing) return
    setBusy('fill')
    setError(null)
    const character = project.characters.find((c) => c.id === editing.characterId)
    const res = await fillVoice(project, describe.trim(), character?.name ?? null)
    setBusy(null)
    if (res.ok && res.json) {
      const f = res.json as Record<string, string>
      setEditing({
        ...editing,
        name: f.name ?? editing.name,
        ageGender: f.ageGender ?? '',
        accent: f.accent ?? '',
        timbre: f.timbre ?? '',
        pitch: f.pitch ?? '',
        pacing: f.pacing ?? '',
        energy: f.energy ?? '',
        texture: f.texture ?? '',
        emotionalRange: f.emotionalRange ?? '',
        sampleLine: f.sampleLine ?? ''
      })
    } else setError(res.error ?? 'Fill failed.')
  }

  const compile = async (v: VoiceSheet): Promise<void> => {
    const profile = VOICE_PROFILES.find((x) => x.id === target)
    if (!profile) return
    setBusy(v.id)
    setError(null)
    const res = await compileVoicePrompt(project, v, profile)
    setBusy(null)
    if (res.ok && res.json) setCompiled({ ...(res.json as Compiled), label: profile.label })
    else setError(res.error ?? 'Compile failed.')
  }

  if (editing) {
    const set = (patch: Partial<VoiceSheet>): void => setEditing({ ...editing, ...patch })
    return (
      <div className="scroll" style={{ padding: 12 }}>
        <div className="field">
          <label>Link to character (optional)</label>
          <select
            value={editing.characterId ?? ''}
            onChange={(e) => {
              const c = project.characters.find((x) => x.id === e.target.value)
              set({ characterId: e.target.value || null, name: editing.name || c?.name || '' })
            }}
          >
            <option value="">— none —</option>
            {project.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fill-bar">
          <input
            placeholder='Describe it — "smoke-cured detective, dry wit, tired"'
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void autoFill()}
          />
          <button className="btn btn-key btn-sm" disabled={busy === 'fill' || !describe.trim()} onClick={() => void autoFill()}>
            {busy === 'fill' ? '…' : '✦ Fill'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        {(
          [
            ['name', 'Voice name'],
            ['ageGender', 'Age / gender'],
            ['accent', 'Accent'],
            ['timbre', 'Timbre'],
            ['pitch', 'Pitch'],
            ['pacing', 'Pacing'],
            ['energy', 'Energy'],
            ['texture', 'Texture / grain'],
            ['emotionalRange', 'Emotional range'],
            ['sampleLine', 'Sample line']
          ] as Array<[keyof VoiceSheet, string]>
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<VoiceSheet>)} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-key"
            disabled={!editing.name.trim()}
            onClick={() => {
              store.upsertVoice(editing)
              setEditing(null)
            }}
          >
            Save Voice
          </button>
          <button className="btn btn-ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll">
      <div style={{ padding: 10 }}>
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => setEditing(blankVoice(uid('voice')))}>
          + New Voice
        </button>
        <AudioRefZone
          label="Match a voice's character"
          onAnalyzed={async (fp, hint) => {
            const res = await analyzeVoiceRef(project, fp, hint)
            if (res.ok && res.json) {
              const f = res.json as Record<string, string>
              setEditing({
                ...blankVoice(uid('voice')),
                name: f.name ?? 'From reference',
                ageGender: f.ageGender ?? '',
                accent: f.accent ?? '',
                timbre: f.timbre ?? '',
                pitch: f.pitch ?? '',
                pacing: f.pacing ?? '',
                energy: f.energy ?? '',
                texture: f.texture ?? '',
                emotionalRange: f.emotionalRange ?? '',
                sampleLine: f.sampleLine ?? '',
                notes: f.styleNotes ?? ''
              })
            } else setError(res.error ?? 'Voice breakdown failed.')
          }}
        />
        <div style={{ marginTop: 8 }}>
          <label>Target</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: '100%' }}>
            {VOICE_PROFILES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>
      {voices.length === 0 && (
        <div className="empty" style={{ height: 'auto', padding: '30px 20px' }}>
          <p>Cast the voices. Describe one — or link it to a character — and compile a voice-design prompt plus audition text for your voice tool.</p>
        </div>
      )}
      {voices.map((v) => (
        <div key={v.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)' }}>{v.name}</b>
            <span className="row-meta">{[v.ageGender, v.accent].filter(Boolean).join(' · ')}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>
            {[v.timbre, v.texture].filter(Boolean).join(' · ').slice(0, 110)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-key" disabled={busy === v.id} onClick={() => void compile(v)}>
              {busy === v.id ? 'Compiling…' : 'Prompt →'}
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(v)}>
              Edit
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeVoice(v.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
      {compiled && <CompiledView c={compiled} onClose={() => setCompiled(null)} />}
    </div>
  )
}
