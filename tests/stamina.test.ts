import { describe, expect, it } from 'vitest'
import { StaminaMeter } from '../src/core/stamina'
import { TUNING } from '../src/game/tuning'

const S = TUNING.stamina

describe('StaminaMeter', () => {
  it('começa cheia', () => {
    const meter = new StaminaMeter()
    expect(meter.value).toBe(S.max)
    expect(meter.ratio).toBe(1)
    expect(meter.exhausted).toBe(false)
  })

  it('o custo é aplicado com saldo parcial: o 4º chute esgota', () => {
    const meter = new StaminaMeter()
    // 100 → 70 → 40 → 10 → 0 (10 − 30 zera; o chute ainda conta).
    for (let i = 0; i < 3; i += 1) {
      expect(meter.spendKick()).toEqual({ blocked: false, justExhausted: false })
      expect(meter.value).toBe(S.max - (i + 1) * S.kickCost)
    }
    expect(meter.value).toBe(10)
    expect(meter.spendKick()).toEqual({ blocked: false, justExhausted: true })
    expect(meter.value).toBe(0)
    expect(meter.ratio).toBe(0)
    expect(meter.exhausted).toBe(true)
  })

  it('chute durante exaustão é bloqueado e não mexe na barra', () => {
    const meter = new StaminaMeter()
    for (let i = 0; i < 4; i += 1) meter.spendKick()
    meter.update(0.3) // 300 ms de 1200 ms → 25% da barra
    expect(meter.value).toBeCloseTo(S.max * 0.25, 5)

    expect(meter.spendKick()).toEqual({ blocked: true, justExhausted: false })
    expect(meter.value).toBeCloseTo(S.max * 0.25, 5)
    expect(meter.exhausted).toBe(true)
  })

  it('fora da exaustão recarrega e satura no máximo', () => {
    const meter = new StaminaMeter()
    meter.spendKick() // 70
    meter.update(0.5) // +24 * 0.5 = +12 → 82
    expect(meter.value).toBeCloseTo(82, 5)

    meter.update(10) // delta grande: satura, sem passar do teto
    expect(meter.value).toBe(S.max)
    expect(meter.ratio).toBe(1)
    expect(meter.exhausted).toBe(false)
  })

  it('durante a exaustão a barra sobe linearmente e termina cheia', () => {
    const meter = new StaminaMeter()
    for (let i = 0; i < 4; i += 1) meter.spendKick()
    const half = S.recoverMs / 1000 / 2

    meter.update(half)
    expect(meter.value).toBeCloseTo(S.max / 2, 5)
    expect(meter.exhausted).toBe(true)

    meter.update(half)
    expect(meter.value).toBe(S.max)
    expect(meter.exhausted).toBe(false)
    expect(meter.spendKick()).toEqual({ blocked: false, justExhausted: false })
  })

  it('recarregar menos que recoverMs mantém o bloqueio', () => {
    const meter = new StaminaMeter()
    for (let i = 0; i < 4; i += 1) meter.spendKick()

    meter.update((S.recoverMs - 1) / 1000)
    expect(meter.exhausted).toBe(true)
    expect(meter.value).toBeCloseTo(S.max * ((S.recoverMs - 1) / S.recoverMs), 5)
    expect(meter.spendKick().blocked).toBe(true)
  })

  it('reset limpa valor, exaustão e contador de recarga', () => {
    const meter = new StaminaMeter()
    for (let i = 0; i < 4; i += 1) meter.spendKick()
    meter.update(0.2)
    expect(meter.exhausted).toBe(true)

    meter.reset()
    expect(meter.value).toBe(S.max)
    expect(meter.ratio).toBe(1)
    expect(meter.exhausted).toBe(false)
    expect(meter.spendKick()).toEqual({ blocked: false, justExhausted: false })
  })

  it('ignora dt inválido e nunca sai de 0..max', () => {
    const meter = new StaminaMeter()
    meter.spendKick() // 70
    for (const dt of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      meter.update(dt)
      expect(meter.value).toBe(S.max - S.kickCost)
    }

    for (let i = 0; i < 50; i += 1) {
      meter.update(0.05)
      meter.spendKick()
      expect(meter.value).toBeGreaterThanOrEqual(0)
      expect(meter.value).toBeLessThanOrEqual(S.max)
    }
  })

  it('aceita configuração própria, sem depender do tuning global', () => {
    const meter = new StaminaMeter({
      max: 10,
      kickCost: 5,
      regenPerSecond: 10,
      recoverMs: 500,
    })
    expect(meter.max).toBe(10)
    expect(meter.spendKick()).toEqual({ blocked: false, justExhausted: false })
    expect(meter.spendKick()).toEqual({ blocked: false, justExhausted: true })
    meter.update(0.25)
    expect(meter.value).toBeCloseTo(5, 5)
  })
})
