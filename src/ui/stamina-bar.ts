import Phaser from 'phaser'
import { FONT_MONO } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'

/** Geometria presa à tela: canto superior direito, abaixo do botão de pausa. */
const BAR = {
  width: 140,
  height: 6,
  top: 150,
  labelY: 142,
  /** Realce curto de toque bloqueado; o instante é marcado no primeiro `set`. */
  bumpMs: 180,
  fullAlpha: 0.55,
} as const

/**
 * Barra de estamina: presa à tela, abaixo do pause e longe dos chips de
 * powerup (que ficam na esquerda). Só desenha; a regra vive em `core/stamina.ts`.
 *
 * `set` recebe o relógio da cena para pulsar na exaustão sem tween por frame;
 * `bump` apenas sinaliza o realce, que é datado no próximo `set`.
 */
export class StaminaBar {
  private readonly gfx: Phaser.GameObjects.Graphics
  /** Texto exposto para o smoke e o debug (rótulo STAMINA / EXHAUSTED). */
  readonly label: Phaser.GameObjects.Text

  private bumpPending = false
  private bumpUntil = -1
  private lastLabel = 'STAMINA'
  private lastColor: string = CSS_PALETTE.inkDim
  private lastBold = false

  constructor(scene: Phaser.Scene) {
    const right = TUNING.world.width - TUNING.ui.hudMargin
    const x = right - BAR.width

    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(100)
    this.label = scene.add
      .text(right, BAR.labelY, 'STAMINA', {
        fontFamily: FONT_MONO,
        fontSize: '9px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(1, 1)
      .setLetterSpacing(2)
      .setScrollFactor(0)
      .setDepth(100)

    this.draw(x, 1, false, false, BAR.fullAlpha, PALETTE.accent, PALETTE.inkDim, 0.35)
  }

  /** Realce curto no rótulo/borda quando um toque é bloqueado. */
  bump(): void {
    this.bumpPending = true
  }

  set(ratio: number, exhausted: boolean, timeMs: number): void {
    if (this.bumpPending) {
      this.bumpUntil = timeMs + BAR.bumpMs
      this.bumpPending = false
    }

    const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
    const bumped = timeMs < this.bumpUntil
    const x = TUNING.world.width - TUNING.ui.hudMargin - BAR.width

    const text = exhausted ? 'EXHAUSTED' : 'STAMINA'
    const color = exhausted || bumped ? CSS_PALETTE.danger : CSS_PALETTE.inkDim
    if (text !== this.lastLabel) {
      this.label.setText(text)
      this.lastLabel = text
    }
    if (color !== this.lastColor) {
      this.label.setColor(color)
      this.lastColor = color
    }
    if (exhausted !== this.lastBold) {
      this.label.setFontStyle(exhausted ? 'bold' : 'normal')
      this.lastBold = exhausted
    }
    this.label.setAlpha(exhausted || bumped ? 1 : 0.85)

    const fill = exhausted || r < 0.2 ? PALETTE.danger : r < 0.5 ? PALETTE.fever : PALETTE.accent
    // Cheia e em repouso fica discreta; drenando, acende; na exaustão pulsa
    // enquanto a barra enche (o preenchimento continua visível).
    const alpha = exhausted
      ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(timeMs / 95))
      : r >= 0.999
        ? BAR.fullAlpha
        : 1
    const borderColor = exhausted || bumped ? PALETTE.danger : PALETTE.inkDim
    const borderAlpha = bumped ? 1 : exhausted ? 0.7 : 0.35

    this.draw(x, r, exhausted, bumped, alpha, fill, borderColor, borderAlpha)
  }

  setVisible(visible: boolean): void {
    this.gfx.setVisible(visible)
    this.label.setVisible(visible)
  }

  private draw(
    x: number,
    ratio: number,
    exhausted: boolean,
    bumped: boolean,
    fillAlpha: number,
    fill: number,
    border: number,
    borderAlpha: number,
  ): void {
    const g = this.gfx
    g.clear()
    g.fillStyle(PALETTE.ink, 0.14)
    g.fillRect(x, BAR.top, BAR.width, BAR.height)
    if (ratio > 0) {
      g.fillStyle(fill, fillAlpha)
      g.fillRect(x, BAR.top, BAR.width * ratio, BAR.height)
    }
    g.lineStyle(bumped ? 2 : 1, border, borderAlpha)
    g.strokeRect(x, BAR.top, BAR.width, BAR.height)
    // Na exaustão, um realce discreto na borda reforça a barra enchendo.
    if (exhausted) {
      g.fillStyle(PALETTE.danger, 0.08)
      g.fillRect(x - 2, BAR.top - 2, BAR.width + 4, BAR.height + 4)
    }
  }
}
