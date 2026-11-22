import { describe, expect, it } from 'vitest'
import { StreakTracker, labelForCount } from '../src/core/streak'
import { TUNING } from '../src/game/tuning'

describe('labelForCount', () => {
  it('respeita os marcos do tuning', () => {
    expect(labelForCount(TUNING.streak.niceAt - 1)).toBeNull()
    expect(labelForCount(TUNING.streak.niceAt)).toBe('NICE')
    expect(labelForCount(TUNING.streak.greatAt)).toBe('GREAT')
    expect(labelForCount(TUNING.streak.onFireAt)).toBe('ON FIRE')
    expect(labelForCount(TUNING.streak.onFireAt + 50)).toBe('ON FIRE')
  })
})

describe('StreakTracker', () => {
  it('sobe um por chute limpo e anuncia só o marco cruzado', () => {
    const tracker = new StreakTracker()
    const labels: Array<string | null> = []
    for (let i = 0; i < TUNING.streak.onFireAt; i += 1) {
      labels.push(tracker.registerKick().label)
    }
    expect(tracker.count).toBe(TUNING.streak.onFireAt)
    expect(labels.filter(Boolean)).toEqual(['NICE', 'GREAT', 'ON FIRE'])
  })

  it('quebra para zero no whiff', () => {
    const tracker = new StreakTracker()
    tracker.registerKick()
    tracker.registerKick()
    tracker.registerWhiff()
    expect(tracker.count).toBe(0)
    expect(tracker.registerKick().count).toBe(1)
  })

  it('inicia febre no ON FIRE e renova nos múltiplos', () => {
    const tracker = new StreakTracker()
    for (let i = 0; i < TUNING.streak.onFireAt - 1; i += 1) {
      expect(tracker.registerKick().feverStarted).toBe(false)
    }
    expect(tracker.registerKick().feverStarted).toBe(true)

    for (let i = TUNING.streak.onFireAt + 1; i < TUNING.streak.onFireAt * 2; i += 1) {
      expect(tracker.registerKick().feverStarted).toBe(false)
    }
    expect(tracker.registerKick().feverStarted).toBe(true)
  })
})
