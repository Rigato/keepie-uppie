import Phaser from 'phaser'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { InteractiveContact, InteractiveFactory } from './types'

/** Zona de passagem: o CENTRO da bola precisa caber dentro desta fração do raio. */
const PASS_RADIUS = TUNING.collect.ringRadius * TUNING.collect.ringPassRatio

/** Pulsação do aro: puramente visual, a zona de contato nunca muda. */
const PULSE_PERIOD_MS = 1200
const PULSE_SCALE = 0.018
const PULSE_ALPHA = 0.12

/** Celebração: aro expandindo + leque de pontos de moeda, tudo em ~450 ms. */
const CELEBRATION_MS = 450
const CELEBRATION_SCALE = 1.6
const CELEBRATION_STAGGER_MS = 60
const DOT_RADIUS = 4
const DOT_START_RATIO = 0.3
const DOT_TRAVEL_RATIO = 1.2
const FX_DEPTH = 7

/** Cor clara para o brilho do aro, como nos obstáculos duros. */
const HIGHLIGHT_COLOR = 0xffffff

/**
 * Argola: a bola precisa atravessar por dentro para ganhar o burst de moedas.
 * Só conta quando o centro da bola entra na zona interna — raspar na borda não
 * premia. A entidade cuida do desenho, do teste e da celebração local; a cena
 * aplica as moedas e toca o som.
 */
export const createRing: InteractiveFactory = (scene, spec) => {
  const radius = TUNING.collect.ringRadius
  const thickness = TUNING.collect.ringThickness
  const outer = radius + thickness / 2

  const root = scene.add.container(spec.x, spec.y).setDepth(6)

  // Um único Graphics concentra o aro vazado e as marcas; nenhum preenchimento
  // cobre o miolo, então a silhueta lê como portal, não como disco.
  const visual = scene.add.graphics()
  root.add(visual)

  // Aro principal: só o traço, centrado no raio de tuning.
  visual.lineStyle(thickness, PALETTE.ring, 1)
  visual.strokeCircle(0, 0, radius)

  // Brilho fino deslocado para fora e sombra na borda interna dão volume ao aro.
  visual.lineStyle(1.5, HIGHLIGHT_COLOR, 0.16)
  visual.strokeCircle(0, 0, radius + thickness * 0.3)
  visual.lineStyle(1, PALETTE.bg, 0.55)
  visual.strokeCircle(0, 0, radius - thickness * 0.45)

  // Aro interno tênue: mostra onde o centro da bola precisa passar.
  visual.lineStyle(1.5, PALETTE.ring, 0.3)
  visual.strokeCircle(0, 0, PASS_RADIUS)

  // Quatro marcas cardeais atravessam a espessura do aro.
  const markerInner = radius - thickness * 0.7
  const markerOuter = radius + thickness * 0.7
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2 - Math.PI / 2 // topo, direita, baixo, esquerda
    visual.lineStyle(Math.max(2, thickness * 0.2), PALETTE.ink, 0.8)
    visual.lineBetween(
      Math.cos(angle) * markerInner,
      Math.sin(angle) * markerInner,
      Math.cos(angle) * markerOuter,
      Math.sin(angle) * markerOuter,
    )
  }

  // Limites generosos para descarte/debug; a passagem real usa PASS_RADIUS.
  const bounds = new Phaser.Geom.Rectangle(
    spec.x - outer - 3,
    spec.y - outer - 3,
    (outer + 3) * 2,
    (outer + 3) * 2,
  )

  // Fase própria por seed: argolas próximas não pulsam em uníssono.
  const pulseOffset = spec.variation * Math.PI * 2
  const particles: Phaser.GameObjects.GameObject[] = []

  let spent = false
  let reacted = false
  let destroyed = false

  function removeFx(target: Phaser.GameObjects.GameObject): void {
    const index = particles.indexOf(target)
    if (index >= 0) particles.splice(index, 1)
    if (target.active) target.destroy()
  }

  /** Aro expansível + pontos de moeda em leque; vivem fora do root. */
  function celebrate(): void {
    const shock = scene.add.graphics().setPosition(spec.x, spec.y).setDepth(FX_DEPTH)
    shock.lineStyle(Math.max(2, thickness * 0.55), PALETTE.ring, 0.9)
    shock.strokeCircle(0, 0, radius)
    particles.push(shock)

    scene.tweens.add({
      targets: shock,
      scaleX: CELEBRATION_SCALE,
      scaleY: CELEBRATION_SCALE,
      alpha: 0,
      duration: CELEBRATION_MS,
      ease: 'Quad.easeOut',
      onComplete: () => removeFx(shock),
    })

    const count = Math.max(1, Math.round(TUNING.collect.ringCoinBurst))
    const startRadius = radius * DOT_START_RATIO
    const travel = radius * DOT_TRAVEL_RATIO
    const maxStagger = CELEBRATION_STAGGER_MS

    for (let i = 0; i < count; i += 1) {
      // Leque radial completo: funciona para passagem de subida ou descida.
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2
      const delay = Math.round((i / Math.max(1, count - 1)) * maxStagger)
      // Atraso + voo fecham juntos nos 450 ms da celebração.
      const duration = Math.max(1, CELEBRATION_MS - delay)
      const distance = startRadius + travel * (0.9 + (i % 3) * 0.08)
      const startX = spec.x + Math.cos(angle) * startRadius
      const startY = spec.y + Math.sin(angle) * startRadius

      const dot = scene.add
        .circle(startX, startY, DOT_RADIUS, PALETTE.coin, 1)
        .setDepth(FX_DEPTH)
      particles.push(dot)

      scene.tweens.add({
        targets: dot,
        x: spec.x + Math.cos(angle) * distance,
        y: spec.y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        delay,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => removeFx(dot),
      })
    }
  }

  function contact(ball: { x: number; y: number; r: number }): InteractiveContact | null {
    if (destroyed || spent) return null

    // Só o centro conta: a borda da bola não alarga a zona de passagem.
    if (Math.hypot(ball.x - spec.x, ball.y - spec.y) > PASS_RADIUS) return null

    spent = true
    return {
      result: 'ring',
      point: { x: spec.x, y: spec.y },
      strength: 1,
      coins: TUNING.collect.ringCoinBurst,
    }
  }

  function react(_contact: InteractiveContact): void {
    if (destroyed || reacted || !spent) return
    reacted = true

    // O aro original some rápido; o aro expansível assume a celebração.
    scene.tweens.killTweensOf(root)
    scene.tweens.killTweensOf(visual)
    visual.setScale(1).setAlpha(1)
    scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (root.active) root.setVisible(false)
      },
    })

    celebrate()
  }

  function update(_dtSeconds: number, timeMs: number): void {
    if (destroyed || spent) return

    // Onda 0..1: mexe apenas no visual, mantendo bounds e PASS_RADIUS intactos.
    const phase = (timeMs / PULSE_PERIOD_MS) * Math.PI * 2 + pulseOffset
    const wave = (Math.sin(phase) + 1) / 2
    visual.setScale(1 + (wave - 0.5) * PULSE_SCALE * 2)
    visual.setAlpha(1 - PULSE_ALPHA + wave * PULSE_ALPHA)
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    scene.tweens.killTweensOf(root)
    scene.tweens.killTweensOf(visual)

    for (const target of [...particles]) {
      scene.tweens.killTweensOf(target)
      removeFx(target)
    }

    if (root.active) root.destroy(true)
  }

  return {
    kind: 'ring',
    root,
    bounds,
    get spent(): boolean {
      return spent
    },
    update,
    contact,
    react,
    destroy,
  }
}
