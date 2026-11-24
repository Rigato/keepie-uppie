/**
 * Estado mutável lido pelo overlay de debug. Atualizado em lugar (sem alocação por frame).
 * Só existe quando `?debug=1`; o gameplay pode escrever sem custo perceptível.
 */
export interface DebugState {
  enabled: boolean
  ballX: number
  ballY: number
  ballVx: number
  ballVy: number
  meters: number
  coins: number
  streak: number
  powerup: string
  lastKickArc: number
  lastKickPower: number
  /** Teto de queda do estágio atual (u/s) e estágio de ritmo da run. */
  fallSpeedLimit: number
  difficultyStage: number
  extra: string
}

export const DEBUG_STATE: DebugState = {
  enabled: false,
  ballX: 0,
  ballY: 0,
  ballVx: 0,
  ballVy: 0,
  meters: 0,
  coins: 0,
  streak: 0,
  powerup: '—',
  lastKickArc: 0,
  lastKickPower: 0,
  fallSpeedLimit: 0,
  difficultyStage: 0,
  extra: '',
}
