import { TUNING } from '../game/tuning'

export type StreakLabel = 'NICE' | 'GREAT' | 'ON FIRE'

/**
 * Multiplicador aditivo de velocidade do chute (0 = sem bônus).
 *
 * O bônus é calculado com o streak ANTES do chute atual, para o próprio chute
 * não se autoalimentar: em 3 (NICE) dá 1,5%, em 6 (GREAT) 3% e em 10 (ON FIRE)
 * 5%, o teto. Os bônus de moedas/febre não mudam.
 */
export function kickBoostFor(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0
  const s = TUNING.streak
  return Math.min(count * s.kickBoostPerKick, s.kickBoostMax)
}

export interface StreakKick {
  /** Chutes limpos consecutivos depois deste. */
  count: number
  /** Rótulo alcançado exatamente neste chute (null se não cruzou um marco). */
  label: StreakLabel | null
  /** Febre começou ou foi renovada neste chute. */
  feverStarted: boolean
}

/** Tier atual do streak (não implica que o marco acabou de ser cruzado). */
export function labelForCount(count: number): StreakLabel | null {
  const s = TUNING.streak
  if (count >= s.onFireAt) return 'ON FIRE'
  if (count >= s.greatAt) return 'GREAT'
  if (count >= s.niceAt) return 'NICE'
  return null
}

/**
 * Streak de chutes limpos. Quebra só em whiff; colisão com obstáculo não conta.
 * A febre começa ao alcançar ON FIRE e é renovada a cada múltiplo do marco.
 */
export class StreakTracker {
  count = 0
  best = 0

  registerKick(): StreakKick {
    const s = TUNING.streak
    this.count += 1
    this.best = Math.max(this.best, this.count)

    const label: StreakLabel | null =
      this.count === s.niceAt
        ? 'NICE'
        : this.count === s.greatAt
          ? 'GREAT'
          : this.count === s.onFireAt
            ? 'ON FIRE'
            : null

    const feverStarted =
      this.count === s.onFireAt || (this.count > s.onFireAt && this.count % s.onFireAt === 0)

    return { count: this.count, label, feverStarted }
  }

  registerWhiff(): void {
    this.count = 0
  }

  reset(): void {
    this.count = 0
    this.best = 0
  }
}
