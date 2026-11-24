import type Phaser from 'phaser'
import type { InteractiveKind, InteractiveSpawn } from '../../game/contracts'
import { createCoin } from './coin'
import { createPickup } from './pickup'
import { createRing } from './ring'
import { createSpring } from './spring'
import type { InteractiveFactory, InteractiveInstance } from './types'

/**
 * Registro central de interativos. Kinds ainda sem fábrica são ignorados com
 * segurança (mesmo padrão dos obstáculos).
 */
const FACTORIES: Partial<Record<InteractiveKind, InteractiveFactory>> = {
  coin: createCoin,
  spring: createSpring,
  ring: createRing,
  pickupMagnet: createPickup,
  pickupAimed: createPickup,
  pickupShield: createPickup,
  pickupSweet: createPickup,
}

export function createInteractive(
  scene: Phaser.Scene,
  spec: InteractiveSpawn,
): InteractiveInstance | null {
  const factory = FACTORIES[spec.kind]
  return factory ? factory(scene, spec) : null
}

export type { InteractiveContact, InteractiveInstance, InteractiveSpawn } from './types'
