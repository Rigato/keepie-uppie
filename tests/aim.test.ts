import { describe, expect, it } from 'vitest'
import { resolveAim } from '../src/core/aim'
import { TUNING } from '../src/game/tuning'

const ball = { x: 270, y: 500 }

describe('resolveAim', () => {
  it('tap curto usa força média e tiro reto para cima', () => {
    const aim = resolveAim(ball, { x: 275, y: 505 })
    expect(aim.dir.x).toBe(0)
    expect(aim.dir.y).toBe(-1)
    expect(aim.ratio).toBe(TUNING.powerup.aimDefaultForceRatio)
  })

  it('arrasto máximo para cima dá força máxima', () => {
    const aim = resolveAim(ball, { x: 270, y: 500 - TUNING.powerup.aimMaxDrag })
    expect(aim.dir).toEqual({ x: 0, y: -1 })
    expect(aim.ratio).toBe(1)
    expect(aim.speed).toBeCloseTo(TUNING.powerup.aimMaxSpeed, 5)
  })

  it('usa a direção do arrasto', () => {
    const aim = resolveAim(ball, { x: 270 + 150, y: 500 - 150 })
    expect(aim.dir.x).toBeGreaterThan(0.6)
    expect(aim.dir.y).toBeLessThan(-0.6)
  })

  it('nunca mira para baixo', () => {
    const aim = resolveAim(ball, { x: 270, y: 800 })
    expect(aim.dir.y).toBeLessThan(0)
    expect(Math.abs(aim.dir.y)).toBeCloseTo(0.12, 5)
  })

  it('timeout com força baixa sobe para a força default', () => {
    const aim = resolveAim(ball, { x: 270, y: 500 - 30 }, true)
    expect(aim.ratio).toBe(TUNING.powerup.aimDefaultForceRatio)
    expect(aim.dir.y).toBeLessThan(0)
  })

  it('release com força baixa mantém a força do arrasto', () => {
    const aim = resolveAim(ball, { x: 270, y: 500 - 40 }, false)
    expect(aim.ratio).toBeLessThan(TUNING.powerup.aimDefaultForceRatio)
  })

  it('satura a força acima do arrasto máximo', () => {
    const aim = resolveAim(ball, { x: 270, y: 500 - 600 })
    expect(aim.ratio).toBe(1)
  })

  it('a velocidade respeita a faixa do tiro mirado', () => {
    const weak = resolveAim(ball, { x: 270, y: 500 - 30 }, false)
    const strong = resolveAim(ball, { x: 270, y: 500 - 400 }, false)
    expect(weak.speed).toBeGreaterThanOrEqual(TUNING.powerup.aimMinSpeed)
    expect(strong.speed).toBeLessThanOrEqual(TUNING.powerup.aimMaxSpeed)
  })
})
