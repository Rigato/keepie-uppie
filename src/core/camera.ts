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
