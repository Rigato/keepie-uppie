import { describe, expect, it } from 'vitest'
import {
  advanceFlightZoom,
  flightZoomTarget,
  kickZoomAmount,
  metersFromTop,
  ratchetCameraY,
  smoothCameraY,
  smoothZoom,
  type FlightZoomPhase,
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

describe('fase do zoom de voo', () => {
  const phases: FlightZoomPhase[] = ['idle', 'open', 'closing']

  it('idle é estável', () => {
    for (const vy of [-2600, 0, 900]) {
      expect(advanceFlightZoom('idle', vy)).toBe('idle')
    }
  })

  it('open segue aberta enquanto a bola sobe', () => {
    expect(advanceFlightZoom('open', -2600)).toBe('open')
    expect(advanceFlightZoom('open', -1)).toBe('open')
  })

  it('open fecha no ápice (vy = 0) e na queda (vy > 0)', () => {
    expect(advanceFlightZoom('open', 0)).toBe('closing')
    expect(advanceFlightZoom('open', 900)).toBe('closing')
  })

  it('closing nunca volta a abrir sem um chute novo', () => {
    for (const vy of [-2600, -1, 0, 900]) {
      expect(advanceFlightZoom('closing', vy)).toBe('closing')
    }
  })

  it('vy inválido mantém a fase (sem pisco)', () => {
    for (const phase of phases) {
      expect(advanceFlightZoom(phase, Number.NaN)).toBe(phase)
      expect(advanceFlightZoom(phase, Number.POSITIVE_INFINITY)).toBe(phase)
      expect(advanceFlightZoom(phase, Number.NEGATIVE_INFINITY)).toBe(phase)
    }
  })

  it('a abertura devolve o recuo clampado em 0..1', () => {
    expect(flightZoomTarget('open', 0)).toBe(1)
    expect(flightZoomTarget('open', TUNING.camera.kickZoomMax)).toBeCloseTo(0.88, 5)
    expect(flightZoomTarget('open', -1)).toBe(1)
    expect(flightZoomTarget('open', 2)).toBe(0)
    expect(flightZoomTarget('open', Number.NaN)).toBe(1)
  })

  it('idle e closing sempre miram o zoom normal', () => {
    for (const phase of ['idle', 'closing'] as FlightZoomPhase[]) {
      expect(flightZoomTarget(phase, 0)).toBe(1)
      expect(flightZoomTarget(phase, TUNING.camera.kickZoomMax)).toBe(1)
    }
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
