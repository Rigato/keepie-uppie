import Phaser from 'phaser'
import { circleRotatedRectHit } from '../../core/collision'
import { clamp } from '../../core/math'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** Faixa clara no topo da barra: espessura e alfa. */
const TOP_FACE_HEIGHT_RATIO = 0.56
const TOP_FACE_LIGHTNESS = 1.35
const HIGHLIGHT_THICKNESS = 2.5
const HIGHLIGHT_ALPHA = 0.7
/** Vinco escuro na base, para a barra não ficar chapada. */
const UNDERSIDE_HEIGHT = 2.5
const UNDERSIDE_ALPHA = 0.8
/** Rebites discretos nas pontas: assinatura de peça de metal. */
const RIVET_RADIUS = 1.8
const RIVET_ALPHA = 0.32
/** Flash de impacto: pico de alfa e duração até sumir. */
const FLASH_ALPHA = 0.5
const FLASH_MS = 130

/** Escurece ou clareia canais RGB por um fator (relevo local). */
function shade(color: number, factor: number): number {
  const r = clamp(Math.round(((color >> 16) & 0xff) * factor), 0, 255)
  const g = clamp(Math.round(((color >> 8) & 0xff) * factor), 0, 255)
  const b = clamp(Math.round((color & 0xff) * factor), 0, 255)
  return (r << 16) | (g << 8) | b
}

/**
 * Ramp: barra diagonal que reflete a bola como uma superfície inclinada.
 * A hitbox acompanha a rotação (`rampAngleDeg`) e é verificada no espaço local
 * por `circleRotatedRectHit`; o desenho é um container rotacionado.
 */
export const createRamp: ObstacleFactory = (scene, spec) => {
  const width = spec.width
  const height = spec.height
  const halfW = width / 2
  const halfH = height / 2
  const angle = Phaser.Math.DegToRad(TUNING.obstacle.rampAngleDeg)
  const radius = halfH
  const bodyHeight = Math.max(0, height - UNDERSIDE_HEIGHT)
  const bodyRadius = Math.min(radius, bodyHeight / 2)

  const root = scene.add.container(spec.x, spec.y).setDepth(5).setRotation(angle)

  // Barra steel: face superior clara, corpo, base escura e contorno.
  const bar = scene.add.graphics()
  bar.fillStyle(shade(PALETTE.ramp, 0.72), 1)
  bar.fillRoundedRect(-halfW, -halfH, width, height, radius)
  bar.fillStyle(PALETTE.ramp, 1)
  bar.fillRoundedRect(-halfW, -halfH, width, bodyHeight, bodyRadius)
  bar.fillStyle(shade(PALETTE.ramp, TOP_FACE_LIGHTNESS), 1)
  bar.fillRoundedRect(
    -halfW + 1.5,
    -halfH + 1,
    width - 3,
    height * TOP_FACE_HEIGHT_RATIO,
    height * TOP_FACE_HEIGHT_RATIO * 0.5,
  )

  // Linha clara ao longo do topo, mais curta que a barra (variação por seed).
  const highlightLength = width * (0.62 + 0.18 * clamp(spec.variation, 0, 1))
  const highlightY = -halfH + Math.max(2.5, height * 0.22)
  bar.lineStyle(HIGHLIGHT_THICKNESS, 0xffffff, HIGHLIGHT_ALPHA)
  bar.lineBetween(-highlightLength / 2, highlightY, highlightLength / 2, highlightY)

  // Rebites nas duas pontas, dentro da faixa clara.
  bar.fillStyle(0xffffff, RIVET_ALPHA)
  bar.fillCircle(-halfW + radius + 2, -halfH + height * 0.3, RIVET_RADIUS)
  bar.fillCircle(halfW - radius - 2, -halfH + height * 0.3, RIVET_RADIUS)

  // Vinco escuro na base e contorno: separam a ramp da barra "hard" chapada.
  bar.fillStyle(shade(PALETTE.ramp, 0.48), UNDERSIDE_ALPHA)
  bar.fillRoundedRect(
    -halfW + radius,
    halfH - UNDERSIDE_HEIGHT,
    width - radius * 2,
    UNDERSIDE_HEIGHT,
    UNDERSIDE_HEIGHT / 2,
  )
  bar.lineStyle(2, PALETTE.ink, 0.62)
  bar.strokeRoundedRect(-halfW + 0.5, -halfH + 0.5, width - 1, height - 1, radius)

  // Camada de flash, invisível até o primeiro contato.
  const flash = scene.add.graphics()
  flash.fillStyle(0xffffff, 1)
  flash.fillRoundedRect(-halfW, -halfH, width, height, radius)
  flash.setAlpha(0).setVisible(false)

  root.add([bar, flash])

  // AABB da barra rotacionada: usada para descarte e debug.
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const boundHalfW = (width * cos + height * sin) / 2
  const boundHalfH = (width * sin + height * cos) / 2
  const bounds = new Phaser.Geom.Rectangle(
    spec.x - boundHalfW,
    spec.y - boundHalfH,
    boundHalfW * 2,
    boundHalfH * 2,
  )

  let lastContactAt = Number.NEGATIVE_INFINITY
  let destroyed = false

  return {
    kind: 'ramp',
    root,
    bounds,
    spent: false,

    update(): void {
      // Estática: não há movimento próprio.
    },

    contact(ball: BallLike): ObstacleContact | null {
      if (destroyed) return null

      const now = performance.now()
      if (now - lastContactAt < TUNING.obstacle.contactCooldownMs) return null

      const hit = circleRotatedRectHit(
        ball.x,
        ball.y,
        ball.r,
        spec.x,
        spec.y,
        width,
        height,
        angle,
      )
      if (!hit) return null

      lastContactAt = now

      const speed = Math.hypot(ball.vx, ball.vy)
      const strength = clamp(speed / TUNING.kick.maxSpeed, 0, 1)

      return {
        result: 'reflect',
        point: hit.point,
        normal: hit.normal,
        penetration: hit.penetration,
        restitution: TUNING.obstacle.rampRestitution,
        strength,
      }
    },

    react(_contact: ObstacleContact): void {
      if (destroyed) return

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
      scene.tweens.killTweensOf(flash)
      root.destroy()
    },
  }
}
