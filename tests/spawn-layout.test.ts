import { describe, expect, it } from 'vitest'
import { GoalSpawner } from '../src/core/goal'
import { InteractiveSpawner, interactiveRect } from '../src/core/interactive-spawner'
import { mulberry32, ObstacleSpawner, obstacleRect } from '../src/core/spawner'
import {
  isFree,
  overlaps,
  rectFromBounds,
  resolveGroupPlacement,
  resolvePlacement,
  spawnRect,
  unionRect,
  type SpawnRect,
} from '../src/core/spawn-layout'
import { TUNING } from '../src/game/tuning'
import type { InteractiveSpawn } from '../src/game/contracts'

const WORLD = TUNING.world
const GAP = TUNING.spawn.overlapGap

function layout(seed = 1): {
  rng: () => number
  world: typeof WORLD
  gap: number
  attempts: number
  levels: number
} {
  return {
    rng: mulberry32(seed),
    world: WORLD,
    gap: GAP,
    attempts: TUNING.spawn.placementAttempts,
    levels: TUNING.spawn.placementLevels,
  }
}

describe('spawn-layout: AABB e conversão', () => {
  it('converte bounds de canto para centro', () => {
    expect(rectFromBounds({ x: 100, y: -50, width: 40, height: 20 })).toEqual({
      cx: 120,
      cy: -40,
      width: 40,
      height: 20,
    })
  })

  it('detecta sobreposição com folga e permite o toque exato na borda+gap', () => {
    const a = spawnRect(100, 0, 40, 20)
    const b = spawnRect(100 + 30 + GAP - 1, 0, 20, 20)
    expect(overlaps(a, b, GAP)).toBe(true)
    b.cx = 100 + 30 + GAP
    expect(overlaps(a, b, GAP)).toBe(false)
  })

  it('calcula a união do grupo com o padding dos membros', () => {
    const rects = [spawnRect(100, -40, 26, 26), spawnRect(128, -84, 26, 26)]
    expect(unionRect(rects)).toEqual({
      cx: 114,
      cy: -62,
      width: 54,
      height: 70,
    })
  })
})

describe('resolvePlacement', () => {
  it('mantém o x desejado quando não há sobreposição, sem consumir rng', () => {
    const forbidden = (): number => {
      throw new Error('rng não deveria ser chamado')
    }
    const desired = spawnRect(200, -300, 60, 20)
    expect(resolvePlacement({ ...layout(), rng: forbidden, rect: desired, occupied: [] })).toEqual(
      desired,
    )
  })

  it('move lateralmente quando o x desejado está ocupado, mantendo o y', () => {
    const blocker = spawnRect(200, -300, 80, 40)
    const desired = spawnRect(200, -300, 60, 20)
    const result = resolvePlacement({ ...layout(7), rect: desired, occupied: [blocker] })
    expect(result).not.toBeNull()
    expect(result?.cy).toBe(desired.cy)
    expect(result?.cx).not.toBe(desired.cx)
    expect(isFree(result!, [blocker], GAP)).toBe(true)
  })

  it('recua verticalmente quando não há x livre na altura desejada', () => {
    const blockers: SpawnRect[] = [80, 270, 460].map((cx) => spawnRect(cx, -300, 200, 40))
    const desired = spawnRect(200, -300, 100, 20)
    const result = resolvePlacement({
      ...layout(11),
      rect: desired,
      occupied: blockers,
      attempts: 4,
      levels: 4,
    })
    expect(result).not.toBeNull()
    expect(result!.cy).toBeLessThan(desired.cy)
    expect(isFree(result!, blockers, GAP)).toBe(true)
  })

  it('devolve null quando o espaço está esgotado', () => {
    const blockers = [spawnRect(270, 0, WORLD.width * 2, WORLD.height * 2)]
    expect(
      resolvePlacement({
        ...layout(3),
        rect: spawnRect(270, 0, 100, 20),
        occupied: blockers,
        attempts: 2,
        levels: 0,
      }),
    ).toBeNull()
  })

  it('é determinístico com a mesma seed', () => {
    const rect = spawnRect(200, -300, 100, 20)
    const occupied = [spawnRect(200, -300, 100, 40)]
    const a = resolvePlacement({ ...layout(99), rect, occupied })
    const b = resolvePlacement({ ...layout(99), rect, occupied })
    expect(a).toEqual(b)
  })

  it('respeita as paredes em qualquer reposicionamento lateral', () => {
    const occupied = Array.from({ length: 12 }, (_, i) =>
      spawnRect(60 + i * 36, -300, 30, 40),
    )
    const width = 100
    const minX = WORLD.wallWidth + width / 2
    const maxX = WORLD.width - WORLD.wallWidth - width / 2
    for (let seed = 0; seed < 30; seed += 1) {
      const result = resolvePlacement({
        ...layout(seed),
        rect: spawnRect(200, -300, width, 20),
        occupied,
      })
      if (!result) continue
      expect(result.cx).toBeGreaterThanOrEqual(minX)
      expect(result.cx).toBeLessThanOrEqual(maxX)
      expect(isFree(result, occupied, GAP)).toBe(true)
    }
  })

  it('mantém o gap configurado mesmo em caso de recuo vertical', () => {
    const blockers = [spawnRect(270, -300, 200, 80), spawnRect(270, -420, 200, 80)]
    const result = resolvePlacement({
      ...layout(5),
      rect: spawnRect(270, -300, 100, 20),
      occupied: blockers,
      attempts: 2,
    })
    expect(result).not.toBeNull()
    expect(isFree(result!, blockers, GAP)).toBe(true)
  })
})

describe('resolveGroupPlacement', () => {
  it('desloca a trilha inteira preservando as distâncias relativas', () => {
    const rects = [spawnRect(200, -100, 26, 26), spawnRect(200, -144, 26, 26)]
    const blocker = spawnRect(200, -100, 60, 60)
    const delta = resolveGroupPlacement({ rects, occupied: [blocker], ...layout(13) })
    expect(delta).not.toBeNull()
    expect(delta!.dx).not.toBe(0)
    expect(delta!.dy).toBe(0)
    for (let i = 0; i < rects.length; i += 1) {
      const moved = { ...rects[i]!, cx: rects[i]!.cx + delta!.dx, cy: rects[i]!.cy + delta!.dy }
      expect(isFree(moved, [blocker], GAP)).toBe(true)
      expect(moved.cy - rects[i]!.cy).toBe(delta!.dy)
    }
  })

  it('devolve null se o grupo inteiro não couber', () => {
    const rects = [spawnRect(200, 0, 26, 26)]
    const blocker = spawnRect(270, 0, WORLD.width * 2, WORLD.height * 2)
    expect(
      resolveGroupPlacement({ rects, occupied: [blocker], ...layout(1), attempts: 1, levels: 0 }),
    ).toBeNull()
  })
})

/** Simulação 0..3000 m com janela de entidades vivas, imitando a PlayScene. */
describe('propriedade: zero sobreposições entre spawns', () => {
  interface Entry {
    rect: SpawnRect
  }

  function simulate(seed: number): { placed: number; skipped: number } {
    const obstacles = new ObstacleSpawner(seed)
    const interactives = new InteractiveSpawner(seed ^ 0x9e3779b9)
    const goals = new GoalSpawner(seed ^ 0x85ebca6b)
    const live: Entry[] = []
    let placed = 0
    let skipped = 0

    const liveRects = (cameraTop: number): SpawnRect[] => {
      const limit = cameraTop + WORLD.height + TUNING.obstacle.despawnMargin
      for (let i = live.length - 1; i >= 0; i -= 1) {
        const rect = live[i]!.rect
        if (rect.cy + rect.height / 2 > limit) live.splice(i, 1)
      }
      return live.map((entry) => entry.rect)
    }

    const accept = (rect: SpawnRect, occupied: SpawnRect[]): boolean => {
      for (const other of occupied) {
        expect(overlaps(rect, other, GAP)).toBe(false)
      }
      live.push({ rect })
      occupied.push(rect)
      placed += 1
      return true
    }

    for (let meters = 0; meters <= 3000; meters += 4) {
      const cameraTop = -meters * TUNING.physics.pxPerMeter
      const input = { cameraTop, meters, ballX: 270 }

      const occupied = liveRects(cameraTop)
      for (const spec of obstacles.update(input, occupied)) {
        if (!accept(obstacleRect(spec), occupied)) skipped += 1
      }
      for (const spec of interactives.update(input, occupied)) {
        if (!accept(interactiveRect(spec), occupied)) skipped += 1
      }
      const goal = goals.update(input, occupied)
      if (goal) {
        accept(spawnRect(goal.x, goal.y, goal.width, goal.height), occupied)
      }

      // Varredura completa da janela, inclusive pares já aceitos em frames passados.
      for (let i = 0; i < occupied.length; i += 1) {
        for (let j = i + 1; j < occupied.length; j += 1) {
          expect(overlaps(occupied[i]!, occupied[j]!, GAP)).toBe(false)
        }
      }
    }
    return { placed, skipped }
  }

  it('mantém zero sobreposições em várias seeds', () => {
    for (const seed of [1, 2, 3, 17, 1234]) {
      const result = simulate(seed)
      expect(result.placed).toBeGreaterThan(20)
    }
  })
})

describe('integração dos spawners com occupied', () => {
  it('obstáculos pulam specs sem espaço em vez de sobrepor', () => {
    const spawner = new ObstacleSpawner(5)
    const blocker = spawnRect(200, -1000, WORLD.width * 2, WORLD.height * 2)
    const specs = spawner.update(
      { cameraTop: -800, meters: 900, ballX: 270 },
      [blocker],
    )
    for (const spec of specs) expect(overlaps(obstacleRect(spec), blocker, GAP)).toBe(false)
  })

  it('interativos nunca sobrepõem um bloco que cobre a tela', () => {
    const spawner = new InteractiveSpawner(5)
    const blocker = spawnRect(270, -1000, WORLD.width * 2, WORLD.height * 2)
    const specs: InteractiveSpawn[] = spawner.update(
      { cameraTop: -800, meters: 900 },
      [blocker],
    )
    for (const spec of specs) expect(overlaps(interactiveRect(spec), blocker, GAP)).toBe(false)
  })

  it('gol sem espaço é pulado, mas o próximo marco continua', () => {
    const spawner = new GoalSpawner(9)
    // Faixa contínua de blocos largos, espaçada pelo próprio passo vertical
    // do layout: nenhum nível de recuo encontra x livre.
    const blockers = Array.from({ length: 60 }, (_, i) =>
      spawnRect(270, -4000 - i * 146, WORLD.width * 2, 134),
    )
    const input = { cameraTop: -4000, meters: 200, ballX: 270 }
    expect(spawner.update(input, blockers)).toBeNull()
    expect(
      spawner.update({ ...input, meters: 900, cameraTop: -900 * TUNING.physics.pxPerMeter }),
    ).not.toBeNull()
  })
})
