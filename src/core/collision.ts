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

/**
 * Colisão círculo × retângulo rotacionado em torno do próprio centro.
 * O retângulo é descrito pelo centro, largura, altura e ângulo (radianos).
 * A conta gira o círculo para o espaço local, usa `circleRectHit` e devolve
 * ponto e normal no espaço do mundo.
 */
export function circleRotatedRectHit(
  cx: number,
  cy: number,
  radius: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  angleRad: number,
): CollisionHit | null {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const dx = cx - centerX
  const dy = cy - centerY
  // Rotaciona o centro da bola por -ângulo para o espaço local do retângulo.
  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos

  const hit = circleRectHit(localX, localY, radius, {
    x: -width / 2,
    y: -height / 2,
    width,
    height,
  })
  if (!hit) return null

  // Ponto e normal locais voltam para o mundo com +ângulo.
  const pointX = hit.point.x * cos - hit.point.y * sin
  const pointY = hit.point.x * sin + hit.point.y * cos
  return {
    point: { x: centerX + pointX, y: centerY + pointY },
    normal: {
      x: hit.normal.x * cos - hit.normal.y * sin,
      y: hit.normal.x * sin + hit.normal.y * cos,
    },
    penetration: hit.penetration,
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
