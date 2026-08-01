import { describe, it, expect } from 'vitest'
import { computeFingerprint } from '../src/main/audio'

const SR = 16000

/** Synthetic click track at a given BPM with a decaying noise burst per beat. */
function clickTrack(bpm: number, seconds: number): Int16Array {
  const pcm = new Int16Array(SR * seconds)
  const beatEvery = Math.round((60 / bpm) * SR)
  for (let beat = 0; beat * beatEvery < pcm.length; beat++) {
    const start = beat * beatEvery
    for (let i = 0; i < 1200 && start + i < pcm.length; i++) {
      const env = Math.exp(-i / 250)
      pcm[start + i] = Math.round((Math.sin(i * 0.9) + (Math.random() * 2 - 1) * 0.4) * env * 14000)
    }
  }
  return pcm
}

/** Steady sine tone at a given frequency. */
function tone(freqHz: number, seconds: number, amp = 9000): Int16Array {
  const pcm = new Int16Array(SR * seconds)
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = Math.round(Math.sin((2 * Math.PI * freqHz * i) / SR) * amp)
  }
  return pcm
}

describe('computeFingerprint', () => {
  it('estimates tempo of a click track within tolerance', () => {
    const fp = computeFingerprint(clickTrack(120, 30), 30)
    expect(fp.bpmEstimate).not.toBeNull()
    // Accept the true tempo or a half/double-time reading (classic beat-tracker ambiguity).
    const candidates = [60, 120, 240]
    const nearest = candidates.reduce((a, b) =>
      Math.abs(b - fp.bpmEstimate!) < Math.abs(a - fp.bpmEstimate!) ? b : a
    )
    expect(Math.abs(fp.bpmEstimate! - nearest)).toBeLessThanOrEqual(6)
  })

  it('finds the fundamental of a pitched tone', () => {
    const fp = computeFingerprint(tone(196, 10), 10) // G3 — a low-ish voice register
    expect(fp.pitchMedianHz).not.toBeNull()
    expect(Math.abs(fp.pitchMedianHz! - 196)).toBeLessThanOrEqual(8)
    expect(fp.voicedRatio).toBeGreaterThan(0.5)
  })

  it('reports high silence for sparse material and low for dense', () => {
    const sparse = computeFingerprint(clickTrack(60, 20), 20)
    const dense = computeFingerprint(tone(220, 20), 20)
    expect(sparse.silenceRatio).toBeGreaterThan(dense.silenceRatio)
    expect(dense.silenceRatio).toBeLessThan(0.1)
  })

  it('describes an energy build', () => {
    const pcm = new Int16Array(SR * 12)
    for (let i = 0; i < pcm.length; i++) {
      const gain = (i / pcm.length) ** 2
      pcm[i] = Math.round(Math.sin((2 * Math.PI * 180 * i) / SR) * 12000 * gain)
    }
    const fp = computeFingerprint(pcm, 12)
    expect(fp.energyArc).toContain('build')
  })

  it('carries the full duration through', () => {
    const fp = computeFingerprint(tone(200, 5), 247.3)
    expect(fp.durationSec).toBe(247.3)
    expect(fp.sampledSec).toBe(5)
  })
})
