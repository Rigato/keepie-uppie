import { describe, expect, it } from 'vitest'
import { nextMagnetEndsAt } from '../src/core/consumables'
import { TUNING } from '../src/game/tuning'

describe('nextMagnetEndsAt', () => {
  it('ativa o Magnet quando não há efeito ativo', () => {
    expect(nextMagnetEndsAt(1000, 0, TUNING.powerup.magnetDurationMs)).toBe(16000)
  })

  it('o pickup de 15 s não encurta um consumível de 45 s ativo', () => {
    const now = 1000
    const consumableEnds = nextMagnetEndsAt(now, 0, TUNING.consumable.magnetDurationMs)
    expect(consumableEnds).toBe(46000)
    expect(nextMagnetEndsAt(now + 1000, consumableEnds, TUNING.powerup.magnetDurationMs)).toBe(
      consumableEnds,
    )
  })

  it('o consumível estende um pickup ativo', () => {
    const now = 1000
    const pickupEnds = nextMagnetEndsAt(now, 0, TUNING.powerup.magnetDurationMs)
    const extended = nextMagnetEndsAt(now + 500, pickupEnds, TUNING.consumable.magnetDurationMs)
    expect(extended).toBe(now + 500 + TUNING.consumable.magnetDurationMs)
    expect(extended).toBeGreaterThan(pickupEnds)
  })

  it('reativar a mesma fonte renova a partir de agora', () => {
    const now = 1000
    const first = nextMagnetEndsAt(now, 0, TUNING.powerup.magnetDurationMs)
    const renewed = nextMagnetEndsAt(now + 8000, first, TUNING.powerup.magnetDurationMs)
    expect(renewed).toBe(now + 8000 + TUNING.powerup.magnetDurationMs)
  })
})
