import { TUNING } from '../game/tuning'
import { clamp } from './math'

/**
 * Rotação visual da bola. A arte é separada em camadas (corpo, padrão e
 * acabamento), então só o padrão gira: o brilho e a sombra ficam parados e a
 * bola não parece um adesivo girando.
 *
 * Tudo aqui é puro (sem Phaser): a cena só aplica `angle` na camada de padrão.
 */

const TAU = Math.PI * 2

export interface BallSpinState {
  /** Rotação visual acumulada em radianos, normalizada em [-π, π]. */
  angle: number
  /** Giro residual do último chute, em rad/s; decai ao longo do voo. */
  residual: number
}

export function createBallSpin(): BallSpinState {
  return { angle: 0, residual: 0 }
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/**
 * Velocidade angular (rad/s) da rolagem visual a partir da velocidade
 * horizontal. Em Phaser, y cresce para baixo: rotação positiva é horária,
 * então a bola indo para a direita gira no sentido horário.
 *
 * A rolagem usa `vx` atual, não a velocidade do chute: quando a bola inverte
 * na parede, o sentido acompanha no frame seguinte.
 */
export function rollOmega(vx: number, radius: number = TUNING.ball.radius): number {
  const safeRadius = finite(radius) > 0 ? radius : TUNING.ball.radius
  const omega = (finite(vx) / safeRadius) * TUNING.ball.spinRollFactor
  return clamp(omega, -TUNING.ball.spinMax, TUNING.ball.spinMax)
}

/**
 * Giro residual (rad/s) de um chute, usado como velocidade angular somada à
 * rolagem. O toque central sai em backspin (negativo); o toque lateral soma um
 * giro no sentido do lado tocado. A força entra linearmente, então o toque de
 * rabicho quase não gira e o chute cheio gira no teto de `spinKick`.
 */
export function kickSpin(offset: number, power: number): number {
  const side = clamp(finite(offset), -1, 1)
  const force = clamp(finite(power), 0, 1)
  const backspin = 1 - Math.abs(side)
  return (
    TUNING.ball.spinKick * force * (side - backspin * TUNING.ball.spinBackspin)
  )
}

/**
 * Offset de toque equivalente a um tiro mirado. `computeKick` lança a bola
 * para o lado oposto ao toque (`vx = -offset * ...`); então a direção
 * horizontal do tiro vira o offset com o sinal invertido.
 */
export function aimOffset(dirX: number): number {
  const lateral = TUNING.kick.maxLateral
  if (lateral <= 0) return 0
  return clamp(-finite(dirX) / lateral, -1, 1)
}

/** Normaliza um ângulo para [-π, π]; valores inválidos viram 0. */
export function normalizeAngle(angle: number): number {
  let normalized = finite(angle) % TAU
  if (normalized > Math.PI) normalized -= TAU
  else if (normalized < -Math.PI) normalized += TAU
  return normalized
}

/**
 * Avança a rotação visual em `dt` segundos e decai o residual do chute.
 * Muta `state` para não alocar por frame; o ângulo fica sempre em [-π, π].
 *
 * O decaimento é exponencial: o giro do chute some aos poucos durante o voo,
 * em vez de cortar seco no primeiro frame.
 */
export function stepBallSpin(
  state: BallSpinState,
  vx: number,
  dt: number,
  radius: number = TUNING.ball.radius,
): void {
  const seconds = Math.max(0, finite(dt))
  state.residual = finite(state.residual) * Math.exp(-TUNING.ball.spinDamping * seconds)
  const omega = rollOmega(vx, radius) + state.residual
  state.angle = normalizeAngle(finite(state.angle) + omega * seconds)
}
