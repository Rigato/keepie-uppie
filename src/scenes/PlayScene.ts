import Phaser from 'phaser'
import { metersFromTop, ratchetCameraY, smoothCameraY } from '../core/camera'
import { reflectVelocity } from '../core/collision'
import { resolveAim } from '../core/aim'
import { InteractiveSpawner } from '../core/interactive-spawner'
import { computeKick, isInsideBall, type KickResult } from '../core/kick'
import { ObstacleSpawner } from '../core/spawner'
import { StreakTracker, labelForCount, type StreakLabel } from '../core/streak'
import { audio } from '../fx/audio'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { DEBUG_STATE } from '../game/debug-state'
import { FEATURES } from '../game/features'
import { gameEvents } from '../game/events'
import type { BallLike } from '../game/contracts'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import { createObstacle, type ObstacleContact, type ObstacleInstance } from '../objects/obstacles'
import {
  createInteractive,
  type InteractiveContact,
  type InteractiveInstance,
} from '../objects/interactives'
import { formatMeters, type SaveStore, type SaveV1 } from '../platform/storage'
import { AimUi } from '../ui/aim'
import { Hud } from '../ui/hud'
import { Parallax } from '../ui/parallax'
import { PowerupHud } from '../ui/powerup-hud'
import { drawBackdrop } from '../ui/backdrop'

type BallState = BallLike

/**
 * F1 — core loop: chute, catraca, paredes, morte e retry.
 * A física é integrada aqui (passo fixo por delta) e a regra de chute vive em core/kick.ts.
 */
export class PlayScene extends Phaser.Scene {
  private ball: BallState = { x: 0, y: 0, vx: 0, vy: 0, r: TUNING.ball.radius }
  private ballView!: Phaser.GameObjects.Container
  private hud!: Hud
  private grid!: Phaser.GameObjects.Graphics
  private parallax!: Parallax
  private hint?: Phaser.GameObjects.Text

  private started = false
  private dead = false
  private retryReady = false
  private startY = 0
  private minY = 0
  private meters = 0
  private coins = 0
  private cameraY = 0
  /** Ponto mais alto da trajetória desde o último chute: base da força do toque. */
  private arcApexY = 0
  private lastWholeMeters = -1
  private wasBest = false
  private spawner = new ObstacleSpawner()
  private obstacles: ObstacleInstance[] = []
  private interactiveSpawner = new InteractiveSpawner()
  private interactives: InteractiveInstance[] = []
  private powerupHud!: PowerupHud
  private aimUi!: AimUi
  private magnetAura!: Phaser.GameObjects.Arc
  private aimedArmed = false
  private magnetEndsAt = 0
  private magnetHudAt = 0
  private aiming = false
  private aimEndsAt = 0
  private aimPointer = { x: 0, y: 0 }
  private streak = new StreakTracker()
  private feverUntil = 0
  private feverAura!: Phaser.GameObjects.Arc
  private streakText!: Phaser.GameObjects.Text
  private feverText!: Phaser.GameObjects.Text
  private feverHudAt = 0
  private hitStopUntil = 0
  private trail: Phaser.GameObjects.Arc[] = []
  private trailIndex = 0
  private trailAt = 0
  private pauseRect = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  private kickRing!: Phaser.GameObjects.Container
  /** Toque que chegou um pouco antes do ápice; dispara quando a bola fica chutável. */
  private bufferedTap: { x: number; y: number; until: number; aimed: boolean } | null = null

  constructor() {
    super('Play')
  }

  create(): void {
    const { width } = TUNING.world
    const save = this.registry.get('save') as SaveV1

    this.ball = { x: width / 2, y: TUNING.run.spawnY, vx: 0, vy: 0, r: TUNING.ball.radius }
    this.started = false
    this.dead = false
    this.retryReady = false
    this.startY = this.ball.y
    this.minY = this.ball.y
    this.arcApexY = this.ball.y
    this.meters = 0
    this.coins = 0
    this.cameraY = 0
    this.lastWholeMeters = -1
    this.spawner.reset((Math.random() * 0xffffffff) >>> 0)
    this.obstacles = []
    this.interactiveSpawner.reset((Math.random() * 0xffffffff) >>> 0)
    this.interactives = []
    this.aimedArmed = false
    this.magnetEndsAt = 0
    this.magnetHudAt = 0
    this.aiming = false
    this.aimEndsAt = 0
    this.streak.reset()
    this.feverUntil = 0
    this.feverHudAt = 0
    this.hitStopUntil = 0
    this.trail = []
    this.trailIndex = 0
    this.trailAt = 0
    this.bufferedTap = null
    DEBUG_STATE.powerup = '—'

    this.cameras.main.setScroll(0, 0)

    drawBackdrop(this, { walls: true }).setScrollFactor(0).setDepth(0)
    this.grid = this.add.graphics().setDepth(1)
    this.parallax = new Parallax(this)

    // Scrim do topo: obstáculos somem atrás do HUD em vez de competir com ele.
    // Fica abaixo da bola e do rastro para o ápice em `camera.maxTop` não
    // escurecer o que o jogador precisa ver (o HUD continua acima, no depth 100).
    const scrim = this.add.graphics().setScrollFactor(0).setDepth(8)
    scrim.fillGradientStyle(
      PALETTE.bgSoft,
      PALETTE.bgSoft,
      PALETTE.bgSoft,
      PALETTE.bgSoft,
      0.9,
      0.9,
      0,
      0,
    )
    scrim.fillRect(0, 0, width, 170)

    this.ballView = this.add.container(this.ball.x, this.ball.y).setDepth(10)
    const glow = this.add.circle(0, 0, TUNING.ball.radius + 18, PALETTE.ball, 0.09)
    const body = this.add.circle(0, 0, TUNING.ball.radius, PALETTE.ball)
    const rim = this.add.circle(0, 0, TUNING.ball.radius).setStrokeStyle(3, PALETTE.ink, 0.28)
    const shine = this.add.circle(-10, -10, 8, 0xffffff, 0.32)
    this.ballView.add([glow, body, rim, shine])

    // Área de chute: anel de pontos opcional (tuning com `?ring=1`).
    const kickDots: Phaser.GameObjects.Arc[] = []
    if (FEATURES.kickRing) {
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2
        kickDots.push(
          this.add.circle(
            Math.cos(angle) * TUNING.kick.ringRadius,
            Math.sin(angle) * TUNING.kick.ringRadius,
            3,
            PALETTE.accent,
            0.6,
          ),
        )
      }
    }
    this.kickRing = this.add.container(0, 0, kickDots).setDepth(9).setVisible(false)

    this.hud = new Hud(this, save.bestMeters)
    this.hud.setMeters(0)
    this.hud.setCoins(0)

    this.powerupHud = new PowerupHud(this)
    this.aimUi = new AimUi(this)

    this.magnetAura = this.add
      .circle(0, 0, TUNING.powerup.magnetRadius, PALETTE.magnet, 0.1)
      .setStrokeStyle(2, PALETTE.magnet, 0.32)
      .setDepth(9)
      .setVisible(false)

    this.feverAura = this.add
      .circle(0, 0, TUNING.streak.feverAuraRadius, PALETTE.fever, 0.11)
      .setStrokeStyle(2, PALETTE.fever, 0.3)
      .setDepth(8)
      .setVisible(false)

    this.streakText = this.add
      .text(width / 2, 52, '', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)

    this.feverText = this.add
      .text(width / 2, 78, '', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: CSS_PALETTE.fever,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false)

    // Rastro curto: leitura de velocidade sem custo por frame.
    for (let i = 0; i < 6; i += 1) {
      this.trail.push(
        this.add.circle(0, 0, TUNING.ball.radius * 0.75, PALETTE.ball, 0).setDepth(9),
      )
    }

    // Pausa: alvo fixo no canto superior direito, abaixo das moedas.
    this.pauseRect.setTo(width - 70, 72, 64, 64)
    const pauseZone = this.add
      .zone(width - 38, 104, 64, 64)
      .setScrollFactor(0)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
    const pauseIcon = this.add.container(width - 38, 104).setScrollFactor(0).setDepth(101)
    pauseIcon.add([
      this.add.circle(0, 0, 18, PALETTE.bg, 0.45).setStrokeStyle(1, PALETTE.inkDim, 0.45),
      this.add.rectangle(-5, 0, 4, 14, PALETTE.ink).setAlpha(0.85),
      this.add.rectangle(5, 0, 4, 14, PALETTE.ink).setAlpha(0.85),
    ])
    pauseZone.on('pointerup', () => this.openPause())

    const onVisibility = (): void => {
      if (document.hidden && this.scene.isActive() && !this.dead && !this.aiming) {
        this.openPause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility)
    })

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
      .text(width / 2, 26, BUILD_LABEL, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.5)
      .setScrollFactor(0)
      .setDepth(100)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer.worldX, pointer.worldY)
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.aiming) return
      this.aimPointer.x = pointer.worldX
      this.aimPointer.y = pointer.worldY
    })
    this.input.on('pointerup', () => {
      if (this.aiming) this.fireAim(false)
    })
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.aiming) this.fireAim(false)
      else if (this.aimedArmed) this.beginAim(this.ball.x, this.ball.y - 180)
      else this.handleTap(this.ball.x, this.ball.y)
    })

    gameEvents.emit('runStart', {})
  }

  update(_time: number, deltaMs: number): void {
    if (this.dead) return

    const slow = (this.registry.get('timeScale') as number | undefined) ?? 1
    const dt = (Math.min(deltaMs, 50) / 1000) * slow

    if (this.aiming) {
      this.updateAim()
      this.syncView()
      return
    }

    if (this.time.now < this.hitStopUntil) {
      this.syncView()
      return
    }

    this.stepPhysics(dt)
    this.resolveBufferedTap()
    this.updateCamera(dt)
    this.parallax.update(this.cameraY, this.time.now)
    this.updateAltitude()
    this.updateObstacles(dt)
    this.updateInteractives(dt)
    this.updateMagnet(dt)
    this.updateFever()
    this.updateKickRing()
    this.updateTrail()
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
    if (b.y < this.arcApexY) this.arcApexY = b.y

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

  private updateCamera(dt: number): void {
    if (!this.started) return

    const height = TUNING.world.height
    const target = ratchetCameraY(this.cameraY, this.ball.y, height)
    this.cameraY = smoothCameraY(this.cameraY, target, dt, TUNING.camera.followSpeed)

    // Atrás da bola por um instante, mas nunca deixa a bola sair pelo topo.
    const maxTop = this.ball.y - height * TUNING.camera.maxTop
    this.cameraY = Math.min(this.cameraY, maxTop)

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

  private updateObstacles(dt: number): void {
    const time = this.time.now
    const specs = this.spawner.update({
      cameraTop: this.cameraY,
      meters: this.meters,
      ballX: this.ball.x,
    })

    for (const spec of specs) {
      const obstacle = createObstacle(this, spec)
      if (obstacle) this.obstacles.push(obstacle)
    }

    for (let i = 0; i < this.obstacles.length; i += 1) {
      const obstacle = this.obstacles[i]
      if (!obstacle) continue
      obstacle.update(dt, time)
      const contact = obstacle.contact(this.ball)
      if (contact) this.applyObstacleContact(obstacle, contact)
    }

    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = this.obstacles[i]
      if (!obstacle) continue
      const belowScreen =
        obstacle.bounds.y - this.cameraY >
        TUNING.world.height + TUNING.obstacle.despawnMargin
      const birdGone = obstacle.kind === 'bird' && obstacle.spent
      if (belowScreen || birdGone) {
        obstacle.destroy()
        this.obstacles.splice(i, 1)
      }
    }
  }

  private applyObstacleContact(obstacle: ObstacleInstance, contact: ObstacleContact): void {
    switch (contact.result) {
      case 'reflect': {
        if (contact.normal) {
          const reflected = reflectVelocity(
            this.ball.vx,
            this.ball.vy,
            contact.normal,
            TUNING.physics.wallRestitution,
          )
          this.ball.vx = reflected.vx
          this.ball.vy = reflected.vy
          const push = (contact.penetration ?? 0) + 1
          this.ball.x += contact.normal.x * push
          this.ball.y += contact.normal.y * push
        }
        audio.play('wall', { pitch: 0.62, volume: 0.9 })
        this.cameras.main.shake(70, TUNING.fx.shakeHard * contact.strength)
        break
      }
      case 'damp': {
        const keep = 1 - TUNING.obstacle.softDamp
        this.ball.vx *= keep
        this.ball.vy *= keep
        audio.play('damp')
        break
      }
      case 'shatter': {
        audio.play('shatter')
        this.cameras.main.shake(90, TUNING.fx.shakeShatter * contact.strength)
        break
      }
      case 'deflect': {
        if (contact.impulse) {
          this.ball.vx += contact.impulse.x
          this.ball.vy += contact.impulse.y
        }
        audio.play('wall', { pitch: 1.7, volume: 0.5 })
        break
      }
    }

    obstacle.react(contact)
    gameEvents.emit('obstacleContact', {
      x: contact.point.x,
      y: contact.point.y,
      kind: obstacle.kind,
      result: contact.result,
      strength: contact.strength,
    })
  }

  private updateInteractives(dt: number): void {
    const specs = this.interactiveSpawner.update({
      cameraTop: this.cameraY,
      meters: this.meters,
    })

    for (const spec of specs) {
      const item = createInteractive(this, spec)
      if (item) this.interactives.push(item)
    }

    for (let i = this.interactives.length - 1; i >= 0; i -= 1) {
      const item = this.interactives[i]
      if (!item) continue

      item.update(dt, this.time.now)
      const contact = item.contact(this.ball)
      if (contact) {
        this.applyInteractiveContact(item, contact)
        if (item.spent && item.kind !== 'spring') {
          item.destroy()
          this.interactives.splice(i, 1)
          continue
        }
      }

      const belowScreen =
        item.bounds.y - this.cameraY >
        TUNING.world.height + TUNING.obstacle.despawnMargin
      if (belowScreen) {
        item.destroy()
        this.interactives.splice(i, 1)
      }
    }
  }

  private applyInteractiveContact(item: InteractiveInstance, contact: InteractiveContact): void {
    switch (contact.result) {
      case 'collect': {
        const fever = this.isFever()
        const value = this.addCoins(contact.coins ?? TUNING.collect.coinValue)
        audio.play('coin')
        gameEvents.emit('coin', {
          x: contact.point.x,
          y: contact.point.y,
          value,
          fever,
        })
        break
      }
      case 'ring': {
        this.addCoins(contact.coins ?? TUNING.collect.ringCoinBurst)
        audio.play('ring')
        this.cameras.main.flash(140, 77, 226, 197)
        gameEvents.emit('ring', { x: contact.point.x, y: contact.point.y })
        break
      }
      case 'launch': {
        this.ball.vy = -TUNING.collect.springLaunchSpeed
        this.ball.vx *= 0.85
        this.arcApexY = this.ball.y
        audio.play('spring')
        this.cameras.main.shake(90, 0.004)
        gameEvents.emit('spring', { x: contact.point.x, y: contact.point.y })
        break
      }
      case 'pickup': {
        audio.play('pickup')
        if (contact.pickup === 'magnet') {
          this.magnetEndsAt = this.time.now + TUNING.powerup.magnetDurationMs
          this.magnetHudAt = 0
          this.magnetAura.setVisible(true)
          this.powerupHud.setMagnet(
            true,
            TUNING.powerup.magnetDurationMs,
            TUNING.powerup.magnetDurationMs,
          )
        } else if (contact.pickup === 'aimed') {
          this.aimedArmed = true
          this.powerupHud.setAimed(true)
        }
        if (contact.pickup) {
          gameEvents.emit('pickup', {
            x: contact.point.x,
            y: contact.point.y,
            kind: contact.pickup,
          })
        }
        break
      }
    }

    item.react(contact)
  }

  private addCoins(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0
    const multiplier = this.isFever() ? TUNING.streak.coinMultiplier : 1
    const value = Math.max(1, Math.round(amount * multiplier))
    this.coins += value
    this.hud.setCoins(this.coins)
    DEBUG_STATE.coins = this.coins
    return value
  }

  private updateMagnet(dt: number): void {
    const now = this.time.now

    if (this.magnetEndsAt > now) {
      this.magnetAura.setVisible(true).setPosition(this.ball.x, this.ball.y)

      for (const item of this.interactives) {
        if (item.kind !== 'coin' || item.spent) continue
        const dx = this.ball.x - item.root.x
        const dy = this.ball.y - item.root.y
        if (Math.hypot(dx, dy) <= TUNING.powerup.magnetRadius) {
          item.attract?.(
            { x: this.ball.x, y: this.ball.y },
            dt,
            TUNING.powerup.magnetPullSpeed,
          )
        }
      }

      if (now >= this.magnetHudAt) {
        this.magnetHudAt = now + 100
        this.powerupHud.setMagnet(
          true,
          this.magnetEndsAt - now,
          TUNING.powerup.magnetDurationMs,
        )
      }
      return
    }

    if (this.magnetEndsAt !== 0) {
      this.magnetEndsAt = 0
      this.magnetAura.setVisible(false)
      this.powerupHud.setMagnet(false, 0, TUNING.powerup.magnetDurationMs)
    }
  }

  private handlePointerDown(x: number, y: number): void {
    if (this.dead) {
      if (this.retryReady) this.retry()
      return
    }
    if (this.aiming) return
    if (Phaser.Geom.Rectangle.Contains(this.pauseRect, x, y - this.cameraY)) return

    if (this.aimedArmed) {
      const touch = { ...this.ball, r: TUNING.kick.touchRadius }
      if (isInsideBall(touch, { x, y })) {
        if (this.ball.vy >= -TUNING.kick.apexTolerance) {
          this.beginAim(x, y)
        } else {
          this.bufferTap(x, y, true)
        }
        return
      }
    }

    this.handleTap(x, y)
  }

  private beginAim(x: number, y: number): void {
    this.aiming = true
    this.bufferedTap = null
    this.aimedArmed = false
    this.powerupHud.setAimed(false)
    this.aimEndsAt = this.time.now + TUNING.powerup.aimWindowMs
    this.aimPointer = { x, y }
    this.kickRing.setVisible(false)
    this.aimUi.show(this.ball.x, this.ball.y - this.cameraY)
    audio.play('ui', { pitch: 1.5, volume: 0.8 })
  }

  private updateAim(): void {
    const now = this.time.now
    const remaining = Math.max(0, this.aimEndsAt - now)
    const aim = resolveAim(this.ball, this.aimPointer, false)

    const ballScreenX = this.ball.x
    const ballScreenY = this.ball.y - this.cameraY

    this.aimUi.update(ballScreenX, ballScreenY, {
      pointerX: this.aimPointer.x,
      pointerY: this.aimPointer.y - this.cameraY,
      launchDirX: aim.dir.x,
      launchDirY: aim.dir.y,
      ratio: aim.ratio,
      remainingMs: remaining,
      windowMs: TUNING.powerup.aimWindowMs,
      maxDrag: TUNING.powerup.aimMaxDrag,
    })

    if (remaining <= 0) this.fireAim(true)
  }

  private fireAim(timedOut: boolean): void {
    if (!this.aiming) return

    const shot = resolveAim(this.ball, this.aimPointer, timedOut)
    this.aiming = false
    this.aimUi.hide()

    this.ball.vx = shot.dir.x * shot.speed
    this.ball.vy = shot.dir.y * shot.speed
    this.arcApexY = this.ball.y
    this.lastArc((2 * shot.speed) / TUNING.physics.gravity, shot.ratio)
    this.markStarted()
    this.registerCleanKick(false)

    audio.play('perfect', { pitch: 0.9, volume: 0.9 })
    this.cameras.main.shake(90, 0.005)
    this.tweens.add({
      targets: this.ballView,
      scaleX: 1.24,
      scaleY: 0.76,
      duration: 85,
      yoyo: true,
      ease: 'Quad.out',
    })
  }

  private markStarted(): void {
    if (this.started) return
    this.started = true
    this.startY = this.ball.y
    this.minY = this.ball.y
    this.hint?.setVisible(false)
    this.hint = undefined
  }

  private syncView(): void {
    this.ballView.setPosition(this.ball.x, this.ball.y)

    DEBUG_STATE.ballX = this.ball.x
    DEBUG_STATE.ballY = this.ball.y
    DEBUG_STATE.ballVx = this.ball.vx
    DEBUG_STATE.ballVy = this.ball.vy
    DEBUG_STATE.meters = this.meters
    DEBUG_STATE.coins = this.coins
    DEBUG_STATE.streak = this.streak.count
    DEBUG_STATE.powerup = this.aiming
      ? 'aiming'
      : this.magnetEndsAt > this.time.now
        ? 'magnet'
        : this.aimedArmed
          ? 'aimed'
          : '—'
    DEBUG_STATE.extra = `obs ${this.obstacles.length} · itv ${this.interactives.length}`
  }

  private handleTap(x: number, y: number): void {
    if (this.dead) {
      if (this.retryReady) this.retry()
      return
    }
    this.bufferedTap = null

    const result = computeKick(this.ball, { x, y }, { fallDistance: this.fallDistance() })
    if (result.kind === 'whiff') {
      if (result.reason === 'miss') {
        audio.play('whiff')
        this.registerWhiff()
        this.showMiss(x, y)
      } else {
        // Toque um pouco antes do ápice: guarda por um instante em vez de perder.
        this.bufferTap(x, y, false)
      }
      return
    }

    this.applyKick(result)
  }

  /** Guarda o toque para disparar no instante em que a bola fica chutável. */
  private bufferTap(x: number, y: number, aimed: boolean): void {
    this.bufferedTap = {
      x,
      y,
      until: this.time.now + TUNING.kick.apexBufferMs,
      aimed,
    }
    audio.play('ui', { pitch: 0.7, volume: 0.22 })
  }

  private resolveBufferedTap(): void {
    const buffered = this.bufferedTap
    if (!buffered) return

    if (this.time.now > buffered.until) {
      this.bufferedTap = null
      return
    }

    const result = computeKick(
      this.ball,
      { x: buffered.x, y: buffered.y },
      { fallDistance: this.fallDistance() },
    )
    if (result.kind !== 'kick') {
      // Se a bola se afastou do toque guardado, desiste em vez de chutar longe.
      if (result.reason === 'miss') this.bufferedTap = null
      return
    }

    this.bufferedTap = null
    if (buffered.aimed && this.aimedArmed) {
      this.beginAim(buffered.x, buffered.y)
      return
    }
    this.applyKick(result)
  }

  /** Queda desde o ápice; alimenta a curva de força do próximo chute. */
  private fallDistance(): number {
    return Math.max(0, this.ball.y - this.arcApexY)
  }

  private applyKick(result: KickResult): void {
    this.ball.vx = result.vx
    this.ball.vy = result.vy
    this.arcApexY = this.ball.y
    this.lastArc(result.arcTime, result.power)

    if (!this.started) this.markStarted()
    this.registerCleanKick(result.perfect)

    const power = result.power
    audio.play(result.perfect ? 'perfect' : 'kick', {
      pitch: result.perfect ? 1 : 0.9 + power * 0.16,
      volume: 0.7 + power * 0.3,
    })
    this.cameras.main.shake(50 + 40 * power, TUNING.fx.shakeKick * (0.5 + power))
    this.tweens.add({
      targets: this.ballView,
      scaleX: 1.1 + 0.12 * power,
      scaleY: 0.9 - 0.12 * power,
      duration: 60 + 30 * power,
      yoyo: true,
      ease: 'Quad.out',
    })
  }

  private lastArc(arcTime: number, power: number): void {
    DEBUG_STATE.lastKickArc = arcTime
    DEBUG_STATE.lastKickPower = power * 100
  }

  private registerCleanKick(perfect: boolean): void {
    const kick = this.streak.registerKick()
    this.updateStreakHud()

    if (kick.label) {
      this.popLabel(kick.label, this.labelColor(kick.label), kick.label === 'ON FIRE', 92)
      audio.play(kick.label === 'ON FIRE' ? 'fever' : 'streakUp')
    }
    if (kick.feverStarted) this.startFever()
    if (perfect) {
      this.hitStopUntil = this.time.now + TUNING.fx.hitStopMs
      this.showPerfect()
    }
  }

  private registerWhiff(): void {
    if (this.streak.count === 0) return
    this.streak.registerWhiff()
    this.updateStreakHud()
  }

  private updateStreakHud(): void {
    const count = this.streak.count
    if (count === 0) {
      this.streakText.setText('')
      return
    }
    const tier = labelForCount(count)
    this.streakText.setColor(tier ? this.labelColor(tier) : CSS_PALETTE.inkDim)
    this.streakText.setText(tier ? `STREAK ${count} · ${tier}` : `STREAK ${count}`)
  }

  private labelColor(label: StreakLabel): string {
    if (label === 'ON FIRE') return CSS_PALETTE.fever
    if (label === 'GREAT') return CSS_PALETTE.ball
    return CSS_PALETTE.accent
  }

  private showPerfect(): void {
    this.popLabel('PERFECT', CSS_PALETTE.accent, false, 56)
    this.cameras.main.flash(70, 232, 238, 252)
    this.burst(this.ball.x, this.ball.y, PALETTE.accent, 8)
  }

  private startFever(): void {
    this.feverUntil = this.time.now + TUNING.streak.feverMs
    this.feverHudAt = 0
    this.feverAura.setVisible(true)
    this.feverText.setVisible(true)
    this.popLabel('FEVER!', CSS_PALETTE.fever, true, 132)
    this.cameras.main.flash(120, 255, 159, 67)
    audio.play('fever')
  }

  private updateFever(): void {
    const now = this.time.now

    if (this.feverUntil > now) {
      this.feverAura.setVisible(true).setPosition(this.ball.x, this.ball.y)
      if (now >= this.feverHudAt) {
        this.feverHudAt = now + 100
        const seconds = Math.ceil((this.feverUntil - now) / 1000)
        this.feverText.setText(`FEVER x${TUNING.streak.coinMultiplier} ${seconds}s`)
      }
      return
    }

    if (this.feverUntil !== 0) {
      this.feverUntil = 0
      this.feverAura.setVisible(false)
      this.feverText.setVisible(false)
    }
  }

  private isFever(): boolean {
    return this.feverUntil > this.time.now
  }

  private updateKickRing(): void {
    if (!FEATURES.kickRing) return

    const kickable = this.ball.vy >= -TUNING.kick.apexTolerance
    if (!kickable) {
      this.kickRing.setVisible(false)
      return
    }
    this.kickRing
      .setVisible(true)
      .setPosition(this.ball.x, this.ball.y)
      .setRotation(this.time.now / 2200)
      .setAlpha(0.55 + 0.35 * Math.sin(this.time.now / 180))
  }

  private updateTrail(): void {    const speed = Math.hypot(this.ball.vx, this.ball.vy)
    const now = this.time.now
    if (speed < 900 || now < this.trailAt) return

    this.trailAt = now + 45
    const ghost = this.trail[this.trailIndex]
    this.trailIndex = (this.trailIndex + 1) % this.trail.length
    if (!ghost) return

    this.tweens.killTweensOf(ghost)
    ghost.setPosition(this.ball.x, this.ball.y).setAlpha(0.16).setScale(0.9)
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.45,
      duration: 220,
      ease: 'Quad.out',
    })
  }

  private openPause(): void {
    if (this.dead || this.scene.isActive('Pause')) return
    this.bufferedTap = null
    audio.play('ui')
    this.scene.launch('Pause')
    this.scene.pause()
  }

  private popLabel(text: string, color: string, big: boolean, offsetY: number): void {
    const label = this.add
      .text(this.ball.x, this.ball.y - offsetY, text, {
        fontFamily: FONT_SANS,
        fontSize: big ? '30px' : '20px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setDepth(110)

    this.tweens.add({
      targets: label,
      y: label.y - 70,
      alpha: 0,
      scale: 1.12,
      duration: 900,
      ease: 'Quad.out',
      onComplete: () => label.destroy(),
    })
  }

  private showMiss(x: number, y: number): void {
    const ring = this.add
      .circle(x, y, 16, PALETTE.danger, 0)
      .setStrokeStyle(2, PALETTE.danger, 0.6)
      .setDepth(110)
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 280,
      ease: 'Quad.out',
      onComplete: () => ring.destroy(),
    })
  }

  private burst(x: number, y: number, color: number, count: number): void {    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2
      const piece = this.add.circle(x, y, 3, color, 0.9).setDepth(110)
      this.tweens.add({
        targets: piece,
        x: x + Math.cos(angle) * 74,
        y: y + Math.sin(angle) * 74,
        alpha: 0,
        scale: 0.4,
        duration: 430,
        ease: 'Quad.out',
        onComplete: () => piece.destroy(),
      })
    }
  }

  private die(): void {
    if (this.dead) return
    this.dead = true
    this.aiming = false
    this.bufferedTap = null
    this.aimedArmed = false
    this.magnetEndsAt = 0
    this.aimUi.hide()
    this.powerupHud.setAimed(false)
    this.powerupHud.setMagnet(false, 0, TUNING.powerup.magnetDurationMs)
    this.magnetAura.setVisible(false)
    this.feverUntil = 0
    this.feverAura.setVisible(false)
    this.feverText.setVisible(false)
    this.streakText.setVisible(false)
    this.kickRing.setVisible(false)
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
    const bestMeters = Math.max(save.bestMeters, whole)
    const totalCoins = save.totalCoins + this.coins
    if (bestMeters === save.bestMeters && this.coins === 0) return

    const next: SaveV1 = { ...save, bestMeters, totalCoins }
    this.registry.set('save', next)
    if (bestMeters > save.bestMeters) this.hud.setBest(bestMeters)
    const store = this.registry.get('saveStore') as SaveStore | undefined
    if (store) void store.save(next)
  }

  private showDeath(): void {
    if (!this.scene.isActive()) return
    const { width, height } = TUNING.world
    const save = this.registry.get('save') as SaveV1
    const isBest = this.wasBest

    const overlay = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
    const dim = this.add.rectangle(0, 0, width, height, PALETTE.bgSoft, 0.9).setOrigin(0)
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
    const coins = this.add
      .text(width / 2, height * 0.47, `+${this.coins} coins`, {
        fontFamily: FONT_MONO,
        fontSize: '18px',
        color: CSS_PALETTE.ball,
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
      alpha: { from: 1, to: 0.5 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })

    overlay.add([dim, title, score, coins, best, retry])
    dim.setScrollFactor(0)
    title.setScrollFactor(0)
    score.setScrollFactor(0)
    coins.setScrollFactor(0)
    best.setScrollFactor(0)
    retry.setScrollFactor(0)
    this.retryReady = true

    if (isBest) {
      this.time.delayedCall(250, () => audio.play('fever', { pitch: 1.2, volume: 0.7 }))
    }
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
    g.lineStyle(1, PALETTE.ink, 0.03)
    for (let y = offset - spacing; y < height + spacing; y += spacing) g.lineBetween(0, y, width, y)

    const strong = ((this.cameraY % strongSpacing) + strongSpacing) % strongSpacing
    g.lineStyle(1, PALETTE.accent, 0.06)
    for (let y = strong - strongSpacing; y < height + strongSpacing; y += strongSpacing)
      g.lineBetween(0, y, width, y)
  }
}
