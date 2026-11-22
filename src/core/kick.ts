import type { BallLike, Vec2 } from '../game/contracts'
import { TUNING } from '../game/tuning'

export type WhiffReason = 'miss' | 'notFalling'

export interface KickResult {
  kind: 'kick' | 'whiff'
  reason: WhiffReason | null
  /** Velocidade horizontal aplicada (u/s). */
  vx: number
  /** Velocidade vertical aplicada (u/s, negativa para cima). */
  vy: number
  perfect: boolean
  /** 0..1 entre piso e teto da faixa. */
  power: number
  /** Offset lateral normalizado -1..1 (esquerda negativa). */
  offset: number
  /** Tempo de voo estimado até voltar à mesma altura. */
  arcTime: number
}

export function isInsideBall(ball: BallLike, point: Vec2): boolean {
  const dx = point.x - ball.x
  const dy = point.y - ball.y
  return dx * dx + dy * dy <= ball.r * ball.r
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Regra central do jogo: só se chuta bola em queda. O ângulo é oposto ao ponto
 * de toque; a força vem da velocidade de encontro, com piso de segurança.
 * O alvo de toque é generoso (`touchRadius`), mas o ângulo usa o raio real da
 * bola — tocar longe da bola vira ângulo máximo, não um chute "sem intenção".
 */
export function computeKick(
  ball: BallLike,
  point: Vec2,
  touchRadius = TUNING.kick.touchRadius,
): KickResult {
  if (!isInsideBall({ ...ball, r: touchRadius }, point)) return whiff('miss')
  // Eixo Y cresce para baixo: bola em queda tem vy > 0. Perto do ápice a
  // velocidade é ~0; toleramos uma subida mínima para o toque não "sumir".
  if (ball.vy < -TUNING.kick.apexTolerance) return whiff('notFalling')

  const offset = clamp((point.x - ball.x) / Math.max(1, touchRadius), -1, 1)
  const perfect = Math.abs(offset) <= TUNING.kick.perfectWindow

  const speed = perfect
    ? TUNING.perfect.speed
    : clamp(
        TUNING.kick.baseSpeed + TUNING.kick.impactFactor * ball.vy,
        TUNING.kick.minSpeed,
        TUNING.kick.maxSpeed,
      )

  const lateral = TUNING.kick.maxLateral * Math.abs(offset)
  const angleFactor = Math.sqrt(1 - lateral * lateral)
  const vx = offset === 0 ? 0 : -Math.sign(offset) * speed * lateral
  const vy = -speed * angleFactor

  return {
    kind: 'kick',
    reason: null,
    vx,
    vy,
    perfect,
    power: clamp(
      (speed - TUNING.kick.minSpeed) / (TUNING.kick.maxSpeed - TUNING.kick.minSpeed),
      0,
      1,
    ),
    offset,
    arcTime: (2 * speed) / TUNING.physics.gravity,
  }
}

function whiff(reason: WhiffReason): KickResult {
  return { kind: 'whiff', reason, vx: 0, vy: 0, perfect: false, power: 0, offset: 0, arcTime: 0 }
}
