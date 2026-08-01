// The prompt editor — CodeMirror 6 with cinematic highlighting, a lock/mute
// gutter (Picture Lock), and selection-driven Pickups.

import React, { useEffect, useRef } from 'react'
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state'
import {
  EditorView,
  lineNumbers,
  gutter,
  GutterMarker,
  Decoration,
  DecorationSet,
  keymap,
  placeholder
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { cinematicHighlight, editorTheme } from '../lib/editorLang'

interface Props {
  value: string
  lockedLines: number[]
  mutedLines: number[]
  onChange(text: string): void
  onToggleLock(line: number): void
  onToggleMute(line: number): void
  onSelection(span: { text: string; from: number; to: number } | null): void
}

const setLineState = StateEffect.define<{ locked: number[]; muted: number[] }>()

const lineStateField = StateField.define<{ locked: Set<number>; muted: Set<number> }>({
  create: () => ({ locked: new Set(), muted: new Set() }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setLineState)) {
        return { locked: new Set(e.value.locked), muted: new Set(e.value.muted) }
      }
    }
    return value
  }
})

const lineDecorations = EditorView.decorations.compute([lineStateField, 'doc'], (state) => {
  const { locked, muted } = state.field(lineStateField)
  const builder = new RangeSetBuilder<Decoration>()
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    if (locked.has(i)) builder.add(line.from, line.from, Decoration.line({ class: 'cm-lockedLine' }))
    else if (muted.has(i)) builder.add(line.from, line.from, Decoration.line({ class: 'cm-mutedLine' }))
  }
  return builder.finish()
})

class ToggleMarker extends GutterMarker {
  constructor(
    private glyph: string,
    private cls: string,
    private title: string,
    private onClick: () => void
  ) {
    super()
  }
  override toDOM(): Node {
    const el = document.createElement('span')
    el.textContent = this.glyph
    el.className = `gutter-toggle ${this.cls}`
    el.title = this.title
    el.onmousedown = (e) => {
      e.preventDefault()
      this.onClick()
    }
    return el
  }
}

export default function PromptEditor({
  value,
  lockedLines,
  mutedLines,
  onChange,
  onToggleLock,
  onToggleMute,
  onSelection
}: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const callbacks = useRef({ onChange, onToggleLock, onToggleMute, onSelection })
  callbacks.current = { onChange, onToggleLock, onToggleMute, onSelection }

  useEffect(() => {
    if (!hostRef.current) return

    const lockGutter = gutter({
      class: 'cm-lock-gutter',
      lineMarker(view, line) {
        const n = view.state.doc.lineAt(line.from).number
        const { locked } = view.state.field(lineStateField)
        const text = view.state.doc.lineAt(line.from).text
        if (!text.trim()) return null
        return new ToggleMarker(
          locked.has(n) ? '●' : '○',
          locked.has(n) ? 'on-lock' : '',
          locked.has(n) ? 'Picture-locked — transforms will not touch this line' : 'Lock this line',
          () => callbacks.current.onToggleLock(n)
        )
      }
    })

    const muteGutter = gutter({
      class: 'cm-mute-gutter',
      lineMarker(view, line) {
        const n = view.state.doc.lineAt(line.from).number
        const { muted } = view.state.field(lineStateField)
        const text = view.state.doc.lineAt(line.from).text
        if (!text.trim()) return null
        return new ToggleMarker(
          muted.has(n) ? '−' : '◦',
          muted.has(n) ? 'on-mute' : '',
          muted.has(n) ? 'Muted — excluded from exports until unmuted' : 'Mute this line (keep it, but leave it out of exports)',
          () => callbacks.current.onToggleMute(n)
        )
      }
    })

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          lineNumbers(),
          lockGutter,
          muteGutter,
          lineStateField,
          lineDecorations,
          cinematicHighlight,
          editorTheme,
          placeholder('# Subject\nDescribe the shot — or ask the brain below to write it…'),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.onChange(u.state.doc.toString())
            if (u.selectionSet) {
              const sel = u.state.selection.main
              if (sel.empty) callbacks.current.onSelection(null)
              else
                callbacks.current.onSelection({
                  text: u.state.doc.sliceString(sel.from, sel.to),
                  from: sel.from,
                  to: sel.to
                })
            }
          })
        ]
      })
    })
    viewRef.current = view
    view.dispatch({ effects: setLineState.of({ locked: lockedLines, muted: mutedLines }) })
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External value changes (agent rewrites, version restore, shot switch).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setLineState.of({ locked: lockedLines, muted: mutedLines }) })
  }, [lockedLines, mutedLines])

  /** Replace the current selection (used by Pickups). */
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    ;(view.dom as HTMLElement & { __replaceSelection?: (text: string) => void }).__replaceSelection = (
      text: string
    ) => {
      const sel = view.state.selection.main
      if (!sel.empty) view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } })
    }
  })

  return <div className="editor-host" ref={hostRef} />
}
