import { TUNING } from '../game/tuning'

/** Metros de altitude a partir da subida máxima da bola. */
export function metersFromTop(startY: number, minBallY: number, pxPerMeter = TUNING.physics.pxPerMeter): number {
  if (!Number.isFinite(startY) || !Number.isFinite(minBallY)) return 0
  return Math.max(0, (startY - minBallY) / pxPerMeter)
}

/**
 * Câmera-catraca: sobe com a bola e nunca desce.
 * `scrollY` cresce para baixo (convenção do Phaser): subir = diminuir.
 * Retorna o novo scrollY, sempre <= atual.
 */
export function ratchetCameraY(
  currentScrollY: number,
  ballY: number,
  viewHeight: number,
  triggerRatio = TUNING.camera.ratchetAt,
): number {
  const trigger = ballY - viewHeight * triggerRatio
  return Math.min(currentScrollY, trigger)
}

/** Suaviza a catraca sem nunca descer. */
export function smoothCameraY(
  currentScrollY: number,
  targetScrollY: number,
  dtSeconds: number,
  speed = TUNING.camera.followSpeed,
): number {
  const target = Math.min(currentScrollY, targetScrollY)
  const t = 1 - Math.exp(-speed * Math.max(0, dtSeconds))
  return currentScrollY + (target - currentScrollY) * t
}

/**
 * Recuo de zoom proporcional à força do chute (0 = sem recuo, até
 * `kickZoomMax`). Abaixo do threshold nada acontece; acima, um smoothstep
 * entrega o máximo suavemente em `power = 1` sem tranco no início da rampa.
 * Fora de 0..1 clampa; entradas inválidas viram 0 (nenhum zoom).
 */
export function kickZoomAmount(power: number): number {
  if (!Number.isFinite(power)) return 0
  const clamped = Math.max(0, Math.min(1, power))
  const threshold = TUNING.camera.kickZoomThreshold
  if (clamped <= threshold || threshold >= 1) return 0
  const t = (clamped - threshold) / (1 - threshold)
  const smooth = t * t * (3 - 2 * t)
  return smooth * TUNING.camera.kickZoomMax
}

/**
 * Fases do recuo de zoom durante o voo da bola:
 * - `idle`: sem chute ativo, zoom normal;
 * - `open`: chute forte acabou de sair — a câmera abre e segue aberta na subida;
 * - `closing`: a bola chegou ao ápice e o recuo volta a 1 sem esperar a queda.
 */
export type FlightZoomPhase = 'idle' | 'open' | 'closing'

/**
 * Avança a fase do recuo. O fechamento começa EXATAMENTE no ápice, quando
 * `vy` cruza para >= 0, e não quando a bola desce perto da zona de toque.
 * `closing` não volta a `open` sozinha: só um chute novo pode reabrir. Uma
 * leitura inválida de `vy` mantém a fase (evita pisco por dado ruim).
 */
export function advanceFlightZoom(phase: FlightZoomPhase, vy: number): FlightZoomPhase {
  if (!Number.isFinite(vy)) return phase
  if (phase === 'open' && vy >= 0) return 'closing'
  return phase
}

/** Alvo de zoom da fase: `open` recua de `amount`; as demais voltam a 1. */
export function flightZoomTarget(phase: FlightZoomPhase, amount: number): number {
  if (phase !== 'open') return 1
  // Sem recuo válido não há por que mexer na câmera (e um NaN vazaria para o zoom).
  if (!Number.isFinite(amount)) return 1
  return 1 - Math.max(0, Math.min(1, amount))
}

/**
 * Aproximação exponencial contínua (sem overshoot) para o zoom da câmera.
 * `dt <= 0` ou qualquer entrada inválida mantém o valor atual — nada de
 * reinícios bruscos que façam a tela piscar.
 */
export function smoothZoom(
  current: number,
  target: number,
  dtSeconds: number,
  speed: number = TUNING.camera.zoomOpenSpeed,
): number {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(target) ||
    !Number.isFinite(dtSeconds) ||
    !Number.isFinite(speed) ||
    dtSeconds <= 0
  ) {
    return current
  }
  const rate = Math.max(0, speed)
  const t = 1 - Math.exp(-rate * dtSeconds)
  return current + (target - current) * t
}
