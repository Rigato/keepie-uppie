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

/** Queda a partir de uma fração da tela, com o ápice acomodado pela catraca. */
function dropAtScreen(screenRatio: number): number {
  const apex = TUNING.world.height * TUNING.camera.ratchetAt
  return Math.max(0, TUNING.world.height * screenRatio - apex)
}

/** Velocidade da curva-base, sem o boost profundo. */
function baseSpeedAt(drop: number): number {
  const ratio = Math.min(Math.max(drop / TUNING.kick.fullPowerDrop, 0), 1)
  return (
    TUNING.kick.minSpeed +
    (TUNING.kick.maxSpeed - TUNING.kick.minSpeed) * Math.pow(ratio, TUNING.kick.powerCurve)
  )
}

function speedAtScreen(screenRatio: number, offset = 24): number {
  const kick = falling(dropAtScreen(screenRatio), offset)
  return Math.hypot(kick.vx, kick.vy)
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
    const full = falling(TUNING.kick.deepFullDrop, 24)
    const apexSpeed = Math.hypot(apex.vx, apex.vy)
    const fullSpeed = Math.hypot(full.vx, full.vy)

    expect(apex.kind).toBe('kick')
    expect(apexSpeed).toBeGreaterThanOrEqual(TUNING.kick.minSpeed)
    expect(apex.power).toBeLessThan(0.1)
    expect(apex.arcTime).toBeGreaterThanOrEqual(0.75)
    expect(apex.arcTime).toBeLessThanOrEqual(0.95)
    expect(fullSpeed).toBeCloseTo(TUNING.kick.maxSpeed + TUNING.kick.deepBonus, 5)
    expect(full.arcTime).toBeGreaterThanOrEqual(3.95)
    expect(full.arcTime).toBeLessThanOrEqual(4.05)
  })

  it('a força cresce a cada trecho da queda', () => {
    const drops = [0, 160, 320, 480, TUNING.kick.fullPowerDrop, TUNING.kick.deepFullDrop]
    const speeds = drops.map((drop) => {
      const kick = falling(drop)
      return Math.hypot(kick.vx, kick.vy)
    })
    for (let i = 1; i < speeds.length; i += 1) {
      expect(speeds[i]).toBeGreaterThan(speeds[i - 1] ?? 0)
    }
  })

  it('a queda satura no teto real, no fundo útil', () => {
    const full = falling(TUNING.kick.deepFullDrop, 24)
    const extra = falling(TUNING.kick.deepFullDrop * 3, 24)
    expect(Math.hypot(extra.vx, extra.vy)).toBeCloseTo(Math.hypot(full.vx, full.vy), 5)
    expect(Math.hypot(extra.vx, extra.vy)).toBeCloseTo(
      TUNING.kick.maxSpeed + TUNING.kick.deepBonus,
      5,
    )
  })

  it('Perfect soma um bônus, mas não anula o timing', () => {
    const apexNormal = computeKick(ball({ vy: 0 }), { x: 270 + 24, y: 500 }, {
      fallDistance: 0,
    })
    const apexPerfect = computeKick(ball({ vy: 0 }), { x: 270 + 4, y: 500 }, {
      fallDistance: 0,
    })
    const fullPerfect = computeKick(ball({ vy: 900 }), { x: 270 + 4, y: 500 }, {
      fallDistance: TUNING.kick.deepFullDrop,
    })

    const normalSpeed = Math.hypot(apexNormal.vx, apexNormal.vy)
    const perfectSpeed = Math.hypot(apexPerfect.vx, apexPerfect.vy)
    const fullSpeed = Math.hypot(fullPerfect.vx, fullPerfect.vy)

    expect(apexPerfect.perfect).toBe(true)
    expect(perfectSpeed).toBeGreaterThan(normalSpeed)
    expect(perfectSpeed).toBeLessThan(fullSpeed)
    expect(apexPerfect.arcTime).toBeLessThan(1.0)
  })

  it('a queda máxima base passa tempo suficiente dentro do alvo de toque', () => {
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

  it('overrideSpeed define o Chutão e o Perfect soma o bônus', () => {
    const chutao = computeKick(ball({ vy: 900 }), { x: 270 + 20, y: 500 }, {
      fallDistance: 0,
      overrideSpeed: TUNING.consumable.chutaoSpeed,
    })
    expect(Math.hypot(chutao.vx, chutao.vy)).toBeCloseTo(
      TUNING.consumable.chutaoSpeed,
      5,
    )
    expect(chutao.power).toBe(1)
    expect(chutao.arcTime).toBeCloseTo(
      (2 * TUNING.consumable.chutaoSpeed) / TUNING.physics.gravity,
      5,
    )

    const perfect = computeKick(ball({ vy: 900 }), { x: 270 + 4, y: 500 }, {
      fallDistance: 0,
      overrideSpeed: TUNING.consumable.chutaoSpeed,
    })
    expect(perfect.perfect).toBe(true)
    expect(Math.hypot(perfect.vx, perfect.vy)).toBeCloseTo(
      TUNING.consumable.chutaoSpeed + TUNING.perfect.speedBonus,
      5,
    )
    // O Chutão fica abaixo da mola (2850) mesmo com Perfect.
    expect(Math.hypot(perfect.vx, perfect.vy)).toBeLessThan(
      TUNING.collect.springLaunchSpeed,
    )
  })

  it('Ponto Doce amplia a janela do Perfect e o bônus de velocidade', () => {
    const offset = TUNING.kick.angleRadius * 0.3
    const normal = computeKick(ball({ vy: 900 }), { x: 270 + offset, y: 500 }, {
      fallDistance: 0,
    })
    const sweet = computeKick(ball({ vy: 900 }), { x: 270 + offset, y: 500 }, {
      fallDistance: 0,
      perfectWindow: TUNING.kick.perfectWindow * TUNING.powerup.sweetWindowScale,
      perfectBonus: TUNING.perfect.speedBonus * TUNING.powerup.sweetBonusScale,
    })

    expect(normal.perfect).toBe(false)
    expect(sweet.perfect).toBe(true)
    expect(Math.hypot(sweet.vx, sweet.vy) - Math.hypot(normal.vx, normal.vy)).toBeCloseTo(
      TUNING.perfect.speedBonus * TUNING.powerup.sweetBonusScale,
      5,
    )
    expect(TUNING.powerup.sweetWindowScale).toBeGreaterThan(1)
  })

  it('arco do ápice é curto; arco da queda cheia fica na faixa alta', () => {
    const apex = falling(0)
    const full = falling(TUNING.kick.deepFullDrop, 24)
    expect(apex.arcTime).toBeGreaterThanOrEqual(0.75)
    expect(apex.arcTime).toBeLessThanOrEqual(0.95)
    expect(full.arcTime).toBeGreaterThanOrEqual(3.95)
    expect(full.arcTime).toBeLessThanOrEqual(4.05)
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

  it('o boost profundo começa aos 80% da tela e preserva o trecho aprovado', () => {
    const H = TUNING.world.height
    const apex = H * TUNING.camera.ratchetAt

    expect((TUNING.kick.deepStartDrop + apex) / H).toBeCloseTo(0.8, 3)
    // Até 80% a curva é exatamente a da 0.1.8; o boost só soma daqui para baixo.
    for (const ratio of [0.3, 0.5, 0.65, 0.75, 0.8]) {
      expect(speedAtScreen(ratio)).toBeCloseTo(baseSpeedAt(dropAtScreen(ratio)), 0)
    }
  })

  it('o ganho marginal cresce de 80% para o fundo', () => {
    const s80 = speedAtScreen(0.8)
    const s90 = speedAtScreen(0.9)
    const s100 = speedAtScreen(1)
    const gained80to90 = s90 - s80
    const gained90to100 = s100 - s90
    expect(gained80to90).toBeGreaterThan(0)
    expect(gained90to100).toBeGreaterThan(gained80to90)

    // Em altura o efeito é ainda mais claro (h ∝ v²).
    const height = (speed: number): number => (speed * speed) / (2 * TUNING.physics.gravity)
    expect(height(s100) - height(s90)).toBeGreaterThan(height(s90) - height(s80))
    expect(s100).toBeGreaterThanOrEqual(TUNING.kick.maxSpeed)
  })

  it('o power acompanha o boost até o fundo', () => {
    const at80 = falling(dropAtScreen(0.8), 24)
    const at100 = falling(dropAtScreen(1), 24)
    const atEnd = falling(TUNING.kick.deepFullDrop, 24)

    expect(at80.power).toBeGreaterThan(0.6)
    expect(at80.power).toBeLessThan(0.7)
    expect(at100.power).toBeGreaterThan(0.95)
    expect(at100.power).toBeLessThan(1)
    expect(atEnd.power).toBeCloseTo(1, 5)
  })

  it('a força máxima é alcançável antes da linha de morte', () => {
    const fallRoom =
      TUNING.world.height * (1 - TUNING.camera.ratchetAt) + TUNING.ball.radius
    expect(TUNING.kick.deepStartDrop).toBeLessThan(TUNING.kick.deepFullDrop)
    expect(TUNING.kick.deepFullDrop).toBeLessThanOrEqual(fallRoom)
  })
})

describe('speedMultiplier (bônus de streak)', () => {
  const fallingBall = ball({ vy: TUNING.physics.maxFallSpeed })
  const edgePoint = { x: 270 + 30, y: 500 } // fora da janela do Perfect
  const centerPoint = { x: 270, y: 500 }

  it('multiplica só a curva normal, preserva a direção e aumenta o power', () => {
    const normal = computeKick(fallingBall, edgePoint, {
      fallDistance: TUNING.kick.fullPowerDrop,
    })
    const boosted = computeKick(fallingBall, edgePoint, {
      fallDistance: TUNING.kick.fullPowerDrop,
      speedMultiplier: 1.05,
    })

    const normalSpeed = Math.hypot(normal.vx, normal.vy)
    const boostedSpeed = Math.hypot(boosted.vx, boosted.vy)
    expect(boostedSpeed / normalSpeed).toBeCloseTo(1.05, 5)
    expect(boosted.vy / normal.vy).toBeCloseTo(1.05, 5)
    expect(boosted.vx / normal.vx).toBeCloseTo(1.05, 5)
    expect(boosted.power).toBeGreaterThan(normal.power)
    expect(boosted.offset).toBeCloseTo(normal.offset, 5)
  })

  it('o overrideSpeed do Chutão ignora o multiplicador', () => {
    const opts = {
      fallDistance: 0,
      overrideSpeed: TUNING.consumable.chutaoSpeed,
    }
    const normal = computeKick(fallingBall, centerPoint, opts)
    const boosted = computeKick(fallingBall, centerPoint, {
      ...opts,
      speedMultiplier: 1.05,
    })

    const expected = TUNING.consumable.chutaoSpeed + TUNING.perfect.speedBonus
    expect(Math.hypot(normal.vx, normal.vy)).toBeCloseTo(expected, 5)
    expect(Math.hypot(boosted.vx, boosted.vy)).toBeCloseTo(expected, 5)
    expect(boosted.vy).toBeCloseTo(normal.vy, 5)
  })

  it('o bônus de Perfect é somado depois, sem ser multiplicado', () => {
    const normal = computeKick(fallingBall, centerPoint, { fallDistance: 0 })
    const boosted = computeKick(fallingBall, centerPoint, {
      fallDistance: 0,
      speedMultiplier: 1.05,
    })
    expect(normal.perfect).toBe(true)
    expect(boosted.perfect).toBe(true)

    const normalSpeed = Math.hypot(normal.vx, normal.vy)
    const boostedSpeed = Math.hypot(boosted.vx, boosted.vy)
    // 500 * 1.05 + 60 = 585; a diferença é 5% da curva, não do total.
    expect(boostedSpeed).toBeCloseTo(normalSpeed + 25, 5)
    expect(boostedSpeed - normalSpeed).toBeCloseTo(
      0.05 * (normalSpeed - TUNING.perfect.speedBonus),
      5,
    )
  })

  it('multiplicador inválido ou negativo cai em 1', () => {
    const expected = computeKick(fallingBall, edgePoint, { fallDistance: 400 })
    for (const speedMultiplier of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const got = computeKick(fallingBall, edgePoint, {
        fallDistance: 400,
        speedMultiplier,
      })
      expect(Math.hypot(got.vx, got.vy)).toBeCloseTo(
        Math.hypot(expected.vx, expected.vy),
        5,
      )
    }
  })
})
