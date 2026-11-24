import {
  CONSUMABLES,
  LOADOUT_SIZE,
  type ConsumableId,
} from './consumables'
import type { SaveV1 } from '../platform/storage'

/** Quantos itens do tipo o jogador possui no pool. */
export function ownedCount(save: SaveV1, id: ConsumableId): number {
  return save.inventory[id] ?? 0
}

export function canBuy(save: SaveV1, id: ConsumableId): boolean {
  return save.totalCoins >= CONSUMABLES[id].price
}

/**
 * Compra uma unidade: desconta as moedas e devolve um save novo. Sem moedas
 * suficientes, devolve o mesmo save (a loja não deve cobrar parcial).
 */
export function buy(save: SaveV1, id: ConsumableId): SaveV1 {
  if (!canBuy(save, id)) return save
  return {
    ...save,
    totalCoins: save.totalCoins - CONSUMABLES[id].price,
    inventory: {
      ...save.inventory,
      [id]: ownedCount(save, id) + 1,
    },
  }
}

export function isEquipped(save: SaveV1, id: ConsumableId): boolean {
  return save.loadout.includes(id)
}

/** Equipar exige posse, não repetir e caber nos 3 slots. */
export function canEquip(save: SaveV1, id: ConsumableId): boolean {
  return (
    !isEquipped(save, id) &&
    ownedCount(save, id) > 0 &&
    save.loadout.length < LOADOUT_SIZE
  )
}

export function toggleEquip(save: SaveV1, id: ConsumableId): SaveV1 {
  if (isEquipped(save, id)) {
    return { ...save, loadout: save.loadout.filter((item) => item !== id) }
  }
  if (!canEquip(save, id)) return save
  return { ...save, loadout: [...save.loadout, id] }
}

/**
 * Itens realmente disponíveis para a próxima run: equipados, com posse e sem
 * repetição. É a fonte de verdade da cena, que nunca lê o loadout cru.
 */
export function equippedIds(save: SaveV1): ConsumableId[] {
  const seen = new Set<ConsumableId>()
  const ready: ConsumableId[] = []
  for (const id of save.loadout) {
    if (seen.has(id) || ownedCount(save, id) <= 0) continue
    seen.add(id)
    ready.push(id)
    if (ready.length >= LOADOUT_SIZE) break
  }
  return ready
}

/**
 * Gasta uma unidade. Quando a última unidade sai, o item também sai do
 * loadout, para a próxima run não abrir um slot fantasma.
 */
export function consume(save: SaveV1, id: ConsumableId): SaveV1 {
  const count = ownedCount(save, id)
  if (count <= 0) return save
  const nextCount = count - 1
  return {
    ...save,
    inventory: { ...save.inventory, [id]: nextCount },
    loadout:
      nextCount === 0 ? save.loadout.filter((item) => item !== id) : save.loadout,
  }
}
