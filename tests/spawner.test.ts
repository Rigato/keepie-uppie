import { describe, expect, it } from 'vitest'
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

  it('respeita o teto de eventos por atualização', () => {
    const spawner = new ObstacleSpawner(3)
    const specs = spawner.update({ cameraTop: -10_000, meters: 10_000, ballX: 270 })
    expect(specs.length).toBeLessThanOrEqual(TUNING.spawn.maxPerUpdate)
  })
})
