import { describe, expect, it } from 'vitest'
import { emptyInventory } from '../src/core/consumables'
import type { PlatformStorage } from '../src/platform/types'
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  SaveStore,
  createDefaultSave,
  sanitizeSave,
} from '../src/platform/storage'

class MemoryStorage implements PlatformStorage {
  readonly data = new Map<string, string>()

  async get(keys: string[]): Promise<(string | null)[]> {
    return keys.map((key) => this.data.get(key) ?? null)
  }

  async set(keys: string[], values: string[]): Promise<void> {
    keys.forEach((key, i) => this.data.set(key, values[i] ?? ''))
  }

  async remove(keys: string[]): Promise<void> {
    keys.forEach((key) => this.data.delete(key))
  }
}

describe('SaveStore', () => {
  it('começa do zero quando não há save', async () => {
    const store = new SaveStore(new MemoryStorage())
    await expect(store.load()).resolves.toEqual(DEFAULT_SAVE)
  })

  it('faz roundtrip do save com loja', async () => {
    const storage = new MemoryStorage()
    const store = new SaveStore(storage)
    const save = {
      ...createDefaultSave(),
      bestMeters: 123,
      totalCoins: 42,
      muted: true,
      inventory: { net: 2, magnet: 1, chutao: 0, streak: 1 },
      loadout: ['net', 'magnet'] as const,
    }
    await store.save({ ...save, loadout: [...save.loadout] })
    expect(await store.load()).toEqual({ ...save, loadout: [...save.loadout] })
  })

  it('ignora save corrompido e começa do zero', async () => {
    const storage = new MemoryStorage()
    await storage.set([SAVE_KEY], ['{oops'])
    const store = new SaveStore(storage)
    expect(await store.load()).toEqual(DEFAULT_SAVE)
  })

  it('reset apaga o save e devolve os defaults', async () => {
    const storage = new MemoryStorage()
    const store = new SaveStore(storage)
    await store.save({
      ...createDefaultSave(),
      bestMeters: 900,
      totalCoins: 12,
      muted: true,
    })
    expect(await store.reset()).toEqual(DEFAULT_SAVE)
    expect(await store.load()).toEqual(DEFAULT_SAVE)
  })

  it('não lança quando o storage falha', async () => {
    const broken: PlatformStorage = {
      get: () => Promise.reject(new Error('blocked')),
      set: () => Promise.reject(new Error('blocked')),
      remove: () => Promise.reject(new Error('blocked')),
    }
    const store = new SaveStore(broken)
    expect(await store.load()).toEqual(DEFAULT_SAVE)
    await expect(store.save(DEFAULT_SAVE)).resolves.toBeUndefined()
  })
})

describe('sanitizeSave', () => {
  it('limita números inválidos e negativos', () => {
    const save = sanitizeSave({ bestMeters: -50, totalCoins: Number.NaN })
    expect(save.bestMeters).toBe(0)
    expect(save.totalCoins).toBe(0)
  })

  it('aceita campos desconhecidos e força a versão atual', () => {
    const save = sanitizeSave({
      version: 99,
      bestMeters: 12.9,
      totalCoins: 3,
      muted: 'yes',
      extra: 1,
    })
    expect(save).toEqual({
      ...createDefaultSave(),
      bestMeters: 12.9,
      totalCoins: 3,
      muted: false,
    })
  })

  it('não aceita lixo', () => {
    expect(sanitizeSave(null)).toEqual(DEFAULT_SAVE)
    expect(sanitizeSave('x')).toEqual(DEFAULT_SAVE)
    expect(sanitizeSave([])).toEqual(DEFAULT_SAVE)
  })

  it('save antigo sem loja ganha inventário e loadout vazios', () => {
    const save = sanitizeSave({ version: 1, bestMeters: 500, totalCoins: 20, muted: false })
    expect(save.inventory).toEqual(emptyInventory())
    expect(save.loadout).toEqual([])
  })

  it('clampa o inventário e limpa o loadout inválido', () => {
    const save = sanitizeSave({
      inventory: { net: -3, magnet: 2.9, chutao: 1_000_000, hacked: 5 },
      loadout: ['chutao', 'chutao', 'net', 'magnet', 'unknown', 'hacked'],
    })
    expect(save.inventory).toEqual({ net: 0, magnet: 2, chutao: 999, streak: 0 })
    // chutao tem posse e entra; net foi clampado para 0 e sai; magnet entra;
    // 'unknown'/'hacked' e a repetição de chutao são descartados.
    expect(save.loadout).toEqual(['chutao', 'magnet'])
  })

  it('não compartilha o inventário do DEFAULT_SAVE entre saves', () => {
    const first = sanitizeSave(null)
    const second = sanitizeSave(null)
    first.inventory.net = 9
    expect(second.inventory.net).toBe(0)
    expect(DEFAULT_SAVE.inventory.net).toBe(0)
  })
})
