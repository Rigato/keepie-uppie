import { describe, expect, it } from 'vitest'
import { smoothstep } from '../src/core/math'
import { ObstacleSpawner } from '../src/core/spawner'
import { TUNING } from '../src/game/tuning'
import type { ObstacleSpawn } from '../src/game/contracts'

function run(spawner: ObstacleSpawner, upToMeters: number, ballX = 270): ObstacleSpawn[] {
  const out: ObstacleSpawn[] = []
  for (let meters = 0; meters <= upToMeters; meters += 4) {
    out.push(
      ...spawner.update({
        cameraTop: -meters * TUNING.physics.pxPerMeter,
        meters,
        ballX,
      }),
    )
  }
  return out
}

describe('ObstacleSpawner', () => {
  it('é determinístico com a mesma seed', () => {
    const a = run(new ObstacleSpawner(1234), 600)
    const b = run(new ObstacleSpawner(1234), 600)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('muda com seeds diferentes', () => {
    const a = run(new ObstacleSpawner(1), 600)
    const b = run(new ObstacleSpawner(2), 600)
    expect(a).not.toEqual(b)
  })

  it('não spawna antes do primeiro marco', () => {
    const spawner = new ObstacleSpawner(7)
    expect(spawner.update({ cameraTop: -100, meters: TUNING.spawn.firstAtMeters - 1, ballX: 270 })).toEqual([])
    expect(
      spawner.update({ cameraTop: -600, meters: TUNING.spawn.firstAtMeters + 1, ballX: 270 }).length,
    ).toBe(1)
  })

  it('aumenta a densidade com a altitude', () => {
    const curto = run(new ObstacleSpawner(99), 300).length
    const longo = run(new ObstacleSpawner(99), 1200).length
    expect(longo).toBeGreaterThan(curto * 3)
  })

  it('coloca barras dentro da tela e majoritariamente fora do corredor da bola', () => {
    const specs = run(new ObstacleSpawner(55), 800, 270).filter((spec) => spec.kind !== 'bird')
    expect(specs.length).toBeGreaterThan(0)

    const safe = specs.filter((spec) => Math.abs(spec.x - 270) >= TUNING.spawn.safeXGap)
    expect(safe.length / specs.length).toBeGreaterThan(0.75)

    for (const spec of specs) {
      expect(spec.x - spec.width / 2).toBeGreaterThanOrEqual(TUNING.world.wallWidth)
      expect(spec.x + spec.width / 2).toBeLessThanOrEqual(
        TUNING.world.width - TUNING.world.wallWidth,
      )
    }
  })

  it('barras nascem acima do topo da câmera', () => {
    const spawner = new ObstacleSpawner(5)
    for (let meters = TUNING.spawn.firstAtMeters; meters <= 500; meters += 4) {
      const cameraTop = -meters * TUNING.physics.pxPerMeter
      for (const spec of spawner.update({ cameraTop, meters, ballX: 270 })) {
        if (spec.kind === 'bird') continue
        expect(spec.y).toBeLessThan(cameraTop)
      }
    }
  })

  it('bando nasce fora da tela, dentro da faixa do topo', () => {
    const birds = run(new ObstacleSpawner(77), 900).filter((spec) => spec.kind === 'bird')
    for (const bird of birds) {
      const fora = bird.x + bird.width / 2 < 0 || bird.x - bird.width / 2 > TUNING.world.width
      expect(fora).toBe(true)
    }
  })

  it('não usa Bumper nem Ramp antes de 300 m', () => {
    const early = run(new ObstacleSpawner(101), 299)
    expect(early.some((spec) => spec.kind === 'bumper')).toBe(false)
    expect(early.some((spec) => spec.kind === 'ramp')).toBe(false)
  })

  it('introduz Bumper e Ramp depois de 300 m', () => {
    let both = false
    for (let seed = 1; seed < 120 && !both; seed += 1) {
      const kinds = new Set(run(new ObstacleSpawner(seed), 2400).map((spec) => spec.kind))
      both = kinds.has('bumper') && kinds.has('ramp')
    }
    expect(both).toBe(true)
  })

  it('respeita o teto de eventos por atualização', () => {
    const spawner = new ObstacleSpawner(3)
    const specs = spawner.update({ cameraTop: -10_000, meters: 10_000, ballX: 270 })
    expect(specs.length).toBeLessThanOrEqual(TUNING.spawn.maxPerUpdate)
  })

  it('o ObstacleKind não inclui mais o hard', () => {
    for (let seed = 1; seed < 12; seed += 1) {
      for (const spec of run(new ObstacleSpawner(seed), 2400)) {
        expect(spec.kind).not.toBe('hard')
      }
    }
  })

  it('o passo segue smoothstep contínuo (0/500/1000/2000 m)', () => {
    const { startStepMeters, minStepMeters, stepAtMeters } = TUNING.spawn
    const stepAt = (meters: number): number =>
      startStepMeters +
      (minStepMeters - startStepMeters) * smoothstep(0, stepAtMeters, meters)
    expect(stepAt(0)).toBeCloseTo(200, 5)
    expect(stepAt(500)).toBeCloseTo(176.67, 1)
    expect(stepAt(1000)).toBeCloseTo(133.33, 1)
    expect(stepAt(2000)).toBeCloseTo(110, 5)
    // Sem degrau: a diferença em 1 m é pequena mesmo cruzando uma âncora.
    expect(Math.abs(stepAt(599) - stepAt(601))).toBeLessThan(0.5)
  })

  it('Bumper e Ramp entram suavemente depois de 300 m, sem salto', () => {
    const mixAt = (meters: number, index: number): number => {
      const anchors = TUNING.spawn.mix
      for (let i = 1; i < anchors.length; i += 1) {
        const a = anchors[i - 1]!
        const b = anchors[i]!
        if (meters > b.meters) continue
        const t = smoothstep(0, 1, (meters - a.meters) / (b.meters - a.meters))
        return a.weights[index]! + (b.weights[index]! - a.weights[index]!) * t
      }
      return anchors[anchors.length - 1]!.weights[index]!
    }
    expect(mixAt(299, 3)).toBe(0)
    expect(mixAt(300, 3)).toBe(0)
    expect(mixAt(450, 3)).toBeGreaterThan(0)
    expect(Math.abs(mixAt(599, 3) - mixAt(601, 3))).toBeLessThan(0.2)
    expect(Math.abs(mixAt(1199, 4) - mixAt(1201, 4))).toBeLessThan(0.2)
  })
})
