import { describe, expect, it } from 'vitest'
import {
  flightZoomEnvelope,
  kickZoomAmount,
  metersFromTop,
  ratchetCameraY,
  smoothCameraY,
  smoothZoom,
} from '../src/core/camera'
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

describe('envelope do voo', () => {
  const H = TUNING.world.height
  const { zoomHoldUntil, zoomCloseAt } = TUNING.camera

  it('mantém o afastamento enquanto a bola sobe', () => {
    expect(flightZoomEnvelope(-1, H * 0.95, H)).toBe(1)
    expect(flightZoomEnvelope(-2600, 0, H)).toBe(1)
  })

  it('segura o afastamento no topo da queda', () => {
    expect(flightZoomEnvelope(0, 0, H)).toBe(1)
    expect(flightZoomEnvelope(900, H * zoomHoldUntil, H)).toBe(1)
    expect(flightZoomEnvelope(900, H * zoomHoldUntil - 1, H)).toBe(1)
  })

  it('fecha de vez no fundo', () => {
    expect(flightZoomEnvelope(900, H * zoomCloseAt, H)).toBe(0)
    expect(flightZoomEnvelope(900, H, H)).toBe(0)
    expect(flightZoomEnvelope(900, H * 2, H)).toBe(0)
  })

  it('cai monotonicamente entre o hold e o close', () => {
    const steps = 20
    let previous = 1
    for (let i = 0; i <= steps; i += 1) {
      const y = H * (zoomHoldUntil + (zoomCloseAt - zoomHoldUntil) * (i / steps))
      const env = flightZoomEnvelope(900, y, H)
      expect(env).toBeGreaterThanOrEqual(0)
      expect(env).toBeLessThanOrEqual(1)
      expect(env).toBeLessThanOrEqual(previous)
      previous = env
    }
    expect(flightZoomEnvelope(900, H * ((zoomHoldUntil + zoomCloseAt) / 2), H)).toBeCloseTo(0.5, 5)
  })

  it('entradas inválidas mantêm o afastamento (sem pisco)', () => {
    expect(flightZoomEnvelope(Number.NaN, H * 0.9, H)).toBe(1)
    expect(flightZoomEnvelope(900, Number.POSITIVE_INFINITY, H)).toBe(1)
    expect(flightZoomEnvelope(900, H * 0.9, 0)).toBe(1)
    expect(flightZoomEnvelope(900, H * 0.9, Number.NaN)).toBe(1)
  })
})

describe('suavização do zoom', () => {
  it('aproxima do alvo sem ultrapassar', () => {
    const next = smoothZoom(1, 0.96, 1 / 60, 4)
    expect(next).toBeLessThan(1)
    expect(next).toBeGreaterThan(0.96)
    const up = smoothZoom(0.96, 1, 1 / 60, 4)
    expect(up).toBeGreaterThan(0.96)
    expect(up).toBeLessThan(1)
  })

  it('dt<=0 e entradas inválidas não mudam nada', () => {
    expect(smoothZoom(0.98, 0.96, 0, 4)).toBe(0.98)
    expect(smoothZoom(0.98, 0.96, -1, 4)).toBe(0.98)
    expect(Number.isNaN(smoothZoom(Number.NaN, 0.96, 1 / 60, 4))).toBe(true)
    expect(smoothZoom(0.98, Number.POSITIVE_INFINITY, 1 / 60, 4)).toBe(0.98)
    expect(smoothZoom(0.98, 0.96, Number.NaN, 4)).toBe(0.98)
    expect(smoothZoom(0.98, 0.96, 1 / 60, Number.NaN)).toBe(0.98)
  })

  it('velocidade zero não move; convergência é monotônica', () => {
    expect(smoothZoom(0.98, 1, 1 / 60, 0)).toBe(0.98)
    let z = 0.96
    for (let i = 0; i < 120; i += 1) {
      const next = smoothZoom(z, 1, 1 / 60, 4)
      expect(next).toBeGreaterThanOrEqual(z)
      expect(next).toBeLessThanOrEqual(1)
      z = next
    }
    expect(z).toBeCloseTo(1, 4)
  })
})
