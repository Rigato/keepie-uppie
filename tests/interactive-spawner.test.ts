import { describe, expect, it } from 'vitest'
import { InteractiveSpawner } from '../src/core/interactive-spawner'
import { TUNING } from '../src/game/tuning'
import type { InteractiveSpawn } from '../src/game/contracts'

function run(spawner: InteractiveSpawner, upToMeters: number): InteractiveSpawn[] {
  const out: InteractiveSpawn[] = []
  for (let meters = 0; meters <= upToMeters; meters += 4) {
    out.push(
      ...spawner.update({
        cameraTop: -meters * TUNING.physics.pxPerMeter,
        meters,
      }),
    )
  }
  return out
}

describe('InteractiveSpawner', () => {
  it('é determinístico com a mesma seed', () => {
    const a = run(new InteractiveSpawner(7), 500)
    const b = run(new InteractiveSpawner(7), 500)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('começa depois do primeiro marco', () => {
    const spawner = new InteractiveSpawner(3)
    expect(spawner.update({ cameraTop: -100, meters: TUNING.interactive.firstAtMeters - 1 })).toEqual(
      [],
    )
    expect(
      spawner.update({ cameraTop: -500, meters: TUNING.interactive.firstAtMeters + 1 }).length,
    ).toBeGreaterThan(0)
  })

  it('trilha de moedas tem o tamanho configurado e sobe em passos', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const spawner = new InteractiveSpawner(seed)
      for (let meters = TUNING.interactive.firstAtMeters; meters <= 200; meters += 2) {
        const batch = spawner.update({
          cameraTop: -meters * TUNING.physics.pxPerMeter,
          meters,
        })
        const coins = batch.filter((spec) => spec.kind === 'coin')
        if (coins.length === 0) continue

        expect(coins.length).toBe(TUNING.interactive.coinTrail)
        for (let i = 1; i < coins.length; i += 1) {
          expect(coins[i]?.y).toBeLessThan(coins[i - 1]?.y ?? 0)
        }
        return
      }
    }
    throw new Error('nenhuma trilha de moedas gerada')
  })

  it('todo interativo nasce acima do topo da câmera', () => {
    const spawner = new InteractiveSpawner(21)
    for (let meters = TUNING.interactive.firstAtMeters; meters <= 400; meters += 4) {
      const cameraTop = -meters * TUNING.physics.pxPerMeter
      for (const spec of spawner.update({ cameraTop, meters })) {
        expect(spec.y).toBeLessThan(cameraTop)
      }
    }
  })

  it('mantém os itens dentro da área jogável', () => {
    for (const spec of run(new InteractiveSpawner(31), 700)) {
      expect(spec.x).toBeGreaterThan(TUNING.world.wallWidth)
      expect(spec.x).toBeLessThan(TUNING.world.width - TUNING.world.wallWidth)
    }
  })

  it('aumenta a densidade com a altitude', () => {
    const curto = run(new InteractiveSpawner(41), 200).length
    const longo = run(new InteractiveSpawner(41), 900).length
    expect(longo).toBeGreaterThan(curto * 3)
  })
})
