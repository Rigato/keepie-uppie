import Phaser from 'phaser'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_SANS } from '../game/config'
import { DEBUG_STATE } from '../game/debug-state'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import type { SaveV1 } from '../platform/storage'
import { Hud } from '../ui/hud'
import { drawBackdrop } from '../ui/backdrop'

/**
 * F0: cenário, HUD e bola de demonstração. O core loop (chute, câmera, morte)
 * entra em F1 e substitui a animação idle.
 */
export class PlayScene extends Phaser.Scene {
  private hud!: Hud
  private ball!: Phaser.GameObjects.Container

  constructor() {
    super('Play')
  }

  create(): void {
    const { width, height } = TUNING.world
    const save = this.registry.get('save') as SaveV1

    drawBackdrop(this, { walls: true })

    this.ball = this.add.container(width / 2, height * 0.44)
    const glow = this.add.circle(0, 0, TUNING.ball.radius + 18, PALETTE.ball, 0.07)
    const body = this.add.circle(0, 0, TUNING.ball.radius, PALETTE.ball)
    const rim = this.add.circle(0, 0, TUNING.ball.radius).setStrokeStyle(3, 0x000000, 0.14)
    const shine = this.add.circle(-9, -9, 7, 0xffffff, 0.32)
    this.ball.add([glow, body, rim, shine])

    this.tweens.add({
      targets: this.ball,
      y: height * 0.5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    this.hud = new Hud(this, save.bestMeters)
    this.hud.setMeters(0)
    this.hud.setCoins(0)

    this.add
      .text(width / 2, height - 32, BUILD_LABEL, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.55)

    DEBUG_STATE.ballX = this.ball.x
    DEBUG_STATE.ballY = this.ball.y
  }

  update(): void {
    DEBUG_STATE.ballX = this.ball.x
    DEBUG_STATE.ballY = this.ball.y
    DEBUG_STATE.ballVx = 0
    DEBUG_STATE.ballVy = 0
  }
}
