import type { PlatformHost, PlatformService, PlatformStorage } from './types'

const LOCAL_PREFIX = 'keepie.'

/** Storage em memória: fallback final quando até localStorage está bloqueado. */
class MemoryStorage implements PlatformStorage {
  private data = new Map<string, string>()

  async get(keys: string[]): Promise<(string | null)[]> {
    return keys.map((key) => this.data.get(key) ?? null)
  }

  async set(keys: string[], values: string[]): Promise<void> {
    if (keys.length !== values.length) throw new Error('storage.set: tamanhos diferentes')
    keys.forEach((key, i) => this.data.set(key, values[i] ?? ''))
  }

  async remove(keys: string[]): Promise<void> {
    keys.forEach((key) => this.data.delete(key))
  }
}

/**
 * localStorage com prefixo. Na primeira falha (modo privado, iframe, cota),
 * passa a usar memória para o resto da sessão — leitura e escrita consistentes.
 */
class LocalStorageAdapter implements PlatformStorage {
  private useMemory = false

  constructor(private readonly fallback: MemoryStorage) {}

  private get ls(): Storage | null {
    if (this.useMemory) return null
    try {
      return window.localStorage
    } catch {
      this.useMemory = true
      return null
    }
  }

  async get(keys: string[]): Promise<(string | null)[]> {
    const ls = this.ls
    if (!ls) return this.fallback.get(keys)
    try {
      return keys.map((key) => ls.getItem(LOCAL_PREFIX + key))
    } catch {
      this.useMemory = true
      return this.fallback.get(keys)
    }
  }

  async set(keys: string[], values: string[]): Promise<void> {
    if (keys.length !== values.length) throw new Error('storage.set: tamanhos diferentes')
    const ls = this.ls
    if (!ls) return this.fallback.set(keys, values)
    try {
      keys.forEach((key, i) => ls.setItem(LOCAL_PREFIX + key, values[i] ?? ''))
    } catch {
      this.useMemory = true
      await this.fallback.set(keys, values)
    }
  }

  async remove(keys: string[]): Promise<void> {
    const ls = this.ls
    if (!ls) return this.fallback.remove(keys)
    try {
      keys.forEach((key) => ls.removeItem(LOCAL_PREFIX + key))
    } catch {
      this.useMemory = true
      await this.fallback.remove(keys)
    }
  }
}

/**
 * Adapter padrão para GitHub Pages, itch.io e GameFlare: localStorage + memória.
 * Não há SDK externo, nenhum request de rede.
 */
export class FallbackAdapter implements PlatformService {
  readonly host: PlatformHost = 'fallback'
  readonly storage: PlatformStorage

  private ready = false
  private pauseCbs: Array<() => void> = []
  private resumeCbs: Array<() => void> = []

  constructor() {
    const memory = new MemoryStorage()
    this.storage = new LocalStorageAdapter(memory)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseCbs.forEach((cb) => cb())
      else this.resumeCbs.forEach((cb) => cb())
    })
  }

  async init(): Promise<void> {
    // Sem SDK: nada a inicializar. Mantido para o contrato.
    this.ready = true
  }

  markGameReady(): void {
    if (!this.ready) console.warn('[platform] game_ready antes do init')
    console.info('[platform] ready (fallback)')
  }

  onPause(cb: () => void): void {
    this.pauseCbs.push(cb)
  }

  onResume(cb: () => void): void {
    this.resumeCbs.push(cb)
  }

  isDocumentHidden(): boolean {
    return document.hidden
  }
}
