/**
 * Catálogo de consumíveis da loja. É dado de design, não de gameplay: os
 * efeitos vivem na cena e os preços são calibração (`[TESTE]`).
 */
export type ConsumableId = 'net' | 'magnet' | 'chutao'

export interface ConsumableDef {
  id: ConsumableId
  /** Nome in-game (inglês, como o resto do HUD). */
  name: string
  /** Descrição curta in-game (inglês). */
  description: string
  /** Preço em moedas. [TESTE] */
  price: number
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  net: {
    id: 'net',
    name: 'SAFETY NET',
    description: 'Saves the ball once when it crosses the death line.',
    price: 50,
  },
  magnet: {
    id: 'magnet',
    name: 'MAGNET START',
    description: 'Starts the run with a 15s magnet.',
    price: 30,
  },
  chutao: {
    id: 'chutao',
    name: 'POWER KICK',
    description: 'The first kick of the run becomes a full-power Chutão.',
    price: 40,
  },
}

/** Ordem de exibição na loja. */
export const CONSUMABLE_IDS: readonly ConsumableId[] = ['net', 'magnet', 'chutao']

/** Slots do loadout pré-run, sem repetição (regra decidida no GDD). */
export const LOADOUT_SIZE = 3

export function isConsumableId(value: unknown): value is ConsumableId {
  return typeof value === 'string' && (CONSUMABLE_IDS as readonly string[]).includes(value)
}

/** Inventário vazio, sempre uma cópia nova. */
export function emptyInventory(): Record<ConsumableId, number> {
  return { net: 0, magnet: 0, chutao: 0 }
}
