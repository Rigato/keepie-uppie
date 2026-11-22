import Phaser from 'phaser'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { InteractiveContact, InteractiveFactory } from './types'

/** Interativos ficam na frente do cenário, atrás apenas da bola e do HUD. */
const DEPTH = 6
/** Fragmentos do pop nascem na frente da moeda. */
const FRAGMENT_DEPTH = 7

/** Shimmer: meia-volta do tween em ms, escala mínima em X e atraso máximo. */
const SHIMMER_MS = 1050
const SHIMMER_MIN_SCALE_X = 0.82
const SHIMMER_MAX_DELAY_MS = 900

/** Pop: quantidade de fragmentos, distância máxima e duração. */
const POP_MIN = 4
const POP_MAX = 6
const POP_DISTANCE = 24
const POP_MS = 300

/** Contato da moeda é o feedback mais forte entre os interativos. */
const CONTACT_STRENGTH = 1

/**
 * Moeda: alvo circular que entrega `coinValue` e some no primeiro contato.
 * A hitbox é o círculo de raio `coinRadius` centrado em (spec.x, spec.y).
 */
export const createCoin: InteractiveFactory = (scene, spec) => {
  const radius = TUNING.collect.coinRadius
  const variation = Math.min(1, Math.max(0, spec.variation))

  // Posição mutável: o Magnet puxa a moeda sem mexer na cena.
  let x = spec.x
  let y = spec.y

  const root = scene.add.container(x, y).setDepth(DEPTH)

  // Corpo: disco dourado, aro interno mais escuro e brilho branco no canto.
  const visual = scene.add.graphics()
  visual.fillStyle(PALETTE.coin, 1)
  visual.fillCircle(0, 0, radius)
  visual.lineStyle(Math.max(1.5, radius * 0.12), PALETTE.ballShade, 0.9)
  visual.strokeCircle(0, 0, radius * 0.66)
  visual.fillStyle(0xffffff, 0.6)
  visual.fillCircle(-radius * 0.32, -radius * 0.34, radius * 0.2)
  root.add(visual)

  // Shimmer lento em X; o atraso vem da variação para as moedas não pulsarem juntas.
  scene.tweens.add({
    targets: root,
    scaleX: { from: 1, to: SHIMMER_MIN_SCALE_X },
    duration: SHIMMER_MS,
    delay: variation * SHIMMER_MAX_DELAY_MS,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  })

  const bounds = new Phaser.Geom.Rectangle(x - radius, y - radius, radius * 2, radius * 2)

  // Fragmentos vivem na cena (não no root), pois o root pode sumir logo após o
  // contato; cada um se autolimpa ao fim do tween.
  const fragments = new Set<Phaser.GameObjects.Arc>()
  let spent = false
  let destroyed = false

  function spawnFragments(centerX: number, centerY: number): void {
    const count = POP_MIN + Math.round(variation * (POP_MAX - POP_MIN))
    const startAngle = variation * Math.PI * 2

    for (let i = 0; i < count; i += 1) {
      const angle = startAngle + (i / count) * Math.PI * 2
      const piece = scene.add
        .circle(centerX, centerY, Math.max(1.5, radius * 0.16), PALETTE.coin, 0.95)
        .setDepth(FRAGMENT_DEPTH)
      fragments.add(piece)

      const distance = POP_DISTANCE * (0.7 + (0.3 * (i + 1)) / count)
      scene.tweens.add({
        targets: piece,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: POP_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
          fragments.delete(piece)
          piece.destroy()
        },
      })
    }
  }

  function contact(ball: { x: number; y: number; r: number }): InteractiveContact | null {
    if (destroyed || spent) return null

    const hit = Math.hypot(ball.x - x, ball.y - y) <= radius + ball.r
    if (!hit) return null

    spent = true

    return {
      result: 'collect',
      coins: TUNING.collect.coinValue,
      point: { x, y },
      strength: CONTACT_STRENGTH,
    }
  }

  function attract(target: { x: number; y: number }, dtSeconds: number, speed: number): void {
    if (destroyed || spent) return
    const dx = target.x - x
    const dy = target.y - y
    const distance = Math.hypot(dx, dy)
    if (distance < 1) return

    const step = Math.min(distance, Math.max(0, speed * dtSeconds))
    x += (dx / distance) * step
    y += (dy / distance) * step
    root.setPosition(x, y)
    bounds.setPosition(x - radius, y - radius)
  }

  function react(contactResult: InteractiveContact): void {
    if (destroyed) return
    spawnFragments(contactResult.point.x, contactResult.point.y)
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    scene.tweens.killTweensOf(root)
    if (root.active) root.destroy(true)

    for (const piece of fragments) {
      scene.tweens.killTweensOf(piece)
      piece.destroy()
    }
    fragments.clear()
  }

  return {
    kind: 'coin',
    root,
    bounds,
    get spent(): boolean {
      return spent
    },
    update(): void {
      // Estática: o brilho é um tween contínuo.
    },
    contact,
    attract,
    react,
    destroy,
  }
}
