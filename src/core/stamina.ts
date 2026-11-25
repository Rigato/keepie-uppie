import { TUNING } from '../game/tuning'

export interface StaminaSpend {
  /** true quando o chute foi bloqueado por exaustão. */
  blocked: boolean
  /** true no chute que zerou a barra e iniciou a exaustão. */
  justExhausted: boolean
}

export interface StaminaConfig {
  max: number
  kickCost: number
  regenPerSecond: number
  recoverMs: number
}

/**
 * Estamina do jogador: cada chute válido custa uma fatia da barra; ao esgotar,
 * os chutes são bloqueados por um instante curto enquanto a barra recarrega.
 *
 * Tudo é puro (sem Phaser, DOM ou tempo real): a cena informa o delta em
 * segundos e decide o que fazer com o resultado de `spendKick`. O medidor só
 * informa — o chute que zera a barra ainda é considerado válido (`blocked:
 * false`, `justExhausted: true`).
 */
export class StaminaMeter {
  readonly max: number
  readonly recoverMs: number
  value: number

  private readonly kickCost: number
  private readonly regenPerSecond: number
  private recovering = false
  private recoverElapsed = 0

  constructor(config: StaminaConfig = TUNING.stamina) {
    this.max = config.max
    this.value = this.max
    this.kickCost = config.kickCost
    this.regenPerSecond = config.regenPerSecond
    this.recoverMs = Math.max(0, config.recoverMs)
  }

  /** Fração da barra restante, em 0..1. */
  get ratio(): number {
    return this.max > 0 ? this.value / this.max : 0
  }

  /** true durante o bloqueio curto depois de esgotar. */
  get exhausted(): boolean {
    return this.recovering
  }

  /**
   * Avança a barra em `dt` segundos. Durante a exaustão a recarga é linear de
   * 0 até `max` em `recoverMs`; fora dela, `regenPerSecond` recupera aos poucos.
   * Delta inválido ou negativo é ignorado; delta grande é aceito (sem clamp).
   */
  update(dtSeconds: number): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return

    if (this.recovering) {
      this.recoverElapsed += dtSeconds * 1000
      if (this.recoverElapsed >= this.recoverMs) {
        this.value = this.max
        this.recovering = false
        this.recoverElapsed = 0
      } else {
        this.value = this.max * (this.recoverElapsed / this.recoverMs)
      }
      return
    }

    this.value = Math.min(this.max, this.value + this.regenPerSecond * dtSeconds)
  }

  /**
   * Tenta gastar um chute. Bloqueia e não mexe na barra durante a exaustão.
   * Fora dela, o custo é aplicado mesmo com saldo parcial: se chegar a ≤ 0, a
   * barra zera e a exaustão começa, mas este chute ainda é válido.
   */
  spendKick(): StaminaSpend {
    if (this.recovering) return { blocked: true, justExhausted: false }

    this.value -= this.kickCost
    if (this.value <= 0) {
      this.value = 0
      this.recovering = true
      this.recoverElapsed = 0
      return { blocked: false, justExhausted: true }
    }

    return { blocked: false, justExhausted: false }
  }

  /** Volta à barra cheia, sem exaustão. */
  reset(): void {
    this.value = this.max
    this.recovering = false
    this.recoverElapsed = 0
  }
}
