import {
  CONSUMABLE_IDS,
  LOADOUT_SIZE,
  emptyInventory,
  isConsumableId,
  type ConsumableId,
} from '../core/consumables'
import type { PlatformStorage } from './types'

export const SAVE_KEY = 'save'
export const SAVE_VERSION = 1

export interface SaveV1 {
  version: 1
  bestMeters: number
  totalCoins: number
  muted: boolean
  /** Consumíveis comprados e ainda não gastos. */
  inventory: Record<ConsumableId, number>
  /** Consumíveis equipados para a próxima run (sem repetição). */
  loadout: ConsumableId[]
}

/** Save novo, com inventário e loadout próprios (sem objetos compartilhados). */
export function createDefaultSave(): SaveV1 {
  return {
    version: SAVE_VERSION,
    bestMeters: 0,
    totalCoins: 0,
    muted: false,
    inventory: emptyInventory(),
    loadout: [],
  }
}

export const DEFAULT_SAVE: SaveV1 = createDefaultSave()

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function sanitizeInventory(raw: unknown): Record<ConsumableId, number> {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const inventory = emptyInventory()
  for (const id of CONSUMABLE_IDS) {
    inventory[id] = Math.floor(clampNumber(source[id], 0, 999, 0))
  }
  return inventory
}

/**
 * Loadout válido: só ids conhecidos, sem repetição, com posse e no máximo 3.
 * Entradas inválidas de um save antigo/corrompido são descartadas em silêncio.
 */
function sanitizeLoadout(
  raw: unknown,
  inventory: Record<ConsumableId, number>,
): ConsumableId[] {
  if (!Array.isArray(raw)) return []
  const loadout: ConsumableId[] = []
  for (const value of raw) {
    if (!isConsumableId(value)) continue
    if (loadout.includes(value)) continue
    if (inventory[value] <= 0) continue
    loadout.push(value)
    if (loadout.length >= LOADOUT_SIZE) break
  }
  return loadout
}

/**
 * Aceita qualquer coisa vinda do storage e devolve um save válido.
 * Save desconhecido/corrompido não derruba o jogo: começa do zero.
 * Saves da 0.2.0 (sem inventário/loja) viram um save novo com os campos
 * aditivos zerados.
 */
export function sanitizeSave(raw: unknown): SaveV1 {
  if (!raw || typeof raw !== 'object') return createDefaultSave()
  const obj = raw as Record<string, unknown>
  const inventory = sanitizeInventory(obj.inventory)
  return {
    version: SAVE_VERSION,
    bestMeters: clampNumber(obj.bestMeters, 0, 100_000, 0),
    totalCoins: clampNumber(obj.totalCoins, 0, 1_000_000_000, 0),
    muted: obj.muted === true,
    inventory,
    loadout: sanitizeLoadout(obj.loadout, inventory),
  }
}

/** Persistência do progresso. Única porta de entrada/saída de save do jogo. */
export class SaveStore {
  constructor(private readonly storage: PlatformStorage) {}

  async load(): Promise<SaveV1> {
    try {
      const [raw] = await this.storage.get([SAVE_KEY])
      if (!raw) return createDefaultSave()
      return sanitizeSave(JSON.parse(raw))
    } catch {
      return createDefaultSave()
    }
  }

  async save(save: SaveV1): Promise<void> {
    try {
      await this.storage.set([SAVE_KEY], [JSON.stringify(save)])
    } catch (error) {
      console.warn('[save] falha ao gravar', error)
    }
  }

  async reset(): Promise<SaveV1> {
    try {
      await this.storage.remove([SAVE_KEY])
    } catch {
      // ignore
    }
    return createDefaultSave()
  }
}

/** Formata metros como o HUD exibe: inteiro. */
export function formatMeters(meters: number): string {
  return `${Math.max(0, Math.floor(meters))} m`
}
