import type { BallLike, ObstacleKind, ObstacleSpawn, Vec2 } from '../../game/contracts'
import type Phaser from 'phaser'

export type { ObstacleSpawn } from '../../game/contracts'

export interface ObstacleContact {
  /** Efeito no gameplay; a cena aplica na bola. */
  result: 'reflect' | 'damp' | 'shatter' | 'deflect' | 'bounce'
  point: Vec2
  /** Obrigatório em 'bounce': lado do impacto em relação ao centro da barreira. */
  side?: -1 | 1
  /** Obrigatória em 'reflect': normal para fora da superfície. */
  normal?: Vec2
  /** Empurrão para fora (evita grudar no obstáculo). */
  penetration?: number
  /** Obrigatório em 'deflect': impulso a somar na velocidade da bola. */
  impulse?: Vec2
  /** Restituição do quique; ausente = `physics.wallRestitution`. */
  restitution?: number
  /** 0..1 para volume/shake/partículas. */
  strength: number
}

/**
 * Contrato de um obstáculo. A entidade cuida de desenho, movimento próprio,
 * teste de contato e reação visual; a cena aplica o efeito na bola e toca som.
 * Nenhuma entidade conhece HUD, score ou áudio.
 */
export interface ObstacleInstance {
  readonly kind: ObstacleKind
  readonly root: Phaser.GameObjects.Container
  readonly bounds: Phaser.Geom.Rectangle
  /** Já foi consumida (estilhaçou) e não deve colidir nem desenhar mais. */
  readonly spent: boolean
  /** Movimento próprio (birds). */
  update(dtSeconds: number, timeMs: number): void
  /** null = sem contato neste frame. A entidade aplica seu próprio cooldown. */
  contact(ball: BallLike): ObstacleContact | null
  /** Feedback local do contato (deformar, estilhaçar). */
  react(contact: ObstacleContact): void
  destroy(): void
}

export type ObstacleFactory = (scene: Phaser.Scene, spec: ObstacleSpawn) => ObstacleInstance
