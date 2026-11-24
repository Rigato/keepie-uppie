import { describe, expect, it } from 'vitest'
import { difficultyStageAt, fallSpeedLimitAt } from '../src/core/difficulty'
import { TUNING } from '../src/game/tuning'

const base = TUNING.physics.maxFallSpeed
const step = TUNING.difficulty.fallSpeedStep
const stage = TUNING.difficulty.stageMeters
const limit = TUNING.difficulty.fallSpeedLimit

describe('dificuldade por altitude', () => {
  it('começa no teto aprovado e só sobe no degrau seguinte', () => {
    expect(fallSpeedLimitAt(0)).toBe(base)
    expect(fallSpeedLimitAt(stage - 0.01)).toBe(base)
    expect(fallSpeedLimitAt(stage)).toBe(base + step)
    expect(fallSpeedLimitAt(stage * 2 - 0.01)).toBe(base + step)
    expect(fallSpeedLimitAt(stage * 2)).toBe(base + step * 2)
  })

  it('sobe um degrau por estágio e satura no limite', () => {
    const stagesToCap = (limit - base) / step
    expect(stagesToCap).toBeGreaterThan(0)
    for (let i = 0; i <= stagesToCap; i += 1) {
      expect(fallSpeedLimitAt(stage * i)).toBe(base + step * i)
      expect(fallSpeedLimitAt(stage * i + stage / 2)).toBe(base + step * i)
    }
    expect(fallSpeedLimitAt(stage * stagesToCap)).toBe(limit)
    expect(fallSpeedLimitAt(stage * (stagesToCap + 10))).toBe(limit)
  })

  it('nunca diminui e nunca passa do limite', () => {
    let previous: number = base
    for (let meters = 0; meters <= 5000; meters += 5) {
      const current = fallSpeedLimitAt(meters)
      expect(current).toBeGreaterThanOrEqual(previous)
      expect(current).toBeLessThanOrEqual(limit)
      previous = current
    }
  })

  it('o estágio é o piso dos metros divididos pelo passo', () => {
    expect(difficultyStageAt(0)).toBe(0)
    expect(difficultyStageAt(stage - 1)).toBe(0)
    expect(difficultyStageAt(stage)).toBe(1)
    expect(difficultyStageAt(stage * 3 + 1)).toBe(3)
  })

  it('entradas inválidas caem na base, sem quebrar a run', () => {
    for (const meters of [-100, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(difficultyStageAt(meters)).toBe(0)
      expect(fallSpeedLimitAt(meters)).toBe(base)
    }
  })

  it('o limite mantém a janela de toque jogável', () => {
    // A janela é o tempo que a bola leva para cruzar o diâmetro do alvo de
    // toque na velocidade máxima. 0,12 s ≈ 7 frames a 60 fps.
    const windowSeconds = (2 * TUNING.kick.touchRadius) / limit
    expect(windowSeconds).toBeGreaterThanOrEqual(0.12)
    expect(windowSeconds).toBeLessThan((2 * TUNING.kick.touchRadius) / base)
  })

  it('o limite fecha em um número inteiro de degraus', () => {
    // Sem isso, o último degrau poderia ser um salto parcial e o aviso de
    // ritmo mentiria sobre o tamanho do aumento.
    const stagesToCap = (limit - base) / step
    expect(Math.abs(stagesToCap - Math.round(stagesToCap))).toBeLessThan(1e-9)
    expect(stagesToCap).toBeGreaterThanOrEqual(2)
  })
})
