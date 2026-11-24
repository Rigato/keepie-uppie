import Phaser from 'phaser'
import { clamp } from '../../core/math'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { InteractiveContact, InteractiveFactory, InteractiveKind } from './types'

/** Raio do item (também define a hitbox circular do contato). */
const PICKUP_RADIUS = TUNING.collect.pickupRadius
/** Hexágono da base: um pouco menor que o halo para o contorno respirar. */
const HEX_RADIUS = PICKUP_RADIUS - 4
/** Amplitude da flutuação do visual; nunca desloca a hitbox. */
const FLOAT_AMPLITUDE = 6
/** Velocidade angular da flutuação e do pulso do halo (rad/ms). */
const FLOAT_SPEED = 0.0024
const HALO_SPEED = 0.0032
/** Expansão curta do item ao ser coletado. */
const REACT_MS = 220
/** Partículas de coleta: quantidade e tempo até a autolimpeza. */
const PARTICLE_COUNT = 6
const PARTICLE_MS = 320

/** Identificador do powerup devolvido no contato. */
type PickupId = NonNullable<InteractiveContact['pickup']>

/** Cor e identificador de cada kind de pickup. */
function resolvePickup(kind: InteractiveKind): { pickup: PickupId; color: number } {
  switch (kind) {
    case 'pickupAimed':
      return { pickup: 'aimed', color: PALETTE.aimed }
    case 'pickupShield':
      return { pickup: 'shield', color: PALETTE.shield }
    case 'pickupSweet':
      return { pickup: 'sweet', color: PALETTE.sweet }
    case 'pickupMagnet':
    default:
      // Fallback seguro: a fábrica só é registrada para os quatro pickups.
      return { pickup: 'magnet', color: PALETTE.magnet }
  }
}

/**
 * Pickups de powerup: ímã (Magnet), mira (Aimed Shot), escudo (Shield) e
 * ponto doce (Sweet Spot).
 * A entidade cuida do desenho, da flutuação e do feedback de coleta;
 * o efeito no gameplay é responsabilidade da cena (F4).
 */
export const createPickup: InteractiveFactory = (scene, spec) => {
  const { pickup, color } = resolvePickup(spec.kind)
  // Fase determinística: itens iguais não flutuam nem pulsam em sincronia.
  const phase = clamp(spec.variation, 0, 1) * Math.PI * 2

  // O root fica parado em (spec.x, spec.y); só o visual interno flutua.
  const root = scene.add.container(spec.x, spec.y).setDepth(6)
  const bounds = new Phaser.Geom.Rectangle(
    spec.x - PICKUP_RADIUS,
    spec.y - PICKUP_RADIUS,
    PICKUP_RADIUS * 2,
    PICKUP_RADIUS * 2,
  )

  // Halo de leitura do raio de coleta; pulsa por escala/alpha no update.
  const halo = scene.add.circle(0, 0, PICKUP_RADIUS, color, 0.18)
  halo.setStrokeStyle(1.5, color, 0.55)

  // Container do visual flutuante (base + ícone).
  const visual = scene.add.container(0, 0)

  /** Traça o hexágono de raio `radius` no caminho atual do Graphics. */
  function traceHex(graphics: Phaser.GameObjects.Graphics, radius: number): void {
    graphics.beginPath()
    for (let i = 0; i < 6; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 3
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) graphics.moveTo(x, y)
      else graphics.lineTo(x, y)
    }
    graphics.closePath()
  }

  /** Base geométrica comum: hexágono colorido, contorno claro e painel interno. */
  function makeBase(): Phaser.GameObjects.Graphics {
    const base = scene.add.graphics()

    base.fillStyle(color, 0.92)
    base.lineStyle(1.5, PALETTE.ink, 0.9)
    traceHex(base, HEX_RADIUS)
    base.fillPath()
    base.strokePath()

    // Painel claro separa o ícone escuro do hexágono colorido.
    base.fillStyle(PALETTE.bg, 0.42)
    traceHex(base, HEX_RADIUS * 0.68)
    base.fillPath()

    return base
  }

  /** Ícone de ímã em U: duas hastes verticais ligadas por um arco inferior. */
  function makeMagnetIcon(): Phaser.GameObjects.Graphics {
    const icon = scene.add.graphics()
    const legX = HEX_RADIUS * 0.32
    const topY = -HEX_RADIUS * 0.4
    const bendY = HEX_RADIUS * 0.04

    icon.lineStyle(4, PALETTE.ink, 1)
    icon.beginPath()
    icon.moveTo(-legX, topY)
    icon.lineTo(-legX, bendY)
    // Arco da base passando por baixo (π → 0 no sentido anti-horário).
    icon.arc(0, bendY, legX, Math.PI, 0, true)
    icon.lineTo(legX, topY)
    icon.strokePath()

    return icon
  }

  /** Ícone de mira: círculo, ponto central e quatro ticks cardinais. */
  function makeAimedIcon(): Phaser.GameObjects.Graphics {
    const icon = scene.add.graphics()
    const ringRadius = HEX_RADIUS * 0.43
    const tickInner = HEX_RADIUS * 0.56
    const tickOuter = HEX_RADIUS * 0.78

    icon.lineStyle(2.2, PALETTE.ink, 1)
    icon.strokeCircle(0, 0, ringRadius)
    icon.fillStyle(PALETTE.ink, 1)
    icon.fillCircle(0, 0, 2.4)

    icon.lineStyle(2.2, PALETTE.ink, 1)
    icon.lineBetween(0, -tickInner, 0, -tickOuter)
    icon.lineBetween(0, tickInner, 0, tickOuter)
    icon.lineBetween(-tickInner, 0, -tickOuter, 0)
    icon.lineBetween(tickInner, 0, tickOuter, 0)

    return icon
  }

  /** Ícone de escudo: silhueta sólida, ombros retos e ponta inferior curva. */
  function makeShieldIcon(): Phaser.GameObjects.Graphics {
    const icon = scene.add.graphics()
    const halfWidth = HEX_RADIUS * 0.5
    const top = -HEX_RADIUS * 0.58
    const shoulder = -HEX_RADIUS * 0.04
    const bottom = HEX_RADIUS * 0.7
    const controlY = bottom * 0.55
    const steps = 8

    icon.fillStyle(PALETTE.ink, 1)
    icon.lineStyle(1.4, PALETTE.ink, 1)
    icon.beginPath()
    icon.moveTo(-halfWidth, top)
    icon.lineTo(halfWidth, top)
    icon.lineTo(halfWidth, shoulder)

    // Lado direito desce em curva até a ponta central do escudo.
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps
      const inv = 1 - t
      icon.lineTo(
        inv * inv * halfWidth + 2 * inv * t * (halfWidth * 0.9),
        inv * inv * shoulder + 2 * inv * t * controlY + t * t * bottom,
      )
    }

    // Lado esquerdo sobe espelhado até o ombro.
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps
      const inv = 1 - t
      icon.lineTo(
        -2 * inv * t * (halfWidth * 0.9) - t * t * halfWidth,
        inv * inv * bottom + 2 * inv * t * controlY + t * t * shoulder,
      )
    }

    icon.closePath()
    icon.fillPath()
    icon.strokePath()

    return icon
  }

  /**
   * Ícone de ponto doce: anel duplo e ponto central grande, com quatro ticks
   * diagonais — deliberadamente distinto da mira, que usa ticks cardinais.
   */
  function makeSweetIcon(): Phaser.GameObjects.Graphics {
    const icon = scene.add.graphics()
    const outerRadius = HEX_RADIUS * 0.6
    const innerRadius = HEX_RADIUS * 0.33
    const dotRadius = HEX_RADIUS * 0.24
    const tickInner = HEX_RADIUS * 0.7
    const tickOuter = HEX_RADIUS * 0.86

    icon.lineStyle(2.4, PALETTE.ink, 1)
    icon.strokeCircle(0, 0, outerRadius)
    icon.lineStyle(1.6, PALETTE.ink, 0.9)
    icon.strokeCircle(0, 0, innerRadius)
    icon.fillStyle(PALETTE.ink, 1)
    icon.fillCircle(0, 0, dotRadius)

    icon.lineStyle(2.4, PALETTE.ink, 1)
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      icon.lineBetween(cos * tickInner, sin * tickInner, cos * tickOuter, sin * tickOuter)
    }

    return icon
  }

  /** Escolhe o desenho pelo powerup; todos compartilham a mesma base. */
  function makeIcon(id: PickupId): Phaser.GameObjects.Graphics {
    switch (id) {
      case 'aimed':
        return makeAimedIcon()
      case 'shield':
        return makeShieldIcon()
      case 'sweet':
        return makeSweetIcon()
      case 'magnet':
        return makeMagnetIcon()
    }
  }

  visual.add([makeBase(), makeIcon(pickup)])
  root.add([halo, visual])

  let spent = false
  let destroyed = false
  let flashRing: Phaser.GameObjects.Arc | null = null
  const particles: Phaser.GameObjects.Arc[] = []

  /** Remove uma partícula da lista e da cena, com segurança para tweens. */
  function removeParticle(particle: Phaser.GameObjects.Arc): void {
    const index = particles.indexOf(particle)
    if (index >= 0) particles.splice(index, 1)
    scene.tweens.killTweensOf(particle)
    if (particle.active) particle.destroy()
  }

  /** Limpa o anel de flash anterior antes de criar um novo. */
  function clearFlash(): void {
    if (!flashRing) return
    const ring = flashRing
    flashRing = null
    scene.tweens.killTweensOf(ring)
    if (ring.active) ring.destroy()
  }

  /** Seis faíscas na cor do powerup, todas autolimpando em ~PARTICLE_MS. */
  function spawnParticles(): void {
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + phase
      const distance = 18 + (i % 3) * 4
      const particle = scene.add
        .circle(spec.x + Math.cos(angle) * 6, spec.y + Math.sin(angle) * 6, 2.4, color, 1)
        .setDepth(7)

      particles.push(particle)
      scene.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * distance,
        y: particle.y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.35,
        scaleY: 0.35,
        duration: PARTICLE_MS,
        ease: 'Quad.easeOut',
        onComplete: () => removeParticle(particle),
      })
    }
  }

  function update(dtSeconds: number, timeMs: number): void {
    if (destroyed || spent) return

    // Flutuação só no visual: root e bounds permanecem em spec.x/spec.y.
    const floatT = timeMs * FLOAT_SPEED + phase
    visual.setY(Math.sin(floatT) * FLOAT_AMPLITUDE)

    const pulse = 0.5 + 0.5 * Math.sin(timeMs * HALO_SPEED + phase)
    halo.setScale(1 + pulse * 0.1)
    halo.setAlpha(0.55 + pulse * 0.35)
  }

  function contact(ball: { x: number; y: number; r: number }): InteractiveContact | null {
    if (destroyed || spent) return null

    const distance = Math.hypot(ball.x - spec.x, ball.y - spec.y)
    if (distance > PICKUP_RADIUS + ball.r) return null

    spent = true
    return {
      result: 'pickup',
      pickup,
      point: { x: spec.x, y: spec.y },
      strength: 1,
    }
  }

  function react(_contact: InteractiveContact): void {
    if (destroyed) return

    // Flash: o item expande e some enquanto o halo abre e apaga.
    scene.tweens.killTweensOf(visual)
    scene.tweens.killTweensOf(halo)
    visual.setScale(1)
    scene.tweens.add({
      targets: visual,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0,
      duration: REACT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (visual.active) visual.setVisible(false)
      },
    })
    scene.tweens.add({
      targets: halo,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: REACT_MS,
      ease: 'Quad.easeOut',
    })

    // Anel de choque curto, filho do root para herdar a posição do item.
    clearFlash()
    const ring = scene.add.circle(0, 0, PICKUP_RADIUS * 0.45, color, 0.5)
    ring.setStrokeStyle(2, PALETTE.ink, 0.95)
    root.add(ring)
    flashRing = ring
    scene.tweens.add({
      targets: ring,
      scaleX: 1.9,
      scaleY: 1.9,
      alpha: 0,
      duration: REACT_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (flashRing === ring) flashRing = null
        if (ring.active) ring.destroy()
      },
    })

    spawnParticles()
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    scene.tweens.killTweensOf(visual)
    scene.tweens.killTweensOf(halo)
    scene.tweens.killTweensOf(root)
    clearFlash()
    for (const particle of [...particles]) removeParticle(particle)
    particles.length = 0

    if (root.active) root.destroy(true)
  }

  return {
    kind: spec.kind,
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
