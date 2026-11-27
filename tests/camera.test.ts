import { describe, expect, it } from 'vitest'
import { kickZoomAmount, metersFromTop, ratchetCameraY, smoothCameraY } from '../src/core/camera'
import { TUNING } from '../src/game/tuning'

describe('altitude', () => {
  it('converte subida em metros', () => {
    expect(metersFromTop(1000, 600)).toBe(20)
    expect(metersFromTop(1000, 1000)).toBe(0)
  })

  it('nunca fica negativa', () => {
    expect(metersFromTop(1000, 1200)).toBe(0)
  })
})

describe('câmera-catraca', () => {
  const H = TUNING.world.height

  it('sobe quando a bola passa do gatilho', () => {
    const scroll = ratchetCameraY(0, 150, H)
    expect(scroll).toBeLessThan(0)
  })

  it('nunca desce', () => {
    const scroll = ratchetCameraY(-500, 900, H)
    expect(scroll).toBe(-500)
  })

  it('acompanha respeitando o gatilho', () => {
    const scroll = ratchetCameraY(-1000, -1200, H)
    expect(scroll).toBeCloseTo(-1200 - H * TUNING.camera.ratchetAt, 5)
  })

  it('suavização não ultrapassa o alvo e nunca desce', () => {
    const next = smoothCameraY(0, -400, 1 / 60)
    expect(next).toBeLessThan(0)
    expect(next).toBeGreaterThan(-400)
    expect(smoothCameraY(-400, 0, 1 / 60)).toBe(-400)
  })
})

describe('zoom do chute', () => {
  const { kickZoomThreshold, kickZoomMax } = TUNING.camera

  it('não recua no threshold e abaixo dele', () => {
    expect(kickZoomAmount(0)).toBe(0)
    expect(kickZoomAmount(kickZoomThreshold - 0.01)).toBe(0)
    expect(kickZoomAmount(kickZoomThreshold)).toBe(0)
  })

  it('entrega o máximo em força cheia', () => {
    expect(kickZoomAmount(1)).toBe(kickZoomMax)
  })

  it('cresce monotonicamente dentro da rampa', () => {
    const steps = 20
    let previous = -1
    for (let i = 0; i <= steps; i += 1) {
      const amount = kickZoomAmount(kickZoomThreshold + (1 - kickZoomThreshold) * (i / steps))
      expect(amount).toBeGreaterThanOrEqual(previous)
      previous = amount
    }
    expect(kickZoomAmount(0.75)).toBeGreaterThan(0)
    expect(kickZoomAmount(0.75)).toBeLessThan(kickZoomMax)
  })

  it('clampa fora de 0..1', () => {
    expect(kickZoomAmount(-3)).toBe(0)
    expect(kickZoomAmount(2)).toBe(kickZoomMax)
  })

  it('entradas inválidas não geram zoom', () => {
    expect(kickZoomAmount(Number.NaN)).toBe(0)
    expect(kickZoomAmount(Number.POSITIVE_INFINITY)).toBe(0)
    expect(kickZoomAmount(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})
