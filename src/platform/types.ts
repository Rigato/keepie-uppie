/** Host detectado no boot. Só o boot pode perguntar "qual é o portal?". */
export type PlatformHost = 'fallback' | 'playgama' | 'crazygames'

/**
 * Contrato de storage no formato dos portais: arrays de mesmo tamanho.
 * `null` = chave ausente. Implementações nunca lançam por storage indisponível.
 */
export interface PlatformStorage {
  get(keys: string[]): Promise<(string | null)[]>
  set(keys: string[], values: string[]): Promise<void>
  remove(keys: string[]): Promise<void>
}

/** Serviço estável consumido pelo jogo. O gameplay nunca fala com o portal. */
export interface PlatformService {
  readonly host: PlatformHost
  readonly storage: PlatformStorage
  init(): Promise<void>
  /** Emitir uma única vez, no primeiro frame jogável e interativo. */
  markGameReady(): void
  onPause(cb: () => void): void
  onResume(cb: () => void): void
  /** Retorna true se o estado de áudio mudou para mutado. */
  isDocumentHidden(): boolean
}
