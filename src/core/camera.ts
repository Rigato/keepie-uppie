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
