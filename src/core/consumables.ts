/**
 * Catálogo de consumíveis da loja. É dado de design, não de gameplay: os
 * efeitos vivem na cena e os preços são calibração (`[TESTE]`).
 *
 * Ativáveis (Magnet, Power Kick e Streak Saver) aparecem na barra da run e
 * gastam uma unidade quando o jogador toca no ícone. Safety Net é passiva e
 * gasta a unidade só quando salva a bola.
 */
export type ConsumableId = 'net' | 'magnet' | 'chutao' | 'streak'

/** Consumíveis que o jogador ativa manualmente durante a run. */
export type ActivatableId = 'magnet' | 'chutao' | 'streak'

export interface ConsumableDef {
  id: ConsumableId
  /** Nome in-game (inglês, como o resto do HUD). */
  name: string
  /** Descrição curta in-game (inglês). */
  description: string
  /** Preço em moedas. [TESTE] */
  price: number
  /** Passivo = não tem ícone na barra da run; o efeito dispara sozinho. */
  passive: boolean
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  net: {
    id: 'net',
    name: 'SAFETY NET',
    description: 'Saves the ball once when it crosses the death line.',
    price: 50,
    passive: true,
  },
  magnet: {
    id: 'magnet',
    name: 'MAGNET',
    /** 45 s = `TUNING.consumable.magnetDurationMs` (o pickup do mundo é 15 s). */
    description: 'Tap its icon in-game to attract coins for 45s.',
    price: 30,
    passive: false,
  },
  chutao: {
    id: 'chutao',
    name: 'POWER KICK',
    description: 'Tap its icon in-game; your next kick becomes a full-power Chutão.',
    price: 40,
    passive: false,
  },
  streak: {
    id: 'streak',
    name: 'STREAK SAVER',
    description: 'Tap its icon in-game to protect your streak from one whiff.',
    price: 25,
    passive: false,
  },
}

/** Ordem de exibição na loja. */
export const CONSUMABLE_IDS: readonly ConsumableId[] = ['net', 'magnet', 'chutao', 'streak']

/** Ordem dos ícones ativáveis na barra da run (ignora os passivos). */
export const ACTIVATABLE_IDS: readonly ActivatableId[] = ['magnet', 'chutao', 'streak']

/** Slots do loadout pré-run, sem repetição (regra decidida no GDD). */
export const LOADOUT_SIZE = 3

export function isConsumableId(value: unknown): value is ConsumableId {
  return typeof value === 'string' && (CONSUMABLE_IDS as readonly string[]).includes(value)
}

export function isActivatable(id: ConsumableId): id is ActivatableId {
  return (ACTIVATABLE_IDS as readonly string[]).includes(id)
}

/** Inventário vazio, sempre uma cópia nova. */
export function emptyInventory(): Record<ConsumableId, number> {
  return { net: 0, magnet: 0, chutao: 0, streak: 0 }
}

/**
 * Fim do Magnet depois de ativar uma fonte. Nunca encurta um efeito ativo:
 * o pickup de 15 s não derruba o consumível de 45 s, mas o consumível estende
 * o pickup. Reativar a mesma fonte renova a partir de `now`.
 */
export function nextMagnetEndsAt(
  now: number,
  currentEndsAt: number,
  durationMs: number,
): number {
  return Math.max(currentEndsAt, now + durationMs)
}
