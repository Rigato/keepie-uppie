import type { ObstacleKind, ObstacleSpawn } from '../game/contracts'
import { TUNING } from '../game/tuning'
import { lerp, sampleAnchors, smoothstep, type ScalarAnchor } from './math'
import { isFree, resolvePlacement, spawnRect, type SpawnRect } from './spawn-layout'

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
  'barrier',
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
    case 'barrier':
      return { width: o.barrierWidth, height: o.barrierHeight }
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
 * Retângulo de layout de um obstáculo já colocado. Usa as dimensões do kind,
 * com duas exceções geométricas (só para o layout, nunca para a hitbox):
 *  - birds: a formação em V se espalha em y além de um pássaro isolado;
 *  - ramp: a barra é rotacionada, então sua AABB é maior que `rampHeight`.
 */
export function obstacleRect(spec: ObstacleSpawn): SpawnRect {
  const { width, height } = dimensionsFor(spec.kind)
  if (spec.kind === 'bird') {
    // Formação em V: 2 fileiras atrás do líder e asas acima/abaixo. A folga
    // `birdFlockSpread` cobre a profundidade em x e o espalhamento em y.
    const spread = TUNING.spawn.birdFlockSpread
    return spawnRect(spec.x, spec.y, width + 2 * spread, height + 4 * spread)
  }
  if (spec.kind === 'ramp') {
    const angle = (TUNING.obstacle.rampAngleDeg * Math.PI) / 180
    const cos = Math.abs(Math.cos(angle))
    const sin = Math.abs(Math.sin(angle))
    return spawnRect(spec.x, spec.y, width * cos + height * sin, width * sin + height * cos)
  }
  return spawnRect(spec.x, spec.y, width, height)
}

/** Série temporal de pesos por kind, derivada das âncoras de `TUNING.spawn.mix`. */
const MIX_SERIES: readonly (readonly ScalarAnchor[])[] = KIND_ORDER.map((_, index) =>
  TUNING.spawn.mix.map((anchor) => ({
    meters: anchor.meters,
    value: anchor.weights[index] ?? 0,
  })),
)

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

  /**
   * `occupied` são os rects vivos (e os já aceitos pelo chamador no frame).
   * Cada lote também evita sobrepor a si mesmo; specs sem lugar são pulados.
   */
  update(input: SpawnInput, occupied: readonly SpawnRect[] = []): ObstacleSpawn[] {
    const out: ObstacleSpawn[] = []
    const local = [...occupied]
    let guard = 0
    while (input.meters >= this.nextAt && guard < TUNING.spawn.maxPerUpdate) {
      const spec = this.make(input, local)
      if (spec) {
        out.push(spec)
        local.push(obstacleRect(spec))
      }
      this.nextAt += this.step(input.meters)
      guard += 1
    }
    return out
  }

  /** Distância até o próximo evento; encurta suavemente conforme a altitude sobe. */
  private step(meters: number): number {
    const t = smoothstep(0, TUNING.spawn.stepAtMeters, meters)
    return lerp(TUNING.spawn.startStepMeters, TUNING.spawn.minStepMeters, t)
  }

  /** Pesos interpolados entre âncoras: nenhuma faixa com salto de mix. */
  private pickKind(meters: number): ObstacleKind {
    const weights = MIX_SERIES.map((series) => sampleAnchors(series, meters))
    const total = weights.reduce<number>((sum, weight) => sum + weight, 0)
    let roll = this.rng() * total

    for (let i = 0; i < KIND_ORDER.length; i += 1) {
      roll -= weights[i] ?? 0
      if (roll <= 0) return KIND_ORDER[i] ?? 'barrier'
    }
    return 'barrier'
  }

  private make(input: SpawnInput, occupied: readonly SpawnRect[]): ObstacleSpawn | null {
    const kind = this.pickKind(input.meters)
    const { width, height } = dimensionsFor(kind)
    const variation = this.rng()
    const direction: 1 | -1 = this.rng() < 0.5 ? -1 : 1

    if (kind === 'bird') {
      const band = TUNING.spawn
      const x = direction === 1 ? -width : TUNING.world.width + width
      const tentative: ObstacleSpawn = { kind, x, y: 0, width, height, direction, variation }
      const yFor = (): number =>
        input.cameraTop + band.birdBandTop + this.rng() * band.birdBandHeight
      const rectFor = (y: number): SpawnRect =>
        obstacleRect({ ...tentative, y })

      // Birds entram pela lateral: NÃO reposicionamos x (sairia da borda). Se
      // a caixa inicial do bando colidir na borda, tentamos outro y da faixa;
      // sem y livre, o bando é pulado.
      const gap = TUNING.spawn.overlapGap
      let y = yFor()
      if (!isFree(rectFor(y), occupied, gap)) {
        y = Number.NaN
        for (let attempt = 0; attempt < band.placementAttempts; attempt += 1) {
          const candidate = yFor()
          if (isFree(rectFor(candidate), occupied, gap)) {
            y = candidate
            break
          }
        }
      }
      if (!Number.isFinite(y)) return null

      return { ...tentative, y }
    }

    const margin = TUNING.world.wallWidth + TUNING.spawn.edgeMargin
    const minX = margin + width / 2
    const maxX = TUNING.world.width - margin - width / 2
    let x = minX + this.rng() * Math.max(0, maxX - minX)

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (Math.abs(x - input.ballX) >= TUNING.spawn.safeXGap) break
      x = minX + this.rng() * Math.max(0, maxX - minX)
    }

    const y = input.cameraTop - TUNING.spawn.aboveTop - this.rng() * TUNING.spawn.jitterY
    const tentative: ObstacleSpawn = { kind, x, y, width, height, direction, variation }
    const resolved = resolvePlacement({
      rect: obstacleRect(tentative),
      occupied,
      rng: this.rng,
      world: TUNING.world,
      gap: TUNING.spawn.overlapGap,
      attempts: TUNING.spawn.placementAttempts,
      levels: TUNING.spawn.placementLevels,
    })
    if (!resolved) return null

    return { ...tentative, x: resolved.cx, y: resolved.cy }
  }
}
