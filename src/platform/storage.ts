import type { PlatformStorage } from './types'

export const SAVE_KEY = 'save'
export const SAVE_VERSION = 1

export interface SaveV1 {
  version: 1
  bestMeters: number
  totalCoins: number
  muted: boolean
}

export const DEFAULT_SAVE: SaveV1 = {
  version: SAVE_VERSION,
  bestMeters: 0,
  totalCoins: 0,
  muted: false,
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/**
 * Aceita qualquer coisa vinda do storage e devolve um save válido.
 * Save desconhecido/corrompido não derruba o jogo: começa do zero.
 */
export function sanitizeSave(raw: unknown): SaveV1 {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SAVE }
  const obj = raw as Record<string, unknown>
  return {
    version: SAVE_VERSION,
    bestMeters: clampNumber(obj.bestMeters, 0, 100_000, 0),
    totalCoins: clampNumber(obj.totalCoins, 0, 1_000_000_000, 0),
    muted: obj.muted === true,
  }
}

/** Persistência do progresso. Única porta de entrada/saída de save do jogo. */
export class SaveStore {
  constructor(private readonly storage: PlatformStorage) {}

  async load(): Promise<SaveV1> {
    try {
      const [raw] = await this.storage.get([SAVE_KEY])
      if (!raw) return { ...DEFAULT_SAVE }
      return sanitizeSave(JSON.parse(raw))
    } catch {
      return { ...DEFAULT_SAVE }
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
    return { ...DEFAULT_SAVE }
  }
}

/** Formata metros como o HUD exibe: inteiro. */
export function formatMeters(meters: number): string {
  return `${Math.max(0, Math.floor(meters))} m`
}
