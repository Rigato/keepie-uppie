import Phaser from 'phaser'
import { circleRectHit } from '../../core/collision'
import { clamp } from '../../core/math'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** Raio dos cantos da barra (visual; não altera a hitbox). */
const CORNER_RADIUS = 6
/** Espessura e alfa da linha clara que dá volume ao topo. */
const HIGHLIGHT_THICKNESS = 2
const HIGHLIGHT_ALPHA = 0.18
/** Flash de impacto: pico de alfa e duração até sumir. */
const FLASH_ALPHA = 0.45
const FLASH_MS = 120

/**
 * Superfície dura: barra estática que reflete a bola.
 * A hitbox é exatamente o retângulo do spec, centrado em (spec.x, spec.y).
 */
export const createHard: ObstacleFactory = (scene, spec) => {
  const width = spec.width
  const height = spec.height
  const radius = Math.max(0, Math.min(CORNER_RADIUS, width / 2, height / 2))

  const root = scene.add.container(spec.x, spec.y).setDepth(5)

  // Volume: preenchimento, contorno escuro sutil e brilho no topo.
  const bar = scene.add.graphics()
  bar.fillStyle(PALETTE.hard, 1)
  bar.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
  bar.lineStyle(1, PALETTE.bg, 0.55)
  bar.strokeRoundedRect(-width / 2 + 0.5, -height / 2 + 0.5, width - 1, height - 1, radius)

  // O comprimento do brilho varia com a seed, mas nunca a hitbox.
  const highlightLength = width * (0.55 + 0.3 * clamp(spec.variation, 0, 1))
  const highlightY = -height / 2 + Math.min(height / 2, Math.max(3, height * 0.28))
  bar.lineStyle(HIGHLIGHT_THICKNESS, 0xffffff, HIGHLIGHT_ALPHA)
  bar.lineBetween(-highlightLength / 2, highlightY, highlightLength / 2, highlightY)

  // Camada de flash, invisível até o primeiro contato.
  const flash = scene.add.graphics()
  flash.fillStyle(0xffffff, 1)
  flash.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
  flash.setAlpha(0).setVisible(false)

  root.add([bar, flash])

  const bounds = new Phaser.Geom.Rectangle(
    spec.x - width / 2,
    spec.y - height / 2,
    width,
    height,
  )

  let lastContactAt = Number.NEGATIVE_INFINITY

  return {
    kind: 'hard',
    root,
    bounds,
    spent: false,

    update(): void {
      // Estática: não há movimento próprio.
    },

    contact(ball: BallLike): ObstacleContact | null {
      const now = performance.now()
      if (now - lastContactAt < TUNING.obstacle.contactCooldownMs) return null

      const hit = circleRectHit(ball.x, ball.y, ball.r, bounds)
      if (!hit) return null

      lastContactAt = now

      // |vy| de 0 até a velocidade máxima de chute vira 0.5..1; acima disso satura.
      const strength = 0.5 + 0.5 * clamp(Math.abs(ball.vy) / TUNING.kick.maxSpeed, 0, 1)

      return {
        result: 'reflect',
        point: hit.point,
        normal: hit.normal,
        penetration: hit.penetration,
        strength,
      }
    },

    react(_contact: ObstacleContact): void {
      scene.tweens.killTweensOf(flash)
      flash.setVisible(true).setAlpha(FLASH_ALPHA)
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: FLASH_MS,
        ease: 'Quad.easeOut',
        onComplete: () => flash.setVisible(false),
      })
    },

    destroy(): void {
      scene.tweens.killTweensOf(flash)
      root.destroy()
    },
  }
}
