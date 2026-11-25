import Phaser from 'phaser'
import { normalizeAngle } from '../core/ball-spin'
import { audio } from '../fx/audio'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import type { PlatformService } from '../platform/types'
import { formatMeters, type SaveV1 } from '../platform/storage'
import { createBallView, type BallView } from '../ui/ball'
import { Parallax } from '../ui/parallax'

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
  private parallax?: Parallax
  /** Bola decorativa; o padrão gira devagar enquanto o brilho fica parado. */
  private ballArt?: BallView
  /**
   * Bloqueio curto de input depois de a cena nascer. A loja volta para o
   * título no `pointerup` do BACK, e o mesmo release pode cair no botão SHOP
   * que fica na mesma coordenada — o lock evita a reabertura acidental.
   */
  private inputLockUntil = 0

  constructor() {
    super('Title')
  }

  create(): void {
    const { width, height } = TUNING.world
    const save = this.registry.get('save') as SaveV1
    this.starting = false
    this.inputLockUntil = this.time.now + 320

    const g = this.add.graphics().setDepth(-2)
    g.fillGradientStyle(PALETTE.bgSoft, PALETTE.bgSoft, PALETTE.bg, PALETTE.bg, 1)
    g.fillRect(0, 0, width, height)

    this.parallax = new Parallax(this, -1)
    this.parallax.update(0, this.time.now)

    this.add.circle(width / 2, height * 0.24, 132, PALETTE.accent, 0.08)
    this.ballArt = createBallView(this, 58)
    this.ballArt.setPosition(width / 2, height * 0.24)

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
      alpha: { from: 1, to: 0.5 },
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
      .text(width / 2, height * 0.838, `COINS ${save.totalCoins}`, {
        fontFamily: FONT_MONO,
        fontSize: '13px',
        color: CSS_PALETTE.ball,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setAlpha(0.9)

    // Loja: botão próprio; tocar fora dele continua iniciando a run.
    const shopY = height * 0.905
    const shopWidth = 190
    const shopHeight = 54
    const shopBg = this.add.graphics()
    shopBg.fillStyle(PALETTE.bgSoft, 0.9)
    shopBg.fillRoundedRect(
      width / 2 - shopWidth / 2,
      shopY - shopHeight / 2,
      shopWidth,
      shopHeight,
      10,
    )
    shopBg.lineStyle(2, PALETTE.accent, 0.85)
    shopBg.strokeRoundedRect(
      width / 2 - shopWidth / 2,
      shopY - shopHeight / 2,
      shopWidth,
      shopHeight,
      10,
    )
    this.add
      .text(width / 2, shopY, 'SHOP', {
        fontFamily: FONT_SANS,
        fontSize: '18px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
    const shopZone = this.add
      .zone(width / 2, shopY, shopWidth, shopHeight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    shopZone.on('pointerdown', () => this.openShop())

    this.add
      .text(width / 2, 26, BUILD_LABEL, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.5)

    const platform = this.registry.get('platform') as PlatformService
    platform.markGameReady()

    this.input.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length > 0) return
        this.startRun()
      },
    )
    this.input.keyboard?.on('keydown-SPACE', () => this.startRun())
    this.input.keyboard?.on('keydown-ENTER', () => this.startRun())
  }

  update(_time: number, deltaMs: number): void {
    this.parallax?.update(0, this.time.now)
    if (this.ballArt) {
      const dt = Math.min(deltaMs, 50) / 1000
      this.ballArt.pattern.setRotation(
        normalizeAngle(this.ballArt.pattern.rotation + TUNING.ball.titleSpin * dt),
      )
    }
  }

  private startRun(): void {
    if (this.starting || this.time.now < this.inputLockUntil) return
    this.starting = true
    void audio.unlock()
    audio.play('ui')
    this.scene.start('Play')
  }

  private openShop(): void {
    if (this.starting || this.time.now < this.inputLockUntil) return
    audio.play('ui')
    this.scene.start('Shop')
  }
}
