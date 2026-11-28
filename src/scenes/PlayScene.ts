import Phaser from 'phaser'
import {
  advanceFlightZoom,
  flightZoomTarget,
  kickZoomAmount,
  metersFromTop,
  ratchetCameraY,
  smoothCameraY,
  smoothZoom,
  type FlightZoomPhase,
} from '../core/camera'
import { barrierBounce, reflectVelocity, wallBounce } from '../core/collision'
import { resolveAim } from '../core/aim'
import {
  aimOffset,
  createBallSpin,
  kickSpin,
  stepBallSpin,
  type BallSpinState,
} from '../core/ball-spin'
import { difficultyStageAt, fallSpeedLimitAt } from '../core/difficulty'
import { InteractiveSpawner, interactiveRect } from '../core/interactive-spawner'
import { computeKick, isInsideBall, type KickResult } from '../core/kick'
import { rectFromBounds, type SpawnRect } from '../core/spawn-layout'
import { ObstacleSpawner, obstacleRect } from '../core/spawner'
import { StaminaMeter } from '../core/stamina'
import { kickBoostFor, StreakTracker, labelForCount, type StreakLabel } from '../core/streak'
import { consume, equippedIds } from '../core/shop'
import {
  ACTIVATABLE_IDS,
  nextMagnetEndsAt,
  type ActivatableId,
  type ConsumableId,
} from '../core/consumables'
import { GoalSpawner } from '../core/goal'
import { audio } from '../fx/audio'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { DEBUG_STATE } from '../game/debug-state'
import { FEATURES } from '../game/features'
import { gameEvents } from '../game/events'
import type { BallLike } from '../game/contracts'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import { createBallView, type BallView } from '../ui/ball'
import { ConsumableBar } from '../ui/consumable-bar'
import { createGoal, type GoalInstance } from '../objects/goal'
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
import { StaminaBar } from '../ui/stamina-bar'
import { BACKDROP_BLEED, drawBackdrop } from '../ui/backdrop'

type BallState = BallLike

/**
 * F1 — core loop: chute, catraca, paredes, morte e retry.
 * A física é integrada aqui (passo fixo por delta) e a regra de chute vive em core/kick.ts.
 */
export class PlayScene extends Phaser.Scene {
  private ball: BallState = { x: 0, y: 0, vx: 0, vy: 0, r: TUNING.ball.radius }
  private ballView!: Phaser.GameObjects.Container
  /** Arte da bola: container externo (glow/marcador) fica parado; só o padrão gira. */
  private ballArt!: BallView
  private ballSpin: BallSpinState = createBallSpin()
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
  /** Zoom contínuo da câmera (1 = normal; <1 = afastada no voo). */
  private zoom = 1
  /** Fase do recuo: abre no chute, fecha no ápice da bola. */
  private zoomPhase: FlightZoomPhase = 'idle'
  /** Recuo do último chute forte, aplicado enquanto a fase estiver `open`. */
  private shotWide = 0
  /** Teto de queda do estágio atual; sobe a cada `difficulty.stageMeters` de pico. */
  private fallSpeedLimit: number = TUNING.physics.maxFallSpeed
  /** Último estágio aplicado, para o aviso de ritmo disparar uma vez por degrau. */
  private difficultyStage = 0
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
  /** Duração ativa do Magnet (15 s no pickup do mundo, 45 s no consumível). */
  private magnetDurationMs: number = TUNING.powerup.magnetDurationMs
  private aiming = false
  private aimEndsAt = 0
  private aimPointer = { x: 0, y: 0 }
  private streak = new StreakTracker()
  /** Estamina: cada chute normal válido custa uma fatia; a exaustão bloqueia toques. */
  private stamina = new StaminaMeter()
  private staminaBar!: StaminaBar
  /** Camada cinza da exaustão: cobre o mundo (depth ≤ 11), não o HUD (100). */
  private exhaustOverlay!: Phaser.GameObjects.Rectangle
  /** Transição da exaustão: evita empilhar tween, som e aviso por toque bloqueado. */
  private exhaustionOverlayActive = false
  private exhaustionAnnounced = false
  private feverUntil = 0
  private feverAura!: Phaser.GameObjects.Arc
  private streakText!: Phaser.GameObjects.Text
  private feverText!: Phaser.GameObjects.Text
  /** Aviso curto quando o ritmo da queda sobe um degrau. */
  private paceText!: Phaser.GameObjects.Text
  private feverHudAt = 0
  private hitStopUntil = 0
  private trail: Phaser.GameObjects.Arc[] = []
  private trailIndex = 0
  private trailAt = 0
  private pauseRect = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  private kickRing!: Phaser.GameObjects.Container
  /** Toque que chegou um pouco antes do ápice; dispara quando a bola fica chutável. */
  private bufferedTap: { x: number; y: number; until: number; aimed: boolean } | null = null
  /** Consumíveis equipados e ainda com carga nesta run. */
  private runItems = new Set<ConsumableId>()
  /** Barra de ativáveis na tela; só os que o jogador trouxe. */
  private consumableBar!: ConsumableBar
  /** Chutão: ativado, o próximo chute válido vira um chute de 2750 u/s. */
  private chutaoArmed = false
  /** Streak Saver: ativado, o próximo whiff não zera o streak. */
  private streakSaverArmed = false
  /** Rede de proteção: salva a bola uma vez ao cruzar a linha de morte. */
  private netReady = false
  /** Escudo: janela com uma carga; o próximo contato com obstáculo vira quique para cima. */
  private shieldUntil = 0
  /** Ponto Doce: janela com Perfect ampliado e bônus maior. */
  private sweetUntil = 0
  private shieldAura!: Phaser.GameObjects.Arc
  private sweetMarker!: Phaser.GameObjects.Container
  private shieldHudAt = 0
  private sweetHudAt = 0
  private goalSpawner = new GoalSpawner()
  private goals: GoalInstance[] = []
  /** Área do botão SHOP na tela de morte, em coordenadas de tela. */
  private deathShopRect = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  /** Container de tela com contra-escala: mantém o HUD fixo sob o zoom. */
  private uiRoot!: Phaser.GameObjects.Container

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
    this.fallSpeedLimit = TUNING.physics.maxFallSpeed
    this.difficultyStage = 0
    this.lastWholeMeters = -1
    const seed = (Math.random() * 0xffffffff) >>> 0
    this.spawner.reset(seed)
    this.obstacles = []
    this.interactiveSpawner.reset(seed ^ 0x9e3779b9)
    this.interactives = []
    this.goalSpawner.reset(seed ^ 0x85ebca6b)
    this.goals = []
    this.aimedArmed = false
    this.magnetEndsAt = 0
    this.magnetHudAt = 0
    this.magnetDurationMs = TUNING.powerup.magnetDurationMs
    this.aiming = false
    this.aimEndsAt = 0
    this.streak.reset()
    this.stamina.reset()
    this.exhaustionOverlayActive = false
    this.exhaustionAnnounced = false
    this.feverUntil = 0
    this.feverHudAt = 0
    this.hitStopUntil = 0
    this.trail = []
    this.trailIndex = 0
    this.trailAt = 0
    this.bufferedTap = null
    const equipped = equippedIds(save)
    this.runItems = new Set(equipped)
    this.chutaoArmed = false
    this.streakSaverArmed = false
    this.netReady = this.runItems.has('net')
    this.shieldUntil = 0
    this.sweetUntil = 0
    this.shieldHudAt = 0
    this.sweetHudAt = 0
    this.deathShopRect.setTo(0, 0, 0, 0)
    this.ballSpin = createBallSpin()
    DEBUG_STATE.powerup = '—'

    this.cameras.main.setScroll(0, 0)
    // Retry/create sempre recomeçam em zoom 1, sem resíduo de chute anterior.
    this.zoom = 1
    this.zoomPhase = 'idle'
    this.shotWide = 0
    this.cameras.main.setZoom(1)

    drawBackdrop(this, { walls: true }).setScrollFactor(0).setDepth(0)
    this.grid = this.add.graphics().setDepth(1)
    this.parallax = new Parallax(this)

    // Scrim do topo: obstáculos somem atrás do HUD em vez de competir com ele.
    // Fica abaixo da bola e do rastro para o ápice em `camera.maxTop` não
    // escurecer o que o jogador precisa ver (o HUD continua acima, no depth 100).
    const scrim = this.add.graphics().setScrollFactor(0).setDepth(8)
    // Faixa sólida acima de y=0: no zoom out o topo do gradiente não pode
    // deixar a faixa descoberta (a cor é a mesma do início do gradiente).
    scrim.fillStyle(PALETTE.bgSoft, 0.9)
    scrim.fillRect(-BACKDROP_BLEED, -BACKDROP_BLEED, width + BACKDROP_BLEED * 2, BACKDROP_BLEED)
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
    // Só a largura transborda: o zoom out não deixa cantos sem scrim, e a
    // altura/fade permanecem idênticos em zoom 1 (fora da tela).
    scrim.fillRect(-BACKDROP_BLEED, 0, width + BACKDROP_BLEED * 2, 170)

    // Bola de futebol: textura gerada (icosaedro truncado) + halo dourado que
    // mantém a leitura da bola contra o céu claro.
    this.ballView = this.add.container(this.ball.x, this.ball.y).setDepth(10)
    const glow = this.add.circle(0, 0, TUNING.ball.radius + 18, PALETTE.ball, 0.09)
    this.sweetMarker = this.add
      .container(0, 0, [
        this.add.circle(0, 0, 12).setStrokeStyle(2, PALETTE.sweet, 0.9),
        this.add.circle(0, 0, 5, PALETTE.sweet, 1),
      ])
      .setVisible(false)
    this.ballArt = createBallView(this, TUNING.ball.radius)
    this.ballView.add([glow, this.ballArt, this.sweetMarker])

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

    // Estamina no topo direito; o cinza fica acima do mundo e abaixo do HUD.
    this.staminaBar = new StaminaBar(this)
    this.exhaustOverlay = this.add
      .rectangle(
        TUNING.world.width / 2,
        TUNING.world.height / 2,
        TUNING.world.width + BACKDROP_BLEED * 2,
        TUNING.world.height + BACKDROP_BLEED * 2,
        PALETTE.exhaust,
        1,
      )
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(90)
      .setVisible(false)

    this.powerupHud = new PowerupHud(this)
    this.aimUi = new AimUi(this)
    this.consumableBar = new ConsumableBar(
      this,
      ACTIVATABLE_IDS.filter((id) => this.runItems.has(id)),
      (id) => this.activateConsumable(id),
    )

    this.magnetAura = this.add
      .circle(0, 0, TUNING.powerup.magnetRadius, PALETTE.magnet, 0.1)
      .setStrokeStyle(2, PALETTE.magnet, 0.32)
      .setDepth(9)
      .setVisible(false)

    this.shieldAura = this.add
      .circle(0, 0, TUNING.ball.radius + 10, PALETTE.shield, 0.08)
      .setStrokeStyle(2, PALETTE.shield, 0.55)
      .setDepth(11)
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

    // Aviso de ritmo: fica abaixo do streak/febre, longe da bola.
    this.paceText = this.add
      .text(width / 2, 104, '', {
        fontFamily: FONT_SANS,
        fontSize: '12px',
        color: CSS_PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setScrollFactor(0)
      .setDepth(100)
      .setAlpha(0)

    // Rastro curto: leitura de velocidade sem custo por frame.
    for (let i = 0; i < 6; i += 1) {
      this.trail.push(
        this.add
          .circle(0, 0, TUNING.ball.radius * 0.75, PALETTE.ballPatch, 0)
          .setDepth(9),
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

    // HUD de tela: um container com contra-escala compensa o zoom da câmera.
    // Os filhos precisam de scrollFactor 1 para o hit-test do Phaser continuar
    // funcionando; o container é que fica preso à tela (scrollFactor 0).
    this.uiRoot = this.add.container(0, 0).setScrollFactor(0).setDepth(100)
    type ScreenObject = Phaser.GameObjects.GameObject &
      Phaser.GameObjects.Components.ScrollFactor &
      Phaser.GameObjects.Components.Depth
    for (const raw of [...this.children.list]) {
      const obj = raw as ScreenObject
      if (obj === this.uiRoot) continue
      if (obj.scrollFactorX !== 0 || obj.scrollFactorY !== 0) continue
      if (obj.depth < 100) continue
      this.uiRoot.add(obj)
      obj.setScrollFactor(1)
    }
    this.syncFixedUi()

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
    // O HUD acompanha o zoom do frame anterior antes de qualquer early return.
    this.syncFixedUi()
    if (this.dead) return

    const slow = (this.registry.get('timeScale') as number | undefined) ?? 1
    const dt = (Math.min(deltaMs, 50) / 1000) * slow

    // A barra recarrega também durante Aimed/hitstop: a exaustão é curta e o
    // jogador precisa ver a recarga ao mirar, sem depender da física da bola.
    this.stamina.update(dt)
    this.updateStaminaUi()

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
    this.updateGoals(dt)
    this.updateMagnet(dt)
    this.updateTimedPowerups()
    this.updateFever()
    this.updateKickRing()
    this.updateTrail()
    this.updateBallSpin(dt)
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
      this.fallSpeedLimit,
    )
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y < this.arcApexY) this.arcApexY = b.y

    if (b.x - r < wall) {
      b.x = wall + r
      b.vx = wallBounce(b.vx, 'left', TUNING.physics.wallRestitution)
      audio.play('wall', { pitch: 0.9 })
    } else if (b.x + r > TUNING.world.width - wall) {
      b.x = TUNING.world.width - wall - r
      b.vx = wallBounce(b.vx, 'right', TUNING.physics.wallRestitution)
      audio.play('wall', { pitch: 1.1 })
    }

    if (b.y - r > this.cameraY + TUNING.world.height) this.die()
  }

  private updateCamera(dt: number): void {
    const height = TUNING.world.height
    if (!this.started) {
      this.zoom = 1
      this.cameras.main.setZoom(1)
      this.syncFixedUi()
      return
    }

    const targetScroll = ratchetCameraY(this.cameraY, this.ball.y, height)
    this.cameraY = smoothCameraY(this.cameraY, targetScroll, dt, TUNING.camera.followSpeed)

    // Atrás da bola por um instante, mas nunca deixa a bola sair pelo topo.
    const maxTop = this.ball.y - height * TUNING.camera.maxTop
    this.cameraY = Math.min(this.cameraY, maxTop)

    this.cameras.main.setScroll(0, this.cameraY)

    // Zoom de transmissão: o chute abre rápido e proporcional à força; no ápice
    // (vy >= 0) a fase passa a `closing` e o recuo volta a 1 sem esperar a bola
    // descer. O alvo sempre parte do zoom atual — um chute novo nunca pisca.
    this.zoomPhase = advanceFlightZoom(this.zoomPhase, this.ball.vy)
    const zoomTarget = flightZoomTarget(this.zoomPhase, this.shotWide)
    const speed =
      zoomTarget < this.zoom ? TUNING.camera.zoomOpenSpeed : TUNING.camera.zoomCloseSpeed
    this.zoom = smoothZoom(this.zoom, zoomTarget, dt, speed)
    this.cameras.main.setZoom(this.zoom)
    this.syncFixedUi()
  }

  /** Recuo do próximo voo, proporcional à força do chute. */
  private noteKick(power: number): void {
    this.shotWide = kickZoomAmount(power)
    // Chute fraco não mexe na câmera; qualquer recuo redefine a fase de abertura,
    // inclusive no meio de um fechamento (sem reset do zoom atual).
    if (this.shotWide > 0) this.zoomPhase = 'open'
  }

  /** Contra-escala do HUD: a tela continua com o mesmo tamanho e posição. */
  private syncFixedUi(): void {
    if (!this.uiRoot) return
    const { width, height } = TUNING.world
    if (Math.abs(this.zoom - 1) < 1e-4) {
      this.uiRoot.setScale(1).setPosition(0, 0)
      return
    }
    const s = 1 / this.zoom
    this.uiRoot.setScale(s).setPosition((width / 2) * (1 - s), (height / 2) * (1 - s))
  }

  private updateAltitude(): void {
    this.minY = Math.min(this.minY, this.ball.y)
    this.meters = this.started ? metersFromTop(this.startY, this.minY) : 0
    const whole = Math.floor(this.meters)
    if (whole !== this.lastWholeMeters) {
      this.lastWholeMeters = whole
      this.hud.setMeters(whole)
    }
    this.updateDifficulty()
  }

  /** Aplica o degrau de ritmo quando o pico da run cruza um múltiplo de 500 m. */
  private updateDifficulty(): void {
    const stage = difficultyStageAt(this.meters)
    if (stage === this.difficultyStage) return

    const limit = fallSpeedLimitAt(this.meters)
    const increased = limit > this.fallSpeedLimit
    this.difficultyStage = stage
    this.fallSpeedLimit = limit
    if (increased) this.showPaceStep()
  }

  private showPaceStep(): void {
    this.paceText.setText('FASTER FALLS').setAlpha(0)
    this.tweens.killTweensOf(this.paceText)
    this.tweens.add({
      targets: this.paceText,
      alpha: { from: 0, to: 1 },
      duration: 160,
      hold: 900,
      yoyo: true,
      ease: 'Quad.out',
    })
  }

  /**
   * Rects ocupados pelas entidades vivas (spent não colide mais). Alimenta os
   * três spawners na ordem obstáculos → interativos → gols; cada lote acrescenta
   * o que aceitou para os lotes seguintes verem.
   */
  private collectOccupied(): SpawnRect[] {
    const out: SpawnRect[] = []
    const add = (bounds: Phaser.Geom.Rectangle): void => {
      if (bounds.width > 0 && bounds.height > 0) out.push(rectFromBounds(bounds))
    }
    for (const obstacle of this.obstacles) if (!obstacle.spent) add(obstacle.bounds)
    for (const item of this.interactives) if (!item.spent) add(item.bounds)
    for (const goal of this.goals) add(goal.bounds)
    return out
  }

  private updateObstacles(dt: number): void {
    const time = this.time.now
    const occupied = this.collectOccupied()
    const specs = this.spawner.update(
      {
        cameraTop: this.cameraY,
        meters: this.meters,
        ballX: this.ball.x,
      },
      occupied,
    )

    for (const spec of specs) {
      occupied.push(obstacleRect(spec))
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
    // Escudo: o próximo contato vira um quique amigável para cima e ignora
    // o efeito original (quique da barreira, estilhaço ou desvio). A carga é
    // gasta aqui.
    if (this.tryShieldSave(obstacle, contact)) return

    switch (contact.result) {
      case 'reflect': {
        if (contact.normal) {
          const reflected = reflectVelocity(
            this.ball.vx,
            this.ball.vy,
            contact.normal,
            contact.restitution ?? TUNING.physics.wallRestitution,
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
      case 'bounce': {
        // A barreira nunca drena: devolve a bola para cima e para o lado, e
        // empurra para fora da hitbox para não deixá-la presa no grupo.
        const bounced = barrierBounce(this.ball.vx, this.ball.vy, contact.side ?? 1)
        this.ball.vx = bounced.vx
        this.ball.vy = bounced.vy
        if (contact.normal) {
          const push = (contact.penetration ?? 0) + 2
          this.ball.x += contact.normal.x * push
          this.ball.y += contact.normal.y * push
        }
        audio.play('damp', { pitch: 1.05 })
        this.cameras.main.shake(60, TUNING.fx.shakeHard * contact.strength * 0.6)
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
    const occupied = this.collectOccupied()
    const specs = this.interactiveSpawner.update(
      {
        cameraTop: this.cameraY,
        meters: this.meters,
      },
      occupied,
    )

    for (const spec of specs) {
      occupied.push(interactiveRect(spec))
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

  private updateGoals(dt: number): void {
    const occupied = this.collectOccupied()
    const spec = this.goalSpawner.update(
      {
        cameraTop: this.cameraY,
        meters: this.meters,
        ballX: this.ball.x,
      },
      occupied,
    )
    if (spec) {
      occupied.push({
        cx: spec.x,
        cy: spec.y,
        width: spec.width,
        height: spec.height,
      })
      this.goals.push(createGoal(this, spec))
    }

    for (let i = this.goals.length - 1; i >= 0; i -= 1) {
      const goal = this.goals[i]
      if (!goal) continue
      goal.update(dt, this.time.now)

      if (goal.tryScore(this.ball)) this.scoreGoal(goal)

      const contact = goal.contact(this.ball)
      if (contact) {
        if (contact.normal) {
          const reflected = reflectVelocity(
            this.ball.vx,
            this.ball.vy,
            contact.normal,
            contact.restitution ?? TUNING.physics.wallRestitution,
          )
          this.ball.vx = reflected.vx
          this.ball.vy = reflected.vy
          const push = (contact.penetration ?? 0) + 1
          this.ball.x += contact.normal.x * push
          this.ball.y += contact.normal.y * push
        }
        goal.react(contact)
        audio.play('wall', { pitch: 0.72, volume: 0.85 })
        this.cameras.main.shake(60, TUNING.fx.shakeHard * contact.strength)
        gameEvents.emit('obstacleContact', {
          x: contact.point.x,
          y: contact.point.y,
          kind: 'goal',
          result: 'reflect',
          strength: contact.strength,
        })
      }

      const belowScreen =
        goal.bounds.y - this.cameraY >
        TUNING.world.height + TUNING.obstacle.despawnMargin
      if (belowScreen) {
        goal.destroy()
        this.goals.splice(i, 1)
      }
    }
  }

  private scoreGoal(goal: GoalInstance): void {
    const value = this.addCoins(TUNING.goal.coinBonus)
    this.popLabel('GOAL!', CSS_PALETTE.accent, true, 120)
    audio.play('fever', { pitch: 1.25, volume: 0.8 })
    this.cameras.main.flash(120, 255, 245, 210)
    this.burst(goal.root.x, goal.root.y, PALETTE.goal, 12)
    this.burst(goal.root.x, goal.root.y, PALETTE.accent, 6)
    gameEvents.emit('goal', { x: goal.root.x, y: goal.root.y, coins: value })
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
          this.activateMagnet()
        } else if (contact.pickup === 'aimed') {
          this.aimedArmed = true
          this.powerupHud.setAimed(true)
        } else if (contact.pickup === 'shield') {
          this.activateShield()
        } else if (contact.pickup === 'sweet') {
          this.activateSweet()
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
        this.powerupHud.setMagnet(true, this.magnetEndsAt - now, this.magnetDurationMs)
      }
      return
    }

    if (this.magnetEndsAt !== 0) {
      this.magnetEndsAt = 0
      this.magnetAura.setVisible(false)
      this.powerupHud.setMagnet(false, 0, this.magnetDurationMs)
    }
  }

  private handlePointerDown(x: number, y: number): void {
    // O HUD está fixo na tela, mas o ponteiro chega em coordenadas de mundo:
    // projeta na tela visual (com o zoom) antes de testar as zonas do HUD.
    const { width, height } = TUNING.world
    const screenX = (x - width / 2) * this.zoom + width / 2
    const screenY = (y - this.cameraY - height / 2) * this.zoom + height / 2

    if (this.dead) {
      if (this.retryReady) {
        if (Phaser.Geom.Rectangle.Contains(this.deathShopRect, screenX, screenY)) return
        this.retry()
      }
      return
    }
    if (this.aiming) return
    if (this.consumableBar.contains(screenX, screenY)) return
    if (Phaser.Geom.Rectangle.Contains(this.pauseRect, screenX, screenY)) return

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

    // Aimed Shot é powerup: permitido na exaustão e sem gasto de estamina —
    // não chama applyKick, então não passa pelo custo nem pelo bloqueio.
    const shot = resolveAim(this.ball, this.aimPointer, timedOut)
    this.aiming = false
    this.aimUi.hide()

    this.ball.vx = shot.dir.x * shot.speed
    this.ball.vy = shot.dir.y * shot.speed
    this.noteKick(shot.ratio)
    this.ballSpin.residual = kickSpin(aimOffset(shot.dir.x), shot.ratio)
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

  private activateMagnet(duration: number = TUNING.powerup.magnetDurationMs): void {
    const endsAt = nextMagnetEndsAt(this.time.now, this.magnetEndsAt, duration)
    if (endsAt === this.magnetEndsAt) return
    this.magnetDurationMs = duration
    this.magnetEndsAt = endsAt
    this.magnetHudAt = 0
    this.magnetAura.setVisible(true)
    this.powerupHud.setMagnet(true, duration, duration)
  }

  private activateShield(): void {
    this.shieldUntil = this.time.now + TUNING.powerup.shieldDurationMs
    this.shieldHudAt = 0
    this.shieldAura.setVisible(true).setPosition(this.ball.x, this.ball.y)
    this.powerupHud.setShield(
      true,
      TUNING.powerup.shieldDurationMs,
      TUNING.powerup.shieldDurationMs,
    )
    this.popLabel('SHIELD!', CSS_PALETTE.shield, true, 92)
    this.cameras.main.flash(100, 210, 232, 255)
    this.burst(this.ball.x, this.ball.y, PALETTE.shield, 8)
  }

  private activateSweet(): void {
    this.sweetUntil = this.time.now + TUNING.powerup.sweetDurationMs
    this.sweetHudAt = 0
    this.sweetMarker.setVisible(true)
    this.powerupHud.setSweet(
      true,
      TUNING.powerup.sweetDurationMs,
      TUNING.powerup.sweetDurationMs,
    )
    this.popLabel('SWEET SPOT!', CSS_PALETTE.sweet, true, 92)
    this.cameras.main.flash(90, 255, 220, 244)
    this.burst(this.ball.x, this.ball.y, PALETTE.sweet, 8)
  }

  /**
   * Escudo: consome a carga no primeiro contato com obstáculo e devolve a bola
   * para cima, sem aplicar o efeito original (quique, estilhaço ou desvio).
   */
  private tryShieldSave(
    obstacle: ObstacleInstance,
    contact: ObstacleContact,
  ): boolean {
    if (this.shieldUntil <= this.time.now) return false

    this.shieldUntil = 0
    this.shieldAura.setVisible(false)
    this.powerupHud.setShield(false, 0, TUNING.powerup.shieldDurationMs)
    if (contact.normal) {
      const push = (contact.penetration ?? 0) + 2
      this.ball.x += contact.normal.x * push
      this.ball.y += contact.normal.y * push
    }
    this.ball.vy = TUNING.powerup.shieldRescueVy
    this.arcApexY = this.ball.y
    this.bufferedTap = null
    this.popLabel('SAFE', CSS_PALETTE.shield, true, 88)
    audio.play('perfect', { pitch: 1.3, volume: 0.75 })
    this.cameras.main.flash(90, 210, 232, 255)
    this.burst(this.ball.x, this.ball.y, PALETTE.shield, 7)
    obstacle.react({ ...contact, result: 'reflect' })
    gameEvents.emit('obstacleContact', {
      x: contact.point.x,
      y: contact.point.y,
      kind: obstacle.kind,
      result: 'reflect',
      strength: contact.strength,
    })
    return true
  }

  /** Mantém os chips de escudo/ponto doce e a aura presos à bola. */
  private updateTimedPowerups(): void {
    const now = this.time.now

    if (this.shieldUntil > now) {
      this.shieldAura.setVisible(true).setPosition(this.ball.x, this.ball.y)
      if (now >= this.shieldHudAt) {
        this.shieldHudAt = now + 100
        this.powerupHud.setShield(
          true,
          this.shieldUntil - now,
          TUNING.powerup.shieldDurationMs,
        )
      }
    } else if (this.shieldUntil !== 0) {
      this.shieldUntil = 0
      this.shieldAura.setVisible(false)
      this.powerupHud.setShield(false, 0, TUNING.powerup.shieldDurationMs)
    }

    if (this.sweetUntil > now) {
      this.sweetMarker.setVisible(true)
      const pulse = 1 + 0.14 * Math.sin(now / 120)
      this.sweetMarker.setScale(pulse)
      if (now >= this.sweetHudAt) {
        this.sweetHudAt = now + 100
        this.powerupHud.setSweet(
          true,
          this.sweetUntil - now,
          TUNING.powerup.sweetDurationMs,
        )
      }
    } else if (this.sweetUntil !== 0) {
      this.sweetUntil = 0
      this.sweetMarker.setVisible(false)
      this.powerupHud.setSweet(false, 0, TUNING.powerup.sweetDurationMs)
    }
  }

  /** Itens que a barra deve mostrar: cargas não usadas + armados aguardando efeito. */
  private barItems(): ActivatableId[] {
    const visible = new Set<ActivatableId>()
    for (const id of ACTIVATABLE_IDS) {
      if (this.runItems.has(id)) visible.add(id)
    }
    if (this.chutaoArmed) visible.add('chutao')
    if (this.streakSaverArmed) visible.add('streak')
    return ACTIVATABLE_IDS.filter((id) => visible.has(id))
  }

  /**
   * Toque no ícone da barra: gasta a unidade e aplica o efeito. Chutão e
   * Streak Saver ficam "armados" até o próximo chute/whiff; o ícone permanece
   * na barra com anel pulsante até o efeito disparar.
   */
  private activateConsumable(id: ActivatableId): void {
    if (this.dead || this.aiming) return
    if (!this.runItems.has(id)) return

    if (id === 'chutao') this.chutaoArmed = true
    if (id === 'streak') this.streakSaverArmed = true
    this.consumeRunItem(id)
    this.consumableBar.refresh(this.barItems())

    switch (id) {
      case 'magnet':
        this.activateMagnet(TUNING.consumable.magnetDurationMs)
        this.popLabel('MAGNET!', CSS_PALETTE.inkDim, true, 92)
        audio.play('pickup')
        break
      case 'chutao':
        this.consumableBar.setArmed('chutao', true)
        this.popLabel('POWER KICK READY', CSS_PALETTE.accent, false, 84)
        audio.play('ui', { pitch: 1.4 })
        break
      case 'streak':
        this.consumableBar.setArmed('streak', true)
        this.popLabel('STREAK SAFE READY', CSS_PALETTE.fever, false, 84)
        audio.play('ui', { pitch: 1.2 })
        break
    }
    gameEvents.emit('consumable', { id })
  }

  /** Gasta uma unidade equipada e persiste. O item sai do pool desta run. */
  private consumeRunItem(id: ConsumableId): void {
    if (!this.runItems.delete(id)) return
    if (id === 'net') this.netReady = false

    const save = this.registry.get('save') as SaveV1
    const next = consume(save, id)
    if (next === save) return
    this.registry.set('save', next)
    const store = this.registry.get('saveStore') as SaveStore | undefined
    if (store) void store.save(next)
  }

  /**
   * Chutão: depois de ativado, o próximo chute válido usa `chutaoSpeed`,
   * mantendo o ângulo do ponto de toque. Whiff e toque antes do ápice não
   * gastam a carga; só um chute de verdade dispara.
   */
  private computeTapKick(x: number, y: number): KickResult {
    const chutao = this.chutaoArmed
    const sweet = this.sweetUntil > this.time.now
    const result = computeKick(this.ball, { x, y }, {
      fallDistance: this.fallDistance(),
      overrideSpeed: chutao ? TUNING.consumable.chutaoSpeed : undefined,
      // Streak ANTES do chute atual; o Chutão ignora o multiplicador e o
      // AimedShot não passa por aqui (usa a própria curva de mira).
      speedMultiplier: 1 + kickBoostFor(this.streak.count),
      perfectWindow: sweet
        ? TUNING.kick.perfectWindow * TUNING.powerup.sweetWindowScale
        : undefined,
      perfectBonus: sweet
        ? TUNING.perfect.speedBonus * TUNING.powerup.sweetBonusScale
        : undefined,
    })
    if (result.kind === 'kick' && chutao) {
      this.chutaoArmed = false
      this.consumableBar.refresh(this.barItems())
      this.consumableBar.setArmed('chutao', false)
      this.showChutao()
    }
    return result
  }

  private showChutao(): void {
    this.popLabel('CHUTÃO!', CSS_PALETTE.accent, true, 100)
    audio.play('perfect', { pitch: 0.8, volume: 1 })
    this.cameras.main.shake(120, 0.007)
    this.cameras.main.flash(90, 255, 245, 210)
  }

  /**
   * Avança a rotação visual da bola a partir do `vx` atual e do residual do
   * chute. Só a camada de padrão gira: o glow e o marcador de Ponto Doce são
   * irmãos no container externo e continuam parados (e o squash usa o
   * container externo, não esta rotação).
   */
  private updateBallSpin(dt: number): void {
    stepBallSpin(this.ballSpin, this.ball.vx, dt)
    this.ballArt.pattern.setRotation(this.ballSpin.angle)
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
    DEBUG_STATE.stamina = this.stamina.ratio * 100
    DEBUG_STATE.staminaExhausted = this.stamina.exhausted
    DEBUG_STATE.kickBoost = kickBoostFor(this.streak.count) * 100
    DEBUG_STATE.fallSpeedLimit = this.fallSpeedLimit
    DEBUG_STATE.difficultyStage = this.difficultyStage
    DEBUG_STATE.powerup = this.aiming
      ? 'aiming'
      : this.magnetEndsAt > this.time.now
        ? 'magnet'
        : this.aimedArmed
          ? 'aimed'
          : this.shieldUntil > this.time.now
            ? 'shield'
            : this.sweetUntil > this.time.now
              ? 'sweet'
              : '—'
    DEBUG_STATE.extra = `obs ${this.obstacles.length} · itv ${this.interactives.length} · goal ${this.goals.length} · items ${[...this.runItems].join(',') || '—'}`
  }

  private handleTap(x: number, y: number): void {
    if (this.dead) {
      if (this.retryReady) this.retry()
      return
    }
    // O Aimed Shot é powerup: beginAim/fireAim não passam por aqui e seguem
    // disponíveis na exaustão, sem gastar estamina. Aqui só há chute normal.
    if (this.stamina.exhausted) {
      this.onBlockedTap()
      return
    }
    this.bufferedTap = null

    const result = this.computeTapKick(x, y)
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

  /**
   * Toque normal durante a exaustão: não compute chute, não registra whiff,
   * não quebra streak e não gasta Chutão. Só feedback — a própria barra já
   * mostra `EXHAUSTED` e a tela está cinza.
   */
  private onBlockedTap(): void {
    this.staminaBar.bump()
    this.updateStaminaUi()
    this.announceExhausted()
    audio.play('ui', { pitch: 0.4, volume: 0.5 })
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

    // O toque guardado era para abrir a mira: não passa pela curva de chute
    // (nem consome Chutão) antes de armar o estilingue.
    if (buffered.aimed && this.aimedArmed) {
      const touch = { ...this.ball, r: TUNING.kick.touchRadius }
      if (!isInsideBall(touch, { x: buffered.x, y: buffered.y })) {
        this.bufferedTap = null
        return
      }
      if (this.ball.vy < -TUNING.kick.apexTolerance) return
      this.bufferedTap = null
      this.beginAim(buffered.x, buffered.y)
      return
    }

    // Exaustão descarta o toque guardado antes de qualquer compute (logo, sem
    // whiff, sem quebra de streak e sem consumo de Chutão).
    if (this.stamina.exhausted) {
      this.bufferedTap = null
      this.onBlockedTap()
      return
    }

    const result = this.computeTapKick(buffered.x, buffered.y)
    if (result.kind !== 'kick') {
      // Se a bola se afastou do toque guardado, desiste em vez de chutar longe.
      if (result.reason === 'miss') this.bufferedTap = null
      return
    }

    this.bufferedTap = null
    this.applyKick(result)
  }

  /** Queda desde o ápice; alimenta a curva de força do próximo chute. */
  private fallDistance(): number {
    return Math.max(0, this.ball.y - this.arcApexY)
  }

  private applyKick(result: KickResult): void {
    // Última barreira: handleTap/resolveBufferedTap já checam a exaustão antes
    // do compute, então um blocked aqui não pode ter gasto o Chutão.
    const spend = this.stamina.spendKick()
    if (spend.blocked) {
      this.staminaBar.bump()
      this.updateStaminaUi()
      return
    }
    this.updateStaminaUi()
    // O chute que zerou a barra ainda é aplicado; a exaustão começa depois.
    if (spend.justExhausted) this.startExhaustion()

    this.ball.vx = result.vx
    this.ball.vy = result.vy
    this.noteKick(result.power)
    this.ballSpin.residual = kickSpin(result.offset, result.power)
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

  /** Um aviso por exaustão, nunca um `EXHAUSTED` a cada toque bloqueado. */
  private announceExhausted(): void {
    if (this.exhaustionAnnounced) return
    this.exhaustionAnnounced = true
    this.popLabel('EXHAUSTED', CSS_PALETTE.danger, false, 46)
  }

  private startExhaustion(): void {
    this.announceExhausted()
    if (this.exhaustionOverlayActive) return
    this.exhaustionOverlayActive = true
    this.tweens.killTweensOf(this.exhaustOverlay)
    this.exhaustOverlay.setVisible(true)
    this.tweens.add({
      targets: this.exhaustOverlay,
      alpha: { from: this.exhaustOverlay.alpha, to: 0.36 },
      duration: 180,
      ease: 'Quad.out',
    })
    audio.play('damp', { pitch: 0.7, volume: 0.6 })
  }

  private endExhaustion(): void {
    this.exhaustionOverlayActive = false
    this.exhaustionAnnounced = false
    this.tweens.killTweensOf(this.exhaustOverlay)
    this.tweens.add({
      targets: this.exhaustOverlay,
      alpha: 0,
      duration: 220,
      ease: 'Quad.out',
      onComplete: () => this.exhaustOverlay.setVisible(false),
    })
  }

  /** Reflete a recarga mesmo durante Aimed/hitstop e detecta as transições. */
  private updateStaminaUi(): void {
    this.staminaBar.set(this.stamina.ratio, this.stamina.exhausted, this.time.now)
    if (this.stamina.exhausted && !this.exhaustionOverlayActive) this.startExhaustion()
    else if (!this.stamina.exhausted && this.exhaustionOverlayActive) this.endExhaustion()
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
    if (this.streakSaverArmed) {
      this.streakSaverArmed = false
      this.consumableBar.refresh(this.barItems())
      this.consumableBar.setArmed('streak', false)
      this.popLabel('STREAK SAFE', CSS_PALETTE.fever, false, 62)
      audio.play('fever', { pitch: 1.4, volume: 0.5 })
      this.burst(this.ball.x, this.ball.y, PALETTE.fever, 6)
      return
    }
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
    const boost = kickBoostFor(count) * 100
    this.streakText.setColor(tier ? this.labelColor(tier) : CSS_PALETTE.inkDim)
    this.streakText.setText(
      tier
        ? `STREAK ${count} · ${tier} · +${boost.toFixed(1)}%`
        : `STREAK ${count} · +${boost.toFixed(1)}%`,
    )
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
    // Rede de proteção: só vale depois de a run ter começado. Se o jogador
    // nunca tocou, não gasta o consumível.
    if (this.netReady && this.started) {
      this.saveWithNet()
      return
    }
    this.dead = true
    // Morte/retry não herdam zoom nem fase do chute anterior.
    this.zoom = 1
    this.zoomPhase = 'idle'
    this.shotWide = 0
    this.cameras.main.setZoom(1)
    this.syncFixedUi()
    this.aiming = false
    this.bufferedTap = null
    this.aimedArmed = false
    this.magnetEndsAt = 0
    this.aimUi.hide()
    this.powerupHud.setAimed(false)
    this.powerupHud.setMagnet(false, 0, this.magnetDurationMs)
    this.powerupHud.setShield(false, 0, TUNING.powerup.shieldDurationMs)
    this.powerupHud.setSweet(false, 0, TUNING.powerup.sweetDurationMs)
    this.magnetAura.setVisible(false)
    this.shieldAura.setVisible(false)
    this.shieldUntil = 0
    this.sweetUntil = 0
    this.sweetMarker.setVisible(false)
    this.consumableBar.refresh([])
    this.chutaoArmed = false
    this.streakSaverArmed = false
    this.feverUntil = 0
    this.feverAura.setVisible(false)
    this.feverText.setVisible(false)
    this.streakText.setVisible(false)
    this.kickRing.setVisible(false)
    // Exaustão não acompanha a bola morta; o retry reconstrói a cena.
    this.staminaBar.setVisible(false)
    this.tweens.killTweensOf(this.exhaustOverlay)
    this.exhaustOverlay.setVisible(false).setAlpha(0)
    this.exhaustionOverlayActive = false
    this.exhaustionAnnounced = false
    this.stamina.reset()
    audio.play('death')
    this.cameras.main.shake(180, 0.006)
    const save = this.registry.get('save') as SaveV1
    this.wasBest = this.meters > save.bestMeters
    this.persistBest()
    this.time.delayedCall(TUNING.run.deathDelayMs, () => this.showDeath())
  }

  private saveWithNet(): void {
    this.netReady = false
    this.consumeRunItem('net')
    this.ball.x = TUNING.world.width / 2
    this.ball.y = this.cameraY + TUNING.world.height - TUNING.consumable.netRescueY
    this.ball.vx = 0
    this.ball.vy = -TUNING.consumable.netLaunchSpeed
    this.arcApexY = this.ball.y
    this.bufferedTap = null
    this.popLabel('SAVED!', CSS_PALETTE.accent, true, 90)
    audio.play('fever', { pitch: 1.1, volume: 0.8 })
    this.cameras.main.flash(140, 232, 238, 252)
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
    const dim = this.add.rectangle(0, 0, width, height, PALETTE.bgSoft, 0.98).setOrigin(0)
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

    // Loja na tela de morte: as moedas da run já foram persistidas em die().
    const shopY = height * 0.8
    const shopWidth = 180
    const shopHeight = 50
    const shopBg = this.add.graphics()
    shopBg.fillStyle(PALETTE.bgSoft, 0.95)
    shopBg.fillRoundedRect(
      width / 2 - shopWidth / 2,
      shopY - shopHeight / 2,
      shopWidth,
      shopHeight,
      10,
    )
    shopBg.lineStyle(2, PALETTE.accent, 0.9)
    shopBg.strokeRoundedRect(
      width / 2 - shopWidth / 2,
      shopY - shopHeight / 2,
      shopWidth,
      shopHeight,
      10,
    )
    const shopText = this.add
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
      .setScrollFactor(0)
      .setDepth(51)
      .setInteractive({ useHandCursor: true })
    shopZone.on('pointerup', () => {
      if (!this.retryReady) return
      audio.play('ui')
      this.scene.start('Shop')
    })
    this.deathShopRect.setTo(
      width / 2 - shopWidth / 2,
      shopY - shopHeight / 2,
      shopWidth,
      shopHeight,
    )

    overlay.add([dim, title, score, coins, best, retry, shopBg, shopText])
    dim.setScrollFactor(0)
    title.setScrollFactor(0)
    score.setScrollFactor(0)
    coins.setScrollFactor(0)
    best.setScrollFactor(0)
    retry.setScrollFactor(0)
    shopBg.setScrollFactor(0)
    shopText.setScrollFactor(0)
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
    for (let y = offset - spacing; y < height; y += spacing) {
      if (y >= 0) g.lineBetween(0, y, width, y)
    }

    const strong = ((this.cameraY % strongSpacing) + strongSpacing) % strongSpacing
    g.lineStyle(1, PALETTE.accent, 0.06)
    for (let y = strong - strongSpacing; y < height; y += strongSpacing) {
      if (y >= 0) g.lineBetween(0, y, width, y)
    }
  }
}
