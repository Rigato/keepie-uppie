import { describe, expect, it } from 'vitest'
import type { BallLike } from '../src/game/contracts'
import { computeKick, isInsideBall } from '../src/core/kick'
import { TUNING } from '../src/game/tuning'

function ball(overrides: Partial<BallLike> = {}): BallLike {
  return { x: 270, y: 500, vx: 0, vy: 0, r: TUNING.ball.radius, ...overrides }
}

describe('computeKick', () => {
  it('acerta o centro: chute reto para cima', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270, y: 500 })
    expect(result.kind).toBe('kick')
    expect(result.vx).toBe(0)
    expect(result.vy).toBeLessThan(0)
    expect(result.perfect).toBe(true)
  })

  it('inverte o lado do toque: tocar na esquerda sobe à direita', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270 - 18, y: 500 })
    expect(result.kind).toBe('kick')
    expect(result.vx).toBeGreaterThan(0)
    expect(result.offset).toBeCloseTo(-18 / TUNING.kick.touchRadius, 5)
  })

  it('tocar na direita sobe à esquerda', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270 + 22, y: 500 })
    expect(result.vx).toBeLessThan(0)
  })

  it('não chuta bola subindo de verdade', () => {
    const result = computeKick(ball({ vy: -400 }), { x: 270, y: 500 })
    expect(result).toMatchObject({ kind: 'whiff', reason: 'notFalling', vx: 0, vy: 0 })
  })

  it('tolera toque perto do ápice', () => {
    const result = computeKick(ball({ vy: -100 }), { x: 270, y: 500 })
    expect(result.kind).toBe('kick')
  })

  it('não chuta fora do raio generoso de toque', () => {
    const result = computeKick(ball(), { x: 270 + 130, y: 500 })
    expect(result).toMatchObject({ kind: 'whiff', reason: 'miss' })
  })

  it('hitbox generosa: toque na borda do alvo ainda chuta, com ângulo máximo', () => {
    const result = computeKick(ball({ vy: 900 }), {
      x: 270 + TUNING.kick.touchRadius,
      y: 500,
    })
    expect(result.kind).toBe('kick')
    expect(result.offset).toBe(1)
  })

  it('fora do alvo generoso não chuta', () => {
    const result = computeKick(ball({ vy: 900 }), {
      x: 270 + TUNING.kick.touchRadius + 10,
      y: 500,
    })
    expect(result).toMatchObject({ kind: 'whiff', reason: 'miss' })
  })

  it('aceita toque na borda exata do círculo', () => {
    expect(isInsideBall(ball(), { x: 270 + 30, y: 500 })).toBe(true)
    expect(isInsideBall(ball(), { x: 270 + 30.1, y: 500 })).toBe(false)
  })

  it('força cresce com a velocidade de encontro', () => {
    const slow = computeKick(ball({ vy: 300 }), { x: 270 + 30, y: 500 })
    const fast = computeKick(ball({ vy: 1600 }), { x: 270 + 30, y: 500 })
    expect(Math.hypot(fast.vx, fast.vy)).toBeGreaterThan(Math.hypot(slow.vx, slow.vy))
    expect(fast.power).toBeGreaterThan(slow.power)
  })

  it('respeita o piso em toque hesitante', () => {
    const result = computeKick(ball({ vy: 1 }), { x: 270 + 24, y: 500 })
    expect(Math.hypot(result.vx, result.vy)).toBeCloseTo(TUNING.kick.minSpeed, 5)
  })

  it('não passa do teto da faixa', () => {
    const result = computeKick(ball({ vy: 5000 }), { x: 270 + 24, y: 500 })
    expect(Math.hypot(result.vx, result.vy)).toBeCloseTo(TUNING.kick.maxSpeed, 5)
  })

  it('perfect usa o topo da faixa', () => {
    const result = computeKick(ball({ vy: 200 }), { x: 270 + 4, y: 500 })
    expect(result.perfect).toBe(true)
    expect(Math.hypot(result.vx, result.vy)).toBeCloseTo(TUNING.perfect.speed, 5)
  })

  it('preserva o orçamento de velocidade ao inclinar', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270 + 25, y: 500 })
    const expected = TUNING.kick.baseSpeed + TUNING.kick.impactFactor * 900
    expect(Math.hypot(result.vx, result.vy)).toBeCloseTo(expected, 5)
  })

  it('arco normal fica na faixa de 1.5–2.5 s', () => {
    const center = computeKick(ball({ vy: 900 }), { x: 270, y: 500 })
    const edge = computeKick(ball({ vy: 900 }), { x: 270 + 24, y: 500 })
    for (const kick of [center, edge]) {
      expect(kick.arcTime).toBeGreaterThanOrEqual(1.5)
      expect(kick.arcTime).toBeLessThanOrEqual(2.5)
    }
  })
})
