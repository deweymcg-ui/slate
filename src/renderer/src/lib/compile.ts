// Deliverables — compile a shot into a target model's dialect, enforce limits,
// and produce copy-ready output. Brain-assisted when reshaping is needed.

import type { Project, Scene, Shot, BrainResult } from '../../../shared/types'
import { runBrain, projectContext } from './brainTasks'

export interface ModelProfile {
  id: string
  label: string
  vendor: string
  kind: 'image' | 'video' | 'node-graph' | 'node-graph'
  dialect: { style: string; guidance: string }
  limits: {
    maxChars: number | null
    maxDurationSec: number | null
    durations: number[] | null
    aspectRatios: string[] | null
    fps: number[] | null
    resolutions: string[] | null
  }
  features: {
    negativePrompt: boolean
    timecodeBeats: boolean
    imageInput: boolean
    cameraControls: boolean
    seeds: boolean
  }
  params: Array<{ name: string; type: string; values?: unknown; note?: string }>
  notes: string
}

export interface CompileWarning {
  kind: 'duration' | 'aspect' | 'fps' | 'chars' | 'feature'
  message: string
}

/** Pre-flight a shot against a model profile — warnings before the user pastes. */
export function preflight(shot: Shot, profile: ModelProfile): CompileWarning[] {
  const warns: CompileWarning[] = []
  const d = shot.spec.durationSec
  if (profile.kind !== 'image' && d) {
    if (profile.limits.maxDurationSec && d > profile.limits.maxDurationSec) {
      warns.push({
        kind: 'duration',
        message: `${profile.label} caps clips at ${profile.limits.maxDurationSec}s — this shot is ${d}s. Use Sequence Chunks to split it.`
      })
    }
    if (profile.limits.durations && !profile.limits.durations.includes(d)) {
      warns.push({
        kind: 'duration',
        message: `${profile.label} supports ${profile.limits.durations.join('/')}s — this shot is ${d}s (nearest: ${nearest(d, profile.limits.durations)}s).`
      })
    }
  }
  const ar = shot.spec.aspectRatio
  if (ar && profile.limits.aspectRatios && !profile.limits.aspectRatios.includes(ar)) {
    warns.push({ kind: 'aspect', message: `${profile.label} aspect ratios: ${profile.limits.aspectRatios.join(', ')} — shot is ${ar}.` })
  }
  const fps = shot.spec.fps
  if (fps && Array.isArray(profile.limits.fps) && profile.limits.fps.length > 0 && !profile.limits.fps.includes(fps)) {
    warns.push({ kind: 'fps', message: `${profile.label} renders at ${profile.limits.fps.join('/')}fps — shot spec says ${fps}fps.` })
  }
  if (shot.beatSheet?.length && !profile.features.timecodeBeats) {
    warns.push({ kind: 'feature', message: `${profile.label} doesn't follow timecoded beats — the beat sheet will be woven into prose instead.` })
  }
  return warns
}

function nearest(v: number, list: number[]): number {
  return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
}

function specLine(shot: Shot, profile: ModelProfile): string {
  const s = shot.spec
  const bits = [
    s.durationSec && profile.kind !== 'image' ? `${s.durationSec} second shot` : null,
    s.aspectRatio ? `${s.aspectRatio}` : null,
    s.fps && profile.kind !== 'image' ? `${s.fps}fps` : null
  ].filter(Boolean)
  return bits.join(', ')
}

function beatText(shot: Shot): string {
  if (!shot.beatSheet?.length) return ''
  return shot.beatSheet.map((b) => `${b.from}-${b.to}s: ${b.text}`).join('\n')
}

/**
 * Compile via the brain: reshape the sectioned prompt into the model's dialect,
 * enforcing the character budget and weaving spec + beats appropriately.
 */
export async function compileForModel(
  p: Project,
  scene: Scene | null,
  shot: Shot,
  profile: ModelProfile
): Promise<BrainResult> {
  const budget = shot.maxChars ?? profile.limits.maxChars
  const beats = beatText(shot)
  const lockedLines = shot.lockedLines
    .map((n) => shot.prompt.split('\n')[n - 1])
    .filter(Boolean)

  return runBrain(p, {
    task: `compile:${profile.id}`,
    tier: 'standard',
    expectJson: true,
    prompt: `${projectContext(p, scene)}

SOURCE PROMPT (sectioned):
${shot.prompt}

${beats ? `TIMECODED BEATS to honor:\n${beats}\n` : ''}SHOT SPEC: ${specLine(shot, profile) || 'default'}

TARGET: ${profile.label} (${profile.kind}). Dialect: ${profile.dialect.style}.
DIALECT GUIDANCE: ${profile.dialect.guidance}
${profile.features.timecodeBeats && beats ? 'This model follows timecoded beat direction — keep the timecodes inline.' : beats ? 'This model ignores timecodes — convert the beats into flowing sequential prose ("then", "as", "finally").' : ''}
${budget ? `HARD CHARACTER BUDGET: ${budget} characters for the main prompt. If over, compress by dropping the weakest modifiers first — never drop subject identity, continuity facts${lockedLines.length ? ', or these locked phrases (verbatim): ' + lockedLines.map((l) => `"${l}"`).join(', ') : ''}.` : ''}
${profile.features.negativePrompt ? 'Also write a negative prompt: concrete artifacts/qualities to avoid for this specific shot (not a generic laundry list — 6-12 targeted terms).' : ''}

Return JSON: {"prompt":"<the compiled prompt in the target dialect>"${profile.features.negativePrompt ? ',"negativePrompt":"<targeted negative prompt>"' : ''},"params":{<any non-prompt parameters worth setting for this model, e.g. duration, aspect_ratio — only ones this model actually has>}}`
  })
}

/** Plain-text scene export — a markdown shot list ready for prepro docs. */
export function exportSceneMarkdown(p: Project, scene: Scene): string {
  const lines: string[] = [`# ${p.name} — ${scene.name}`, '']
  if (scene.synopsis) lines.push(scene.synopsis, '')
  for (const shot of scene.shots) {
    const s = shot.spec
    lines.push(`## ${shot.name}`)
    if (shot.intent) lines.push(`*${shot.intent}*`)
    lines.push(
      `- Spec: ${[
        s.durationSec ? `${s.durationSec}s` : null,
        s.fps ? `${s.fps}fps` : null,
        s.aspectRatio,
        s.size,
        s.angle,
        s.lens,
        s.movement
      ]
        .filter(Boolean)
        .join(' · ')}`
    )
    if (shot.targetModel) lines.push(`- Target: ${shot.targetModel}`)
    lines.push('', '```', shot.prompt, '```', '')
    if (shot.beatSheet?.length) {
      lines.push('Beats:')
      for (const b of shot.beatSheet) lines.push(`- ${b.from}-${b.to}s — ${b.text}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

export function exportSceneCsv(p: Project, scene: Scene): string {
  const esc = (v: string): string => `"${(v || '').replace(/"/g, '""')}"`
  const rows = [
    ['shot', 'intent', 'duration_s', 'fps', 'aspect', 'size', 'angle', 'lens', 'movement', 'target_model', 'prompt']
      .map(esc)
      .join(',')
  ]
  for (const shot of scene.shots) {
    const s = shot.spec
    rows.push(
      [
        shot.name,
        shot.intent,
        String(s.durationSec ?? ''),
        String(s.fps ?? ''),
        s.aspectRatio ?? '',
        s.size ?? '',
        s.angle ?? '',
        s.lens ?? '',
        s.movement ?? '',
        shot.targetModel ?? '',
        shot.prompt
      ]
        .map(esc)
        .join(',')
    )
  }
  return rows.join('\n')
}
