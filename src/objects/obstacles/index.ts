import type Phaser from 'phaser'
import type { ObstacleKind, ObstacleSpawn } from '../../game/contracts'
import { createBirds } from './birds'
import { createBarrier } from './barrier'
import { createBreakable } from './breakable'
import { createBumper } from './bumper'
import { createRamp } from './ramp'
import type { ObstacleFactory, ObstacleInstance } from './types'

/**
 * Registro central de obstáculos. Cada lote entrega sua factory; a cena só
 * conhece este mapa. Kinds ainda sem fábrica são ignorados com segurança.
 */
const FACTORIES: Partial<Record<ObstacleKind, ObstacleFactory>> = {
  barrier: createBarrier,
  breakable: createBreakable,
  bird: createBirds,
  bumper: createBumper,
  ramp: createRamp,
}

export function createObstacle(
  scene: Phaser.Scene,
  spec: ObstacleSpawn,
): ObstacleInstance | null {
  const factory = FACTORIES[spec.kind]
  return factory ? factory(scene, spec) : null
}

export type { ObstacleContact, ObstacleInstance, ObstacleSpawn } from './types'
