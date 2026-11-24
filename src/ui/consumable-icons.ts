import type Phaser from 'phaser'
import type { ConsumableId } from '../core/consumables'
import { PALETTE } from '../game/palette'

/** Cor de identidade de cada consumível (ícone, card e slot do loadout). */
export const CONSUMABLE_COLORS: Record<ConsumableId, number> = {
  net: PALETTE.accent,
  magnet: PALETTE.magnet,
  chutao: PALETTE.aimed,
  streak: PALETTE.fever,
}

/**
 * Ícones vetoriais dos consumíveis, compartilhados pela loja e pela barra da
 * run. Desenhados em um espaço de 64×64 centrado em (cx, cy); `size` escala o
 * conjunto para o card (64) ou para o slot da barra (72).
 */
export function drawConsumableIcon(
  g: Phaser.GameObjects.Graphics,
  id: ConsumableId,
  cx: number,
  cy: number,
  color: number,
  size = 64,
): void {
  const s = size / 64
  const ink = PALETTE.ink
  const line = (width: number) => Math.max(1, width * s)

  if (id === 'net') {
    // Escudo: contorno escuro, preenchimento translúcido e uma rede simples.
    const w = 30 * s
    const h = 34 * s
    g.fillStyle(color, 0.18)
    g.lineStyle(line(3), ink, 1)
    traceShield(g, cx, cy, w, h)
    g.fillPath()
    g.strokePath()
    g.lineStyle(line(1.4), color, 0.95)
    g.lineBetween(cx - w * 0.32, cy - h * 0.02, cx + w * 0.32, cy + h * 0.28)
    g.lineBetween(cx + w * 0.32, cy - h * 0.02, cx - w * 0.32, cy + h * 0.28)
    return
  }

  if (id === 'magnet') {
    // Ímã em U: corpo colorido com contorno escuro e polos claros.
    const legX = 12 * s
    const topY = cy - 14 * s
    const bendY = cy + 4 * s
    g.lineStyle(line(11), ink, 1)
    traceMagnet(g, cx, legX, topY, bendY)
    g.strokePath()
    g.lineStyle(line(7), color, 1)
    traceMagnet(g, cx, legX, topY, bendY)
    g.strokePath()
    g.fillStyle(PALETTE.ballBase, 1)
    g.fillRect(cx - legX - 4 * s, topY - 3 * s, 8 * s, 7 * s)
    g.fillRect(cx + legX - 4 * s, topY - 3 * s, 8 * s, 7 * s)
    return
  }

  if (id === 'chutao') {
    // Bola + linhas de velocidade: o chute forte, não um segundo esporte.
    const r = 15 * s
    g.lineStyle(line(3), ink, 1)
    g.fillStyle(PALETTE.ballBase, 1)
    g.fillCircle(cx + 5 * s, cy + 1 * s, r)
    g.strokeCircle(cx + 5 * s, cy + 1 * s, r)
    g.fillStyle(ink, 1)
    g.fillCircle(cx + 5 * s, cy + 1 * s, 3.4 * s)
    g.lineStyle(line(3), color, 1)
    g.lineBetween(cx - 26 * s, cy - 9 * s, cx - 12 * s, cy - 9 * s)
    g.lineBetween(cx - 29 * s, cy + 1 * s, cx - 15 * s, cy + 1 * s)
    g.lineBetween(cx - 26 * s, cy + 11 * s, cx - 12 * s, cy + 11 * s)
    return
  }

  // Streak Saver: escudo colorido com um check de "salvo".
  const w = 30 * s
  const h = 34 * s
  g.fillStyle(color, 0.2)
  g.lineStyle(line(3), ink, 1)
  traceShield(g, cx, cy, w, h)
  g.fillPath()
  g.strokePath()
  g.lineStyle(line(4), color, 1)
  g.beginPath()
  g.moveTo(cx - 9 * s, cy + 1 * s)
  g.lineTo(cx - 2 * s, cy + 8 * s)
  g.lineTo(cx + 11 * s, cy - 8 * s)
  g.strokePath()
}

/** Caminho de escudo (ponta para baixo), centrado em (cx, cy). */
function traceShield(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  width: number,
  height: number,
): void {
  const half = width / 2
  const top = cy - height / 2
  const bottom = cy + height / 2
  g.beginPath()
  g.moveTo(cx, top)
  g.lineTo(cx + half, top + height * 0.16)
  g.lineTo(cx + half * 0.82, bottom - height * 0.16)
  g.lineTo(cx, bottom)
  g.lineTo(cx - half * 0.82, bottom - height * 0.16)
  g.lineTo(cx - half, top + height * 0.16)
  g.closePath()
}

/** Caminho do ímã em U (sem preencher; o caller decide o traço). */
function traceMagnet(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  legX: number,
  topY: number,
  bendY: number,
): void {
  g.beginPath()
  g.moveTo(cx - legX, topY)
  g.lineTo(cx - legX, bendY)
  g.arc(cx, bendY, legX, Math.PI, 0, true)
  g.lineTo(cx + legX, topY)
}
