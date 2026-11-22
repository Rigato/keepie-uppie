import Phaser from 'phaser'
import { PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'

/** Fundo comum das cenas: gradiente, grid de altitude, paredes e linha de morte. */
export function drawBackdrop(scene: Phaser.Scene, opts: { walls: boolean }): void {
  const { width, height } = TUNING.world
  const g = scene.add.graphics()

  g.fillGradientStyle(PALETTE.bgSoft, PALETTE.bgSoft, PALETTE.bg, PALETTE.bg, 1)
  g.fillRect(0, 0, width, height)

  g.lineStyle(1, 0xffffff, 0.03)
  for (let y = 120; y < height; y += 120) g.lineBetween(0, y, width, y)

  g.lineStyle(1, PALETTE.accent, 0.06)
  for (let y = 600; y < height; y += 600) g.lineBetween(0, y, width, y)

  if (!opts.walls) return

  g.fillStyle(PALETTE.wall, 1)
  g.fillRect(0, 0, 14, height)
  g.fillRect(width - 14, 0, 14, height)

  g.fillStyle(PALETTE.accent, 0.16)
  g.fillRect(14, 0, 2, height)
  g.fillRect(width - 16, 0, 2, height)

  g.lineStyle(2, PALETTE.danger, 0.3)
  g.lineBetween(0, height - 1, width, height - 1)
}
