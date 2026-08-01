// Cinematic prompt language for CodeMirror — section headers + categorized
// keyword highlighting so a prompt reads like a lit set: camera cyan, light gold,
// color magenta, motion green, mood violet.

import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const CAMERA = [
  'lens', 'mm', 'anamorphic', 'bokeh', 'depth of field', 'shallow focus', 'deep focus', 'rack focus',
  'wide[- ]angle', 'telephoto', 'macro', 'fisheye', 'tilt[- ]shift', 'zoom', 'dolly', 'tracking', 'steadicam',
  'handheld', 'crane', 'drone', 'aerial', 'gimbal', 'whip[- ]pan', 'pan', 'tilt', 'push[- ]in', 'pull[- ]back',
  'orbit', 'locked[- ]off', 'tripod', 'pov', 'over[- ]the[- ]shoulder', 'close[- ]up', 'wide shot', 'medium shot',
  'extreme close[- ]up', 'establishing', 'low[- ]angle', 'high[- ]angle', 'eye[- ]level', 'dutch', 'overhead',
  'top[- ]down', 'slow[- ]motion', 'slow mo', 'high[- ]speed', 'shutter', 'frame rate', 'fps', 'viewfinder',
  'crash zoom', 'snorricam', 'long take', 'oner', 'perspective', 'foreground', 'background', 'framing', 'composition'
]

const LIGHTING = [
  'light', 'lighting', 'lit', 'shadow', 'shadows', 'silhouette', 'backlit', 'backlight', 'rim light',
  'key light', 'fill light', 'practical', 'practicals', 'golden hour', 'blue hour', 'magic hour', 'neon',
  'sodium vapor', 'tungsten', 'fluorescent', 'candlelight', 'firelight', 'moonlight', 'sunlight', 'overcast',
  'sun rays', 'god rays', 'volumetric', 'haze', 'lens flare', 'flare', 'glow', 'glowing', 'contrast',
  'high[- ]key', 'low[- ]key', 'chiaroscuro', 'rembrandt', 'softbox', 'diffused', 'hard light', 'soft light',
  'dappled', 'catchlight', 'catchlights', 'strobe', 'spotlight', 'floodlight', 'ambient', 'luminous', 'gleaming'
]

const COLOR = [
  'red', 'crimson', 'scarlet', 'orange', 'amber', 'yellow', 'gold', 'golden', 'green', 'emerald', 'teal',
  'cyan', 'blue', 'cobalt', 'navy', 'azure', 'purple', 'violet', 'magenta', 'pink', 'rose', 'brown', 'sepia',
  'black', 'white', 'grey', 'gray', 'silver', 'monochrome', 'desaturated', 'saturated', 'pastel', 'vivid',
  'color palette', 'palette', 'grade', 'graded', 'color grading', 'technicolor', 'duotone', 'warm tones', 'cool tones'
]

const MOTION = [
  'running', 'sprinting', 'walking', 'strides', 'leaping', 'jumping', 'falling', 'flying', 'soaring',
  'drifting', 'sliding', 'spinning', 'rotating', 'crashing', 'exploding', 'explosion', 'racing', 'chasing',
  'chase', 'fleeing', 'dancing', 'swaying', 'rippling', 'flowing', 'billowing', 'fluttering', 'trembling',
  'shaking', 'colliding', 'impact', 'accelerating', 'braking', 'skidding', 'swerving', 'tumbling', 'motion',
  'movement', 'kinetic', 'momentum', 'burst', 'erupting', 'surging'
]

const MOOD = [
  'tense', 'tension', 'dread', 'ominous', 'foreboding', 'melancholy', 'melancholic', 'wistful', 'serene',
  'tranquil', 'peaceful', 'euphoric', 'joyful', 'triumphant', 'menacing', 'sinister', 'eerie', 'haunting',
  'intimate', 'lonely', 'isolation', 'isolated', 'chaotic', 'chaos', 'frantic', 'urgent', 'urgency', 'calm',
  'confident', 'defiant', 'vulnerable', 'mysterious', 'wonder', 'awe', 'awe[- ]inspiring', 'brooding',
  'oppressive', 'hopeful', 'somber', 'grim', 'electric', 'dreamlike', 'nightmarish', 'nostalgic'
]

const TECHNICAL = [
  'photoreal', 'photorealistic', 'film grain', 'grain', '16mm', '35mm', '65mm', '70mm', 'imax', 'kodak',
  'portra', 'ektachrome', 'vision3', 'cinestill', 'fuji', 'velvia', 'eterna', 'tri[- ]x', 'hp5', 'bleach bypass',
  'cross[- ]process', 'vhs', 'analog', 'digital', 'texture', 'sharpness', 'crisp', 'gritty', 'pristine',
  'medium format', 'large format', 'documentary', 'editorial', 'cinematic', 'noir', 'anamorphic flare'
]

function compile(words: string[]): RegExp {
  const alts = [...words].sort((a, b) => b.length - a.length).join('|')
  return new RegExp(`\\b(?:${alts})\\b`, 'gi')
}

const CATEGORIES: Array<{ cls: string; re: RegExp }> = [
  { cls: 'syn-camera', re: compile(CAMERA) },
  { cls: 'syn-lighting', re: compile(LIGHTING) },
  { cls: 'syn-motion', re: compile(MOTION) },
  { cls: 'syn-mood', re: compile(MOOD) },
  { cls: 'syn-technical', re: compile(TECHNICAL) },
  { cls: 'syn-color', re: compile(COLOR) }
]

const SECTION_RE = /^#\s+.*/
const TIMECODE_RE = /\b\d+\s*[-–]\s*\d+\s*s(?:ec(?:onds)?)?\b|\b\d+:\d{2}\b/g

interface Mark {
  from: number
  to: number
  cls: string
}

function marksForLine(text: string, offset: number): Mark[] {
  const marks: Mark[] = []
  if (SECTION_RE.test(text)) {
    marks.push({ from: offset, to: offset + text.length, cls: 'syn-section' })
    return marks
  }
  const taken: Array<[number, number]> = []
  const tryAdd = (from: number, to: number, cls: string): void => {
    if (taken.some(([a, b]) => from < b && to > a)) return
    taken.push([from, to])
    marks.push({ from: offset + from, to: offset + to, cls })
  }
  let m: RegExpExecArray | null
  TIMECODE_RE.lastIndex = 0
  while ((m = TIMECODE_RE.exec(text))) tryAdd(m.index, m.index + m[0].length, 'syn-timecode')
  for (const cat of CATEGORIES) {
    cat.re.lastIndex = 0
    while ((m = cat.re.exec(text))) tryAdd(m.index, m.index + m[0].length, cat.cls)
  }
  marks.sort((a, b) => a.from - b.from)
  return marks
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos)
      for (const mark of marksForLine(line.text, line.from)) {
        builder.add(mark.from, mark.to, Decoration.mark({ class: mark.cls }))
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

export const cinematicHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildDecorations(u.view)
    }
  },
  { decorations: (v) => v.decorations }
)

export const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      fontSize: '13.5px',
      height: '100%'
    },
    '.cm-content': {
      fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace",
      caretColor: '#e3b341',
      lineHeight: '1.7',
      padding: '14px 4px'
    },
    '.cm-cursor': { borderLeftColor: '#e3b341', borderLeftWidth: '2px' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(227,179,65,0.22) !important' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(227,179,65,0.26) !important' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#5c6472',
      fontSize: '11px'
    },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c8cdd6' },
    '.cm-line': { padding: '0 10px' },
    '.syn-section': { color: '#8b93a1', fontWeight: '700', letterSpacing: '0.06em' },
    '.syn-camera': { color: '#56b8c9' },
    '.syn-lighting': { color: '#e3b341' },
    '.syn-color': { color: '#c886c8' },
    '.syn-motion': { color: '#6dbf7e' },
    '.syn-mood': { color: '#9d8cff' },
    '.syn-technical': { color: '#7aa2e8' },
    '.syn-timecode': {
      color: '#f2c855',
      fontWeight: '650',
      backgroundColor: 'rgba(227,179,65,0.09)',
      borderRadius: '3px',
      padding: '0 2px'
    },
    '.cm-lockedLine': { backgroundColor: 'rgba(227,179,65,0.055)' },
    '.cm-mutedLine': { opacity: '0.38', textDecoration: 'line-through', textDecorationColor: 'rgba(139,147,161,0.5)' }
  },
  { dark: true }
)
