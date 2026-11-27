import Phaser from 'phaser'
import { clamp } from '../../core/math'
import { circleRectHit } from '../../core/collision'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** 70 ms para o flinch + 70 ms de yoyo para voltar. */
const SQUASH_DURATION_MS = 70
const SQUASH_SCALE_Y = 0.72
const SQUASH_SCALE_X = 1.04
/** Poeirinha no ponto de impacto: abre e some. */
const RIPPLE_DURATION_MS = 180
/** Piso de intensidade: até um toque leve rende feedback perceptível. */
const MIN_STRENGTH = 0.4
/** Abaixo disto, o ponto de impacto é "centro" e decide pelo vx de entrada. */
const CENTER_EPSILON = 2

interface Player {
  /** Posição do corpo em unidades locais da barreira. */
  x: number
  /** Variação de altura (pequena, dentro da hitbox). */
  y: number
  skin: number
  /** Variação de largura do torso. */
  width: number
}

/**
 * Quatro jogadores de falta, de frente e ombro a ombro. A silhueta é feita de
 * cabeças, ombros e chuteiras — nunca de uma barra reta. Posições em unidades
 * locais, dentro da hitbox (152×32).
 */
const PLAYERS: readonly Player[] = [
  { x: -57, y: -1, skin: PALETTE.barrierSkinA, width: 34 },
  { x: -19, y: 0.5, skin: PALETTE.barrierSkinB, width: 36 },
  { x: 19, y: -1.5, skin: PALETTE.barrierSkinA, width: 35 },
  { x: 57, y: 0, skin: PALETTE.barrierSkinB, width: 34 },
]

/** Escurece canais RGB por um fator 0..1. */
function darken(color: number, factor: number): number {
  const r = clamp(Math.round(((color >> 16) & 0xff) * factor), 0, 255)
  const g = clamp(Math.round(((color >> 8) & 0xff) * factor), 0, 255)
  const b = clamp(Math.round((color & 0xff) * factor), 0, 255)
  return (r << 16) | (g << 8) | b
}

/** Clareia canais RGB por um fator ≥ 1. */
function lighten(color: number, factor: number): number {
  const r = clamp(Math.round(((color >> 16) & 0xff) * factor), 0, 255)
  const g = clamp(Math.round(((color >> 8) & 0xff) * factor), 0, 255)
  const b = clamp(Math.round((color & 0xff) * factor), 0, 255)
  return (r << 16) | (g << 8) | b
}

/**
 * Barreira de jogadores de falta. Não drena e não mata: a bola quica para cima
 * e para um dos lados. A entidade só devolve o contato `bounce` com o lado do
 * impacto; a cena aplica `barrierBounce` e o empurrão para fora da hitbox.
 */
export const createBarrier: ObstacleFactory = (scene, spec) => {
  const halfW = spec.width / 2
  const halfH = spec.height / 2

  // Hitbox fixa: o flinch visual nunca mexe nela.
  const bounds = new Phaser.Geom.Rectangle(spec.x - halfW, spec.y - halfH, spec.width, spec.height)

  const root = scene.add.container(spec.x, spec.y).setDepth(5)
  const fabric = scene.add.graphics()

  const shirt = PALETTE.barrier
  const shirtShade = darken(shirt, 0.62)
  const shirtLight = lighten(shirt, 1.3)
  const shorts = PALETTE.barrierShorts
  const dark = PALETTE.barrierDark

  for (const player of PLAYERS) {
    const px = player.x
    const py = player.y
    const torsoW = player.width

    // Pernas e chuteiras escuras: dois blocos curtos na base da silhueta.
    fabric.fillStyle(dark, 1)
    fabric.fillRoundedRect(px - 9, py + 9, 8, 6, 2)
    fabric.fillRoundedRect(px + 1, py + 9, 8, 6, 2)

    // Short claro, com contorno fino e luz de cima.
    fabric.fillStyle(shorts, 1)
    fabric.fillRoundedRect(px - 14, py + 3.5, 28, 7, 2.5)
    fabric.lineStyle(1, dark, 0.85)
    fabric.strokeRoundedRect(px - 14, py + 3.5, 28, 7, 2.5)
    fabric.fillStyle(lighten(shorts, 1.06), 0.6)
    fabric.fillEllipse(px, py + 5.5, 18, 2.6)

    // Camisa: corpo arredondado + ombros arredondados, sem aresta de barra.
    fabric.fillStyle(shirt, 1)
    fabric.fillRoundedRect(px - torsoW / 2, py - 5, torsoW, 10, 3)
    fabric.fillCircle(px - torsoW / 2 + 3, py - 3, 4)
    fabric.fillCircle(px + torsoW / 2 - 3, py - 3, 4)
    fabric.lineStyle(1, dark, 0.9)
    fabric.strokeRoundedRect(px - torsoW / 2, py - 5, torsoW, 10, 3)
    // Luz de cima, na mesma direção dos outros objetos do jogo.
    fabric.fillStyle(shirtLight, 0.34)
    fabric.fillEllipse(px, py - 3.2, torsoW * 0.55, 3.2)

    // Braços cruzados na frente do peito: contorno escuro e pele por cima.
    fabric.lineStyle(5, dark, 0.95)
    fabric.lineBetween(px - torsoW / 2 + 3, py - 2.5, px + 10, py + 3)
    fabric.lineBetween(px + torsoW / 2 - 3, py - 2.5, px - 10, py + 3)
    fabric.lineStyle(3, player.skin, 1)
    fabric.lineBetween(px - torsoW / 2 + 3, py - 2.5, px + 10, py + 3)
    fabric.lineBetween(px + torsoW / 2 - 3, py - 2.5, px - 10, py + 3)
    fabric.fillStyle(player.skin, 1)
    fabric.fillCircle(px + 10, py + 3, 2.6)
    fabric.fillCircle(px - 10, py + 3, 2.6)

    // Cabeça e cabelo escuro, com brilho discreto no topo.
    fabric.fillStyle(player.skin, 1)
    fabric.fillCircle(px, py - 10.5, 5.2)
    fabric.lineStyle(1, dark, 0.9)
    fabric.strokeCircle(px, py - 10.5, 5.2)
    fabric.fillStyle(dark, 1)
    fabric.fillEllipse(px, py - 13.2, 10.4, 5.2)
    fabric.fillStyle(shirtShade, 0.5)
    fabric.fillEllipse(px + 4, py - 12.4, 3, 4)
    fabric.fillStyle(0xffffff, 0.26)
    fabric.fillEllipse(px - 1.6, py - 11.2, 3, 2)
  }

  // Poeirinha reutilizável, ancorada na peça e reposicionada a cada toque.
  const ripple = scene.add
    .ellipse(0, 0, spec.width * 0.34, spec.height * 0.85, PALETTE.barrierShorts, 0.5)
    .setStrokeStyle(2, PALETTE.barrierDark, 0.6)
    .setAlpha(0)

  root.add([fabric, ripple])

  let lastContactAt = Number.NEGATIVE_INFINITY
  let destroyed = false

  return {
    kind: 'barrier',
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

      // Lado do impacto em relação ao centro; no centro ambíguo, usa o vx de
      // entrada; parado no centro, sai para a direita.
      const dx = hit.point.x - spec.x
      const side: -1 | 1 =
        Math.abs(dx) > CENTER_EPSILON
          ? dx < 0
            ? -1
            : 1
          : ball.vx < 0
            ? -1
            : 1

      // 0.4 no toque leve até 1.0 na velocidade máxima de chute (satura acima).
      const speed = Math.hypot(ball.vx, ball.vy)
      const speedRatio = clamp(speed / TUNING.kick.maxSpeed, 0, 1)

      return {
        result: 'bounce',
        side,
        point: hit.point,
        normal: hit.normal,
        penetration: hit.penetration,
        strength: MIN_STRENGTH + (1 - MIN_STRENGTH) * speedRatio,
      }
    },

    react(contact: ObstacleContact): void {
      if (destroyed) return

      // Flinch curto do grupo inteiro em X e Y; a hitbox fica intacta.
      scene.tweens.killTweensOf(root)
      root.setScale(1, 1)
      scene.tweens.add({
        targets: root,
        scaleX: SQUASH_SCALE_X,
        scaleY: SQUASH_SCALE_Y,
        duration: SQUASH_DURATION_MS,
        yoyo: true,
        ease: 'Quad.out',
      })

      // Poeirinha no ponto exato do toque, em coordenadas locais.
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
