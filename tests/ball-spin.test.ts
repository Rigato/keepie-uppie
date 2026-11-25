import { describe, expect, it } from 'vitest'
import {
  aimOffset,
  createBallSpin,
  kickSpin,
  normalizeAngle,
  rollOmega,
  stepBallSpin,
} from '../src/core/ball-spin'
import { TUNING } from '../src/game/tuning'

const R = TUNING.ball.radius

describe('rollOmega', () => {
  it('bola indo para a direita gira no sentido horário (positivo)', () => {
    expect(rollOmega(750)).toBeCloseTo(
      (750 / R) * TUNING.ball.spinRollFactor,
      8,
    )
    expect(rollOmega(750)).toBeGreaterThan(0)
  })

  it('bola indo para a esquerda gira no sentido anti-horário (negativo)', () => {
    expect(rollOmega(-750)).toBeCloseTo(-rollOmega(750), 8)
    expect(rollOmega(-750)).toBeLessThan(0)
  })

  it('inverte o sentido quando a parede inverte o vx', () => {
    const before = rollOmega(820)
    const after = rollOmega(-820)
    expect(before).toBeGreaterThan(0)
    expect(after).toBeLessThan(0)
    expect(after).toBeCloseTo(-before, 8)
  })

  it('satura em spinMax para velocidades altas', () => {
    expect(rollOmega(100_000)).toBe(TUNING.ball.spinMax)
    expect(rollOmega(-100_000)).toBe(-TUNING.ball.spinMax)
  })

  it('usa o raio informado na conta', () => {
    expect(rollOmega(750, 50)).toBeCloseTo((750 / 50) * TUNING.ball.spinRollFactor, 8)
  })

  it('não gera NaN com entradas inválidas', () => {
    expect(rollOmega(Number.NaN)).toBe(0)
    expect(rollOmega(Number.POSITIVE_INFINITY)).toBe(0)
    expect(rollOmega(750, 0)).toBe(rollOmega(750, R))
  })
})

describe('kickSpin', () => {
  it('toque central dá backspin (negativo)', () => {
    expect(kickSpin(0, 1)).toBeLessThan(0)
    expect(kickSpin(0, 1)).toBeCloseTo(
      -TUNING.ball.spinKick * TUNING.ball.spinBackspin,
      8,
    )
  })

  it('toque lateral soma giro na direção do lado tocado', () => {
    expect(kickSpin(0.8, 1)).toBeGreaterThan(0)
    expect(kickSpin(-0.8, 1)).toBeLessThan(0)
    expect(kickSpin(1, 1)).toBeCloseTo(TUNING.ball.spinKick, 8)
    expect(kickSpin(-1, 1)).toBeCloseTo(-TUNING.ball.spinKick, 8)
  })

  it('escala com a força do chute', () => {
    expect(kickSpin(1, 0)).toBe(0)
    expect(kickSpin(1, 0.5)).toBeCloseTo(kickSpin(1, 1) * 0.5, 8)
    expect(kickSpin(0, 0.5)).toBeCloseTo(kickSpin(0, 1) * 0.5, 8)
  })

  it('clampa offset e power fora da faixa', () => {
    expect(kickSpin(4, 1)).toBeCloseTo(kickSpin(1, 1), 8)
    expect(kickSpin(-4, 1)).toBeCloseTo(kickSpin(-1, 1), 8)
    expect(kickSpin(1, 9)).toBeCloseTo(kickSpin(1, 1), 8)
    expect(kickSpin(Number.NaN, Number.NaN)).toBeCloseTo(0, 8)
  })
})

describe('aimOffset', () => {
  it('converte a direção do tiro no offset de toque equivalente', () => {
    expect(aimOffset(0)).toBeCloseTo(0, 8)
    expect(aimOffset(TUNING.kick.maxLateral)).toBeCloseTo(-1, 8)
    expect(aimOffset(-TUNING.kick.maxLateral)).toBeCloseTo(1, 8)
    expect(aimOffset(0.9)).toBe(-1)
    expect(aimOffset(-0.9)).toBe(1)
  })

  it('tiro para a direita gera o mesmo spin de um toque na esquerda', () => {
    const dirX = 0.6
    expect(kickSpin(aimOffset(dirX), 1)).toBeCloseTo(
      kickSpin(-dirX / TUNING.kick.maxLateral, 1),
      8,
    )
    expect(kickSpin(aimOffset(dirX), 1)).toBeLessThan(0)
  })
})

describe('normalizeAngle', () => {
  it('mantém o ângulo em [-π, π]', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(Math.PI * 2)).toBe(0)
    expect(normalizeAngle((Math.PI * 7) / 4)).toBeCloseTo(-Math.PI / 4, 8)
    expect(normalizeAngle(-(Math.PI * 7) / 4)).toBeCloseTo(Math.PI / 4, 8)
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 8)
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(-Math.PI, 8)
  })

  it('entradas inválidas viram 0', () => {
    expect(normalizeAngle(Number.NaN)).toBe(0)
    expect(normalizeAngle(Number.POSITIVE_INFINITY)).toBe(0)
    expect(normalizeAngle(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('stepBallSpin', () => {
  it('avança o ângulo por omega × dt', () => {
    const spin = createBallSpin()
    stepBallSpin(spin, 750, 0.1)
    expect(spin.angle).toBeCloseTo(rollOmega(750) * 0.1, 8)
    expect(spin.residual).toBe(0)
  })

  it('soma o residual do chute à rolagem no mesmo frame', () => {
    const spin = createBallSpin()
    spin.residual = 4
    stepBallSpin(spin, 750, 0.1)
    const expectedResidual = 4 * Math.exp(-TUNING.ball.spinDamping * 0.1)
    expect(spin.residual).toBeCloseTo(expectedResidual, 8)
    expect(spin.angle).toBeCloseTo((rollOmega(750) + expectedResidual) * 0.1, 8)
  })

  it('residual decai exponencialmente sem zerar de repente', () => {
    const spin = createBallSpin()
    spin.residual = kickSpin(0, 1)
    const start = spin.residual
    stepBallSpin(spin, 0, 1)
    expect(spin.residual).toBeCloseTo(start * Math.exp(-TUNING.ball.spinDamping), 8)
    expect(spin.residual).not.toBe(0)
    expect(Math.abs(spin.residual)).toBeLessThan(Math.abs(start))
  })

  it('nunca deixa o ângulo fora de [-π, π]', () => {
    const spin = createBallSpin()
    spin.angle = Math.PI - 0.01
    for (let i = 0; i < 120; i += 1) {
      stepBallSpin(spin, 3000, 0.05)
      expect(spin.angle).toBeGreaterThanOrEqual(-Math.PI - 1e-9)
      expect(spin.angle).toBeLessThanOrEqual(Math.PI + 1e-9)
    }
  })

  it('toque central gira a bola mesmo com vx = 0', () => {
    const spin = createBallSpin()
    spin.residual = kickSpin(0, 1)
    stepBallSpin(spin, 0, 1 / 60)
    expect(spin.angle).toBeLessThan(0)
  })

  it('não gera NaN/infinito com entradas absurdas', () => {
    const spin = createBallSpin()
    spin.angle = Number.NaN
    spin.residual = Number.POSITIVE_INFINITY
    stepBallSpin(spin, Number.NaN, Number.NaN)
    expect(Number.isFinite(spin.angle)).toBe(true)
    expect(Number.isFinite(spin.residual)).toBe(true)
    expect(spin.angle).toBe(0)
    expect(spin.residual).toBe(0)
  })

  it('dt negativo não recua a rotação', () => {
    const spin = createBallSpin()
    spin.angle = 0.5
    spin.residual = 2
    stepBallSpin(spin, 500, -1)
    expect(spin.angle).toBe(0.5)
    expect(spin.residual).toBe(2)
  })
})
