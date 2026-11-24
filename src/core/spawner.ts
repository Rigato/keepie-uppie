import type { ObstacleKind, ObstacleSpawn } from '../game/contracts'
import { TUNING } from '../game/tuning'
import { clamp, lerp } from './math'

/** PRNG determinístico e barato: mesma seed = mesma sequência. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SpawnInput {
  /** scrollY da câmera (negativo ao subir). */
  cameraTop: number
  /** Altitude já conquistada, em metros. */
  meters: number
  /** x da bola agora (para não nascer em cima dela). */
  ballX: number
}

const KIND_ORDER: readonly ObstacleKind[] = [
  'hard',
  'soft',
  'breakable',
  'bird',
  'bumper',
  'ramp',
]

interface Dimensions {
  width: number
  height: number
}

function dimensionsFor(kind: ObstacleKind): Dimensions {
  const o = TUNING.obstacle
  switch (kind) {
    case 'hard':
      return { width: o.hardWidth, height: o.hardHeight }
    case 'soft':
      return { width: o.softWidth, height: o.softHeight }
    case 'breakable':
      return { width: o.breakableWidth, height: o.breakableHeight }
    case 'bird':
      return { width: o.birdWidth, height: o.birdHeight }
    case 'bumper':
      return { width: o.bumperRadius * 2, height: o.bumperRadius * 2 }
    case 'ramp':
      return { width: o.rampWidth, height: o.rampHeight }
  }
}

/**
 * Spawner procedural por altitude (a pergunta do GDD: densidade por metro, não
 * por tempo — o placar é metros). Determinístico para teste e replay.
 */
export class ObstacleSpawner {
  private rng: () => number
  private nextAt: number

  constructor(seed = 0x1f2e3d4c) {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.spawn.firstAtMeters
  }

  reset(seed = 0x1f2e3d4c): void {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.spawn.firstAtMeters
  }

  update(input: SpawnInput): ObstacleSpawn[] {
    const out: ObstacleSpawn[] = []
    let guard = 0
    while (input.meters >= this.nextAt && guard < TUNING.spawn.maxPerUpdate) {
      out.push(this.make(input))
      this.nextAt += this.step(input.meters)
      guard += 1
    }
    return out
  }

  /** Distância até o próximo evento; encurta conforme a altitude sobe. */
  private step(meters: number): number {
    const t = clamp(meters / TUNING.spawn.stepAtMeters, 0, 1)
    return lerp(TUNING.spawn.startStepMeters, TUNING.spawn.minStepMeters, t)
  }

  private pickKind(meters: number): ObstacleKind {
    const bands = TUNING.spawn.mix
    const band = bands.find((entry) => meters <= entry.maxMeters) ?? bands[bands.length - 1]
    const weights = band.weights
    const total = weights.reduce<number>((sum, weight) => sum + weight, 0)
    let roll = this.rng() * total

    for (let i = 0; i < KIND_ORDER.length; i += 1) {
      roll -= weights[i] ?? 0
      if (roll <= 0) return KIND_ORDER[i] ?? 'hard'
    }
    return 'hard'
  }

  private make(input: SpawnInput): ObstacleSpawn {
    const kind = this.pickKind(input.meters)
    const { width, height } = dimensionsFor(kind)
    const variation = this.rng()
    const direction: 1 | -1 = this.rng() < 0.5 ? -1 : 1

    if (kind === 'bird') {
      const band = TUNING.spawn
      return {
        kind,
        x: direction === 1 ? -width : TUNING.world.width + width,
        y: input.cameraTop + band.birdBandTop + this.rng() * band.birdBandHeight,
        width,
        height,
        direction,
        variation,
      }
    }

    const margin = TUNING.world.wallWidth + TUNING.spawn.edgeMargin
    const minX = margin + width / 2
    const maxX = TUNING.world.width - margin - width / 2
    let x = minX + this.rng() * Math.max(0, maxX - minX)

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (Math.abs(x - input.ballX) >= TUNING.spawn.safeXGap) break
      x = minX + this.rng() * Math.max(0, maxX - minX)
    }

    return {
      kind,
      x,
      y: input.cameraTop - TUNING.spawn.aboveTop - this.rng() * TUNING.spawn.jitterY,
      width,
      height,
      direction,
      variation,
    }
  }
}
