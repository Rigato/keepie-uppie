import Phaser from 'phaser'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_MONO } from '../game/config'
import { DEBUG_STATE } from '../game/debug-state'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { formatMeters, type SaveStore, type SaveV1 } from '../platform/storage'

/** Margem do painel em relação ao canto inferior esquerdo do mundo. */
const MARGIN = 12
/** Largura fixa do painel; a altura acompanha o conteúdo. */
const PANEL_WIDTH = 300
const PANEL_PAD = 10
/** Coluna reservada para os rótulos em accent. */
const LABEL_COLUMN = 50
const ROW_GAP = 2
const FONT_SIZE = '11px'

interface DebugRow {
  readonly label: Phaser.GameObjects.Text
  readonly value: Phaser.GameObjects.Text
}

/**
 * Overlay de debug (`?debug=1`). Só lê estado: o gameplay escreve em `DEBUG_STATE`.
 * Atualiza a 10 Hz, sem DOM e sem trabalho no loop de render.
 */
export class DebugOverlay extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Graphics
  private resetButton!: Phaser.GameObjects.Text

  private fpsRow!: DebugRow
  private ballRow!: DebugRow
  private runRow!: DebugRow
  private kickRow!: DebugRow
  private paceRow!: DebugRow
  private saveRow!: DebugRow
  private extraRow!: DebugRow

  /** Linhas visíveis, na ordem de desenho. Reaproveitado entre atualizações. */
  private readonly rows: DebugRow[] = []

  constructor() {
    super('DebugOverlay')
  }

  create(): void {
    this.scene.bringToTop()

    // Câmera transparente: o jogo das cenas abaixo continua visível.
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')

    // Recriação de cena (restart/console) não deve acumular linhas antigas.
    this.rows.length = 0

    this.panel = this.add.graphics().setDepth(0)

    this.addRow('BUILD', BUILD_LABEL, CSS_PALETTE.accent)
    this.fpsRow = this.addRow('FPS', '0', CSS_PALETTE.ink)
    this.ballRow = this.addRow('BALL', '—', CSS_PALETTE.ink)
    this.runRow = this.addRow('RUN', '—', CSS_PALETTE.ink)
    this.kickRow = this.addRow('KICK', '—', CSS_PALETTE.ink)
    this.paceRow = this.addRow('PACE', '—', CSS_PALETTE.ink)
    this.saveRow = this.addRow('SAVE', '—', CSS_PALETTE.ink)
    this.extraRow = this.addRow('EXTRA', '', CSS_PALETTE.ink)
    this.extraRow.label.setVisible(false)
    this.extraRow.value.setVisible(false)

    this.resetButton = this.add
      .text(0, 0, 'RESET SAVE', {
        fontFamily: FONT_MONO,
        fontSize: FONT_SIZE,
        color: CSS_PALETTE.accent,
      })
      .setDepth(2)
      .setInteractive({ useHandCursor: true })

    this.resetButton.on('pointerover', () => this.resetButton.setColor(CSS_PALETTE.ink))
    this.resetButton.on('pointerout', () => this.resetButton.setColor(CSS_PALETTE.accent))
    this.resetButton.on('pointerup', () => this.resetSave())

    this.refresh()

    // Painel a 10 Hz. O loop de render não visita esta cena além do desenho.
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: this.refresh,
      callbackScope: this,
    })
  }

  private addRow(label: string, value: string, valueColor: string): DebugRow {
    const labelText = this.add
      .text(0, 0, label, {
        fontFamily: FONT_MONO,
        fontSize: FONT_SIZE,
        color: CSS_PALETTE.accent,
      })
      .setDepth(1)

    const valueText = this.add
      .text(0, 0, value, {
        fontFamily: FONT_MONO,
        fontSize: FONT_SIZE,
        color: valueColor,
        wordWrap: { width: PANEL_WIDTH - PANEL_PAD * 2 - LABEL_COLUMN },
      })
      .setDepth(1)

    const row: DebugRow = { label: labelText, value: valueText }
    this.rows.push(row)
    return row
  }

  private refresh(): void {
    // Registry pode estar incompleto (ex.: cena aberta manualmente): nunca quebra.
    const save = this.registry.get('save') as SaveV1 | undefined
    const best = save ? formatMeters(save.bestMeters) : '—'
    const total = save ? String(Math.round(save.totalCoins)) : '—'
    const mute = save ? (save.muted ? 'mute on' : 'mute off') : 'mute ?'
    const powerup = DEBUG_STATE.powerup.length > 0 ? DEBUG_STATE.powerup : '—'
    const extra = DEBUG_STATE.extra

    this.fpsRow.value.setText(String(Math.round(this.game.loop.actualFps)))
    this.ballRow.value.setText(
      `x ${Math.round(DEBUG_STATE.ballX)} y ${Math.round(DEBUG_STATE.ballY)}` +
        ` · vx ${Math.round(DEBUG_STATE.ballVx)} vy ${Math.round(DEBUG_STATE.ballVy)}`,
    )
    this.runRow.value.setText(
      `${Math.round(DEBUG_STATE.meters)} m · ${Math.round(DEBUG_STATE.coins)} coins` +
        ` · streak ${Math.round(DEBUG_STATE.streak)} · ${powerup}`,
    )
    this.kickRow.value.setText(
      `arc ${DEBUG_STATE.lastKickArc.toFixed(2)} s · power ${Math.round(DEBUG_STATE.lastKickPower)}`,
    )
    this.paceRow.value.setText(
      `stage ${DEBUG_STATE.difficultyStage} · limite ${Math.round(DEBUG_STATE.fallSpeedLimit)} u/s`,
    )
    this.saveRow.value.setText(`best ${best} · coins ${total} · ${mute}`)

    const showExtra = extra.length > 0
    this.extraRow.label.setVisible(showExtra)
    this.extraRow.value.setVisible(showExtra)
    if (showExtra) this.extraRow.value.setText(extra)

    this.layout()
  }

  /** Mede as linhas e redesenha o painel ancorado no canto inferior esquerdo. */
  private layout(): void {
    const panelX = MARGIN
    let contentHeight = 0

    for (const row of this.rows) {
      if (!row.label.visible) continue
      contentHeight += Math.max(row.label.height, row.value.height) + ROW_GAP
    }

    const buttonGap = 8
    const buttonHeight = this.resetButton.height
    const panelHeight = PANEL_PAD * 2 + contentHeight + buttonGap + buttonHeight
    // Se o conteúdo passar da tela, o topo para na margem e o painel desce.
    const panelTop = Math.max(MARGIN, this.scale.height - MARGIN - panelHeight)

    this.panel.clear()
    this.panel.fillStyle(PALETTE.bg, 0.82)
    this.panel.fillRoundedRect(panelX, panelTop, PANEL_WIDTH, panelHeight, 9)
    this.panel.lineStyle(1, PALETTE.accent, 0.3)
    this.panel.strokeRoundedRect(panelX, panelTop, PANEL_WIDTH, panelHeight, 9)

    let y = panelTop + PANEL_PAD
    for (const row of this.rows) {
      if (!row.label.visible) continue
      row.label.setPosition(panelX + PANEL_PAD, y)
      row.value.setPosition(panelX + PANEL_PAD + LABEL_COLUMN, y)
      y += Math.max(row.label.height, row.value.height) + ROW_GAP
    }

    const buttonX = panelX + PANEL_WIDTH - PANEL_PAD - this.resetButton.width
    const buttonY = panelTop + PANEL_PAD + contentHeight + buttonGap
    this.resetButton.setPosition(buttonX, buttonY)

    // Divisória e realce do botão usam o mesmo Graphics do painel.
    this.panel.lineStyle(1, PALETTE.inkDim, 0.25)
    this.panel.lineBetween(
      panelX + PANEL_PAD,
      buttonY - 5,
      panelX + PANEL_WIDTH - PANEL_PAD,
      buttonY - 5,
    )
    this.panel.fillStyle(PALETTE.accent, 0.14)
    this.panel.fillRoundedRect(
      buttonX - 5,
      buttonY - 2,
      this.resetButton.width + 10,
      buttonHeight + 4,
      4,
    )
  }

  /** Reset assíncrono: qualquer falha de storage fica contida aqui. */
  private resetSave(): void {
    void (async () => {
      try {
        const store = this.registry.get('saveStore') as SaveStore | undefined
        if (!store || typeof store.reset !== 'function') return

        const fresh = await store.reset()
        this.registry.set('save', fresh)
        this.refresh()
      } catch (error) {
        console.warn('[debug] falha ao resetar save', error)
      }
    })()
  }
}
