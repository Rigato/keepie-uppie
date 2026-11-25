import Phaser from 'phaser'
import { clamp } from '../../core/math'
import { circleRectHit } from '../../core/collision'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { ObstacleContact, ObstacleFactory } from './types'

/** 70 ms para achatar + 70 ms de yoyo para voltar. */
const SQUASH_DURATION_MS = 70
const SQUASH_SCALE_Y = 0.72
/** Ondulação do ponto de contato: abre e some. */
const RIPPLE_DURATION_MS = 180
/** Piso de intensidade: até um toque leve rende feedback perceptível. */
const MIN_STRENGTH = 0.4

interface Leaf {
  x: number
  y: number
  width: number
  height: number
  angle: number
  back: boolean
}

/**
 * Folhagem: lóbulos de folha sobrepostos, sem nenhuma aresta reta. A silhueta
 * orgânica diz "passa através" antes do contato; a bola afunda e perde força.
 * Posições em unidades locais, na faixa da hitbox (152×18).
 */
const LEAVES: readonly Leaf[] = [
  // Camada de trás, mais escura: dá profundidade ao arbusto.
  { x: -50, y: 3, width: 46, height: 16, angle: -0.38, back: true },
  { x: -10, y: 4, width: 50, height: 17, angle: 0.22, back: true },
  { x: 34, y: 3, width: 46, height: 16, angle: -0.16, back: true },
  // Camada da frente: folhas em leque, com as pontas caindo para os lados.
  { x: -66, y: -2, width: 40, height: 14, angle: -0.7, back: false },
  { x: -40, y: -1, width: 44, height: 15, angle: -0.32, back: false },
  { x: -6, y: 0, width: 50, height: 17, angle: 0.04, back: false },
  { x: 28, y: -1, width: 46, height: 15, angle: 0.32, back: false },
  { x: 60, y: -2, width: 38, height: 14, angle: 0.7, back: false },
  // Folhas penduradas completam o contorno.
  { x: -24, y: 9, width: 22, height: 8, angle: 1.05, back: false },
  { x: 26, y: 8, width: 24, height: 9, angle: -0.95, back: false },
  { x: 50, y: 7, width: 17, height: 7, angle: -0.6, back: false },
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
 * Soft surface: folhagem. A bola atravessa as folhas perdendo força, sem
 * desviar. A entidade só devolve o contato `damp`; a cena aplica o dreno
 * (`TUNING.obstacle.softDamp`).
 */
export const createSoft: ObstacleFactory = (scene, spec) => {
  const halfW = spec.width / 2
  const halfH = spec.height / 2

  // Hitbox fixa: a deformação visual nunca mexe nela.
  const bounds = new Phaser.Geom.Rectangle(spec.x - halfW, spec.y - halfH, spec.width, spec.height)

  const root = scene.add.container(spec.x, spec.y).setDepth(5)

  const fabric = scene.add.graphics()

  // Galho fino atrás das folhas: o cluster lê como um arbusto, não como uma
  // nuvem solta. Fica quase todo coberto pelos lóbulos.
  fabric.lineStyle(2, darken(PALETTE.soft, 0.52), 0.9)
  fabric.lineBetween(-halfW + 8, 3, halfW - 8, 3)

  const leafColor = (back: boolean): number => (back ? darken(PALETTE.soft, 0.72) : PALETTE.soft)

  for (const leaf of LEAVES) {
    const color = leafColor(leaf.back)
    const hw = leaf.width / 2
    const hh = leaf.height / 2

    fabric.save()
    fabric.translateCanvas(leaf.x, leaf.y)
    fabric.rotateCanvas(leaf.angle)

    // Folha pontuda: duas curvas amostradas formam uma lente, não um ovo.
    fabric.beginPath()
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12
      const x = -hw + leaf.width * t
      const y = -hh * Math.sin(Math.PI * t)
      if (i === 0) fabric.moveTo(x, y)
      else fabric.lineTo(x, y)
    }
    for (let i = 12; i >= 0; i -= 1) {
      const t = i / 12
      const x = -hw + leaf.width * t
      const y = hh * Math.sin(Math.PI * t)
      fabric.lineTo(x, y)
    }
    fabric.closePath()
    fabric.fillStyle(color, 1)
    fabric.fillPath()

    // Nervura central: dá leitura de folha mesmo com o lóbulo pequeno.
    fabric.lineStyle(1, darken(color, 0.62), 0.45)
    fabric.lineBetween(-leaf.width * 0.36, 0, leaf.width * 0.36, 0)

    // Brilho na metade de cima, na mesma luz dos outros objetos.
    if (!leaf.back) {
      fabric.fillStyle(lighten(color, 1.28), 0.38)
      fabric.fillEllipse(0, -leaf.height * 0.14, leaf.width * 0.42, leaf.height * 0.32)
    }

    // Contorno depois do brilho: a borda fica limpa.
    fabric.lineStyle(1, darken(color, 0.52), 0.8)
    fabric.strokePath()

    fabric.restore()
  }

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

      // Achata a folhagem inteira em Y e volta (yoyo); a hitbox fica intacta.
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
