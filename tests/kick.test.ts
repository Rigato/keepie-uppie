import { describe, expect, it } from 'vitest'
import type { BallLike } from '../src/game/contracts'
import { computeKick, isInsideBall } from '../src/core/kick'
import { TUNING } from '../src/game/tuning'

function ball(overrides: Partial<BallLike> = {}): BallLike {
  return { x: 270, y: 500, vx: 0, vy: 0, r: TUNING.ball.radius, ...overrides }
}

function falling(fallDistance: number, offset = 0) {
  return computeKick(
    ball({ vy: TUNING.physics.maxFallSpeed }),
    { x: 270 + offset, y: 500 },
    { fallDistance },
  )
}

describe('computeKick', () => {
  it('acerta o centro: chute reto para cima', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270, y: 500 }, {
      fallDistance: TUNING.kick.fullPowerDrop,
    })
    expect(result.kind).toBe('kick')
    expect(result.vx).toBe(0)
    expect(result.vy).toBeLessThan(0)
    expect(result.perfect).toBe(true)
  })

  it('inverte o lado do toque: tocar na esquerda sobe à direita', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270 - 18, y: 500 }, {
      fallDistance: TUNING.kick.fullPowerDrop,
    })
    expect(result.kind).toBe('kick')
    expect(result.vx).toBeGreaterThan(0)
    expect(result.offset).toBeCloseTo(-18 / TUNING.kick.angleRadius, 5)
  })

  it('tocar na direita sobe à esquerda', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270 + 22, y: 500 }, {
      fallDistance: TUNING.kick.fullPowerDrop,
    })
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

  it('área de toque maior que a área do ângulo: a borda externa chuta com ângulo máximo', () => {
    const result = computeKick(ball({ vy: 900 }), {
      x: 270 + TUNING.kick.angleRadius + 10,
      y: 500,
    })
    expect(result.kind).toBe('kick')
    expect(result.offset).toBe(1)
  })

  it('toque no ápice é curto; queda cheia chega ao topo da faixa', () => {
    const apex = falling(0)
    const full = falling(TUNING.kick.fullPowerDrop, 24)
    const apexSpeed = Math.hypot(apex.vx, apex.vy)
    const fullSpeed = Math.hypot(full.vx, full.vy)

    expect(apex.kind).toBe('kick')
    expect(apexSpeed).toBeGreaterThanOrEqual(TUNING.kick.minSpeed)
    expect(apex.power).toBeLessThan(0.1)
    expect(apex.arcTime).toBeGreaterThanOrEqual(0.75)
    expect(apex.arcTime).toBeLessThanOrEqual(0.95)
    expect(fullSpeed).toBeCloseTo(TUNING.kick.maxSpeed, 5)
    expect(full.arcTime).toBeGreaterThanOrEqual(3.3)
    expect(full.arcTime).toBeLessThanOrEqual(3.45)
  })

  it('a força cresce a cada trecho da queda', () => {
    const drops = [0, 160, 320, 480, TUNING.kick.fullPowerDrop]
    const speeds = drops.map((drop) => {
      const kick = falling(drop)
      return Math.hypot(kick.vx, kick.vy)
    })
    for (let i = 1; i < speeds.length; i += 1) {
      expect(speeds[i]).toBeGreaterThan(speeds[i - 1] ?? 0)
    }
  })

  it('a queda satura no teto da faixa', () => {
    const full = falling(TUNING.kick.fullPowerDrop, 24)
    const extra = falling(TUNING.kick.fullPowerDrop * 3, 24)
    expect(Math.hypot(extra.vx, extra.vy)).toBeCloseTo(Math.hypot(full.vx, full.vy), 5)
    expect(Math.hypot(extra.vx, extra.vy)).toBeCloseTo(TUNING.kick.maxSpeed, 5)
  })

  it('Perfect soma um bônus, mas não anula o timing', () => {
    const apexNormal = computeKick(ball({ vy: 0 }), { x: 270 + 24, y: 500 }, {
      fallDistance: 0,
    })
    const apexPerfect = computeKick(ball({ vy: 0 }), { x: 270 + 4, y: 500 }, {
      fallDistance: 0,
    })
    const fullPerfect = computeKick(ball({ vy: 900 }), { x: 270 + 4, y: 500 }, {
      fallDistance: TUNING.kick.fullPowerDrop,
    })

    const normalSpeed = Math.hypot(apexNormal.vx, apexNormal.vy)
    const perfectSpeed = Math.hypot(apexPerfect.vx, apexPerfect.vy)
    const fullSpeed = Math.hypot(fullPerfect.vx, fullPerfect.vy)

    expect(apexPerfect.perfect).toBe(true)
    expect(perfectSpeed).toBeGreaterThan(normalSpeed)
    expect(perfectSpeed).toBeLessThan(fullSpeed)
    expect(apexPerfect.arcTime).toBeLessThan(1.0)
  })

  it('a queda máxima passa tempo suficiente dentro do alvo de toque', () => {
    const windowSeconds = (2 * TUNING.kick.touchRadius) / TUNING.physics.maxFallSpeed
    expect(windowSeconds).toBeGreaterThanOrEqual(0.15)
  })

  it('preserva o orçamento de velocidade ao inclinar', () => {
    const result = computeKick(ball({ vy: 900 }), { x: 270 + 25, y: 500 }, {
      fallDistance: TUNING.kick.fullPowerDrop / 2,
    })
    const impact = Math.pow(0.5, TUNING.kick.powerCurve)
    const expected =
      TUNING.kick.minSpeed + (TUNING.kick.maxSpeed - TUNING.kick.minSpeed) * impact
    expect(Math.hypot(result.vx, result.vy)).toBeCloseTo(expected, 5)
  })

  it('arco do ápice é curto; arco da queda cheia fica na faixa alta', () => {
    const apex = falling(0)
    const full = falling(TUNING.kick.fullPowerDrop, 24)
    expect(apex.arcTime).toBeGreaterThanOrEqual(0.75)
    expect(apex.arcTime).toBeLessThanOrEqual(0.95)
    expect(full.arcTime).toBeGreaterThanOrEqual(3.3)
    expect(full.arcTime).toBeLessThanOrEqual(3.45)
  })

  it('a metade de baixo da tela é ao menos 30% mais forte que a 0.1.7', () => {
    // Referência da build anterior: catraca em 34% e curva 500–1550.
    const oldApex = TUNING.world.height * 0.34
    const oldSpeed = (drop: number): number =>
      500 + 1050 * Math.pow(Math.min(drop / 640, 1), 0.85)

    // Toca em várias alturas da metade de baixo. A nova catraca fica mais
    // alta, então a mesma tela exige uma queda maior — e mais força.
    for (const screenY of [540, 600, 700, 800, 900, 1000]) {
      const oldDrop = Math.max(0, screenY - oldApex)
      const newDrop = Math.max(0, screenY - TUNING.world.height * TUNING.camera.ratchetAt)
      const before = oldSpeed(oldDrop)
      const kick = falling(newDrop, 24)
      const speed = Math.hypot(kick.vx, kick.vy)
      expect(speed).toBeGreaterThanOrEqual(before * 1.3)
    }
  })

  it('a força máxima é alcançável antes da linha de morte', () => {
    const fallRoom =
      TUNING.world.height * (1 - TUNING.camera.ratchetAt) + TUNING.ball.radius
    expect(TUNING.kick.fullPowerDrop).toBeLessThanOrEqual(fallRoom)
  })
})
