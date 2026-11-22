import Phaser from 'phaser'
import { circleCircleHit } from '../../core/collision'
import { clamp } from '../../core/math'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** Folga além da tela para considerar um pássaro fora de cena. */
const SCREEN_MARGIN = 100
/** Componente vertical do desvio: sobe a bola, nunca causa dano. */
const DEFLECT_LIFT = -80
/** Intensidade de feedback do toque (shake/partículas da cena). */
const CONTACT_STRENGTH = 0.25
/** Batida de asa: meia-volta do tween em ms. */
const FLAP_MS = 180
const FLAP_MIN_SCALE = 0.8
const FLAP_MAX_SCALE = 1
/** Tremor/pisca curto do pássaro atingido. */
const REACT_MS = 55
const REACT_ANGLE = 7
const REACT_ALPHA = 0.55

interface FlockBird {
  readonly visual: Phaser.GameObjects.Container
  readonly wings: readonly Phaser.GameObjects.Line[]
  x: number
  y: number
  /** Já rompeu o atraso de entrada e pode ser tocado. */
  entered: boolean
  /** Continua em cena (não atravessou a tela). */
  active: boolean
  readonly entryDelayMs: number
}

/**
 * Birds / bando: atravessa a tela na horizontal e desvia a bola de leve.
 * A instância controla o grupo inteiro; o líder nasce em `spec.x` e os demais
 * entram escalonados, fechando a travessia dentro de `flockDurationMs`.
 */
export const createBirds: ObstacleFactory = (scene, spec) => {
  const o = TUNING.obstacle
  const direction = spec.direction
  const variation = clamp(spec.variation, 0, 1)
  const flockSize = Math.max(1, Math.round(o.flockSize))
  const width = o.birdWidth
  const height = o.birdHeight

  // O evento do bando dura ~flockDurationMs: a travessia de um pássaro consome
  // a maior parte desse tempo e a sobra vira atraso escalonado de entrada.
  const exitX = direction === 1 ? TUNING.world.width + SCREEN_MARGIN : -SCREEN_MARGIN
  const travelDistance = Math.abs(exitX - spec.x)
  const travelMs = o.birdSpeed > 0 ? (travelDistance / o.birdSpeed) * 1000 : 0
  const entryWindowMs = Math.max(0, o.flockDurationMs - travelMs)
  const entryStepMs = entryWindowMs / Math.max(1, flockSize - 1)

  // Formação compacta em V invertido: líder à frente, companheiros atrás em ±y.
  const rowSpread = height * (0.46 + variation * 0.12)
  const rowStep = width * (0.36 + variation * 0.08)
  const mirror = variation < 0.5 ? -1 : 1

  const root = scene.add.container(0, 0).setDepth(5)
  const bounds = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  const birds: FlockBird[] = []

  /** Silhueta: diamante com cauda entalhada, contorno escuro e olho. */
  function makeBody(): Phaser.GameObjects.Graphics {
    const body = scene.add.graphics()
    body.fillStyle(PALETTE.bird, 1)
    body.lineStyle(1.5, PALETTE.bg, 0.85)
    body.beginPath()
    body.moveTo(width * 0.5, 0)
    body.lineTo(width * 0.02, -height * 0.34)
    body.lineTo(-width * 0.44, -height * 0.15)
    body.lineTo(-width * 0.28, 0)
    body.lineTo(-width * 0.44, height * 0.15)
    body.lineTo(width * 0.02, height * 0.34)
    body.closePath()
    body.fillPath()
    body.strokePath()
    body.fillStyle(PALETTE.bg, 1)
    body.fillCircle(width * 0.2, -height * 0.06, 1.6)
    return body
  }

  /** Asa como linha; `sign` escolhe o lado do corpo (cima/baixo). */
  function makeWing(sign: 1 | -1): Phaser.GameObjects.Line {
    const wing = scene.add.line(
      0,
      0,
      0,
      sign * height * 0.1,
      -width * 0.32,
      sign * height * 0.62,
      PALETTE.ink,
      0.85,
    )
    wing.setOrigin(0, 0)
    wing.setLineWidth(2)
    return wing
  }

  /** Batida contínua: encolhe em Y e volta, com fase própria por asa. */
  function addFlap(wing: Phaser.GameObjects.Line, delay: number): void {
    wing.setScale(1, FLAP_MIN_SCALE)
    scene.tweens.add({
      targets: wing,
      scaleY: FLAP_MAX_SCALE,
      duration: FLAP_MS,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  for (let i = 0; i < flockSize; i += 1) {
    const row = Math.ceil(i / 2)
    const arm = i === 0 ? 0 : i % 2 === 1 ? -1 : 1
    const jitter = i === 0 ? 0 : Math.sin((i + 1) * 2.3 + variation * 7.1) * 2.5
    const x = spec.x - direction * row * rowStep
    const y = spec.y + arm * row * rowSpread * mirror + jitter

    // Cada pássaro é um Container em coordenadas de mundo; o root fica em (0, 0).
    const visual = scene.add.container(x, y).setScale(direction, 1)
    const upper = makeWing(-1)
    const lower = makeWing(1)
    visual.add([upper, lower, makeBody()])
    root.add(visual)

    const flapDelay = variation * 150 + i * 47
    addFlap(upper, flapDelay)
    addFlap(lower, flapDelay + 40)

    const active = i === 0
    visual.setVisible(active)

    birds.push({
      visual,
      wings: [upper, lower],
      x,
      y,
      entered: active,
      active,
      entryDelayMs: i * entryStepMs,
    })
  }

  /** União dos pássaros ativos; a cena usa para descarte e debug. */
  function syncBounds(): void {
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY

    for (const bird of birds) {
      if (!bird.active) continue
      const halfW = width / 2 + 2
      const halfH = height / 2 + 6
      left = Math.min(left, bird.x - halfW)
      right = Math.max(right, bird.x + halfW)
      top = Math.min(top, bird.y - halfH)
      bottom = Math.max(bottom, bird.y + halfH)
    }

    if (!Number.isFinite(left)) {
      bounds.setTo(0, 0, 0, 0)
      return
    }

    bounds.setTo(left, top, right - left, bottom - top)
  }

  let elapsedMs = 0
  let spent = false
  let destroyed = false
  let lastContactAt = Number.NEGATIVE_INFINITY
  let lastHit: FlockBird | null = null

  syncBounds()

  function update(dtSeconds: number): void {
    if (destroyed || spent) return

    const dt = Math.max(0, dtSeconds)
    elapsedMs += dt * 1000

    for (const bird of birds) {
      if (!bird.entered) {
        if (elapsedMs < bird.entryDelayMs) continue
        bird.entered = true
        bird.active = true
        bird.visual.setVisible(true)
      }

      if (!bird.active) continue

      bird.x += direction * o.birdSpeed * dt
      bird.visual.setPosition(bird.x, bird.y)

      if (bird.x < -SCREEN_MARGIN || bird.x > TUNING.world.width + SCREEN_MARGIN) {
        bird.active = false
        bird.visual.setVisible(false)
      }
    }

    syncBounds()

    if (birds.every((bird) => bird.entered && !bird.active)) spent = true
  }

  function contact(ball: BallLike): ObstacleContact | null {
    if (destroyed || spent) return null

    const now = performance.now()
    if (now - lastContactAt < o.contactCooldownMs) return null

    for (const bird of birds) {
      if (!bird.active) continue

      const hit = circleCircleHit(ball.x, ball.y, ball.r, bird.x, bird.y, o.birdRadius)
      if (!hit) continue

      lastContactAt = now
      lastHit = bird

      return {
        result: 'deflect',
        point: hit.point,
        impulse: { x: direction * o.birdDeflect, y: DEFLECT_LIFT },
        strength: CONTACT_STRENGTH,
      }
    }

    return null
  }

  function react(_contact: ObstacleContact): void {
    if (destroyed) return

    const bird = lastHit
    if (!bird || !bird.active) return

    // Só feedback visual no pássaro atingido: a trajetória do bando não muda.
    scene.tweens.killTweensOf(bird.visual)
    bird.visual.setAngle(0).setAlpha(1)
    scene.tweens.add({
      targets: bird.visual,
      angle: { from: -REACT_ANGLE, to: REACT_ANGLE },
      alpha: { from: 1, to: REACT_ALPHA },
      duration: REACT_MS,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (destroyed) return
        bird.visual.setAngle(0).setAlpha(1)
      },
    })
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    for (const bird of birds) {
      for (const wing of bird.wings) scene.tweens.killTweensOf(wing)
      scene.tweens.killTweensOf(bird.visual)
      bird.active = false
    }

    if (root.active) root.destroy(true)
  }

  return {
    kind: 'bird',
    root,
    bounds,
    get spent(): boolean {
      return spent
    },
    update,
    contact,
    react,
    destroy,
  }
}
