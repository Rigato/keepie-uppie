import { TUNING } from '../game/tuning'

/**
 * Estágio de ritmo da run (0 = começo). A altitude que conta é o pico da run,
 * que só sobe — o estágio nunca volta atrás no meio de uma run.
 */
export function difficultyStageAt(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  return Math.floor(meters / TUNING.difficulty.stageMeters)
}

/**
 * Teto de queda (u/s) para a altitude de pico da run. Cresce em degraus de
 * `fallSpeedStep` a cada `stageMeters` e satura em `fallSpeedLimit`.
 */
export function fallSpeedLimitAt(meters: number): number {
  const stage = difficultyStageAt(meters)
  const limit =
    TUNING.physics.maxFallSpeed + stage * TUNING.difficulty.fallSpeedStep
  return Math.min(limit, TUNING.difficulty.fallSpeedLimit)
}
