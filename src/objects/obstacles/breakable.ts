import Phaser from 'phaser'
import { circleRectHit } from '../../core/collision'
import { clamp } from '../../core/math'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** Vão entre os blocos da barra, em unidades de mundo. */
const BLOCK_GAP = 4
const BLOCK_COUNT = 3
const CORNER_RADIUS = 4

/** Tempo do sumiço da barra depois de romper. */
const SHATTER_MS = 120
/** Movimento dos estilhaços; o fade começa depois de ~500 ms. */
const FRAGMENT_LIFESPAN_MS = 520
const FRAGMENT_FADE_START_MS = 500
const FRAGMENT_FADE_MS = 140
/** Gravidade visual leve dos estilhaços. */
const FRAGMENT_GRAVITY = 900

const BASE_COLOR = Phaser.Display.Color.ValueToColor(PALETTE.breakable)
const LIGHT_COLOR = Phaser.Display.Color.GetColor(
  Math.min(255, BASE_COLOR.red + 34),
  Math.min(255, BASE_COLOR.green + 26),
  Math.min(255, BASE_COLOR.blue + 18),
)
const DARK_COLOR = Phaser.Display.Color.GetColor(
  Math.max(0, BASE_COLOR.red - 30),
  Math.max(0, BASE_COLOR.green - 24),
  Math.max(0, BASE_COLOR.blue - 18),
)
const CRACK_COLOR = Phaser.Display.Color.GetColor(
  Math.round(BASE_COLOR.red * 0.32),
  Math.round(BASE_COLOR.green * 0.3),
  Math.round(BASE_COLOR.blue * 0.28),
)
const FRAGMENT_COLORS = [PALETTE.breakable, LIGHT_COLOR, DARK_COLOR] as const

/**
 * Breakable: barra segmentada que a bola veloz estilhaça e atravessa.
 * Bola lenta quica de volta com tremor e rachadura.
 */
export const createBreakable: ObstacleFactory = (scene, spec) => {
  const width = spec.width
  const height = spec.height
  const bounds = new Phaser.Geom.Rectangle(
    spec.x - width / 2,
    spec.y - height / 2,
    width,
    height,
  )

  const root = scene.add.container(spec.x, spec.y).setDepth(5)
  const bar = scene.add.graphics()
  const crackLayer = scene.add.graphics()
  root.add([bar, crackLayer])

  const blockWidth = Math.max(1, (width - BLOCK_GAP * (BLOCK_COUNT - 1)) / BLOCK_COUNT)
  const radius = Math.min(CORNER_RADIUS, height / 2, blockWidth / 2)
  const top = -height / 2

  for (let i = 0; i < BLOCK_COUNT; i += 1) {
    const x = -width / 2 + i * (blockWidth + BLOCK_GAP)
    const phase = (spec.variation * 9.13 + i * 0.41) % 1

    bar.fillStyle(PALETTE.breakable, 1)
    bar.fillRoundedRect(x, top, blockWidth, height, radius)

    // Brilho no topo e sombra na base dão volume sem sair da paleta.
    bar.lineStyle(1, LIGHT_COLOR, 0.6)
    bar.lineBetween(x + radius, top + 1, x + blockWidth - radius, top + 1)
    bar.lineStyle(1, 0x000000, 0.22)
    bar.lineBetween(x + radius, top + height - 1, x + blockWidth - radius, top + height - 1)
    bar.lineStyle(1, DARK_COLOR, 0.75)
    bar.strokeRoundedRect(x + 0.5, top + 0.5, blockWidth - 1, height - 1, radius)

    // Rachadura fina permanente: lê como "quebrável" antes do impacto.
    const crackX = x + blockWidth * (0.28 + phase * 0.44)
    bar.lineStyle(1, CRACK_COLOR, 0.4)
    bar.beginPath()
    bar.moveTo(crackX - 2, top + height * 0.25)
    bar.lineTo(crackX + 1.5, top + height * 0.5)
    bar.lineTo(crackX - 1, top + height * 0.75)
    bar.strokePath()
  }

  // Camada extra de rachaduras, revelada no contato lento.
  for (let i = 0; i < BLOCK_COUNT; i += 1) {
    const x = -width / 2 + i * (blockWidth + BLOCK_GAP)
    const phase = (spec.variation * 7.71 + i * 0.53) % 1
    const crackX = x + blockWidth * (0.25 + phase * 0.5)

    crackLayer.lineStyle(1.5, CRACK_COLOR, 0.95)
    crackLayer.beginPath()
    crackLayer.moveTo(crackX - 4, top + 2)
    crackLayer.lineTo(crackX + 2, top + height * 0.4)
    crackLayer.lineTo(crackX - 2, top + height * 0.62)
    crackLayer.lineTo(crackX + 4, top + height - 2)
    crackLayer.strokePath()
    crackLayer.lineStyle(1, CRACK_COLOR, 0.8)
    crackLayer.lineBetween(
      crackX + 2,
      top + height * 0.4,
      crackX + 6,
      top + height * 0.28,
    )
  }
  crackLayer.setAlpha(0)

  let spent = false
  let shattered = false
  let destroyed = false
  let lastContactAt = Number.NEGATIVE_INFINITY
  const fragments: Phaser.GameObjects.Triangle[] = []

  /** Ruído determinístico (0..1) para variar a quebra sem RNG de gameplay. */
  function noise(seed: number): number {
    const value = Math.sin(seed * 127.1 + spec.variation * 311.7) * 43758.5453
    return value - Math.floor(value)
  }

  function removeFragment(fragment: Phaser.GameObjects.Triangle): void {
    const index = fragments.indexOf(fragment)
    if (index >= 0) fragments.splice(index, 1)
    scene.tweens.killTweensOf(fragment)
    if (fragment.active) fragment.destroy()
  }

  function spawnFragments(): void {
    const count = clamp(6 + Math.floor(spec.variation * 5), 6, 10)
    const seconds = FRAGMENT_LIFESPAN_MS / 1000

    for (let i = 0; i < count; i += 1) {
      const seed = noise(i + 1)
      const across = (i + 0.5) / count
      const startX = spec.x - width / 2 + across * width
      const startY = spec.y + (seed - 0.5) * height * 0.45

      const angle =
        (i / count) * Math.PI * 2 + spec.variation * Math.PI + (seed - 0.5) * 0.7
      const speed = 100 + noise(i + 11) * 170
      const vx = Math.cos(angle) * speed
      // Bias para cima + piso de gravidade: o arco sempre termina abaixo.
      const vy = clamp(Math.sin(angle) * speed - 70, -140, 260)

      const shardWidth = 4 + noise(i + 21) * 6
      const shardHeight = 4 + noise(i + 31) * 7
      const color = FRAGMENT_COLORS[i % FRAGMENT_COLORS.length] ?? PALETTE.breakable
      const spin = (noise(i + 41) - 0.5) * 10

      const fragment = scene.add
        .triangle(
          startX,
          startY,
          0,
          0,
          shardWidth,
          shardHeight * 0.25,
          shardWidth * 0.35,
          shardHeight,
          color,
        )
        .setDepth(6)
        .setRotation(seed * Math.PI * 2)
        .setAlpha(0.85 + seed * 0.15)
      fragments.push(fragment)

      // Movimento balístico: x linear e y com a curva de gravidade.
      const travelY = vy * seconds + 0.5 * FRAGMENT_GRAVITY * seconds * seconds
      const ballistic = (progress: number): number => {
        const fall =
          vy * seconds * progress +
          0.5 * FRAGMENT_GRAVITY * seconds * seconds * progress * progress
        return fall / travelY
      }

      scene.tweens.add({
        targets: fragment,
        x: startX + vx * seconds,
        rotation: fragment.rotation + spin * seconds,
        duration: FRAGMENT_LIFESPAN_MS,
        ease: 'Linear',
      })
      scene.tweens.add({
        targets: fragment,
        y: startY + travelY,
        duration: FRAGMENT_LIFESPAN_MS,
        ease: ballistic,
      })
      scene.tweens.add({
        targets: fragment,
        alpha: 0,
        delay: FRAGMENT_FADE_START_MS,
        duration: FRAGMENT_FADE_MS,
        ease: 'Quad.easeIn',
        onComplete: () => removeFragment(fragment),
      })
    }
  }

  function shatter(): void {
    if (shattered || destroyed) return
    shattered = true
    spent = true
    spawnFragments()

    scene.tweens.killTweensOf(root)
    root.setPosition(spec.x, spec.y)
    scene.tweens.add({
      targets: root,
      scaleX: 0.7,
      scaleY: 0.35,
      alpha: 0,
      duration: SHATTER_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (root.active) root.setVisible(false)
      },
    })
  }

  function hitFeedback(strength: number): void {
    const shake = 2 + strength * 3
    scene.tweens.killTweensOf(root)
    root.setPosition(spec.x, spec.y)
    scene.tweens.add({
      targets: root,
      x: spec.x + shake,
      duration: 28,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (root.active) root.x = spec.x
      },
    })

    scene.tweens.killTweensOf(crackLayer)
    crackLayer.setAlpha(Math.min(0.95, 0.72 + strength * 0.25))
    scene.tweens.add({
      targets: crackLayer,
      alpha: 0.55,
      delay: 40,
      duration: 180,
      ease: 'Quad.easeOut',
    })
  }

  function contact(ball: BallLike): ObstacleContact | null {
    if (spent || shattered || destroyed) return null

    const hit = circleRectHit(ball.x, ball.y, ball.r, bounds)
    if (!hit) return null

    const now = performance.now()
    if (now - lastContactAt < TUNING.obstacle.contactCooldownMs) return null
    lastContactAt = now

    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed >= TUNING.obstacle.breakSpeed) {
      spent = true
      return { result: 'shatter', point: hit.point, strength: 1 }
    }

    const strength =
      0.3 + 0.6 * clamp(speed / TUNING.obstacle.breakSpeed, 0, 1)
    return {
      result: 'reflect',
      point: hit.point,
      normal: hit.normal,
      penetration: hit.penetration,
      strength,
    }
  }

  function react(feedback: ObstacleContact): void {
    if (destroyed) return
    if (feedback.result === 'shatter') {
      shatter()
      return
    }
    if (!spent && feedback.result === 'reflect') hitFeedback(feedback.strength)
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    scene.tweens.killTweensOf(root)
    scene.tweens.killTweensOf(crackLayer)
    for (const fragment of [...fragments]) {
      scene.tweens.killTweensOf(fragment)
      if (fragment.active) fragment.destroy()
    }
    fragments.length = 0
    if (root.active) root.destroy()
  }

  return {
    kind: 'breakable',
    root,
    bounds,
    get spent(): boolean {
      return spent
    },
    update(): void {},
    contact,
    react,
    destroy,
  }
}
