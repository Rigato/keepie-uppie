import Phaser from 'phaser'
import { clamp } from '../core/math'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'

/** Instantâneo da mira, calculado pela cena; esta UI só desenha. */
export interface AimReadout {
  pointerX: number
  pointerY: number
  /** 0..1 da barra de força. */
  ratio: number
  remainingMs: number
  windowMs: number
  maxDrag: number
}

/** Abaixo do HUD (100) e acima de todo o gameplay. */
const DEPTH = 95
/** Anel do timer em volta da bola. */
const RING_RADIUS = 40
const RING_THICKNESS = 3
/** Barra de força. */
const BAR_WIDTH = 120
const BAR_HEIGHT = 8
/** Limites (em mundo = tela com a câmera parada) que viram o layout. */
const TOP_EDGE = 190
const BOTTOM_EDGE = 880
/** Abaixo disto o arrasto é "tap": a linha aponta reto para cima. */
const MIN_DRAG = 12
const FALLBACK_LENGTH = 60
/** Margem para a ponta e a seta nunca saírem da tela. */
const DRAW_MARGIN = 16
/** Ponta de seta da linha de mira. */
const ARROW_LENGTH = 11
const ARROW_SPREAD = 0.45
/** Folga mínima dos textos em relação às bordas. */
const TEXT_MARGIN = 4

interface AimOffsets {
  title: number
  timer: number
  bar: number
  hint: number
}

/**
 * Deslocamentos verticais em relação ao centro da bola. No caso padrão o
 * cabeçalho fica acima e a barra abaixo; perto de uma borda, o bloco que
 * sairia da tela passa para o outro lado.
 */
const OFFSETS: { normal: AimOffsets; nearTop: AimOffsets; nearBottom: AimOffsets } = {
  normal: { title: -87, timer: -70, bar: 56, hint: 74 },
  nearTop: { title: 56, timer: 73, bar: 96, hint: 114 },
  nearBottom: { title: -124, timer: -107, bar: -92, hint: -74 },
}

/**
 * Overlay da pausa de mira do Aimed Shot: linha/força do arrasto, anel do
 * timer e rótulos. Desenha em coordenadas de mundo (scrollFactor padrão),
 * pois a câmera fica parada durante a mira.
 */
export class AimUi {
  private readonly gfx: Phaser.GameObjects.Graphics
  private readonly title: Phaser.GameObjects.Text
  private readonly timerText: Phaser.GameObjects.Text
  private readonly hint: Phaser.GameObjects.Text
  private readonly container: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setScrollFactor(0)

    this.title = scene.add
      .text(0, 0, 'AIMED SHOT', {
        fontFamily: FONT_SANS,
        fontSize: '12px',
        color: CSS_PALETTE.accent,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setScrollFactor(0)

    this.timerText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    this.hint = scene.add
      .text(0, 0, 'RELEASE TO FIRE', {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    this.container = scene.add
      .container(0, 0, [this.gfx, this.title, this.timerText, this.hint])
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false)
  }

  show(ballX: number, ballY: number): void {
    this.gfx.clear()
    this.timerText.setText('')
    this.placeTexts(ballX, ballY, this.offsetsFor(ballY))
    this.container.setVisible(true)
  }

  update(ballX: number, ballY: number, readout: AimReadout): void {
    const offsets = this.offsetsFor(ballY)
    this.gfx.clear()

    this.drawTimer(ballX, ballY, readout)
    this.drawAimLine(ballX, ballY, readout)
    this.drawForceBar(ballX, ballY, readout.ratio, offsets.bar)

    const seconds = Math.max(0, readout.remainingMs) / 1000
    this.timerText.setText(`${seconds.toFixed(1)}s`)
    this.placeTexts(ballX, ballY, offsets)
  }

  hide(): void {
    this.container.setVisible(false)
    this.gfx.clear()
  }

  /** Escolhe o bloco de layout que não encosta nas bordas. */
  private offsetsFor(ballY: number): AimOffsets {
    if (ballY < TOP_EDGE) return OFFSETS.nearTop
    if (ballY > BOTTOM_EDGE) return OFFSETS.nearBottom
    return OFFSETS.normal
  }

  private placeTexts(ballX: number, ballY: number, offsets: AimOffsets): void {
    this.title.setPosition(this.textX(ballX, this.title), this.textY(ballY + offsets.title, this.title))
    this.timerText.setPosition(
      this.textX(ballX, this.timerText),
      this.textY(ballY + offsets.timer, this.timerText),
    )
    this.hint.setPosition(this.textX(ballX, this.hint), this.textY(ballY + offsets.hint, this.hint))
  }

  /** Centraliza o texto na bola, sem deixar metade dele fora da tela. */
  private textX(ballX: number, text: Phaser.GameObjects.Text): number {
    const half = text.displayWidth / 2
    return clamp(ballX, half + TEXT_MARGIN, TUNING.world.width - half - TEXT_MARGIN)
  }

  private textY(y: number, text: Phaser.GameObjects.Text): number {
    const half = text.displayHeight / 2
    return clamp(y, half + TEXT_MARGIN, TUNING.world.height - half - TEXT_MARGIN)
  }

  /** Anel de fundo + arco do tempo restante, começando no topo. */
  private drawTimer(ballX: number, ballY: number, readout: AimReadout): void {
    const g = this.gfx
    const { width, height } = TUNING.world
    // Salvaguarda: o anel também nunca pode cruzar as bordas.
    const cx = clamp(ballX, RING_RADIUS + 1, width - RING_RADIUS - 1)
    const cy = clamp(ballY, RING_RADIUS + 1, height - RING_RADIUS - 1)
    const remaining =
      readout.windowMs > 0 ? clamp(readout.remainingMs / readout.windowMs, 0, 1) : 0

    g.lineStyle(RING_THICKNESS, PALETTE.inkDim, 0.25)
    g.strokeCircle(cx, cy, RING_RADIUS)

    if (remaining >= 1) {
      // Arco cheio: evita o caso degenerado de 2π no traçado por arcos.
      g.lineStyle(RING_THICKNESS, PALETTE.accent, 1)
      g.strokeCircle(cx, cy, RING_RADIUS)
    } else if (remaining > 0.001) {
      g.lineStyle(RING_THICKNESS, PALETTE.accent, 1)
      g.beginPath()
      g.arc(cx, cy, RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining, false)
      g.strokePath()
    }
  }

  /** Linha da bola ao ponteiro, limitada por `maxDrag` e com ponta de seta. */
  private drawAimLine(ballX: number, ballY: number, readout: AimReadout): void {
    const dx = readout.pointerX - ballX
    const dy = readout.pointerY - ballY
    const distance = Math.hypot(dx, dy)
    const limit = Math.max(0, readout.maxDrag)

    let dirX: number
    let dirY: number
    let length: number
    if (distance < MIN_DRAG) {
      // Ponteiro praticamente em cima da bola: reto para cima, nunca some.
      dirX = 0
      dirY = -1
      length = Math.min(FALLBACK_LENGTH, limit)
    } else {
      dirX = dx / distance
      dirY = dy / distance
      length = Math.min(distance, limit)
    }

    const { width, height } = TUNING.world
    const endX = clamp(ballX + dirX * length, DRAW_MARGIN, width - DRAW_MARGIN)
    const endY = clamp(ballY + dirY * length, DRAW_MARGIN, height - DRAW_MARGIN)
    const realDx = endX - ballX
    const realDy = endY - ballY
    if (Math.hypot(realDx, realDy) < 1) return

    const g = this.gfx
    g.lineStyle(3, PALETTE.aimed, 0.9)
    g.lineBetween(ballX, ballY, endX, endY)

    // Duas hastes para trás a partir da ponta, na direção efetiva do traço.
    const angle = Math.atan2(realDy, realDx)
    const backLeft = angle - ARROW_SPREAD
    const backRight = angle + ARROW_SPREAD
    g.lineBetween(
      endX,
      endY,
      endX - Math.cos(backLeft) * ARROW_LENGTH,
      endY - Math.sin(backLeft) * ARROW_LENGTH,
    )
    g.lineBetween(
      endX,
      endY,
      endX - Math.cos(backRight) * ARROW_LENGTH,
      endY - Math.sin(backRight) * ARROW_LENGTH,
    )
  }

  /** Fundo escuro, preenchimento pela força e contorno sutil. */
  private drawForceBar(ballX: number, ballY: number, ratio: number, offsetY: number): void {
    const g = this.gfx
    const { width, height } = TUNING.world
    const cx = clamp(ballX, BAR_WIDTH / 2 + 2, width - BAR_WIDTH / 2 - 2)
    const cy = clamp(ballY + offsetY, BAR_HEIGHT / 2 + 2, height - BAR_HEIGHT / 2 - 2)
    const left = cx - BAR_WIDTH / 2
    const top = cy - BAR_HEIGHT / 2
    const fill = clamp(ratio, 0, 1) * BAR_WIDTH

    g.fillStyle(PALETTE.bg, 0.5)
    g.fillRect(left, top, BAR_WIDTH, BAR_HEIGHT)
    if (fill > 0) {
      g.fillStyle(PALETTE.aimed, 0.95)
      g.fillRect(left, top, fill, BAR_HEIGHT)
    }
    g.lineStyle(1, PALETTE.ink, 0.18)
    g.strokeRect(left, top, BAR_WIDTH, BAR_HEIGHT)
  }
}
