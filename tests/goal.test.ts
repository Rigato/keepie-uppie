import { describe, expect, it } from 'vitest'
import { GoalSpawner, isGoalCrossing, type GoalSpawn } from '../src/core/goal'
import { TUNING } from '../src/game/tuning'

interface Collected {
  meters: number
  spawn: GoalSpawn
}

function collect(spawner: GoalSpawner, upToMeters: number, ballX = 270): Collected[] {
  const out: Collected[] = []
  for (let meters = 0; meters <= upToMeters; meters += 1) {
    const spawn = spawner.update({
      cameraTop: -meters * TUNING.physics.pxPerMeter,
      meters,
      ballX,
    })
    if (spawn) out.push({ meters, spawn })
  }
  return out
}

describe('GoalSpawner', () => {
  it('é determinístico com a mesma seed', () => {
    const a = collect(new GoalSpawner(1234), 4000)
    const b = collect(new GoalSpawner(1234), 4000)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(2)
  })

  it('reproduz a sequência depois de reset', () => {
    const spawner = new GoalSpawner(77)
    const first = collect(spawner, 2500)
    spawner.reset(77)
    const second = collect(spawner, 2500)
    expect(second).toEqual(first)
  })

  it('muda com seeds diferentes', () => {
    const a = collect(new GoalSpawner(1), 2500)
    const b = collect(new GoalSpawner(2), 2500)
    expect(a).not.toEqual(b)
  })

  it('só emite o primeiro gol a partir de firstAtMeters', () => {
    const spawner = new GoalSpawner(7)
    expect(
      spawner.update({
        cameraTop: -199 * TUNING.physics.pxPerMeter,
        meters: TUNING.goal.firstAtMeters - 1,
        ballX: 270,
      }),
    ).toBeNull()

    const first = spawner.update({
      cameraTop: -TUNING.goal.firstAtMeters * TUNING.physics.pxPerMeter,
      meters: TUNING.goal.firstAtMeters,
      ballX: 270,
    })
    expect(first).not.toBeNull()
  })

  it('mantém os intervalos entre gols dentro de minGap..maxGap', () => {
    const goals = collect(new GoalSpawner(55), 5000)
    expect(goals.length).toBeGreaterThanOrEqual(5)

    for (let i = 1; i < goals.length; i += 1) {
      const previous = goals[i - 1]
      const current = goals[i]
      if (!previous || !current) continue
      const gap = current.meters - previous.meters
      expect(gap).toBeGreaterThanOrEqual(TUNING.goal.minGapMeters)
      expect(gap).toBeLessThanOrEqual(TUNING.goal.maxGapMeters)
    }
  })

  it('respeita dimensões, paredes e margem lateral', () => {
    const goals = collect(new GoalSpawner(99), 3000)
    const expectedWidth = TUNING.goal.gapWidth + 2 * TUNING.goal.postThickness
    const expectedHeight = TUNING.goal.gapHeight + TUNING.goal.postThickness
    const minEdge = TUNING.world.wallWidth + 20

    for (const { spawn } of goals) {
      expect(spawn.width).toBe(expectedWidth)
      expect(spawn.height).toBe(expectedHeight)
      expect(spawn.x - spawn.width / 2).toBeGreaterThanOrEqual(minEdge)
      expect(spawn.x + spawn.width / 2).toBeLessThanOrEqual(TUNING.world.width - minEdge)
    }
  })

  it('nasce acima do topo da câmera, com jitter limitado', () => {
    const goals = collect(new GoalSpawner(31), 2000)
    for (const { meters, spawn } of goals) {
      const cameraTop = -meters * TUNING.physics.pxPerMeter
      const above = cameraTop - spawn.y
      expect(above).toBeGreaterThanOrEqual(TUNING.goal.aboveTop)
      expect(above).toBeLessThanOrEqual(TUNING.goal.aboveTop + 60)
    }
  })

  it('não despeja vários gols quando a altitude salta de uma vez', () => {
    const spawner = new GoalSpawner(9)
    const input = {
      cameraTop: -10_000 * TUNING.physics.pxPerMeter,
      meters: 10_000,
      ballX: 270,
    }
    expect(spawner.update(input)).not.toBeNull()
    expect(spawner.update(input)).toBeNull()
  })
})

describe('isGoalCrossing', () => {
  const gapLeft = 100
  const gapRight = 280
  const scoreY = 500

  it('conta a subida pelo meio do vão', () => {
    expect(isGoalCrossing(520, 480, 190, gapLeft, gapRight, scoreY)).toBe(true)
    expect(isGoalCrossing(500, 499, 100 + 2, gapLeft, gapRight, scoreY)).toBe(true)
    expect(isGoalCrossing(500, 499, 280 - 2, gapLeft, gapRight, scoreY)).toBe(true)
  })

  it('não conta a descida', () => {
    expect(isGoalCrossing(480, 520, 190, gapLeft, gapRight, scoreY)).toBe(false)
  })

  it('não conta fora do vão', () => {
    expect(isGoalCrossing(520, 480, 90, gapLeft, gapRight, scoreY)).toBe(false)
    expect(isGoalCrossing(520, 480, 290, gapLeft, gapRight, scoreY)).toBe(false)
    // A folga de 2 u não pode invadir a espessura do poste.
    expect(isGoalCrossing(520, 480, 101, gapLeft, gapRight, scoreY)).toBe(false)
    expect(isGoalCrossing(520, 480, 279, gapLeft, gapRight, scoreY)).toBe(false)
  })

  it('não conta sem cruzar a linha de pontuação', () => {
    expect(isGoalCrossing(600, 580, 190, gapLeft, gapRight, scoreY)).toBe(false)
    expect(isGoalCrossing(480, 470, 190, gapLeft, gapRight, scoreY)).toBe(false)
    expect(isGoalCrossing(500, 500, 190, gapLeft, gapRight, scoreY)).toBe(false)
  })

  it('precisa de uma subida completa na chamada', () => {
    // A bola já acima da linha e continuando acima não cruza de novo.
    expect(isGoalCrossing(470, 450, 190, gapLeft, gapRight, scoreY)).toBe(false)
  })
})
