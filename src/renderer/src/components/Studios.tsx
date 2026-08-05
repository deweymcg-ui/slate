// Studios — Casting, Art Department, Locations, Lookbook.

import React, { useState } from 'react'
import { useProject, uid } from '../stores/project'
import { fillCharacter, characterSheetPrompt, studyStyle } from '../lib/brainTasks'
import SoundDept from './SoundDept'
import type { CharacterSheet, ArtDeptSheet, LocationSheet, StyleProfile, ScenarioTab } from '../../../shared/types'

type Section = 'casting' | 'art' | 'locations' | 'lookbook' | 'sound'

export default function Studios(): React.JSX.Element {
  const [section, setSection] = useState<Section>('casting')
  return (
    <>
      <div className="tabs" style={{ borderBottom: '1px solid var(--border)' }}>
        {(
          [
            ['casting', 'Casting'],
            ['art', 'Art Dept'],
            ['locations', 'Locations'],
            ['lookbook', 'Lookbook'],
            ['sound', 'Sound']
          ] as Array<[Section, string]>
        ).map(([id, label]) => (
          <button key={id} className={`tab ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </div>
      {section === 'casting' && <Casting />}
      {section === 'art' && <ArtDept />}
      {section === 'locations' && <Locations />}
      {section === 'lookbook' && <Lookbook />}
      {section === 'sound' && <SoundDept />}
    </>
  )
}

// ---------- Casting ----------

const SCENARIOS: Array<[ScenarioTab, string]> = [
  ['cinematic', 'Cinematic'],
  ['portrait', 'Portrait'],
  ['film-scene', 'Film Scene'],
  ['interview', 'Interview'],
  ['fashion', 'Fashion'],
  ['street', 'Street']
]

function blankCharacter(): CharacterSheet {
  return {
    id: uid('char'),
    name: '',
    age: '',
    gender: '',
    ethnicity: '',
    faceFeatures: '',
    hair: '',
    clothing: '',
    expression: '',
    eyeDirection: '',
    mood: '',
    environment: '',
    keyLightSide: 'Key light from left',
    lightingMood: 'Natural soft light',
    scenario: 'cinematic',
    notes: ''
  }
}

function Casting(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const [editing, setEditing] = useState<CharacterSheet | null>(null)
  const [describe, setDescribe] = useState('')
  const [busy, setBusy] = useState(false)

  const autoFill = async (): Promise<void> => {
    if (!describe.trim() || !editing) return
    setBusy(true)
    const res = await fillCharacter(project, describe.trim(), editing.scenario, editing.images)
    setBusy(false)
    if (res.ok && res.json) {
      const f = res.json as Record<string, string>
      setEditing({
        ...editing,
        name: f.name ?? editing.name,
        age: f.age ?? '',
        gender: f.gender ?? '',
        ethnicity: f.ethnicity ?? '',
        faceFeatures: f.faceFeatures ?? '',
        hair: f.hair ?? '',
        clothing: f.clothing ?? '',
        expression: f.expression ?? '',
        eyeDirection: f.eyeDirection ?? '',
        mood: f.mood ?? '',
        environment: f.environment ?? '',
        keyLightSide: f.keyLightSide ?? editing.keyLightSide,
        lightingMood: f.lightingMood ?? editing.lightingMood
      })
    }
  }

  const copySheetPrompt = (c: CharacterSheet): void => {
    void window.slate.copyText(characterSheetPrompt(c, c.scenario))
  }

  if (editing) {
    const set = (patch: Partial<CharacterSheet>): void => setEditing({ ...editing, ...patch })
    return (
      <div className="scroll" style={{ padding: 12 }}>
        <div className="tabs" style={{ border: 'none', padding: 0, marginBottom: 10 }}>
          {SCENARIOS.map(([id, label]) => (
            <button key={id} className={`tab ${editing.scenario === id ? 'active' : ''}`} onClick={() => set({ scenario: id })} style={{ fontSize: 11 }}>
              {label}
            </button>
          ))}
        </div>

        <div className="fill-bar">
          <input
            placeholder='Describe them — "weathered getaway driver, 60s"'
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void autoFill()}
          />
          <button className="btn btn-key btn-sm" disabled={busy || !describe.trim()} onClick={() => void autoFill()}>
            {busy ? '…' : editing.images?.length ? '✦ Fill from stills' : '✦ Fill'}
          </button>
        </div>

        <SheetStills
          images={editing.images}
          onRemove={(p) => set({ images: (editing.images ?? []).filter((x) => x !== p) })}
        />

        <div className="grid-3">
          <div className="field" style={{ gridColumn: 'span 1' }}>
            <label>Name</label>
            <input value={editing.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <label>Age</label>
            <input value={editing.age} onChange={(e) => set({ age: e.target.value })} />
          </div>
          <div className="field">
            <label>Gender</label>
            <input value={editing.gender} onChange={(e) => set({ gender: e.target.value })} />
          </div>
        </div>
        {(
          [
            ['ethnicity', 'Ethnicity'],
            ['faceFeatures', 'Face & Features'],
            ['hair', 'Hair'],
            ['clothing', 'Clothing'],
            ['expression', 'Expression'],
            ['eyeDirection', 'Eye Direction'],
            ['mood', 'Mood'],
            ['environment', 'Location / Environment']
          ] as Array<[keyof CharacterSheet, string]>
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<CharacterSheet>)} />
          </div>
        ))}
        <div className="grid-2">
          <div className="field">
            <label>Key Light Side</label>
            <select value={editing.keyLightSide} onChange={(e) => set({ keyLightSide: e.target.value })}>
              {['Key light from left', 'Key light from right', 'Front key', 'Backlit', 'Top light', 'Underlight'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Lighting Mood</label>
            <select value={editing.lightingMood} onChange={(e) => set({ lightingMood: e.target.value })}>
              {['Natural soft light', 'Hard dramatic light', 'Golden hour warmth', 'Cool overcast', 'Neon practicals', 'Candlelight', 'Studio clean'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            className="btn btn-key"
            disabled={!editing.name.trim()}
            onClick={() => {
              store.upsertCharacter(editing)
              setEditing(null)
            }}
          >
            Save to Cast
          </button>
          <button className="btn" onClick={() => copySheetPrompt(editing)} title="Copy a character-sheet prompt for your image generator">
            Copy Sheet Prompt
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
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => setEditing(blankCharacter())}>
          + New Character
        </button>
      </div>
      {project.characters.length === 0 && (
        <div className="empty" style={{ height: 'auto', padding: '30px 20px' }}>
          <p>Cast your film. Characters saved here are woven into every prompt for perfect consistency.</p>
        </div>
      )}
      {project.characters.map((c) => (
        <div key={c.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)' }}>{c.name}</b>
            <span className="row-meta">{[c.age, c.gender].filter(Boolean).join(', ')}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>
            {[c.faceFeatures, c.hair].filter(Boolean).join(' · ').slice(0, 110)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setEditing(c)}>
              Edit
            </button>
            <button className="btn btn-sm" onClick={() => copySheetPrompt(c)} title="Copy a character-sheet prompt">
              Sheet Prompt
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeCharacter(c.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Art Department ----------

function ArtDept(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const [editing, setEditing] = useState<ArtDeptSheet | null>(null)

  const sheetPrompt = (a: ArtDeptSheet): string =>
    [
      '# Subject',
      `${a.name} — ${a.description}. Materials: ${a.materials}. Condition: ${a.condition}.${a.era ? ` Era: ${a.era}.` : ''}${a.distinctive ? ` Distinctive: ${a.distinctive}.` : ''}`,
      '',
      '# Composition',
      a.kind === 'vehicle'
        ? 'Reference sheet framing: clean three-quarter front view, full object in frame, seamless neutral backdrop; then match a profile side view.'
        : 'Reference sheet framing: centered product-style view, full object in frame, seamless neutral backdrop, generous margins.',
      '',
      '# Lighting',
      'Soft even studio light, gentle top key, controlled reflections, true material rendering, no colored gels.',
      '',
      '# Style',
      'Photoreal, neutral grade, crisp texture detail for continuity reference.',
      '',
      '# Mood',
      'Clean, catalog-neutral.'
    ].join('\n')

  if (editing) {
    const set = (patch: Partial<ArtDeptSheet>): void => setEditing({ ...editing, ...patch })
    return (
      <div className="scroll" style={{ padding: 12 }}>
        <div className="field">
          <label>Type</label>
          <select value={editing.kind} onChange={(e) => set({ kind: e.target.value as ArtDeptSheet['kind'] })}>
            <option value="prop">Prop</option>
            <option value="wardrobe">Wardrobe</option>
            <option value="vehicle">Vehicle</option>
          </select>
        </div>
        {(
          [
            ['name', 'Name'],
            ['description', 'Description'],
            ['materials', 'Materials'],
            ['condition', 'Condition'],
            ['era', 'Era'],
            ['distinctive', 'Distinctive details']
          ] as Array<[keyof ArtDeptSheet, string]>
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            {key === 'description' ? (
              <textarea rows={3} value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<ArtDeptSheet>)} />
            ) : (
              <input value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<ArtDeptSheet>)} />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-key"
            disabled={!editing.name.trim()}
            onClick={() => {
              store.upsertArtDept(editing)
              setEditing(null)
            }}
          >
            Save
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
        <button
          className="btn btn-sm"
          style={{ width: '100%' }}
          onClick={() =>
            setEditing({ id: uid('art'), kind: 'prop', name: '', description: '', materials: '', condition: '', era: '', distinctive: '', notes: '' })
          }
        >
          + New Prop / Wardrobe / Vehicle
        </button>
      </div>
      {project.artDept.length === 0 && (
        <div className="empty" style={{ height: 'auto', padding: '30px 20px' }}>
          <p>The hero car, the lucky lighter, the bloodstained jacket — keep them identical in every shot.</p>
        </div>
      )}
      {project.artDept.map((a) => (
        <div key={a.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)' }}>{a.name}</b>
            <span className="row-meta">{a.kind}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>{a.description.slice(0, 110)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setEditing(a)}>
              Edit
            </button>
            <button className="btn btn-sm" onClick={() => void window.slate.copyText(sheetPrompt(a))}>
              Sheet Prompt
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeArtDept(a.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Locations ----------

function Locations(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const [editing, setEditing] = useState<LocationSheet | null>(null)

  const sheetPrompt = (l: LocationSheet): string =>
    [
      '# Subject',
      `${l.name} — ${l.description}. Architecture: ${l.architecture}. Textures: ${l.textures}.`,
      '',
      '# Composition',
      'Location reference: wide establishing view showing full geography, then natural vantage points a scene would shoot from.',
      '',
      '# Lighting',
      `${l.timeOfDay || 'Golden hour'}, ${l.weather || 'clear'}. Practicals: ${l.practicalLights || 'none noted'}.`,
      '',
      '# Style',
      'Photoreal, location-scout clarity, honest color.',
      '',
      '# Mood',
      l.notes || 'True to the place.'
    ].join('\n')

  if (editing) {
    const set = (patch: Partial<LocationSheet>): void => setEditing({ ...editing, ...patch })
    return (
      <div className="scroll" style={{ padding: 12 }}>
        <div className="field">
          <label>Name</label>
          <input value={editing.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <SheetStills
          images={editing.images}
          onRemove={(p) => set({ images: (editing.images ?? []).filter((x) => x !== p) })}
        />
        <div className="field">
          <label>Int / Ext</label>
          <select value={editing.interiorExterior} onChange={(e) => set({ interiorExterior: e.target.value as LocationSheet['interiorExterior'] })}>
            <option value="exterior">Exterior</option>
            <option value="interior">Interior</option>
            <option value="both">Both</option>
          </select>
        </div>
        {(
          [
            ['description', 'Description'],
            ['timeOfDay', 'Time of day'],
            ['weather', 'Weather'],
            ['architecture', 'Architecture'],
            ['textures', 'Textures'],
            ['practicalLights', 'Practical lights'],
            ['notes', 'Notes']
          ] as Array<[keyof LocationSheet, string]>
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            {key === 'description' ? (
              <textarea rows={3} value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<LocationSheet>)} />
            ) : (
              <input value={editing[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<LocationSheet>)} />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-key"
            disabled={!editing.name.trim()}
            onClick={() => {
              store.upsertLocation(editing)
              setEditing(null)
            }}
          >
            Save
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
        <button
          className="btn btn-sm"
          style={{ width: '100%' }}
          onClick={() =>
            setEditing({
              id: uid('loc'),
              name: '',
              interiorExterior: 'exterior',
              description: '',
              timeOfDay: '',
              weather: '',
              architecture: '',
              textures: '',
              practicalLights: '',
              notes: ''
            })
          }
        >
          + New Location
        </button>
      </div>
      {project.locations.length === 0 && (
        <div className="empty" style={{ height: 'auto', padding: '30px 20px' }}>
          <p>Scout your world once — every prompt shoots the same place after that.</p>
        </div>
      )}
      {project.locations.map((l) => (
        <div key={l.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)' }}>{l.name}</b>
            <span className="row-meta">{l.interiorExterior}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>{l.description.slice(0, 110)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setEditing(l)}>
              Edit
            </button>
            <button className="btn btn-sm" onClick={() => void window.slate.copyText(sheetPrompt(l))}>
              Sheet Prompt
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeLocation(l.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Lookbook ----------

function Lookbook(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const [source, setSource] = useState('')
  const [kind, setKind] = useState<StyleProfile['kind']>('cinematographer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const study = async (): Promise<void> => {
    if (!source.trim() || busy) return
    setBusy(true)
    setError(null)
    const res = await studyStyle(project, source.trim(), kind)
    setBusy(false)
    if (res.ok && res.json) {
      const f = res.json as Record<string, string>
      store.upsertStyle({
        id: uid('style'),
        source: source.trim(),
        kind,
        tone: f.tone ?? '',
        palette: f.palette ?? '',
        lighting: f.lighting ?? '',
        lensLanguage: f.lensLanguage ?? '',
        movement: f.movement ?? '',
        blocking: f.blocking ?? '',
        editorial: f.editorial ?? '',
        notes: f.notes ?? ''
      })
      setSource('')
    } else setError(res.error ?? 'Study failed.')
  }

  return (
    <div className="scroll">
      <div style={{ padding: 10 }}>
        <label>Study a style</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as StyleProfile['kind'])} style={{ width: 110 }}>
            <option value="cinematographer">DP</option>
            <option value="director">Director</option>
            <option value="film">Film</option>
            <option value="series">Series</option>
          </select>
          <input
            placeholder="Name…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void study()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-key btn-sm" disabled={busy || !source.trim()} onClick={() => void study()}>
            {busy ? '…' : 'Study'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
          Profiles distill a look into reusable visual language — active profiles shape every prompt
          the brain writes. Names never appear in output prompts.
        </div>
      </div>
      {project.lookbook.map((s) => (
        <div key={s.id} className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ color: 'var(--ink-0)' }}>{s.source}</b>
            <span className="row-meta">{s.kind}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>
            {s.tone.slice(0, 60)} · {s.palette.slice(0, 50)}
          </div>
          <SheetStills
            images={s.images}
            onRemove={(p) =>
              store.mutate((proj) => {
                const sheet = proj.lookbook.find((x) => x.id === s.id)
                if (sheet) sheet.images = (sheet.images ?? []).filter((x) => x !== p)
              })
            }
          />
          <details style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--ink-1)' }}>Full profile</summary>
            {(['tone', 'palette', 'lighting', 'lensLanguage', 'movement', 'blocking', 'editorial', 'notes'] as const).map((k) => (
              <p key={k} style={{ margin: '6px 0' }}>
                <b style={{ color: 'var(--ink-1)', textTransform: 'capitalize' }}>{k}:</b> {s[k]}
              </p>
            ))}
          </details>
          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => store.removeStyle(s.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}


/** Continuity stills pinned to a sheet from the Stills Library. */
function SheetStills({
  images,
  onRemove
}: {
  images?: string[]
  onRemove: (path: string) => void
}): React.JSX.Element | null {
  if (!images || images.length === 0) return null
  return (
    <div className="sheet-stills">
      {images.map((p) => (
        <div key={p} className="sheet-still">
          <img src={`file://${p}`} alt="" title={p} />
          <button className="btn btn-ghost btn-danger" onClick={() => onRemove(p)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
