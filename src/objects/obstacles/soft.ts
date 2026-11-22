import Phaser from 'phaser'
import { clamp } from '../../core/math'
import { circleRectHit } from '../../core/collision'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** Cantos bem arredondados: a barra lê como tecido, não como superfície rígida. */
const CORNER_RADIUS = 8
/** 70 ms para achatar + 70 ms de yoyo para voltar. */
const SQUASH_DURATION_MS = 70
const SQUASH_SCALE_Y = 0.72
/** Ondulação do ponto de contato: abre e some. */
const RIPPLE_DURATION_MS = 180
/** Piso de intensidade: até um toque leve rende feedback perceptível. */
const MIN_STRENGTH = 0.4

/** Escurece canais RGB por um fator 0..1 (borda inferior dobrada). */
function darken(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor)
  const g = Math.round(((color >> 8) & 0xff) * factor)
  const b = Math.round((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

/**
 * Soft surface: a bola afunda e perde força, sem desviar. A entidade só devolve
 * o contato `damp`; a cena aplica o dreno (`TUNING.obstacle.softDamp`).
 */
export const createSoft: ObstacleFactory = (scene, spec) => {
  const halfW = spec.width / 2
  const halfH = spec.height / 2
  const radius = Math.min(CORNER_RADIUS, halfW, halfH)

  // Hitbox fixa: a deformação visual nunca mexe nela.
  const bounds = new Phaser.Geom.Rectangle(spec.x - halfW, spec.y - halfH, spec.width, spec.height)

  const root = scene.add.container(spec.x, spec.y).setDepth(5)

  // Corpo de tecido: retângulo arredondado em PALETTE.soft.
  const fabric = scene.add.graphics()
  fabric.fillStyle(PALETTE.soft, 1)
  fabric.fillRoundedRect(-halfW, -halfH, spec.width, spec.height, radius)

  // Trama: linhas horizontais claras e discretas.
  const lineInset = Math.min(24, spec.width * 0.12)
  fabric.lineStyle(1, PALETTE.ink, 0.2)
  for (const ratio of [0.26, 0.5, 0.74]) {
    const y = -halfH + spec.height * ratio
    fabric.lineBetween(-halfW + lineInset, y, halfW - lineInset, y)
  }

  // Dobra inferior mais escura, com pontas suaves.
  const foldInset = Math.min(20, spec.width * 0.1)
  fabric.fillStyle(darken(PALETTE.soft, 0.58), 0.9)
  fabric.fillRoundedRect(
    -halfW + foldInset,
    halfH - 5,
    spec.width - foldInset * 2,
    2.5,
    1.25,
  )

  // Ondulação reutilizável, ancorada na peça e reposicionada a cada toque.
  const ripple = scene.add
    .ellipse(0, 0, spec.width * 0.34, spec.height * 0.8, PALETTE.ink, 0)
    .setStrokeStyle(2, PALETTE.ink, 0.5)
    .setAlpha(0)

  root.add([fabric, ripple])

  let lastContactAt = Number.NEGATIVE_INFINITY
  let destroyed = false

  return {
    kind: 'soft',
    root,
    bounds,
    spent: false,

    /** Obstáculo estático: o mundo é que se move. */
    update(): void {},

    contact(ball: BallLike): ObstacleContact | null {
      const now = performance.now()
      if (now - lastContactAt < TUNING.obstacle.contactCooldownMs) return null

      const hit = circleRectHit(ball.x, ball.y, ball.r, bounds)
      if (!hit) return null
      lastContactAt = now

      // 0.4 no toque leve até 1.0 na velocidade máxima de chute (satura acima).
      const speed = Math.hypot(ball.vx, ball.vy)
      const speedRatio = clamp(speed / TUNING.kick.maxSpeed, 0, 1)

      return {
        result: 'damp',
        point: hit.point,
        strength: MIN_STRENGTH + (1 - MIN_STRENGTH) * speedRatio,
      }
    },

    react(contact: ObstacleContact): void {
      if (destroyed) return

      // Achata a peça inteira em Y e volta (yoyo); a hitbox fica intacta.
      scene.tweens.killTweensOf(root)
      root.setScale(1, 1)
      scene.tweens.add({
        targets: root,
        scaleY: SQUASH_SCALE_Y,
        duration: SQUASH_DURATION_MS,
        yoyo: true,
        ease: 'Quad.out',
      })

      // Ondulação clara no ponto exato do toque, em coordenadas locais.
      const localX = clamp(contact.point.x - spec.x, -halfW + 6, halfW - 6)
      const localY = clamp(contact.point.y - spec.y, -halfH, halfH)
      ripple.setPosition(localX, localY).setScale(0.4).setAlpha(0.85)

      scene.tweens.killTweensOf(ripple)
      scene.tweens.add({
        targets: ripple,
        scaleX: 1.5,
        scaleY: 1.5,
        alpha: 0,
        duration: RIPPLE_DURATION_MS,
        ease: 'Quad.out',
      })
    },

    destroy(): void {
      if (destroyed) return
      destroyed = true
      scene.tweens.killTweensOf(root)
      scene.tweens.killTweensOf(ripple)
      root.destroy()
    },
  }
}
