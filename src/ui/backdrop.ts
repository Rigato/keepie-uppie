import Phaser from 'phaser'
import { PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'

/**
 * Fundo comum das cenas: gradiente, grid de altitude, paredes e linha de morte.
 * Em cenas de gameplay o retorno deve receber `setScrollFactor(0)` — o fundo é
 * da tela, não do mundo (o mundo sobe com a câmera).
 */
export function drawBackdrop(
  scene: Phaser.Scene,
  opts: { walls: boolean },
): Phaser.GameObjects.Graphics {
  const { width, height, wallWidth } = TUNING.world
  const g = scene.add.graphics()

  g.fillGradientStyle(PALETTE.bgSoft, PALETTE.bgSoft, PALETTE.bg, PALETTE.bg, 1)
  g.fillRect(0, 0, width, height)

  g.lineStyle(1, PALETTE.ink, 0.03)
  for (let y = 120; y < height; y += 120) g.lineBetween(0, y, width, y)

  g.lineStyle(1, PALETTE.accent, 0.05)
  for (let y = 600; y < height; y += 600) g.lineBetween(0, y, width, y)

  if (!opts.walls) return g

  g.fillStyle(PALETTE.wall, 1)
  g.fillRect(0, 0, wallWidth, height)
  g.fillRect(width - wallWidth, 0, wallWidth, height)

  g.fillStyle(PALETTE.accent, 0.16)
  g.fillRect(wallWidth, 0, 2, height)
  g.fillRect(width - wallWidth - 2, 0, 2, height)

  g.lineStyle(2, PALETTE.danger, 0.3)
  g.lineBetween(0, height - 1, width, height - 1)

  return g
}
