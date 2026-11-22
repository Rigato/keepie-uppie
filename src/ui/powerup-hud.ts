import Phaser from 'phaser'
import { FONT_MONO } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'

const LAYOUT = {
  magnet: {
    x: TUNING.ui.hudMargin,
    y: 118,
    width: 220,
    height: 30,
    radius: 6,
  },
  aimed: {
    x: TUNING.ui.hudMargin,
    y: 154,
    width: 220,
    height: 26,
    radius: 6,
  },
  iconInsetX: 14,
  textInsetX: 30,
  barWidth: 180,
  barHeight: 3,
  barBottomInset: 5,
} as const

/**
 * Indicadores dos powerups ativos: Magnet (com contagem e barra de duração)
 * e Aimed Shot (pronto para armar). Ficam presos à tela, abaixo do HUD de altitude.
 */
export class PowerupHud {
  private readonly magnetGfx: Phaser.GameObjects.Graphics
  private readonly magnetText: Phaser.GameObjects.Text
  private readonly aimedGfx: Phaser.GameObjects.Graphics
  private readonly aimedText: Phaser.GameObjects.Text

  /** -1 força a atualização do texto na próxima ativação. */
  private magnetSeconds = -1

  constructor(scene: Phaser.Scene) {
    this.magnetGfx = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    this.magnetText = scene.add
      .text(
        LAYOUT.magnet.x + LAYOUT.textInsetX,
        LAYOUT.magnet.y + 13,
        'MAGNET 0s',
        {
          fontFamily: FONT_MONO,
          fontSize: '12px',
          color: CSS_PALETTE.ink,
        },
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    this.aimedGfx = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    this.aimedText = scene.add
      .text(
        LAYOUT.aimed.x + LAYOUT.textInsetX,
        LAYOUT.aimed.y + 13,
        'AIMED READY',
        {
          fontFamily: FONT_MONO,
          fontSize: '12px',
          color: CSS_PALETTE.ink,
        },
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    this.drawAimedChip()
  }

  setMagnet(active: boolean, remainingMs: number, durationMs: number): void {
    if (!active) {
      this.magnetGfx.setVisible(false)
      this.magnetText.setVisible(false)
      this.magnetSeconds = -1
      return
    }

    this.magnetGfx.setVisible(true)
    this.magnetText.setVisible(true)

    const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
    if (seconds !== this.magnetSeconds) {
      this.magnetSeconds = seconds
      this.magnetText.setText(`MAGNET ${seconds}s`)
    }

    const ratio = durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0
    this.drawMagnetChip(ratio)
  }

  setAimed(armed: boolean): void {
    this.aimedGfx.setVisible(armed)
    this.aimedText.setVisible(armed)
  }

  /** Redesenha o chip inteiro: fundo, borda, ícone e barra de progresso. */
  private drawMagnetChip(ratio: number): void {
    const { x, y, width, height, radius } = LAYOUT.magnet
    const { iconInsetX, barWidth, barHeight, barBottomInset } = LAYOUT
    const g = this.magnetGfx
    const centerY = y + 13

    g.clear()

    g.fillStyle(PALETTE.bg, 0.55)
    g.fillRoundedRect(x, y, width, height, radius)
    g.lineStyle(1, PALETTE.magnet, 0.5)
    g.strokeRoundedRect(x, y, width, height, radius)

    this.drawMagnetIcon(g, x + iconInsetX, centerY)

    const barX = x + (width - barWidth) / 2
    const barY = y + height - barBottomInset - barHeight
    g.fillStyle(PALETTE.ink, 0.14)
    g.fillRect(barX, barY, barWidth, barHeight)
    if (ratio > 0) {
      g.fillStyle(PALETTE.magnet, 1)
      g.fillRect(barX, barY, barWidth * ratio, barHeight)
    }
  }

  private drawMagnetIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    const radius = 4.5
    const leg = 4.5
    const top = cy - 1
    g.lineStyle(2, PALETTE.magnet, 1)
    g.beginPath()
    g.arc(cx, top, radius, Math.PI, Math.PI * 2, false)
    g.moveTo(cx - radius, top)
    g.lineTo(cx - radius, top + leg)
    g.moveTo(cx + radius, top)
    g.lineTo(cx + radius, top + leg)
    g.strokePath()
  }

  private drawAimedChip(): void {
    const { x, y, width, height, radius } = LAYOUT.aimed
    const cx = x + LAYOUT.iconInsetX
    const cy = y + height / 2
    const g = this.aimedGfx

    g.clear()

    g.fillStyle(PALETTE.bg, 0.55)
    g.fillRoundedRect(x, y, width, height, radius)
    g.lineStyle(1, PALETTE.aimed, 0.5)
    g.strokeRoundedRect(x, y, width, height, radius)

    const ring = 4.5
    const tickStart = ring + 1.5
    const tickEnd = ring + 4
    g.lineStyle(1.5, PALETTE.aimed, 1)
    g.strokeCircle(cx, cy, ring)
    g.beginPath()
    g.moveTo(cx, cy - tickStart)
    g.lineTo(cx, cy - tickEnd)
    g.moveTo(cx, cy + tickStart)
    g.lineTo(cx, cy + tickEnd)
    g.moveTo(cx - tickStart, cy)
    g.lineTo(cx - tickEnd, cy)
    g.moveTo(cx + tickStart, cy)
    g.lineTo(cx + tickEnd, cy)
    g.strokePath()
  }
}
