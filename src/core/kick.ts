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
  /** 0..1 entre o piso e o teto real (inclui o boost profundo). */
  power: number
  /** Offset lateral normalizado -1..1 (esquerda negativa). */
  offset: number
  /** Tempo de voo estimado até voltar à mesma altura. */
  arcTime: number
}

export interface KickOptions {
  /**
   * Distância caída desde o ápice da trajetória, em unidades de mundo.
   * É a medida principal da força: o teto de velocidade de queda saturaria o
   * bônus cedo demais, então a altura perdida continua contando.
   */
  fallDistance?: number
  /**
   * Velocidade-base fixa (u/s) antes do bônus de Perfect. Usada por
   * consumíveis como o Chutão, que não dependem da queda. Quando ausente, a
   * curva normal de força é usada.
   */
  overrideSpeed?: number
  /** Janela central do Perfect (fração do raio de ângulo); o Ponto Doce amplia. */
  perfectWindow?: number
  /** Bônus de velocidade do Perfect; o Ponto Doce aumenta. */
  perfectBonus?: number
  touchRadius?: number
  angleRadius?: number
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
 * de toque; a força vem da distância caída desde o ápice (`fallDistance`) —
 * quanto mais baixo o toque, mais alto o chute. Tocar no ápice é uma
 * embaixadinha curta; esperar a queda é o risco que paga a altura.
 *
 * A curva tem dois estágios: a curva-base (côncava) até 80% da tela e um
 * boost profundo de 80% até a linha de morte, com ganho marginal crescente.
 * O segundo estágio existe para o fundo não "normalizar": cada trecho abaixo
 * de 80% rende mais que o anterior, em vez de menos.
 *
 * O Perfect Touch soma um bônus pequeno de velocidade, mas não substitui o
 * timing: um perfect no ápice continua sendo um chute curto. O alvo de toque
 * (`touchRadius`) é maior que a área do ângulo (`angleRadius`): o jogador pode
 * tocar um pouco fora da bola sem perder o chute, mas a mira continua com a
 * calibração de 60 u (centro = reto, borda do ângulo = máximo).
 */
export function computeKick(
  ball: BallLike,
  point: Vec2,
  options: KickOptions = {},
): KickResult {
  const {
    fallDistance = 0,
    overrideSpeed,
    perfectWindow = TUNING.kick.perfectWindow,
    perfectBonus = TUNING.perfect.speedBonus,
    touchRadius = TUNING.kick.touchRadius,
    angleRadius = TUNING.kick.angleRadius,
  } = options

  if (!isInsideBall({ ...ball, r: touchRadius }, point)) return whiff('miss')
  // Eixo Y cresce para baixo: bola em queda tem vy > 0. Perto do ápice a
  // velocidade é ~0; toleramos uma subida mínima para o toque não "sumir".
  if (ball.vy < -TUNING.kick.apexTolerance) return whiff('notFalling')

  const offset = clamp((point.x - ball.x) / Math.max(1, angleRadius), -1, 1)
  const perfect = Math.abs(offset) <= perfectWindow

  const fallRatio = clamp(fallDistance / TUNING.kick.fullPowerDrop, 0, 1)
  const charged = Math.pow(fallRatio, TUNING.kick.powerCurve)
  const baseSpeed =
    TUNING.kick.minSpeed + (TUNING.kick.maxSpeed - TUNING.kick.minSpeed) * charged

  // Segundo estágio: só a partir de 80% da tela. O expoente >1 faz o ganho
  // por trecho aumentar até o fundo em vez de achatar na curva-base.
  const deepSpan = Math.max(1, TUNING.kick.deepFullDrop - TUNING.kick.deepStartDrop)
  const deepRatio = clamp((fallDistance - TUNING.kick.deepStartDrop) / deepSpan, 0, 1)
  const deepBoost =
    TUNING.kick.deepBonus * Math.pow(deepRatio, TUNING.kick.deepPowerCurve)
  const chargedSpeed = overrideSpeed ?? baseSpeed + deepBoost
  const speed = perfect ? chargedSpeed + perfectBonus : chargedSpeed

  const maxSpeed = Math.max(
    TUNING.kick.maxSpeed + TUNING.kick.deepBonus,
    chargedSpeed,
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
    power: clamp((speed - TUNING.kick.minSpeed) / (maxSpeed - TUNING.kick.minSpeed), 0, 1),
    offset,
    arcTime: (2 * speed) / TUNING.physics.gravity,
  }
}

function whiff(reason: WhiffReason): KickResult {
  return { kind: 'whiff', reason, vx: 0, vy: 0, perfect: false, power: 0, offset: 0, arcTime: 0 }
}
