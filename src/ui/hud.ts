import Phaser from 'phaser'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import { formatMeters } from '../platform/storage'

/** HUD em unidades de mundo, preso à tela (scrollFactor 0). */
export class Hud {
  private readonly altitudeValue: Phaser.GameObjects.Text
  private readonly coinValue: Phaser.GameObjects.Text
  private readonly bestLabel: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, bestMeters = 0) {
    const m = TUNING.ui.hudMargin

    scene.add
      .text(m, m - 4, 'ALTITUDE', {
        fontFamily: FONT_SANS,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setLetterSpacing(3)
      .setScrollFactor(0)
      .setDepth(100)

    this.altitudeValue = scene.add
      .text(m - 2, m + 10, formatMeters(0), {
        fontFamily: FONT_MONO,
        fontSize: '42px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100)

    this.bestLabel = scene.add
      .text(m, m + 62, `BEST ${formatMeters(bestMeters)}`, {
        fontFamily: FONT_SANS,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setLetterSpacing(2)
      .setScrollFactor(0)
      .setDepth(100)

    const right = TUNING.world.width - m

    scene.add
      .circle(right - 74, m + 8, 9, PALETTE.coin)
      .setStrokeStyle(2, PALETTE.ballShade, 0.85)
      .setScrollFactor(0)
      .setDepth(100)

    this.coinValue = scene.add
      .text(right, m - 12, '0', {
        fontFamily: FONT_MONO,
        fontSize: '30px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
  }

  setMeters(meters: number): void {
    this.altitudeValue.setText(formatMeters(meters))
  }

  setCoins(coins: number): void {
    this.coinValue.setText(String(coins))
  }

  setBest(meters: number): void {
    this.bestLabel.setText(`BEST ${formatMeters(meters)}`)
  }
}
