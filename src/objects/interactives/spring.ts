import Phaser from 'phaser'
import { circleRectHit } from '../../core/collision'
import type { BallLike } from '../../game/contracts'
import { PALETTE } from '../../game/palette'
import { TUNING } from '../../game/tuning'
import type { InteractiveContact, InteractiveFactory } from './types'

/** Altura da base escura e da placa clara; o resto é o corpo da mola. */
const BASE_HEIGHT = 4
const PLATE_HEIGHT = 5
/** Recuos laterais do zigue-zague e da placa clara. */
const COIL_INSET = 9
const PLATE_INSET = 5
/** Compressão do contato: escala mínima e metade da duração total (ida e volta). */
const COMPRESS_SCALE_Y = 0.5
const COMPRESS_HALF_MS = 80
/** Tempo do flash/linha de impulso acima da placa. */
const IMPULSE_MS = 220

const SPRING_BASE = Phaser.Display.Color.ValueToColor(PALETTE.spring)
const LIGHT_COLOR = Phaser.Display.Color.GetColor(
  Math.min(255, SPRING_BASE.red + 40),
  Math.min(255, SPRING_BASE.green + 55),
  Math.min(255, SPRING_BASE.blue + 40),
)
const DARK_COLOR = Phaser.Display.Color.GetColor(
  Math.round(SPRING_BASE.red * 0.3),
  Math.round(SPRING_BASE.green * 0.28),
  Math.round(SPRING_BASE.blue * 0.3),
)

/**
 * Mola: plataforma rosa que lança a bola alto sem consumir chute.
 * A hitbox é o retângulo fixo `springWidth` × `springHeight` centrado em
 * (spec.x, spec.y); a compressão é apenas visual e não altera os bounds.
 */
export const createSpring: InteractiveFactory = (scene, spec) => {
  const width = TUNING.collect.springWidth
  const height = TUNING.collect.springHeight
  const bodyHeight = Math.max(1, height - BASE_HEIGHT - PLATE_HEIGHT)
  const plateWidth = width - PLATE_INSET * 2

  const bounds = new Phaser.Geom.Rectangle(
    spec.x - width / 2,
    spec.y - height / 2,
    width,
    height,
  )

  const root = scene.add.container(spec.x, spec.y).setDepth(6)

  // Brilho sutil: elipses largas de alfa baixo, atrás de tudo.
  const glow = scene.add.graphics()
  glow.fillStyle(PALETTE.spring, 0.07)
  glow.fillEllipse(0, 0, width * 1.32, height * 2.4)
  glow.fillStyle(PALETTE.spring, 0.11)
  glow.fillEllipse(0, 2, width * 0.94, height * 1.5)

  // Base escura e fina, fixa no fundo do retângulo.
  const base = scene.add.graphics()
  base.fillStyle(DARK_COLOR, 1)
  base.fillRoundedRect(
    -width / 2,
    height / 2 - BASE_HEIGHT,
    width,
    BASE_HEIGHT,
    BASE_HEIGHT / 2,
  )
  base.lineStyle(1, PALETTE.bg, 0.55)
  base.strokeRoundedRect(
    -width / 2 + 0.5,
    height / 2 - BASE_HEIGHT + 0.5,
    width - 1,
    BASE_HEIGHT - 1,
    BASE_HEIGHT / 2,
  )
  base.lineStyle(1, LIGHT_COLOR, 0.22)
  base.lineBetween(
    -width / 2 + 4,
    height / 2 - BASE_HEIGHT + 0.5,
    width / 2 - 4,
    height / 2 - BASE_HEIGHT + 0.5,
  )

  // Corpo + placa em uma camada própria, ancorada na base: comprimir a escala
  // vertical empurra a placa para baixo sem deslocar a hitbox.
  const coilLayer = scene.add.container(0, height / 2 - BASE_HEIGHT)
  const coil = scene.add.graphics()

  // Zigue-zague do corpo: 3 ou 4 voltas conforme a variação determinística.
  const turns = spec.variation < 0.5 ? 3 : 4
  const coilLeft = -width / 2 + COIL_INSET
  const coilRight = width / 2 - COIL_INSET

  const traceZigzag = (
    graphics: Phaser.GameObjects.Graphics,
    lineWidth: number,
    color: number,
    alpha: number,
  ): void => {
    graphics.lineStyle(lineWidth, color, alpha)
    graphics.beginPath()
    graphics.moveTo(coilLeft, 0)
    for (let i = 1; i <= turns; i += 1) {
      const t = i / turns
      graphics.lineTo(coilLeft + (coilRight - coilLeft) * t, -bodyHeight * t)
    }
    graphics.strokePath()
  }

  // Sombra escura sob o traço claro dá relevo ao zigue-zague.
  traceZigzag(coil, 4, DARK_COLOR, 0.85)
  traceZigzag(coil, 2, LIGHT_COLOR, 0.95)

  // Placa clara no topo: o "pise aqui" da mola.
  coil.fillStyle(LIGHT_COLOR, 1)
  coil.fillRoundedRect(
    -plateWidth / 2,
    -bodyHeight - PLATE_HEIGHT,
    plateWidth,
    PLATE_HEIGHT,
    PLATE_HEIGHT / 2,
  )
  coil.lineStyle(1, PALETTE.bg, 0.5)
  coil.strokeRoundedRect(
    -plateWidth / 2 + 0.5,
    -bodyHeight - PLATE_HEIGHT + 0.5,
    plateWidth - 1,
    PLATE_HEIGHT - 1,
    PLATE_HEIGHT / 2,
  )
  coil.lineStyle(1.5, 0xffffff, 0.6)
  coil.lineBetween(
    -plateWidth / 2 + 5,
    -bodyHeight - PLATE_HEIGHT + 1.5,
    plateWidth / 2 - 5,
    -bodyHeight - PLATE_HEIGHT + 1.5,
  )

  coilLayer.add(coil)

  // Impulso: flash na placa e linha com seta apontando para cima.
  const impulse = scene.add.graphics()
  const topY = -height / 2
  impulse.fillStyle(0xffffff, 0.65)
  impulse.fillRoundedRect(
    -plateWidth / 2 + 3,
    topY,
    plateWidth - 6,
    PLATE_HEIGHT,
    PLATE_HEIGHT / 2,
  )
  impulse.lineStyle(2, PALETTE.ink, 0.85)
  impulse.lineBetween(0, topY - 5, 0, topY - 27)
  impulse.beginPath()
  impulse.moveTo(-6, topY - 19)
  impulse.lineTo(0, topY - 27)
  impulse.lineTo(6, topY - 19)
  impulse.strokePath()
  impulse.setAlpha(0).setVisible(false)

  root.add([glow, base, coilLayer, impulse])

  let lastContactAt = Number.NEGATIVE_INFINITY
  let destroyed = false

  function contact(ball: BallLike): InteractiveContact | null {
    if (destroyed) return null

    // A mola dispara em qualquer direção de movimento, inclusive com a bola subindo.
    const now = performance.now()
    if (now - lastContactAt < TUNING.collect.springCooldownMs) return null

    const hit = circleRectHit(ball.x, ball.y, ball.r, bounds)
    if (!hit) return null

    lastContactAt = now
    return { result: 'launch', point: hit.point, strength: 1 }
  }

  function react(_feedback: InteractiveContact): void {
    if (destroyed) return

    // Compressão ancorada na base: desce e volta em ~160 ms.
    scene.tweens.killTweensOf(coilLayer)
    coilLayer.setScale(1, 1)
    scene.tweens.add({
      targets: coilLayer,
      scaleY: COMPRESS_SCALE_Y,
      duration: COMPRESS_HALF_MS,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (coilLayer.active) coilLayer.setScale(1, 1)
      },
    })

    // Flash/linha de impulso some logo em seguida.
    scene.tweens.killTweensOf(impulse)
    impulse.setVisible(true).setAlpha(0.9)
    scene.tweens.add({
      targets: impulse,
      alpha: 0,
      duration: IMPULSE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (impulse.active) impulse.setVisible(false)
      },
    })
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    scene.tweens.killTweensOf(coilLayer)
    scene.tweens.killTweensOf(impulse)
    scene.tweens.killTweensOf(root)
    if (root.active) root.destroy()
  }

  return {
    kind: 'spring',
    root,
    bounds,
    spent: false,
    update(): void {
      // Estática: a mola não tem movimento próprio.
    },
    contact,
    react,
    destroy,
  }
}
