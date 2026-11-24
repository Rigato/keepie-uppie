import Phaser from 'phaser'
import { circleRectHit } from '../core/collision'
import { isGoalCrossing, type GoalSpawn } from '../core/goal'
import { clamp } from '../core/math'
import type { BallLike } from '../game/contracts'
import { PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import type { ObstacleContact } from './obstacles/types'

export interface GoalInstance {
  readonly root: Phaser.GameObjects.Container
  readonly bounds: Phaser.Geom.Rectangle
  readonly scored: boolean
  update(dtSeconds: number, timeMs: number): void
  contact(ball: BallLike): ObstacleContact | null
  /** Detecta a passagem pelo vão; retorna true uma única vez. */
  tryScore(ball: BallLike): boolean
  react(contact: ObstacleContact): void
  destroy(): void
}

/** Atrás dos obstáculos (5) e dos interativos (6); a bola (10) passa por cima. */
const GOAL_DEPTH = 4
/** Raio dos cantos do frame. */
const CORNER_RADIUS = 5
const OUTLINE_WIDTH = 2
/** Malha da rede: espaçamento e alfa de repouso (~0.45 com a pulsação). */
const NET_CELL = 20
const NET_BASE_ALPHA = 0.38
const NET_PULSE_ALPHA = 0.1
const NET_PULSE_PERIOD_MS = 2200
/** Faixa de brilho accent na boca do gol. */
const MOUTH_GLOW_HEIGHT = 34
/** Quique nos postes. */
const POST_RESTITUTION = 0.9
/** Flash branco ao bater no poste. */
const HIT_FLASH_ALPHA = 0.5
const HIT_FLASH_MS = 160
/** Celebração do gol: a rede pisca, expande e some. */
const SCORE_FADE_MS = 420
const SCORE_SCALE = 1.14
const SCORE_FLASH_MS = 220

/**
 * Recorta um segmento contra um retângulo (Liang–Barsky). Usado só para a
 * malha diagonal da rede, que precisa terminar exatamente no vão.
 */
function clipSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): [number, number, number, number] | null {
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - minX, maxX - x0, y0 - minY, maxY - y0]

  for (let i = 0; i < 4; i += 1) {
    const pi = p[i] ?? 0
    const qi = q[i] ?? 0
    if (pi === 0) {
      if (qi < 0) return null
      continue
    }
    const r = qi / pi
    if (pi < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }

  return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1]
}

/**
 * Gol de futebol como set piece: dois postes duros, travessão visual (sensor)
 * e rede que marca a passagem. A entidade cuida de desenho, colisão dos postes
 * e do teste de pontuação; a cena aplica bônus e som.
 */
export function createGoal(scene: Phaser.Scene, spec: GoalSpawn): GoalInstance {
  const width = spec.width
  const height = spec.height
  const post = Math.min(TUNING.goal.postThickness, width / 2, height / 2)
  const left = -width / 2
  const top = -height / 2
  const right = width / 2
  const bottom = height / 2
  const innerLeft = left + post
  const innerRight = right - post
  const innerTop = top + post
  const gapWidth = innerRight - innerLeft
  const gapHeight = bottom - innerTop
  const corner = Math.min(CORNER_RADIUS, post / 2)

  // Linha de pontuação: dentro do vão, ~28 u abaixo da face interna do travessão.
  const scoreY = spec.y - spec.height / 2 + TUNING.goal.gapHeight * 0.35
  const scoreGapLeft = spec.x + innerLeft
  const scoreGapRight = spec.x + innerRight

  const root = scene.add.container(spec.x, spec.y).setDepth(GOAL_DEPTH)

  // Fundo translúcido: dá profundidade ao vão e faz o creme do frame destacar.
  const panel = scene.add.graphics()
  panel.fillGradientStyle(
    PALETTE.ink,
    PALETTE.ink,
    PALETTE.ink,
    PALETTE.ink,
    0.14,
    0.14,
    0.045,
    0.045,
  )
  panel.fillRect(innerLeft, innerTop, gapWidth, gapHeight)

  // Rede: malha diagonal contida no vão, atrás de tudo que é estrutural.
  const netRoot = scene.add.container(0, 0)
  const net = scene.add.graphics()
  net.lineStyle(1.1, PALETTE.accent, 0.95)
  const meshLeft = innerLeft + 2
  const meshTop = innerTop + 2
  const meshRight = innerRight - 2
  const meshBottom = bottom - 2
  const meshWidth = meshRight - meshLeft
  const meshHeight = meshBottom - meshTop

  // Duas famílias de diagonais a 45° formam o losango clássico da rede.
  for (let offset = -meshHeight; offset <= meshWidth; offset += NET_CELL) {
    const segment = clipSegment(
      meshLeft + offset,
      meshTop,
      meshLeft + offset + meshHeight,
      meshBottom,
      meshLeft,
      meshTop,
      meshRight,
      meshBottom,
    )
    if (segment) net.lineBetween(segment[0], segment[1], segment[2], segment[3])
  }
  for (let offset = 0; offset <= meshWidth + meshHeight; offset += NET_CELL) {
    const segment = clipSegment(
      meshLeft + offset,
      meshTop,
      meshLeft + offset - meshHeight,
      meshBottom,
      meshLeft,
      meshTop,
      meshRight,
      meshBottom,
    )
    if (segment) net.lineBetween(segment[0], segment[1], segment[2], segment[3])
  }
  net.lineStyle(1.2, PALETTE.accent, 0.5)
  net.lineBetween(innerLeft + 2, innerTop + 1, innerRight - 2, innerTop + 1)
  netRoot.add(net)
  netRoot.setAlpha(NET_BASE_ALPHA)

  // Brilho na boca: convida a entrar por baixo, sem virar HUD.
  const mouthGlow = scene.add.graphics()
  mouthGlow.fillGradientStyle(
    PALETTE.accent,
    PALETTE.accent,
    PALETTE.accent,
    PALETTE.accent,
    0,
    0,
    0.2,
    0.2,
  )
  mouthGlow.fillRect(innerLeft, bottom - MOUTH_GLOW_HEIGHT, gapWidth, MOUTH_GLOW_HEIGHT)

  // Frame em U invertido: postes + travessão, preenchimento creme e contorno.
  const frame = scene.add.graphics()
  frame.fillStyle(PALETTE.goal, 1)
  frame.fillRoundedRect(left, top, post, height, corner)
  frame.fillRoundedRect(right - post, top, post, height, corner)
  frame.fillRoundedRect(left, top, width, post, corner)

  frame.lineStyle(OUTLINE_WIDTH, PALETTE.ink, 0.85)
  frame.beginPath()
  frame.moveTo(left, bottom)
  frame.lineTo(left, top + corner)
  frame.arc(left + corner, top + corner, corner, Math.PI, Math.PI * 1.5, false)
  frame.lineTo(right - corner, top)
  frame.arc(right - corner, top + corner, corner, Math.PI * 1.5, Math.PI * 2, false)
  frame.lineTo(right, bottom)
  frame.strokePath()

  frame.beginPath()
  frame.moveTo(innerLeft, bottom)
  frame.lineTo(innerLeft, innerTop + corner)
  frame.arc(innerLeft + corner, innerTop + corner, corner, Math.PI, Math.PI * 1.5, false)
  frame.lineTo(innerRight - corner, innerTop)
  frame.arc(innerRight - corner, innerTop + corner, corner, Math.PI * 1.5, Math.PI * 2, false)
  frame.lineTo(innerRight, bottom)
  frame.strokePath()

  // Fecha a base dos postes (o vão continua aberto embaixo).
  frame.lineStyle(1.5, PALETTE.ink, 0.55)
  frame.lineBetween(left, bottom, innerLeft, bottom)
  frame.lineBetween(innerRight, bottom, right, bottom)

  // Volume: luz na face superior/esquerda e sombra sob o travessão.
  frame.lineStyle(2, 0xffffff, 0.38)
  frame.lineBetween(innerLeft + 7, top + post * 0.36, innerRight - 7, top + post * 0.36)
  frame.lineBetween(left + post * 0.34, innerTop + 9, left + post * 0.34, bottom - 11)
  frame.lineBetween(right - post * 0.34, innerTop + 9, right - post * 0.34, bottom - 11)
  frame.lineStyle(2, PALETTE.ink, 0.1)
  frame.lineBetween(innerLeft + 2, innerTop + 1.5, innerRight - 2, innerTop + 1.5)

  // Flash de impacto nos postes, desenhado por cima do frame.
  const hitFlash = scene.add.graphics()
  hitFlash.fillStyle(0xffffff, 1)
  hitFlash.fillRoundedRect(left, top, post, height, corner)
  hitFlash.fillRoundedRect(right - post, top, post, height, corner)
  hitFlash.fillRoundedRect(left, top, width, post, corner)
  hitFlash.setAlpha(0).setVisible(false)

  // Flash da pontuação dentro do vão.
  const scoreFlash = scene.add.graphics()
  scoreFlash.fillStyle(PALETTE.goal, 1)
  scoreFlash.fillRect(innerLeft, innerTop, gapWidth, gapHeight)
  scoreFlash.setAlpha(0).setVisible(false)

  root.add([panel, netRoot, mouthGlow, frame, scoreFlash, hitFlash])

  const leftPostRect = new Phaser.Geom.Rectangle(
    spec.x + left,
    spec.y + top,
    post,
    height,
  )
  const rightPostRect = new Phaser.Geom.Rectangle(
    spec.x + right - post,
    spec.y + top,
    post,
    height,
  )
  const bounds = new Phaser.Geom.Rectangle(
    spec.x + left,
    spec.y + top,
    width,
    height,
  )

  let lastContactAt = Number.NEGATIVE_INFINITY
  let previousBallY: number | null = null
  let isScored = false
  let destroyed = false

  function flashPost(): void {
    scene.tweens.killTweensOf(hitFlash)
    hitFlash.setVisible(true).setAlpha(HIT_FLASH_ALPHA)
    scene.tweens.add({
      targets: hitFlash,
      alpha: 0,
      duration: HIT_FLASH_MS,
      ease: 'Quad.easeOut',
      onComplete: () => hitFlash.setVisible(false),
    })
  }

  function celebrateScore(): void {
    scene.tweens.killTweensOf(netRoot)
    scene.tweens.killTweensOf(mouthGlow)
    scene.tweens.killTweensOf(scoreFlash)

    netRoot.setAlpha(1)
    scene.tweens.add({
      targets: netRoot,
      alpha: 0,
      scaleX: SCORE_SCALE,
      scaleY: SCORE_SCALE,
      duration: SCORE_FADE_MS,
      ease: 'Quad.easeOut',
    })

    mouthGlow.setAlpha(1)
    scene.tweens.add({
      targets: mouthGlow,
      alpha: 0,
      duration: SCORE_FADE_MS,
      ease: 'Quad.easeOut',
    })

    scoreFlash.setVisible(true).setAlpha(0.75)
    scene.tweens.add({
      targets: scoreFlash,
      alpha: 0,
      duration: SCORE_FLASH_MS,
      ease: 'Quad.easeOut',
      onComplete: () => scoreFlash.setVisible(false),
    })
  }

  function update(_dtSeconds: number, timeMs: number): void {
    if (destroyed || isScored) return

    const phase = (timeMs / NET_PULSE_PERIOD_MS) * Math.PI * 2 + spec.variation * Math.PI * 2
    const wave = (Math.sin(phase) + 1) / 2
    netRoot.setAlpha(NET_BASE_ALPHA + wave * NET_PULSE_ALPHA)
    mouthGlow.setAlpha(0.55 + wave * 0.45)
  }

  function contact(ball: BallLike): ObstacleContact | null {
    if (destroyed) return null

    const now = performance.now()
    if (now - lastContactAt < TUNING.obstacle.contactCooldownMs) return null

    const leftHit = circleRectHit(ball.x, ball.y, ball.r, leftPostRect)
    const rightHit = circleRectHit(ball.x, ball.y, ball.r, rightPostRect)
    // Se a bola toca os dois postes ao mesmo tempo (raro), empurra pelo mais fundo.
    let hit = leftHit ?? rightHit
    if (leftHit && rightHit && rightHit.penetration > leftHit.penetration) hit = rightHit
    if (!hit) return null

    lastContactAt = now

    // |vy| de 0 até o chute máximo vira 0.5..1; acima disso satura.
    const strength = 0.5 + 0.5 * clamp(Math.abs(ball.vy) / TUNING.kick.maxSpeed, 0, 1)

    return {
      result: 'reflect',
      point: hit.point,
      normal: hit.normal,
      penetration: hit.penetration,
      restitution: POST_RESTITUTION,
      strength,
    }
  }

  function tryScore(ball: BallLike): boolean {
    const previousY = previousBallY
    previousBallY = ball.y
    if (destroyed || isScored || previousY === null) return false

    if (
      !isGoalCrossing(
        previousY,
        ball.y,
        ball.x,
        scoreGapLeft,
        scoreGapRight,
        scoreY,
      )
    ) {
      return false
    }

    isScored = true
    celebrateScore()
    return true
  }

  function react(_contact: ObstacleContact): void {
    if (destroyed) return
    flashPost()
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    scene.tweens.killTweensOf(netRoot)
    scene.tweens.killTweensOf(mouthGlow)
    scene.tweens.killTweensOf(scoreFlash)
    scene.tweens.killTweensOf(hitFlash)
    if (root.active) root.destroy(true)
  }

  return {
    root,
    bounds,
    get scored(): boolean {
      return isScored
    },
    update,
    contact,
    tryScore,
    react,
    destroy,
  }
}
