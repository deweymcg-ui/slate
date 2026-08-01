// Director's Notes — the always-in-context chat with the brain.

import React, { useRef, useState } from 'react'
import { useProject } from '../stores/project'
import { directorsNote, extractPromptBlock } from '../lib/brainTasks'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  promptBlock?: string | null
}

export default function NotesDock(): React.JSX.Element {
  const store = useProject()
  const project = store.project!
  const scene = store.currentScene()
  const shot = store.currentShot()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const send = async (): Promise<void> => {
    const text = note.trim()
    if (!text || busy) return
    setNote('')
    const history = msgs.map((m) => ({ role: m.role, text: m.text }))
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    const res = await directorsNote(project, scene, shot, history, text)
    setBusy(false)
    if (res.ok) {
      const block = extractPromptBlock(res.text)
      setMsgs((m) => [...m, { role: 'assistant', text: res.text.replace(/```(?:prompt)?\n[\s\S]*?```/, '— updated prompt below —').trim(), promptBlock: block }])
      if (block && shot) store.setPrompt(block, 'before note')
    } else {
      setMsgs((m) => [...m, { role: 'assistant', text: `⚠ ${res.error ?? 'The brain did not answer.'}` }])
    }
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }))
  }

  return (
    <div className={`notes-dock ${open ? '' : 'closed'}`}>
      <div className="notes-head" onClick={() => setOpen(!open)}>
        <span className="panel-title">Director&apos;s Notes</span>
        <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>
          {open ? '▾' : `▴ ${msgs.length ? `${msgs.length} notes` : 'give the brain a note'}`}
        </span>
      </div>
      {open && (
        <>
          <div className="notes-scroll" ref={scrollRef}>
            {msgs.length === 0 && (
              <div className="notes-hint">
                Talk to the shot. <i>“Make it rain, keep the neon.”</i> · <i>“What lens sells the
                loneliness here?”</i> · <i>“Write this shot from the getaway driver&apos;s POV.”</i>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`note-msg ${m.role}`}>
                <div className="note-text">{m.text}</div>
                {m.promptBlock && (
                  <div className="note-applied">✓ applied to the editor (previous version saved to history)</div>
                )}
              </div>
            ))}
            {busy && (
              <span className="thinking" style={{ padding: '4px 12px' }}>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
            )}
          </div>
          <div className="notes-input">
            <input
              placeholder={shot ? `Note on ${shot.name}…` : 'Note on this scene…'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
            />
            <button className="btn btn-key btn-sm" disabled={!note.trim() || busy} onClick={() => void send()}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}
