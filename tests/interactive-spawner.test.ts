import { describe, expect, it } from 'vitest'
import { buildCoinOffsets, type CoinPatternId } from '../src/core/coin-patterns'
import { sampleAnchors, smoothstep } from '../src/core/math'
import { InteractiveSpawner, interactiveRect } from '../src/core/interactive-spawner'
import { overlaps } from '../src/core/spawn-layout'
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

interface Tracked {
  spec: InteractiveSpawn
  meters: number
  cameraTop: number
}

function runTracked(spawner: InteractiveSpawner, upToMeters: number): Tracked[] {
  const out: Tracked[] = []
  for (let meters = 0; meters <= upToMeters; meters += 4) {
    const cameraTop = -meters * TUNING.physics.pxPerMeter
    for (const spec of spawner.update({ cameraTop, meters })) {
      out.push({ spec, meters, cameraTop })
    }
  }
  return out
}

const PATTERN_IDS: readonly CoinPatternId[] = [
  'trail',
  'row',
  'square',
  'diamond',
  'star',
  'zigzag',
]

/** Forma normalizada (translada o mínimo para a origem), ignorando a posição. */
function shapeOf(points: readonly { x: number; y: number }[]): string[] {
  const minX = Math.min(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  return points
    .map((p) => `${(p.x - minX).toFixed(3)}|${(p.y - minY).toFixed(3)}`)
    .sort()
}

/** Offsets são +y para cima; no mundo, y cresce para baixo. */
const PATTERN_SHAPES = new Map(
  PATTERN_IDS.map((id) => [
    id,
    shapeOf(
      buildCoinOffsets(
        id,
        TUNING.interactive.coinSpacing,
        TUNING.interactive.coinArc,
      ).map((offset) => ({ x: offset.x, y: -offset.y })),
    ),
  ]),
)

function bySet(entries: readonly Tracked[]): Map<number, Tracked[]> {
  const sets = new Map<number, Tracked[]>()
  for (const entry of entries) {
    if (entry.spec.kind !== 'coin' || entry.spec.setId === undefined) continue
    const list = sets.get(entry.spec.setId) ?? []
    list.push(entry)
    sets.set(entry.spec.setId, list)
  }
  return sets
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

  it('cada conjunto é um dos seis padrões, sem deformação', () => {
    const seen = new Set<CoinPatternId>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const [setId, list] of bySet(runTracked(new InteractiveSpawner(seed), 1400))) {
        expect(setId).toBeGreaterThan(0)
        const shape = shapeOf(list.map((entry) => entry.spec))
        const match = PATTERN_IDS.find((id) =>
          JSON.stringify(PATTERN_SHAPES.get(id)) === JSON.stringify(shape),
        )
        expect(match, `conjunto ${setId} (seed ${seed}) não bate com nenhum padrão`).toBeDefined()
        if (match) seen.add(match)
      }
    }
    for (const id of PATTERN_IDS) expect(seen.has(id), `padrão ${id} nunca apareceu`).toBe(true)
  })

  it('moeda especial só nasce a partir de 400 m, uma por conjunto', () => {
    let below = 0
    let above = 0
    for (const seed of [1, 2, 3, 17, 1234]) {
      for (const list of bySet(runTracked(new InteractiveSpawner(seed), 3000)).values()) {
        const meters = list[0]!.meters
        const specials = list.filter((entry) => entry.spec.special === true)
        if (meters < TUNING.collect.coinSpecialMinMeters) {
          expect(specials).toHaveLength(0)
          below += 1
        } else {
          expect(specials).toHaveLength(1)
          above += 1
        }
      }
    }
    expect(below).toBeGreaterThan(0)
    expect(above).toBeGreaterThan(0)
  })

  it('conjuntos inteiros e especial ficam acima do topo e dentro das paredes', () => {
    for (const seed of [5, 21, 77]) {
      for (const entry of runTracked(new InteractiveSpawner(seed), 1800)) {
        expect(entry.spec.y).toBeLessThan(entry.cameraTop)
        expect(entry.spec.x).toBeGreaterThan(TUNING.world.wallWidth)
        expect(entry.spec.x).toBeLessThan(TUNING.world.width - TUNING.world.wallWidth)

        if (entry.spec.special === true) {
          const rect = interactiveRect(entry.spec)
          expect(rect.width).toBe(36)
          expect(rect.height).toBe(36)
        }
      }
    }
  })

  it('moedas do mesmo conjunto não se sobrepõem', () => {
    const gap = TUNING.spawn.overlapGap
    for (const seed of [1, 2, 3, 17, 1234]) {
      for (const list of bySet(runTracked(new InteractiveSpawner(seed), 1600)).values()) {
        const rects = list.map((entry) => interactiveRect(entry.spec))
        for (let i = 0; i < rects.length; i += 1) {
          for (let j = i + 1; j < rects.length; j += 1) {
            expect(overlaps(rects[i]!, rects[j]!, gap)).toBe(false)
          }
        }
      }
    }
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

  it('não sorteia Shield antes de 200 m nem Sweet Spot antes de 300 m', () => {
    for (const spec of run(new InteractiveSpawner(63), 199)) {
      expect(spec.kind).not.toBe('pickupShield')
      expect(spec.kind).not.toBe('pickupSweet')
    }
    for (const spec of run(new InteractiveSpawner(64), 299)) {
      expect(spec.kind).not.toBe('pickupSweet')
    }
  })

  it('introduz Shield e Sweet Spot nas altitudes certas', () => {
    let shield = false
    let sweet = false
    for (let seed = 1; seed < 120 && !(shield && sweet); seed += 1) {
      for (const spec of run(new InteractiveSpawner(seed), 1800)) {
        if (spec.kind === 'pickupShield') shield = true
        if (spec.kind === 'pickupSweet') sweet = true
      }
    }
    expect(shield).toBe(true)
    expect(sweet).toBe(true)
  })

  it('passo dos interativos é suave (0/500/1000/2000 m)', () => {
    const { startStepMeters, minStepMeters, stepAtMeters } = TUNING.interactive
    const stepAt = (meters: number): number =>
      startStepMeters +
      (minStepMeters - startStepMeters) * smoothstep(0, stepAtMeters, meters)
    expect(stepAt(0)).toBeCloseTo(70, 5)
    expect(stepAt(500)).toBeCloseTo(57.2, 1)
    expect(stepAt(1000)).toBeCloseTo(38.5, 1)
    expect(stepAt(2000)).toBeCloseTo(36, 5)
    expect(Math.abs(stepAt(599) - stepAt(601))).toBeLessThan(0.5)
  })

  it('a fatia de moedas cresce suavemente com a altitude', () => {
    const series = TUNING.interactive.coinWeightAnchors.map((a) => ({
      meters: a.meters,
      value: a.weight,
    }))
    expect(sampleAnchors(series, 0)).toBe(50)
    expect(sampleAnchors(series, 600)).toBe(55)
    expect(sampleAnchors(series, 1500)).toBe(60)
    expect(sampleAnchors(series, 2000)).toBe(60)
    expect(Math.abs(sampleAnchors(series, 599) - sampleAnchors(series, 601))).toBeLessThan(0.1)
  })
})
