import type { InteractiveKind, InteractiveSpawn, Vec2 } from '../../game/contracts'
import type Phaser from 'phaser'

export type { InteractiveKind, InteractiveSpawn }

export interface InteractiveContact {
  /** Efeito no gameplay; a cena aplica e remove o item consumido. */
  result: 'collect' | 'ring' | 'launch' | 'pickup'
  point: Vec2
  /** 0..1 para volume/partículas/shake. */
  strength: number
  /** Moedas entregues no contato (1 na moeda; burst na argola). */
  coins?: number
  /** Qual powerup foi pego. */
  pickup?: 'magnet' | 'aimed'
}

/**
 * Contrato de um interativo. A entidade cuida de desenho, movimento próprio,
 * detecção e reação visual; a cena aplica efeito (moeda, burst, lançamento,
 * armar powerup) e toca som. Nenhuma entidade conhece HUD, score ou áudio.
 */
export interface InteractiveInstance {
  readonly kind: InteractiveKind
  readonly root: Phaser.GameObjects.Container
  readonly bounds: Phaser.Geom.Rectangle
  /** Consumido: não colide mais. A cena decide quando remover o root. */
  readonly spent: boolean
  update(dtSeconds: number, timeMs: number): void
  contact(ball: { x: number; y: number; r: number }): InteractiveContact | null
  /** Magnet: moedas se deslocam na direção do alvo. Outros kinds não implementam. */
  attract?(target: { x: number; y: number }, dtSeconds: number, speed: number): void
  /** Feedback local: pop da moeda, flash da argola, compressão da mola. */
  react(contact: InteractiveContact): void
  destroy(): void
}

export type InteractiveFactory = (
  scene: Phaser.Scene,
  spec: InteractiveSpawn,
) => InteractiveInstance
