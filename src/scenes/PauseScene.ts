import Phaser from 'phaser'
import { audio } from '../fx/audio'
import { FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import { DEFAULT_SAVE, type SaveStore, type SaveV1 } from '../platform/storage'

/** Medidas fixas dos botões do menu de pausa. */
const BUTTON_WIDTH = 260
const BUTTON_HEIGHT = 56
const BUTTON_RADIUS = 10

/**
 * Botão do menu de pausa: fundo em Graphics, rótulo em Text e uma Zone
 * interativa cobrindo o botão inteiro (área de toque generosa no celular).
 */
class PauseButton {
  private readonly root: Phaser.GameObjects.Container
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private readonly border: number
  private hovered = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    border: number,
    onClick: () => void,
  ) {
    this.border = border
    this.root = scene.add.container(x, y)
    this.bg = scene.add.graphics()
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: FONT_SANS,
        fontSize: '18px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    const hit = scene.add
      .zone(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    this.root.add([this.bg, this.label, hit])

    hit.on('pointerover', () => {
      this.hovered = true
      this.draw()
    })
    hit.on('pointerout', () => {
      this.hovered = false
      this.draw()
    })
    hit.on('pointerdown', () => {
      // Feedback de escala curto, sem atrasar a ação do botão.
      scene.tweens.add({
        targets: this.root,
        scaleX: 0.97,
        scaleY: 0.97,
        duration: 60,
        yoyo: true,
        ease: 'Quad.out',
      })
      onClick()
    })

    this.draw()
  }

  setLabel(text: string): void {
    this.label.setText(text)
  }

  private draw(): void {
    const g = this.bg
    const left = -BUTTON_WIDTH / 2
    const top = -BUTTON_HEIGHT / 2
    g.clear()

    g.fillStyle(PALETTE.bgSoft, this.hovered ? 1 : 0.9)
    g.fillRoundedRect(left, top, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS)

    const border = this.hovered
      ? Phaser.Display.Color.IntegerToColor(this.border).brighten(28).color
      : this.border
    g.lineStyle(2, border, this.hovered ? 1 : 0.85)
    g.strokeRoundedRect(left, top, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS)
  }
}

/**
 * Overlay de pausa lançado sobre a Play (que fica pausada pelo SceneManager).
 * A cena é transparente fora do retângulo de fundo; o mundo da Play continua
 * visível e estático por baixo.
 */
export class PauseScene extends Phaser.Scene {
  private muteButton?: PauseButton
  private closing = false

  constructor() {
    super('Pause')
  }

  create(): void {
    const { width, height } = TUNING.world
    this.closing = false

    // Scrim: clareia a Play pausada sem esconder o contexto da partida.
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.bg, 0.82)

    this.add
      .text(width / 2, 330, 'PAUSED', {
        fontFamily: FONT_SANS,
        fontSize: '42px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(5)

    new PauseButton(this, width / 2, 500, 'RESUME', PALETTE.accent, () => this.resumeGame())
    this.muteButton = new PauseButton(
      this,
      width / 2,
      586,
      audio.isMuted() ? 'UNMUTE' : 'MUTE',
      PALETTE.aimed,
      () => this.toggleMute(),
    )
    new PauseButton(this, width / 2, 672, 'RESTART', PALETTE.danger, () => this.restartGame())

    this.add
      .text(width / 2, 770, 'ESC / P TO RESUME', {
        fontFamily: FONT_SANS,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setAlpha(0.8)

    // Teclado também fecha a pausa; útil no desktop.
    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame())
    this.input.keyboard?.on('keydown-P', () => this.resumeGame())
  }

  /** Fecha o overlay e devolve o controle à Play pausada. */
  private resumeGame(): void {
    if (this.closing) return
    this.closing = true
    audio.play('ui')
    this.scene.resume('Play')
    this.scene.stop()
  }

  /** Recomeça a partida: encerra o overlay e reinicia a Play do zero. */
  private restartGame(): void {
    if (this.closing) return
    this.closing = true
    audio.play('ui')
    this.scene.stop()
    const play = this.scene.get('Play')
    play.scene.restart()
  }

  /** Alterna o mudo, persiste no save e atualiza o rótulo do botão. */
  private toggleMute(): void {
    try {
      const nextMuted = !audio.isMuted()
      // Toca antes de mutar: o próprio gesto ainda tem resposta sonora.
      audio.play('ui')
      audio.setMuted(nextMuted)

      const save = (this.registry.get('save') as SaveV1 | undefined) ?? DEFAULT_SAVE
      const next: SaveV1 = { ...save, muted: nextMuted }
      this.registry.set('save', next)

      const store = this.registry.get('saveStore') as SaveStore | undefined
      if (store) void store.save(next)

      // Ao desmutar, um clique (agora audível) confirma a mudança.
      if (!nextMuted) audio.play('ui')
    } catch {
      // Áudio e save são acessórios: a pausa nunca deve quebrar por causa deles.
    }
    this.syncMuteLabel()
  }

  private syncMuteLabel(): void {
    this.muteButton?.setLabel(audio.isMuted() ? 'UNMUTE' : 'MUTE')
  }
}
