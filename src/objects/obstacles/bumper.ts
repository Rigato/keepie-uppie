import Phaser from 'phaser'
import { circleCircleHit } from '../../core/collision'
import { clamp } from '../../core/math'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** Quantidade de ranhuras radiais do anel interno (identidade do bumper). */
const TICK_COUNT = 8
/** Faixa radial das ranhuras, em fração do raio. */
const TICK_INNER = 0.6
const TICK_OUTER = 0.9
const TICK_THICKNESS = 3
const TICK_ALPHA = 0.52
/** Anel interno: raio e espessura em fração/unidades do raio. */
const INNER_RING_RATIO = 0.56
const INNER_RING_THICKNESS = 2
/** Contorno escuro e flash de impacto. */
const OUTLINE_THICKNESS = 2.5
const FLASH_ALPHA = 0.5
const FLASH_MS = 130
/** Squash do contato: metade da ida e volta. */
const SQUASH_MS = 55
const SQUASH_SCALE_X = 1.16
const SQUASH_SCALE_Y = 0.84

/**
 * Bumper: almofada circular que devolve a bola na direção radial.
 * A hitbox é o círculo de `bumperRadius` centrado em (spec.x, spec.y); o squash
 * é apenas visual e não altera os bounds.
 */
export const createBumper: ObstacleFactory = (scene, spec) => {
  const radius = TUNING.obstacle.bumperRadius
  const tickPhase = clamp(spec.variation, 0, 1) * (Math.PI / TICK_COUNT)
  const innerRadius = radius * INNER_RING_RATIO

  const root = scene.add.container(spec.x, spec.y).setDepth(5)

  // Corpo teal com relevo: miolo levemente mais claro, anel e ranhuras.
  const body = scene.add.graphics()
  body.fillStyle(PALETTE.bumper, 1)
  body.fillCircle(0, 0, radius)
  body.fillStyle(0xffffff, 0.08)
  body.fillCircle(0, 0, innerRadius)
  body.lineStyle(INNER_RING_THICKNESS, 0xffffff, 0.42)
  body.strokeCircle(0, 0, innerRadius)
  body.lineStyle(OUTLINE_THICKNESS, PALETTE.ink, 0.68)
  body.strokeCircle(0, 0, radius - OUTLINE_THICKNESS / 2)

  // Oito ranhuras curtas apontando para fora, com fase determinística pela seed.
  body.lineStyle(TICK_THICKNESS, PALETTE.ink, TICK_ALPHA)
  for (let i = 0; i < TICK_COUNT; i += 1) {
    const angle = tickPhase + (i / TICK_COUNT) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    body.lineBetween(
      cos * radius * TICK_INNER,
      sin * radius * TICK_INNER,
      cos * radius * TICK_OUTER,
      sin * radius * TICK_OUTER,
    )
  }

  // Flash circular, invisível até o primeiro contato.
  const flash = scene.add.graphics()
  flash.fillStyle(0xffffff, 1)
  flash.fillCircle(0, 0, radius)
  flash.setAlpha(0).setVisible(false)

  root.add([body, flash])

  const bounds = new Phaser.Geom.Rectangle(
    spec.x - radius,
    spec.y - radius,
    radius * 2,
    radius * 2,
  )

  let lastContactAt = Number.NEGATIVE_INFINITY
  let destroyed = false

  return {
    kind: 'bumper',
    root,
    bounds,
    spent: false,

    update(): void {
      // Estático: não há movimento próprio.
    },

    contact(ball: BallLike): ObstacleContact | null {
      if (destroyed) return null

      const now = performance.now()
      if (now - lastContactAt < TUNING.obstacle.bumperCooldownMs) return null

      // Normal do centro do bumper para a bola: quique sempre radial.
      const hit = circleCircleHit(ball.x, ball.y, ball.r, spec.x, spec.y, radius)
      if (!hit) return null
      // Centro exato: a normal degenera em (0,0). Empurra para cima em vez de
      // deixar a bola presa no meio do bumper.
      if (hit.normal.x === 0 && hit.normal.y === 0) {
        hit.normal = { x: 0, y: -1 }
      }

      lastContactAt = now

      // Centro exato não tem direção radial: devolve a bola para cima.
      const deadCenter = hit.normal.x === 0 && hit.normal.y === 0
      const normal = deadCenter ? { x: 0, y: -1 } : hit.normal
      const point = deadCenter ? { x: spec.x, y: spec.y - radius } : hit.point

      const speed = Math.hypot(ball.vx, ball.vy)
      const strength = clamp(speed / TUNING.kick.maxSpeed, 0, 1)

      return {
        result: 'reflect',
        point,
        normal,
        penetration: hit.penetration,
        restitution: TUNING.obstacle.bumperRestitution,
        strength,
      }
    },

    react(_contact: ObstacleContact): void {
      if (destroyed) return

      // Squash curto no lugar: a hitbox circular permanece intacta.
      scene.tweens.killTweensOf(root)
      root.setScale(1, 1)
      scene.tweens.add({
        targets: root,
        scaleX: SQUASH_SCALE_X,
        scaleY: SQUASH_SCALE_Y,
        duration: SQUASH_MS,
        yoyo: true,
        ease: 'Quad.out',
        onComplete: () => {
          if (root.active) root.setScale(1, 1)
        },
      })

      scene.tweens.killTweensOf(flash)
      flash.setVisible(true).setAlpha(FLASH_ALPHA)
      scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: FLASH_MS,
        ease: 'Quad.out',
        onComplete: () => {
          if (flash.active) flash.setVisible(false)
        },
      })
    },

    destroy(): void {
      if (destroyed) return
      destroyed = true
      scene.tweens.killTweensOf(root)
      scene.tweens.killTweensOf(flash)
      root.destroy()
    },
  }
}
