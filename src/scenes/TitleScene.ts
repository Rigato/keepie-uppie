import Phaser from 'phaser'
import { audio } from '../fx/audio'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import type { PlatformService } from '../platform/types'
import { formatMeters, type SaveV1 } from '../platform/storage'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    if (this.registry.get('debug') === true) {
      this.scene.launch('DebugOverlay')
      this.scene.bringToTop('DebugOverlay')
    }
    this.scene.start('Title')
  }
}

export class TitleScene extends Phaser.Scene {
  private starting = false

  constructor() {
    super('Title')
  }

  create(): void {
    const { width, height } = TUNING.world
    const save = this.registry.get('save') as SaveV1

    const g = this.add.graphics()
    g.fillGradientStyle(PALETTE.bgSoft, PALETTE.bgSoft, PALETTE.bg, PALETTE.bg, 1)
    g.fillRect(0, 0, width, height)

    this.add.circle(width / 2, height * 0.24, 132, PALETTE.accent, 0.05)
    this.add.circle(width / 2, height * 0.24, 58, PALETTE.ball)
    this.add.circle(width / 2, height * 0.24, 58).setStrokeStyle(3, 0x000000, 0.14)
    this.add.circle(width / 2 - 18, height * 0.24 - 18, 13, 0xffffff, 0.32)

    this.add
      .text(width / 2, height * 0.39, 'KEEPIE', {
        fontFamily: FONT_SANS,
        fontSize: '76px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)

    this.add
      .text(width / 2, height * 0.465, 'UPPIE', {
        fontFamily: FONT_SANS,
        fontSize: '76px',
        color: CSS_PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)

    this.add
      .text(width / 2, height * 0.545, 'ENDLESS VERTICAL ARCADE', {
        fontFamily: FONT_SANS,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setLetterSpacing(5)

    const tap = this.add
      .text(width / 2, height * 0.74, 'TAP TO PLAY', {
        fontFamily: FONT_SANS,
        fontSize: '22px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    this.tweens.add({
      targets: tap,
      alpha: { from: 1, to: 0.3 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    this.add
      .text(width / 2, height * 0.805, `BEST ${formatMeters(save.bestMeters)}`, {
        fontFamily: FONT_SANS,
        fontSize: '13px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    this.add
      .text(width / 2, height - 32, BUILD_LABEL, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.55)

    const platform = this.registry.get('platform') as PlatformService
    platform.markGameReady()

    this.input.on('pointerdown', () => this.startRun())
    this.input.keyboard?.on('keydown-SPACE', () => this.startRun())
    this.input.keyboard?.on('keydown-ENTER', () => this.startRun())
  }

  private startRun(): void {
    if (this.starting) return
    this.starting = true
    audio.play('ui')
    this.scene.start('Play')
  }
}
