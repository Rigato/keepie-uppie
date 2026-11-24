import { TUNING } from '../game/tuning'
import { mulberry32 } from './spawner'

export interface GoalSpawn {
  /** Centro horizontal do gol. */
  x: number
  /** Centro vertical do frame (não do vão). */
  y: number
  /** Largura total: dois postes + vão. */
  width: number
  /** Altura total: travessão + vão (o gol é aberto embaixo). */
  height: number
  /** Variação visual determinística (0..1). */
  variation: number
}

export interface GoalSpawnInput {
  /** scrollY da câmera (negativo ao subir). */
  cameraTop: number
  /** Altitude já conquistada, em metros. */
  meters: number
  /** x da bola agora (para não nascer em cima dela). */
  ballX: number
}

const DEFAULT_SEED = 0x2f6e2b1d
/** Folga extra entre o frame e as paredes, além de `wallWidth`. */
const WALL_PADDING = 20
/** Quantas vezes tentamos afastar o gol do x da bola. */
const SAFE_X_ATTEMPTS = 3
/** Dispersão vertical acima do topo da câmera. */
const Y_JITTER = 60
/** Folga interna para o centro da bola contar dentro do vão. */
const GAP_PADDING = 2

/**
 * Spawner de gols por altitude. No máximo um gol por atualização: o gol é um
 * set piece, não um obstáculo de rotina. Determinístico para teste e replay.
 */
export class GoalSpawner {
  private rng: () => number
  private nextAt: number

  constructor(seed = DEFAULT_SEED) {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.goal.firstAtMeters
  }

  reset(seed = DEFAULT_SEED): void {
    this.rng = mulberry32(seed)
    this.nextAt = TUNING.goal.firstAtMeters
  }

  update(input: GoalSpawnInput): GoalSpawn | null {
    if (input.meters < this.nextAt) return null

    const spawn = this.make(input)
    // O próximo marco conta a partir de onde o gol nasceu: uma atualização
    // esparsa nunca despeja vários gols em sequência nos frames seguintes.
    this.nextAt = input.meters + this.gapMeters()
    return spawn
  }

  private gapMeters(): number {
    const { minGapMeters, maxGapMeters } = TUNING.goal
    return minGapMeters + this.rng() * (maxGapMeters - minGapMeters)
  }

  private make(input: GoalSpawnInput): GoalSpawn {
    const { gapWidth, gapHeight, postThickness, aboveTop } = TUNING.goal
    const width = gapWidth + 2 * postThickness
    const height = gapHeight + postThickness

    // x nunca deixa o frame encostar nas paredes; a margem de 20 u respira.
    const margin = width / 2 + TUNING.world.wallWidth + WALL_PADDING
    const minX = margin
    const maxX = TUNING.world.width - margin
    const span = Math.max(0, maxX - minX)
    let x = minX + this.rng() * span

    // Tenta não nascer em cima do corredor da bola; se não der, o gol é largo
    // e o jogador ainda consegue desviar para dentro do vão.
    for (let attempt = 0; attempt < SAFE_X_ATTEMPTS; attempt += 1) {
      if (Math.abs(x - input.ballX) >= TUNING.spawn.safeXGap) break
      x = minX + this.rng() * span
    }

    const variation = this.rng()
    return {
      x,
      y: input.cameraTop - aboveTop - this.rng() * Y_JITTER,
      width,
      height,
      variation,
    }
  }
}

/**
 * A bola conta o gol quando cruza a linha de pontuação de baixo para cima e o
 * centro está dentro do vão (com 2 u de folga). Pura para testar sem Phaser.
 */
export function isGoalCrossing(
  prevY: number,
  y: number,
  x: number,
  gapLeft: number,
  gapRight: number,
  scoreY: number,
): boolean {
  const crossedUpward = prevY >= scoreY && y < scoreY
  if (!crossedUpward) return false

  return x >= gapLeft + GAP_PADDING && x <= gapRight - GAP_PADDING
}
