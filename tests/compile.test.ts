import { describe, it, expect } from 'vitest'
import { preflight, exportSceneMarkdown, exportSceneCsv, type ModelProfile } from '../src/renderer/src/lib/compile'
import { extractJson } from '../src/main/brain'
import type { Project, Scene, Shot } from '../src/shared/types'

const profile: ModelProfile = {
  id: 'test-video',
  label: 'TestVid',
  vendor: 'Test',
  kind: 'video',
  dialect: { style: 'cinematic-prose', guidance: 'Write prose.' },
  limits: { maxChars: 500, maxDurationSec: 10, durations: [5, 10], aspectRatios: ['16:9', '9:16'], fps: [24], resolutions: null },
  features: { negativePrompt: true, timecodeBeats: false, imageInput: true, cameraControls: false, seeds: true },
  params: [],
  notes: ''
}

function shotWith(over: Partial<Shot['spec']>, extra: Partial<Shot> = {}): Shot {
  return {
    id: 's1',
    name: 'Shot 01',
    intent: 'test',
    spec: { durationSec: 8, fps: 24, aspectRatio: '16:9', lens: null, movement: null, size: null, angle: null, ...over },
    prompt: '# Subject\nA test.',
    lockedLines: [],
    mutedLines: [],
    beatSheet: null,
    targetModel: 'test-video',
    maxChars: null,
    variants: [],
    history: [],
    takes: [],
    createdAt: '',
    updatedAt: '',
    ...extra
  }
}

describe('preflight', () => {
  it('flags duration over the cap', () => {
    const warns = preflight(shotWith({ durationSec: 30 }), profile)
    expect(warns.some((w) => w.kind === 'duration' && w.message.includes('caps clips at 10s'))).toBe(true)
  })

  it('flags unsupported discrete duration with nearest suggestion', () => {
    const warns = preflight(shotWith({ durationSec: 8 }), profile)
    expect(warns.some((w) => w.kind === 'duration' && w.message.includes('nearest: 10s'))).toBe(true)
  })

  it('flags aspect ratio and fps mismatches', () => {
    const warns = preflight(shotWith({ aspectRatio: '4:3', fps: 60 }), profile)
    expect(warns.some((w) => w.kind === 'aspect')).toBe(true)
    expect(warns.some((w) => w.kind === 'fps')).toBe(true)
  })

  it('warns when beats are set but the model ignores timecodes', () => {
    const shot = shotWith({ durationSec: 10 }, { beatSheet: [{ from: 0, to: 5, text: 'run' }] })
    const warns = preflight(shot, profile)
    expect(warns.some((w) => w.kind === 'feature')).toBe(true)
  })

  it('passes a clean shot', () => {
    const warns = preflight(shotWith({ durationSec: 10 }), profile)
    expect(warns).toHaveLength(0)
  })
})

describe('extractJson', () => {
  it('parses bare JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON inside prose and code fences', () => {
    expect(extractJson('Here you go:\n```json\n{"shots":[{"name":"A"}]}\n```\nDone.')).toEqual({
      shots: [{ name: 'A' }]
    })
  })

  it('handles nested braces and strings with braces', () => {
    expect(extractJson('x {"a":{"b":"{not a brace}"},"c":[1,2]} y')).toEqual({ a: { b: '{not a brace}' }, c: [1, 2] })
  })

  it('parses arrays', () => {
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('throws on garbage', () => {
    expect(() => extractJson('no json here')).toThrow()
  })
})

describe('scene export', () => {
  const scene: Scene = {
    id: 'sc1',
    name: 'Rooftop Chase',
    synopsis: 'She runs.',
    shots: [shotWith({}, { prompt: '# Subject\nKaia runs, "fast".' })]
  }
  const project = { name: 'Night Market' } as Project

  it('exports markdown with spec and prompt', () => {
    const md = exportSceneMarkdown(project, scene)
    expect(md).toContain('# Night Market — Rooftop Chase')
    expect(md).toContain('## Shot 01')
    expect(md).toContain('8s · 24fps · 16:9')
    expect(md).toContain('Kaia runs')
  })

  it('exports CSV with quoted fields', () => {
    const csv = exportSceneCsv(project, scene)
    const lines = csv.split('\n')
    expect(lines[0]).toContain('"shot"')
    expect(lines[1]).toContain('"Shot 01"')
    // Quotes inside the prompt are doubled per CSV rules (the field spans lines).
    expect(csv).toContain('""fast""')
  })
})
