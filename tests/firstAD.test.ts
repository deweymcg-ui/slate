import { describe, it, expect } from 'vitest'
import { applyAdActions, type AdAction } from '../src/renderer/src/lib/firstAD'
import { newProjectShape } from '../src/renderer/src/lib/newProject'

function freshProject() {
  return newProjectShape('Test Film')
}

describe('applyAdActions', () => {
  it('creates scenes and shots with specs and prompts, and focuses the new shot', () => {
    const p = freshProject()
    const actions: AdAction[] = [
      { type: 'create_scene', name: 'Alley Ambush', synopsis: 'It goes wrong.' },
      {
        type: 'create_shot',
        scene: 'Alley Ambush',
        name: 'Chunk 1 (0:00-0:10)',
        intent: 'Open the trap',
        prompt: '# Subject\nA van blocks the alley.',
        spec: { durationSec: 10, size: 'WS', movement: 'push-in' },
        targetModel: 'seedance-2'
      }
    ]
    const { receipts, focus } = applyAdActions(p, actions)
    expect(p.scenes).toHaveLength(1)
    expect(p.scenes[0].shots).toHaveLength(1)
    const shot = p.scenes[0].shots[0]
    expect(shot.spec.durationSec).toBe(10)
    expect(shot.spec.size).toBe('WS')
    expect(shot.targetModel).toBe('seedance-2')
    expect(focus?.shotId).toBe(shot.id)
    expect(receipts.some((r) => r.startsWith('✓ Created scene'))).toBe(true)
    expect(receipts.some((r) => r.includes('with prompt'))).toBe(true)
  })

  it('updates a shot by name and versions the old prompt', () => {
    const p = freshProject()
    applyAdActions(p, [
      { type: 'create_scene', name: 'S1' },
      { type: 'create_shot', scene: 'S1', name: 'Shot 01', prompt: '# Subject\nOld.' }
    ])
    const { receipts } = applyAdActions(p, [
      { type: 'update_shot', shot: 'shot 01', prompt: '# Subject\nNew.', spec: { lens: '85mm' } }
    ])
    const shot = p.scenes[0].shots[0]
    expect(shot.prompt).toContain('New.')
    expect(shot.spec.lens).toBe('85mm')
    expect(shot.history[0].prompt).toContain('Old.')
    expect(receipts.some((r) => r.startsWith('✓ Updated'))).toBe(true)
  })

  it('adds characters and locations with safe defaults', () => {
    const p = freshProject()
    applyAdActions(p, [
      { type: 'add_character', name: 'Marlow', age: '61', hair: 'silver crop' },
      { type: 'add_location', name: 'Night Market', interiorExterior: 'exterior' }
    ])
    expect(p.characters[0].name).toBe('Marlow')
    expect(p.characters[0].keyLightSide).toBe('Key light from left')
    expect(p.locations[0].interiorExterior).toBe('exterior')
  })

  it('reports unknown targets without throwing and skips duplicate scenes', () => {
    const p = freshProject()
    applyAdActions(p, [{ type: 'create_scene', name: 'S1' }])
    const { receipts } = applyAdActions(p, [
      { type: 'create_scene', name: 'S1' },
      { type: 'update_shot', shot: 'Nope', prompt: 'x' }
    ])
    expect(p.scenes).toHaveLength(1)
    expect(receipts.some((r) => r.includes('already exists'))).toBe(true)
    expect(receipts.some((r) => r.startsWith('✗ Shot "Nope" not found'))).toBe(true)
  })

  it('updates project bible and defaults', () => {
    const p = freshProject()
    applyAdActions(p, [
      { type: 'update_project', logline: 'A chase.', defaults: { targetModel: 'minimax-h3', durationSec: 15 } }
    ])
    expect(p.logline).toBe('A chase.')
    expect(p.defaults.targetModel).toBe('minimax-h3')
    expect(p.defaults.durationSec).toBe(15)
  })
})
