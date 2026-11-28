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

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * Envelope 0..1 do afastamento da câmera durante o voo da bola.
 *
 * Enquanto a bola sobe (`vy < 0`) o zoom fica totalmente aberto (1). Na queda,
 * o afastamento se mantém até `ballScreenY = viewHeight * zoomHoldUntil` e
 * fecha com smoothstep até `viewHeight * zoomCloseAt`; abaixo disso o alvo é
 * o zoom normal (0). Entradas inválidas devolvem 1 de propósito: manter o
 * afastamento evita um salto/pisco de zoom quando uma leitura falha.
 */
export function flightZoomEnvelope(
  vy: number,
  ballScreenY: number,
  viewHeight: number,
): number {
  if (
    !Number.isFinite(vy) ||
    !Number.isFinite(ballScreenY) ||
    !Number.isFinite(viewHeight) ||
    viewHeight <= 0
  ) {
    return 1
  }
  if (vy < 0) return 1

  const hold = viewHeight * TUNING.camera.zoomHoldUntil
  const close = viewHeight * TUNING.camera.zoomCloseAt
  if (ballScreenY <= hold) return 1
  if (ballScreenY >= close) return 0
  const span = close - hold
  if (span <= 0) return 0
  return 1 - smoothstep((ballScreenY - hold) / span)
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
