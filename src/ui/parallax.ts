import Phaser from 'phaser'
import { PALETTE } from '../game/palette'

/**
 * Duas camadas de paralaxe, propositalmente simples:
 * - distante: nuvens geométricas claras, lentas (12% da câmera);
 * - próxima: riscos de vento, mais rápidos (30% da câmera).
 *
 * As duas têm um drift de tempo mínimo para o céu não congelar quando a câmera
 * está parada (queda da bola). O mundo do gameplay continua a 100%.
 */
const FAR_SPAN = 760
const NEAR_SPAN = 560

interface Cloud {
  x: number
  y: number
  r: number
  alpha: number
}

interface Streak {
  x: number
  y: number
  length: number
  alpha: number
}

const CLOUDS: readonly Cloud[] = [
  { x: 112, y: 36, r: 62, alpha: 0.3 },
  { x: 338, y: 132, r: 48, alpha: 0.24 },
  { x: 206, y: 262, r: 68, alpha: 0.2 },
  { x: 430, y: 366, r: 54, alpha: 0.26 },
  { x: 126, y: 498, r: 44, alpha: 0.22 },
  { x: 304, y: 618, r: 64, alpha: 0.18 },
  { x: 448, y: 704, r: 40, alpha: 0.24 },
]

const STREAKS: readonly Streak[] = [
  { x: 82, y: 42, length: 14, alpha: 0.1 },
  { x: 196, y: 118, length: 10, alpha: 0.08 },
  { x: 344, y: 76, length: 16, alpha: 0.12 },
  { x: 462, y: 190, length: 12, alpha: 0.09 },
  { x: 118, y: 258, length: 18, alpha: 0.11 },
  { x: 288, y: 330, length: 10, alpha: 0.07 },
  { x: 414, y: 292, length: 14, alpha: 0.1 },
  { x: 168, y: 408, length: 12, alpha: 0.08 },
  { x: 476, y: 454, length: 16, alpha: 0.11 },
  { x: 62, y: 496, length: 10, alpha: 0.09 },
  { x: 352, y: 536, length: 14, alpha: 0.08 },
]

function wrap(value: number, span: number): number {
  return ((value % span) + span) % span
}

export class Parallax {
  private readonly far: Phaser.GameObjects.Graphics
  private readonly near: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, depth = 2) {
    this.far = scene.add.graphics().setScrollFactor(0).setDepth(depth)
    this.near = scene.add.graphics().setScrollFactor(0).setDepth(depth + 0.1)
  }

  update(cameraY: number, timeMs: number): void {
    this.drawFar(-cameraY * 0.12 + timeMs * 0.0012)
    this.drawNear(-cameraY * 0.3 + timeMs * 0.004)
  }

  private drawFar(offset: number): void {
    const g = this.far
    g.clear()

    for (const cloud of CLOUDS) {
      const y = wrap(cloud.y + offset, FAR_SPAN)
      g.fillStyle(0xffffff, cloud.alpha)
      g.fillEllipse(cloud.x, y, cloud.r * 1.7, cloud.r * 0.75)
      g.fillEllipse(cloud.x, y + FAR_SPAN, cloud.r * 1.7, cloud.r * 0.75)
    }
  }

  private drawNear(offset: number): void {
    const g = this.near
    g.clear()

    for (const streak of STREAKS) {
      const y = wrap(streak.y + offset, NEAR_SPAN)
      g.lineStyle(2, PALETTE.accent, streak.alpha)
      g.lineBetween(streak.x, y, streak.x - 2, y + streak.length)
      g.lineBetween(streak.x, y + NEAR_SPAN, streak.x - 2, y + NEAR_SPAN + streak.length)
    }
  }
}
