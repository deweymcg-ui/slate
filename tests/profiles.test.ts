// Schema guard for data/model-profiles.json — the Deliver panel and preflight
// trust these shapes at runtime, so every profile must hold them.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { preflight } from '../src/renderer/src/lib/compile'
import type { Shot } from '../src/shared/types'

const raw = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'model-profiles.json'), 'utf8'))
const profiles: Array<Record<string, never>> = Array.isArray(raw) ? raw : raw.models ?? raw.profiles

function fakeShot(): Shot {
  return {
    id: 's1',
    name: 'Shot',
    intent: '',
    prompt: 'test',
    negativePrompt: '',
    spec: { durationSec: 7, aspectRatio: '2.39:1', fps: 30, camera: '', lens: '', movement: '' },
    beatSheet: [{ start: 0, end: 3, action: 'a' }],
    locked: false,
    lockedSpans: [],
    variants: [],
    takes: [],
    history: [],
    updatedAt: new Date().toISOString()
  } as unknown as Shot
}

describe('model profiles schema', () => {
  it('loads and is non-empty', () => {
    expect(profiles.length).toBeGreaterThan(5)
  })

  for (const p of profiles) {
    const prof = p as {
      id: string
      label: string
      kind: string
      dialect: { style: string; guidance: string }
      limits: Record<string, unknown>
      features: Record<string, unknown>
    }
    describe(prof.id, () => {
      it('has required fields', () => {
        expect(prof.label).toBeTruthy()
        expect(['video', 'image', 'node-graph']).toContain(prof.kind)
        expect(prof.dialect.style).toBeTruthy()
        expect(prof.dialect.guidance.length).toBeGreaterThan(40)
      })

      it('list-shaped limits are arrays (fps, durations, aspectRatios, resolutions)', () => {
        for (const key of ['fps', 'durations', 'aspectRatios', 'resolutions']) {
          const v = prof.limits[key]
          expect(
            v === null || v === undefined || Array.isArray(v),
            `${prof.id}.limits.${key} must be an array or null, got ${typeof v}`
          ).toBe(true)
        }
      })

      it('scalar limits are numbers or null (maxChars, maxDurationSec)', () => {
        for (const key of ['maxChars', 'maxDurationSec']) {
          const v = prof.limits[key]
          expect(v === null || v === undefined || typeof v === 'number').toBe(true)
        }
      })

      it('features are booleans', () => {
        for (const [k, v] of Object.entries(prof.features)) {
          expect(typeof v, `${prof.id}.features.${k}`).toBe('boolean')
        }
      })

      it('preflight never throws against this profile', () => {
        expect(() => preflight(fakeShot(), prof as never)).not.toThrow()
      })
    })
  }
})
