import { describe, expect, it } from 'vitest'
import {
  CONSUMABLES,
  CONSUMABLE_IDS,
  LOADOUT_SIZE,
  emptyInventory,
} from '../src/core/consumables'
import {
  buy,
  canBuy,
  canEquip,
  consume,
  equippedIds,
  isEquipped,
  ownedCount,
  toggleEquip,
} from '../src/core/shop'
import { createDefaultSave, type SaveV1 } from '../src/platform/storage'

function saveWith(overrides: Partial<SaveV1> = {}): SaveV1 {
  return { ...createDefaultSave(), ...overrides }
}

describe('loja: compra', () => {
  it('desconta o preço e adiciona uma unidade ao inventário', () => {
    const save = saveWith({ totalCoins: 100 })
    const next = buy(save, 'net')
    expect(next.totalCoins).toBe(100 - CONSUMABLES.net.price)
    expect(ownedCount(next, 'net')).toBe(1)
    // Imutável: o save de entrada não muda.
    expect(save.totalCoins).toBe(100)
    expect(ownedCount(save, 'net')).toBe(0)
  })

  it('não compra sem moedas suficientes', () => {
    const save = saveWith({ totalCoins: CONSUMABLES.chutao.price - 1 })
    expect(canBuy(save, 'chutao')).toBe(false)
    expect(buy(save, 'chutao')).toBe(save)
    expect(ownedCount(buy(save, 'chutao'), 'chutao')).toBe(0)
  })

  it('permite comprar repetido e acumula no pool', () => {
    const save = saveWith({ totalCoins: CONSUMABLES.magnet.price * 2 })
    const first = buy(save, 'magnet')
    const second = buy(first, 'magnet')
    expect(ownedCount(second, 'magnet')).toBe(2)
    expect(second.totalCoins).toBe(0)
  })
})

describe('loja: loadout', () => {
  it('só equipa item com posse', () => {
    const save = saveWith()
    expect(canEquip(save, 'net')).toBe(false)
    expect(toggleEquip(save, 'net')).toBe(save)
    expect(isEquipped(toggleEquip(save, 'net'), 'net')).toBe(false)
  })

  it('equipa e desequipa devolvendo o item ao pool', () => {
    const save = saveWith({ inventory: { net: 1, magnet: 1, chutao: 1, streak: 0 } })
    const equipped = toggleEquip(save, 'net')
    expect(isEquipped(equipped, 'net')).toBe(true)
    expect(ownedCount(equipped, 'net')).toBe(1)

    const unequipped = toggleEquip(equipped, 'net')
    expect(isEquipped(unequipped, 'net')).toBe(false)
    expect(ownedCount(unequipped, 'net')).toBe(1)
  })

  it('não repete o mesmo item e respeita o limite de 3 slots', () => {
    const save = saveWith({ inventory: { net: 1, magnet: 1, chutao: 1, streak: 0 } })
    let next = toggleEquip(save, 'net')
    expect(next.loadout).toEqual(['net'])
    expect(canEquip(next, 'net')).toBe(false)
    // Equipar de novo desequipa, em vez de duplicar.
    next = toggleEquip(next, 'net')
    expect(next.loadout).toEqual([])

    next = toggleEquip(next, 'magnet')
    next = toggleEquip(next, 'chutao')
    next = toggleEquip(next, 'net')
    expect(next.loadout).toHaveLength(LOADOUT_SIZE)
    expect(new Set(next.loadout).size).toBe(LOADOUT_SIZE)
  })

  it('equippedIds ignora item sem posse e repetição', () => {
    const save = saveWith({
      loadout: ['net', 'net', 'magnet', 'chutao'],
      inventory: { net: 0, magnet: 1, chutao: 1, streak: 0 },
    })
    expect(equippedIds(save)).toEqual(['magnet', 'chutao'])
    expect(
      equippedIds(
        saveWith({ loadout: ['net'], inventory: { net: 1, magnet: 0, chutao: 0, streak: 0 } }),
      ),
    ).toEqual(['net'])
  })
})

describe('loja: consumo', () => {
  it('gasta uma unidade e mantém o loadout enquanto houver posse', () => {
    const save = saveWith({ inventory: { net: 2, magnet: 0, chutao: 0, streak: 0 }, loadout: ['net'] })
    const once = consume(save, 'net')
    expect(ownedCount(once, 'net')).toBe(1)
    expect(once.loadout).toEqual(['net'])

    const twice = consume(once, 'net')
    expect(ownedCount(twice, 'net')).toBe(0)
    expect(twice.loadout).toEqual([])
  })

  it('não gasta item inexistente e não muta a entrada', () => {
    const save = saveWith({ inventory: { net: 1, magnet: 0, chutao: 0, streak: 0 }, loadout: ['net'] })
    expect(consume(save, 'magnet')).toBe(save)
    consume(save, 'net')
    expect(ownedCount(save, 'net')).toBe(1)
    expect(save.loadout).toEqual(['net'])
  })
})

describe('loja: catálogo', () => {
  it('tem preços positivos e ids coerentes', () => {
    for (const def of Object.values(CONSUMABLES)) {
      expect(def.price).toBeGreaterThan(0)
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it('tem o Streak Saver ativável e a Safety Net passiva', () => {
    expect(CONSUMABLES.net.passive).toBe(true)
    expect(CONSUMABLES.streak.passive).toBe(false)
    expect(CONSUMABLE_IDS).toContain('streak')
    expect(emptyInventory().streak).toBe(0)
  })
})
