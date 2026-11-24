import type { InteractiveKind, InteractiveSpawn } from '../game/contracts'
import { TUNING } from '../game/tuning'
import { clamp, lerp } from './math'
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

/** Folga lateral por tipo, para o item nunca nascer encostado na parede. */
function paddingFor(kind: InteractiveKind): number {
  const c = TUNING.collect
  switch (kind) {
    case 'coin':
      return c.coinRadius
    case 'ring':
      return c.ringRadius
    case 'spring':
      return c.springWidth / 2
    case 'pickupMagnet':
    case 'pickupAimed':
    case 'pickupShield':
    case 'pickupSweet':
      return c.pickupRadius
  }
}

/**
 * Spawner de interativos por altitude. Devolve specs individuais: uma trilha de
 * moedas vira N specs no mesmo update. Determinístico para teste e replay.
 */
export class InteractiveSpawner {
  private rng: () => number
  private nextAt: number

  constructor(seed = 0x51ed270b) {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.interactive.firstAtMeters
  }

  reset(seed = 0x51ed270b): void {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.interactive.firstAtMeters
  }

  update(input: InteractiveSpawnInput): InteractiveSpawn[] {
    const out: InteractiveSpawn[] = []
    let guard = 0
    while (input.meters >= this.nextAt && guard < TUNING.interactive.maxPerUpdate) {
      out.push(...this.make(input))
      this.nextAt += this.step(input.meters)
      guard += 1
    }
    return out
  }

  private step(meters: number): number {
    const t = clamp(meters / TUNING.interactive.stepAtMeters, 0, 1)
    return lerp(TUNING.interactive.startStepMeters, TUNING.interactive.minStepMeters, t)
  }

  private pickKind(meters: number): InteractiveKind {
    const weights = TUNING.interactive.weights
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

  private xFor(kind: InteractiveKind): number {
    const pad = TUNING.world.wallWidth + TUNING.interactive.edgeMargin + paddingFor(kind)
    const min = pad
    const max = TUNING.world.width - pad
    return min + this.rng() * Math.max(0, max - min)
  }

  private make(input: InteractiveSpawnInput): InteractiveSpawn[] {
    const kind = this.pickKind(input.meters)
    const variation = this.rng()

    if (kind === 'coin') {
      const baseX = this.xFor(kind)
      const startY = input.cameraTop - 40 - this.rng() * 60
      const count = TUNING.interactive.coinTrail
      const arc = TUNING.interactive.coinArc
      const spacing = TUNING.interactive.coinSpacing
      const specs: InteractiveSpawn[] = []
      for (let i = 0; i < count; i += 1) {
        const t = count > 1 ? i / (count - 1) : 0
        specs.push({
          kind,
          x: baseX + Math.sin(t * Math.PI) * arc,
          y: startY - i * spacing,
          variation: (variation + i * 0.13) % 1,
        })
      }
      return specs
    }

    return [
      {
        kind,
        x: this.xFor(kind),
        y: input.cameraTop - this.top(),
        variation,
      },
    ]
  }
}
