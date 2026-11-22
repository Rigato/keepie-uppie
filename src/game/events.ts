import type { EntityKind } from './contracts'

/**
 * Event bus tipado. Entidades emitem fatos; FX, HUD e meta reagem.
 * Nenhuma entidade conhece som, partícula ou UI.
 */
export type GameEventMap = {
  runStart: Record<string, never>
  kick: { x: number; y: number; vx: number; vy: number; power: number; perfect: boolean; arcTime: number }
  whiff: { x: number; y: number }
  wallBounce: { x: number; y: number; side: 'left' | 'right'; speed: number }
  obstacleContact: {
    x: number
    y: number
    kind: EntityKind
    result: 'reflect' | 'damp' | 'shatter' | 'deflect'
    strength: number
  }
  coin: { x: number; y: number; value: number; fever: boolean }
  ring: { x: number; y: number }
  spring: { x: number; y: number }
  pickup: { x: number; y: number; kind: 'magnet' | 'aimed' }
  powerupStart: { kind: 'magnet' | 'aimed'; durationMs: number }
  powerupEnd: { kind: 'magnet' | 'aimed' }
  streak: { count: number; label: string | null }
  feverStart: { durationMs: number }
  feverEnd: Record<string, never>
  death: { meters: number; coins: number }
  retry: Record<string, never>
}

type Listener<T> = (payload: T) => void

export class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>()

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener as Listener<never>)
    return () => this.off(event, listener)
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of set) {
      ;(listener as Listener<Events[K]>)(payload)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const gameEvents = new TypedEmitter<GameEventMap>()
