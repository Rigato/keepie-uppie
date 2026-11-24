import Phaser from 'phaser'
import { FONT_MONO } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'

type TimedIcon = 'magnet' | 'shield' | 'sweet'

interface ChipLayout {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

const CHIP = {
  width: 220,
  height: 30,
  radius: 6,
  iconInsetX: 14,
  textInsetX: 30,
  barWidth: 180,
  barHeight: 3,
  barBottomInset: 5,
} as const

const LAYOUT = {
  magnet: { x: TUNING.ui.hudMargin, y: 118, ...CHIP },
  aimed: { x: TUNING.ui.hudMargin, y: 154, ...CHIP, height: 26 },
  shield: { x: TUNING.ui.hudMargin, y: 190, ...CHIP },
  sweet: { x: TUNING.ui.hudMargin, y: 226, ...CHIP },
} as const

/** Chip de powerup com duração: fundo, ícone, texto e barra de progresso. */
class TimedChip {
  private readonly gfx: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private readonly color: number
  private readonly icon: TimedIcon
  private readonly layout: ChipLayout
  /** -1 força a atualização do texto na próxima ativação. */
  private seconds = -1

  constructor(
    scene: Phaser.Scene,
    layout: ChipLayout,
    icon: TimedIcon,
    color: number,
    text: string,
  ) {
    this.layout = layout
    this.icon = icon
    this.color = color
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(100).setVisible(false)
    this.label = scene.add
      .text(layout.x + CHIP.textInsetX, layout.y + 13, text, {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: CSS_PALETTE.ink,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)
  }

  set(active: boolean, remainingMs: number, durationMs: number, prefix: string): void {
    if (!active) {
      this.gfx.setVisible(false)
      this.label.setVisible(false)
      this.seconds = -1
      return
    }

    this.gfx.setVisible(true)
    this.label.setVisible(true)

    const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
    if (seconds !== this.seconds) {
      this.seconds = seconds
      this.label.setText(`${prefix} ${seconds}s`)
    }

    const ratio = durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0
    this.draw(ratio)
  }

  private draw(ratio: number): void {
    const { x, y, width, height, radius } = this.layout
    const centerY = y + 13
    const g = this.gfx

    g.clear()
    g.fillStyle(PALETTE.bg, 0.55)
    g.fillRoundedRect(x, y, width, height, radius)
    g.lineStyle(1, this.color, 0.5)
    g.strokeRoundedRect(x, y, width, height, radius)

    this.drawIcon(g, x + CHIP.iconInsetX, centerY)

    const barX = x + (width - CHIP.barWidth) / 2
    const barY = y + height - CHIP.barBottomInset - CHIP.barHeight
    g.fillStyle(PALETTE.ink, 0.14)
    g.fillRect(barX, barY, CHIP.barWidth, CHIP.barHeight)
    if (ratio > 0) {
      g.fillStyle(this.color, 1)
      g.fillRect(barX, barY, CHIP.barWidth * ratio, CHIP.barHeight)
    }
  }

  private drawIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    if (this.icon === 'magnet') {
      const radius = 4.5
      const leg = 4.5
      const top = cy - 1
      g.lineStyle(2, this.color, 1)
      g.beginPath()
      g.arc(cx, top, radius, Math.PI, Math.PI * 2, false)
      g.moveTo(cx - radius, top)
      g.lineTo(cx - radius, top + leg)
      g.moveTo(cx + radius, top)
      g.lineTo(cx + radius, top + leg)
      g.strokePath()
      return
    }

    if (this.icon === 'shield') {
      const w = 5.5
      const h = 6.5
      g.lineStyle(1.8, this.color, 1)
      g.beginPath()
      g.moveTo(cx, cy - h)
      g.lineTo(cx + w, cy - h * 0.45)
      g.lineTo(cx + w * 0.78, cy + h * 0.45)
      g.lineTo(cx, cy + h)
      g.lineTo(cx - w * 0.78, cy + h * 0.45)
      g.lineTo(cx - w, cy - h * 0.45)
      g.closePath()
      g.strokePath()
      return
    }

    // Ponto Doce: anel duplo com ponto central, distinto da mira do Aimed.
    g.lineStyle(1.5, this.color, 1)
    g.strokeCircle(cx, cy, 5)
    g.strokeCircle(cx, cy, 2.4)
    g.fillStyle(this.color, 1)
    g.fillCircle(cx, cy, 1.2)
  }
}

/**
 * Indicadores dos powerups ativos: Magnet, Aimed, Shield e Sweet Spot.
 * Ficam presos à tela, abaixo do HUD de altitude.
 */
export class PowerupHud {
  private readonly magnet: TimedChip
  private readonly shield: TimedChip
  private readonly sweet: TimedChip
  private readonly aimedGfx: Phaser.GameObjects.Graphics
  private readonly aimedText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.magnet = new TimedChip(scene, LAYOUT.magnet, 'magnet', PALETTE.magnet, 'MAGNET 0s')
    this.shield = new TimedChip(scene, LAYOUT.shield, 'shield', PALETTE.shield, 'SHIELD 0s')
    this.sweet = new TimedChip(scene, LAYOUT.sweet, 'sweet', PALETTE.sweet, 'SWEET 0s')

    this.aimedGfx = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    this.aimedText = scene.add
      .text(
        LAYOUT.aimed.x + CHIP.textInsetX,
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
    this.magnet.set(active, remainingMs, durationMs, 'MAGNET')
  }

  setShield(active: boolean, remainingMs: number, durationMs: number): void {
    this.shield.set(active, remainingMs, durationMs, 'SHIELD')
  }

  setSweet(active: boolean, remainingMs: number, durationMs: number): void {
    this.sweet.set(active, remainingMs, durationMs, 'SWEET')
  }

  setAimed(armed: boolean): void {
    this.aimedGfx.setVisible(armed)
    this.aimedText.setVisible(armed)
  }

  private drawAimedChip(): void {
    const { x, y, width, height, radius } = LAYOUT.aimed
    const cx = x + CHIP.iconInsetX
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
