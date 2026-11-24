import type { Vec2 } from '../game/contracts'
import { clamp } from './math'

export interface RectLike {
  x: number
  y: number
  width: number
  height: number
}

export interface CollisionHit {
  /** Ponto de contato na superfície. */
  point: Vec2
  /** Normal apontando para fora da superfície (do obstáculo para a bola). */
  normal: Vec2
  /** Quanto empurrar a bola para fora. */
  penetration: number
}

/**
 * Colisão círculo × retângulo alinhado aos eixos.
 * Cobre o caso de centro dentro do retângulo escolhendo o eixo de menor saída.
 */
export function circleRectHit(
  cx: number,
  cy: number,
  radius: number,
  rect: RectLike,
): CollisionHit | null {
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height
  const closestX = clamp(cx, rect.x, right)
  const closestY = clamp(cy, rect.y, bottom)
  const dx = cx - closestX
  const dy = cy - closestY
  const distSq = dx * dx + dy * dy

  if (distSq > radius * radius) return null

  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq)
    return {
      point: { x: closestX, y: closestY },
      normal: { x: dx / dist, y: dy / dist },
      penetration: radius - dist,
    }
  }

  // Centro dentro do retângulo: sai pelo lado mais próximo.
  const toLeft = cx - rect.x
  const toRight = right - cx
  const toTop = cy - rect.y
  const toBottom = bottom - cy
  const min = Math.min(toLeft, toRight, toTop, toBottom)

  if (min === toLeft) {
    return { point: { x: rect.x, y: cy }, normal: { x: -1, y: 0 }, penetration: toLeft + radius }
  }
  if (min === toRight) {
    return { point: { x: right, y: cy }, normal: { x: 1, y: 0 }, penetration: toRight + radius }
  }
  if (min === toTop) {
    return { point: { x: cx, y: rect.y }, normal: { x: 0, y: -1 }, penetration: toTop + radius }
  }
  return { point: { x: cx, y: bottom }, normal: { x: 0, y: 1 }, penetration: toBottom + radius }
}

/** Colisão círculo × círculo. Normal aponta de B para A. */
export function circleCircleHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): CollisionHit | null {
  const dx = ax - bx
  const dy = ay - by
  const sum = ar + br
  const distSq = dx * dx + dy * dy
  if (distSq > sum * sum) return null

  const dist = Math.sqrt(distSq) || 0.0001
  const nx = dx / dist
  const ny = dy / dist
  return {
    point: { x: bx + nx * br, y: by + ny * br },
    normal: { x: nx, y: ny },
    penetration: sum - dist,
  }
}

/** Reflexão especular em torno da normal. */
export function reflectVelocity(
  vx: number,
  vy: number,
  normal: Vec2,
  restitution = 1,
): { vx: number; vy: number } {
  const dot = vx * normal.x + vy * normal.y
  return {
    vx: (vx - 2 * dot * normal.x) * restitution,
    vy: (vy - 2 * dot * normal.y) * restitution,
  }
}

/**
 * Quique em parede vertical. Devolve a velocidade horizontal com o sentido
 * trocado e amortecida por `restitution`. Com restituição < 1, quiques
 * encadeados perdem energia e a bola deixa de "pinballar" entre as bordas.
 */
export function wallBounce(
  vx: number,
  side: 'left' | 'right',
  restitution = 1,
): number {
  const magnitude = Math.abs(vx) * restitution
  return side === 'left' ? magnitude : -magnitude
}
