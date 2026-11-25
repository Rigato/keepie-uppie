import type { InteractiveKind, InteractiveSpawn } from '../game/contracts'
import { TUNING } from '../game/tuning'
import {
  buildCoinOffsets,
  coinRadiusFor,
  pickCoinPattern,
  pickSpecialIndex,
} from './coin-patterns'
import { lerp, sampleAnchors, smoothstep, type ScalarAnchor } from './math'
import {
  resolveGroupPlacement,
  resolvePlacement,
  spawnRect,
  unionRect,
  type SpawnRect,
} from './spawn-layout'
import { mulberry32 } from './spawner'

const KIND_ORDER: readonly InteractiveKind[] = [
  'coin',
  'ring',
  'spring',
  'pickupMagnet',
  'pickupAimed',
  'pickupShield',
  'pickupSweet',
]

export interface InteractiveSpawnInput {
  cameraTop: number
  meters: number
}

/** Alguns powerups só entram depois que o jogador aprendeu o básico. */
const MIN_METERS: Partial<Record<InteractiveKind, number>> = {
  pickupShield: 200,
  pickupSweet: 300,
}

function minMetersFor(kind: InteractiveKind): number {
  return MIN_METERS[kind] ?? 0
}

/** Tamanho da caixa de layout de cada kind (centro + meia-largura). */
function sizeFor(kind: InteractiveKind, special = false): { width: number; height: number } {
  const c = TUNING.collect
  switch (kind) {
    case 'coin': {
      const radius = coinRadiusFor(special)
      return { width: radius * 2, height: radius * 2 }
    }
    case 'ring': {
      const outer = c.ringRadius + c.ringThickness / 2
      return { width: outer * 2, height: outer * 2 }
    }
    case 'spring':
      return { width: c.springWidth, height: c.springHeight }
    case 'pickupMagnet':
    case 'pickupAimed':
    case 'pickupShield':
    case 'pickupSweet':
      return { width: c.pickupRadius * 2, height: c.pickupRadius * 2 }
  }
}

/** Converte um spec em rect de layout (centro). Exportado para a cena reusar. */
export function interactiveRect(spec: InteractiveSpawn): SpawnRect {
  const { width, height } = sizeFor(spec.kind, spec.special === true)
  return spawnRect(spec.x, spec.y, width, height)
}

/** Folga lateral por tipo, para o item nunca nascer encostado na parede. */
function paddingFor(kind: InteractiveKind, special = false): number {
  const { width, height } = sizeFor(kind, special)
  return Math.max(width, height) / 2
}

/** Série do peso da moeda: cresce suavemente com a altitude. */
const COIN_SERIES: readonly ScalarAnchor[] = TUNING.interactive.coinWeightAnchors.map((anchor) => ({
  meters: anchor.meters,
  value: anchor.weight,
}))

/**
 * Spawner de interativos por altitude. Devolve specs individuais: um padrão de
 * moedas vira N specs com o mesmo `setId`. Determinístico para teste e replay.
 */
export class InteractiveSpawner {
  private rng: () => number
  private nextAt: number
  /** Id do próximo conjunto de moedas; só avança quando o conjunto é aceito. */
  private nextSetId = 1

  constructor(seed = 0x51ed270b) {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.interactive.firstAtMeters
  }

  reset(seed = 0x51ed270b): void {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.interactive.firstAtMeters
    this.nextSetId = 1
  }

  /** `occupied` inclui os vivos e os já aceitos no frame; lotes não se sobrepõem. */
  update(input: InteractiveSpawnInput, occupied: readonly SpawnRect[] = []): InteractiveSpawn[] {
    const out: InteractiveSpawn[] = []
    const local = [...occupied]
    let guard = 0
    while (input.meters >= this.nextAt && guard < TUNING.interactive.maxPerUpdate) {
      const specs = this.make(input, local)
      for (const spec of specs) {
        out.push(spec)
        local.push(interactiveRect(spec))
      }
      this.nextAt += this.step(input.meters)
      guard += 1
    }
    return out
  }

  /** Passo suave: o mesmo `smoothstep` dos obstáculos, com âncoras próprias. */
  private step(meters: number): number {
    const t = smoothstep(0, TUNING.interactive.stepAtMeters, meters)
    return lerp(TUNING.interactive.startStepMeters, TUNING.interactive.minStepMeters, t)
  }

  /** Moeda tem peso variável; os demais são fixos e o total é normalizado. */
  private pickKind(meters: number): InteractiveKind {
    const weights = [
      sampleAnchors(COIN_SERIES, meters),
      ...TUNING.interactive.weights,
    ]
    const total = weights.reduce<number>((sum, weight) => sum + weight, 0)
    // Repete algumas vezes para não sortear um item bloqueado por altitude.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let roll = this.rng() * total
      for (let i = 0; i < KIND_ORDER.length; i += 1) {
        roll -= weights[i] ?? 0
        if (roll <= 0) {
          const kind = KIND_ORDER[i] ?? 'coin'
          if (meters >= minMetersFor(kind)) return kind
          break
        }
      }
    }
    // Fallback seguro: moeda sempre pode nascer.
    return 'coin'
  }

  private top(): number {
    return (
      TUNING.interactive.aboveTop + this.rng() * Math.max(0, TUNING.interactive.jitterY)
    )
  }

  private xFor(kind: InteractiveKind, special = false): number {
    const pad = TUNING.world.wallWidth + TUNING.interactive.edgeMargin + paddingFor(kind, special)
    const min = pad
    const max = TUNING.world.width - pad
    return min + this.rng() * Math.max(0, max - min)
  }

  private placement(): {
    rng: () => number
    world: typeof TUNING.world
    gap: number
    attempts: number
    levels: number
  } {
    return {
      rng: this.rng,
      world: TUNING.world,
      gap: TUNING.spawn.overlapGap,
      attempts: TUNING.spawn.placementAttempts,
      levels: TUNING.spawn.placementLevels,
    }
  }

  private make(input: InteractiveSpawnInput, occupied: readonly SpawnRect[]): InteractiveSpawn[] {
    const kind = this.pickKind(input.meters)
    const variation = this.rng()
    const layout = { ...this.placement(), occupied }

    if (kind === 'coin') {
      const pattern = pickCoinPattern(input.meters, this.rng)
      const offsets = buildCoinOffsets(
        pattern,
        TUNING.interactive.coinSpacing,
        TUNING.interactive.coinArc,
      )
      // A especial só entra quando a altitude permite; exatamente 1 por conjunto.
      const specialIndex =
        input.meters >= TUNING.collect.coinSpecialMinMeters
          ? pickSpecialIndex(offsets.length, this.rng)
          : -1

      // Centraliza os offsets para a âncora ser o centro da caixa união.
      const xs = offsets.map((offset) => offset.x)
      const ys = offsets.map((offset) => offset.y)
      const midX = (Math.min(...xs) + Math.max(...xs)) / 2
      const midY = (Math.min(...ys) + Math.max(...ys)) / 2
      const specs: InteractiveSpawn[] = offsets.map((offset, i) => ({
        kind,
        x: offset.x - midX,
        y: -(offset.y - midY),
        variation: (variation + i * 0.13) % 1,
        special: i === specialIndex,
        setId: this.nextSetId,
      }))

      const rects = specs.map(interactiveRect)
      const union = unionRect(rects)
      if (!union) return []

      // A caixa inteira nasce acima do topo: a borda de baixo fica em
      // `cameraTop - aboveTop - rng·jitterY`. O centro da união é o que o
      // resolvedor posiciona; limitar o x aqui evita que um padrão largo
      // (estrela/losango) atravesse as paredes.
      const desiredX = Math.min(
        TUNING.world.width - TUNING.world.wallWidth - union.width / 2,
        Math.max(
          TUNING.world.wallWidth + union.width / 2,
          this.xFor(kind, specialIndex >= 0),
        ),
      )
      const desiredY = input.cameraTop - this.top() - union.height / 2
      const delta = resolveGroupPlacement({
        rects,
        anchor: { cx: desiredX, cy: desiredY },
        ...layout,
      })
      if (!delta) return []
      this.nextSetId += 1
      return specs.map((spec) => ({ ...spec, x: spec.x + delta.dx, y: spec.y + delta.dy }))
    }

    const spec: InteractiveSpawn = {
      kind,
      x: this.xFor(kind),
      y: input.cameraTop - this.top(),
      variation,
    }
    const resolved = resolvePlacement({ rect: interactiveRect(spec), ...layout })
    if (!resolved) return []
    return [{ ...spec, x: resolved.cx, y: resolved.cy }]
  }
}
