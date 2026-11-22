import type { Vec2 } from '../game/contracts'
import { TUNING } from '../game/tuning'
import { clamp } from './math'

export interface AimResult {
  /** Direção normalizada do tiro (y negativo = para cima). */
  dir: Vec2
  /** 0..1 de arrasto, já com o piso default aplicado quando precisa. */
  ratio: number
  /** Velocidade final do tiro. */
  speed: number
}

/** Não deixa mirar para baixo nem rasante: mínimo de subida. */
const MIN_UP = 0.12

/**
 * Converte o arrasto (posição do ponteiro no mundo) em direção + força.
 * - Tap curto (< aimDeadZone) ou timeout com força muito baixa usam a força
 *   média default e tiro reto para cima: o jogador nunca é punido por hesitar.
 * - Arrasto longo satura a força; a direção é a do arrasto.
 */
export function resolveAim(
  ball: Vec2,
  pointer: Vec2,
  timedOut = false,
): AimResult {
  const p = TUNING.powerup
  const dx = pointer.x - ball.x
  const dy = pointer.y - ball.y
  const length = Math.hypot(dx, dy)

  let dir: Vec2
  let ratio: number

  if (length < p.aimDeadZone) {
    dir = { x: 0, y: -1 }
    ratio = p.aimDefaultForceRatio
  } else {
    dir = { x: dx / length, y: dy / length }
    ratio = clamp(length / p.aimMaxDrag, 0, 1)
    if (timedOut && ratio < p.aimMinForceRatio) {
      ratio = p.aimDefaultForceRatio
    }
  }

  if (dir.y > -MIN_UP) {
    const horizontal = Math.abs(dir.x) < 1e-4 ? 0 : Math.sign(dir.x)
    const vertical = -MIN_UP
    const horizontalLength = Math.sqrt(Math.max(0, 1 - vertical * vertical))
    dir = { x: horizontal * horizontalLength, y: vertical }
  }

  const speed = p.aimMinSpeed + (p.aimMaxSpeed - p.aimMinSpeed) * ratio
  return { dir, ratio, speed }
}
