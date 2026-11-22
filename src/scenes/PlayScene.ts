import Phaser from 'phaser'
import { metersFromTop, ratchetCameraY } from '../core/camera'
import { computeKick } from '../core/kick'
import { audio } from '../fx/audio'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { DEBUG_STATE } from '../game/debug-state'
import { gameEvents } from '../game/events'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import { formatMeters, type SaveStore, type SaveV1 } from '../platform/storage'
import { Hud } from '../ui/hud'
import { drawBackdrop } from '../ui/backdrop'

interface BallState {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * F1 — core loop: chute, catraca, paredes, morte e retry.
 * A física é integrada aqui (passo fixo por delta) e a regra de chute vive em core/kick.ts.
 */
export class PlayScene extends Phaser.Scene {
  private ball: BallState = { x: 0, y: 0, vx: 0, vy: 0 }
  private ballView!: Phaser.GameObjects.Container
  private hud!: Hud
  private grid!: Phaser.GameObjects.Graphics
  private hint?: Phaser.GameObjects.Text

  private started = false
  private dead = false
  private retryReady = false
  private startY = 0
  private minY = 0
  private meters = 0
  private coins = 0
  private cameraY = 0
  private lastWholeMeters = -1
  private wasBest = false

  constructor() {
    super('Play')
  }

  create(): void {
    const { width, height } = TUNING.world
    const save = this.registry.get('save') as SaveV1

    this.ball = { x: width / 2, y: TUNING.run.spawnY, vx: 0, vy: 0 }
    this.started = false
    this.dead = false
    this.retryReady = false
    this.startY = this.ball.y
    this.minY = this.ball.y
    this.meters = 0
    this.coins = 0
    this.cameraY = 0
    this.lastWholeMeters = -1

    this.cameras.main.setScroll(0, 0)

    drawBackdrop(this, { walls: true }).setScrollFactor(0).setDepth(0)
    this.grid = this.add.graphics().setDepth(1)

    this.ballView = this.add.container(this.ball.x, this.ball.y).setDepth(10)
    const glow = this.add.circle(0, 0, TUNING.ball.radius + 18, PALETTE.ball, 0.07)
    const body = this.add.circle(0, 0, TUNING.ball.radius, PALETTE.ball)
    const rim = this.add.circle(0, 0, TUNING.ball.radius).setStrokeStyle(3, 0x000000, 0.14)
    const shine = this.add.circle(-9, -9, 7, 0xffffff, 0.32)
    this.ballView.add([glow, body, rim, shine])

    this.hud = new Hud(this, save.bestMeters)
    this.hud.setMeters(0)
    this.hud.setCoins(0)

    this.hint = this.add
      .text(width / 2, 560, 'TAP THE BALL', {
        fontFamily: FONT_SANS,
        fontSize: '14px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setScrollFactor(0)
      .setDepth(20)

    this.add
      .text(width / 2, height - 30, BUILD_LABEL, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.5)
      .setScrollFactor(0)
      .setDepth(20)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleTap(pointer.worldX, pointer.worldY)
    })
    this.input.keyboard?.on('keydown-SPACE', () => this.handleTap(this.ball.x, this.ball.y))

    gameEvents.emit('runStart', {})
  }

  update(_time: number, deltaMs: number): void {
    if (this.dead) return

    const slow = (this.registry.get('timeScale') as number | undefined) ?? 1
    const dt = (Math.min(deltaMs, 50) / 1000) * slow

    this.stepPhysics(dt)
    this.updateCamera()
    this.updateAltitude()
    this.drawGrid()
    this.syncView()
  }

  private stepPhysics(dt: number): void {
    const b = this.ball
    const r = TUNING.ball.radius
    const wall = 14

    b.vy = Math.min(
      b.vy +
        TUNING.physics.gravity * (this.started ? 1 : TUNING.run.serveGravityScale) * dt,
      TUNING.physics.maxFallSpeed,
    )
    b.x += b.vx * dt
    b.y += b.vy * dt

    if (b.x - r < wall) {
      b.x = wall + r
      b.vx = Math.abs(b.vx) * TUNING.physics.wallRestitution
      audio.play('wall', { pitch: 0.9 })
    } else if (b.x + r > TUNING.world.width - wall) {
      b.x = TUNING.world.width - wall - r
      b.vx = -Math.abs(b.vx) * TUNING.physics.wallRestitution
      audio.play('wall', { pitch: 1.1 })
    }

    if (b.y - r > this.cameraY + TUNING.world.height) this.die()
  }

  private updateCamera(): void {
    if (!this.started) return
    this.cameraY = ratchetCameraY(this.cameraY, this.ball.y, TUNING.world.height)
    this.cameras.main.setScroll(0, this.cameraY)
  }

  private updateAltitude(): void {
    this.minY = Math.min(this.minY, this.ball.y)
    this.meters = this.started ? metersFromTop(this.startY, this.minY) : 0
    const whole = Math.floor(this.meters)
    if (whole !== this.lastWholeMeters) {
      this.lastWholeMeters = whole
      this.hud.setMeters(whole)
    }
  }

  private syncView(): void {
    this.ballView.setPosition(this.ball.x, this.ball.y)

    DEBUG_STATE.ballX = this.ball.x
    DEBUG_STATE.ballY = this.ball.y
    DEBUG_STATE.ballVx = this.ball.vx
    DEBUG_STATE.ballVy = this.ball.vy
    DEBUG_STATE.meters = this.meters
    DEBUG_STATE.coins = this.coins
  }

  private handleTap(x: number, y: number): void {
    if (this.dead) {
      if (this.retryReady) this.retry()
      return
    }

    const result = computeKick({ ...this.ball, r: TUNING.ball.radius }, { x, y })
    if (result.kind === 'whiff') {
      audio.play('whiff')
      return
    }

    this.ball.vx = result.vx
    this.ball.vy = result.vy
    this.lastArc(result.arcTime, result.power)

    if (!this.started) {
      this.started = true
      this.startY = this.ball.y
      this.minY = this.ball.y
      this.hint?.setVisible(false)
      this.hint = undefined
    }

    audio.play(result.perfect ? 'perfect' : 'kick', { pitch: result.perfect ? 1 : 0.95 + result.power * 0.1 })
    this.cameras.main.shake(60, TUNING.fx.shakeKick)
    this.tweens.add({
      targets: this.ballView,
      scaleX: 1.18,
      scaleY: 0.82,
      duration: 70,
      yoyo: true,
      ease: 'Quad.out',
    })
  }

  private lastArc(arcTime: number, power: number): void {
    DEBUG_STATE.lastKickArc = arcTime
    DEBUG_STATE.lastKickPower = power * 100
  }

  private die(): void {
    if (this.dead) return
    this.dead = true
    audio.play('death')
    this.cameras.main.shake(180, 0.006)
    const save = this.registry.get('save') as SaveV1
    this.wasBest = this.meters > save.bestMeters
    this.persistBest()
    this.time.delayedCall(TUNING.run.deathDelayMs, () => this.showDeath())
  }

  private persistBest(): void {
    const save = this.registry.get('save') as SaveV1
    const whole = Math.floor(this.meters)
    if (whole <= save.bestMeters) return
    const next: SaveV1 = { ...save, bestMeters: whole }
    this.registry.set('save', next)
    this.hud.setBest(whole)
    const store = this.registry.get('saveStore') as SaveStore | undefined
    if (store) void store.save(next)
  }

  private showDeath(): void {
    if (!this.scene.isActive()) return
    const { width, height } = TUNING.world
    const save = this.registry.get('save') as SaveV1
    const isBest = this.wasBest

    const overlay = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
    const dim = this.add.rectangle(0, 0, width, height, PALETTE.bg, 0.78).setOrigin(0)
    const title = this.add
      .text(width / 2, height * 0.3, 'GAME OVER', {
        fontFamily: FONT_SANS,
        fontSize: '40px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
    const score = this.add
      .text(width / 2, height * 0.42, formatMeters(this.meters), {
        fontFamily: FONT_MONO,
        fontSize: '68px',
        color: CSS_PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    const best = this.add
      .text(width / 2, height * 0.51, isBest ? 'NEW BEST!' : `BEST ${formatMeters(save.bestMeters)}`, {
        fontFamily: FONT_SANS,
        fontSize: '16px',
        color: isBest ? CSS_PALETTE.accent : CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
    const retry = this.add
      .text(width / 2, height * 0.68, 'TAP TO RETRY', {
        fontFamily: FONT_SANS,
        fontSize: '20px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    this.tweens.add({
      targets: retry,
      alpha: { from: 1, to: 0.3 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    overlay.add([dim, title, score, best, retry])
    dim.setScrollFactor(0)
    title.setScrollFactor(0)
    score.setScrollFactor(0)
    best.setScrollFactor(0)
    retry.setScrollFactor(0)
    this.retryReady = true
  }

  private retry(): void {
    this.retryReady = false
    this.scene.restart()
  }

  private drawGrid(): void {
    const { width, height } = TUNING.world
    const spacing = 120
    const strongSpacing = 600
    const g = this.grid
    g.clear()

    const offset = ((this.cameraY % spacing) + spacing) % spacing
    g.lineStyle(1, 0xffffff, 0.03)
    for (let y = offset - spacing; y < height + spacing; y += spacing) g.lineBetween(0, y, width, y)

    const strong = ((this.cameraY % strongSpacing) + strongSpacing) % strongSpacing
    g.lineStyle(1, PALETTE.accent, 0.06)
    for (let y = strong - strongSpacing; y < height + strongSpacing; y += strongSpacing)
      g.lineBetween(0, y, width, y)
  }
}
