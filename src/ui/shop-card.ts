import Phaser from 'phaser'
import { CONSUMABLES, type ConsumableId } from '../core/consumables'
import { canBuy, canEquip, isEquipped, ownedCount } from '../core/shop'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import type { SaveV1 } from '../platform/storage'
import { CONSUMABLE_COLORS, drawConsumableIcon } from './consumable-icons'

export const SHOP_CARD_WIDTH = 460
export const SHOP_CARD_HEIGHT = 118

const CARD_RADIUS = 12
/** Moldura do ícone; o desenho compartilhado usa 60 para ficar legível. */
const ICON_SIZE = 56
const ICON_DRAW_SIZE = 60
const BUTTON_WIDTH = 112
const BUTTON_HEIGHT = 36
/**
 * Área de toque bem maior que o desenho. Os dois botões do card ficam com as
 * zonas quase encostadas no meio do card, deslocadas para fora, sem sobrepor.
 */
const BUTTON_TOUCH_WIDTH = 124
const BUTTON_TOUCH_HEIGHT = 56
const BUTTON_TOUCH_OFFSET = 7
/** Distância entre os centros dos dois botões empilhados. */
const BUTTON_GAP = 44

/** Texto claro sobre o botão primário (teal escuro). */
const TEXT_ON_DARK = '#f8f4e8'

/**
 * Coordenadas locais ao centro do card (230, 59). A coluna de texto termina
 * antes da coluna dos botões, que ocupam a direita do card.
 */
const LOCAL = {
  iconX: -186,
  iconY: 0,
  textX: -142,
  nameY: -44,
  descriptionY: -20,
  priceY: 20,
  ownedX: 92,
  buttonX: 160,
  buyY: -BUTTON_GAP / 2,
  equipY: BUTTON_GAP / 2,
} as const

export type ShopButtonVariant = 'primary' | 'secondary' | 'active'

export interface ShopButtonOptions {
  label: string
  width: number
  height: number
  variant?: ShopButtonVariant
  touchWidth?: number
  touchHeight?: number
  /** Desloca a área de toque no eixo Y sem mover o desenho do botão. */
  touchOffsetY?: number
  fontSize?: string
  letterSpacing?: number
  onClick: () => void
}

/**
 * Botão da loja: fundo em Graphics, rótulo em Text e uma Zone de toque maior
 * que o desenho. O clique dispara no `pointerup` — trocar de cena no
 * `pointerdown` deixava o release cair na cena seguinte e reabrir a loja.
 * Desabilitado fica translúcido e não recebe input.
 */
export class ShopButton {
  readonly root: Phaser.GameObjects.Container
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly label: Phaser.GameObjects.Text
  private readonly hit: Phaser.GameObjects.Zone
  private readonly width: number
  private readonly height: number
  private readonly onClick: () => void
  private enabled = false
  private hovered = false
  private pressed = false
  private variant: ShopButtonVariant = 'secondary'

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: ShopButtonOptions,
  ) {
    this.width = options.width
    this.height = options.height
    this.onClick = options.onClick

    this.root = scene.add.container(x, y)
    this.bg = scene.add.graphics()
    this.label = scene.add
      .text(0, 0, options.label, {
        fontFamily: FONT_SANS,
        fontSize: options.fontSize ?? '14px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(options.letterSpacing ?? 1)

    this.hit = scene.add
      .zone(
        0,
        options.touchOffsetY ?? 0,
        options.touchWidth ?? BUTTON_TOUCH_WIDTH,
        options.touchHeight ?? BUTTON_TOUCH_HEIGHT,
      )
      .setOrigin(0.5)

    this.root.add([this.bg, this.label, this.hit])

    this.hit.on('pointerover', () => {
      this.hovered = true
      this.draw()
    })
    this.hit.on('pointerout', () => {
      this.hovered = false
      // Sair da área cancela o clique: só vale o release sobre o botão.
      this.pressed = false
      this.draw()
    })
    this.hit.on('pointerdown', () => {
      if (!this.enabled || this.pressed) return
      this.pressed = true
      scene.tweens.add({
        targets: this.root,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 55,
        yoyo: true,
        ease: 'Quad.out',
      })
    })
    this.hit.on('pointerup', () => {
      // O guard evita dois cliques no mesmo toque (e o clique duplo acidental).
      if (!this.pressed) return
      this.pressed = false
      if (!this.enabled) return
      this.onClick()
    })
    this.hit.on('pointerupoutside', () => {
      this.pressed = false
    })

    this.set(options.label, true, options.variant ?? 'secondary')
  }

  set(label: string, enabled: boolean, variant: ShopButtonVariant): void {
    this.variant = variant
    this.label.setText(label)
    this.label.setColor(
      variant === 'primary'
        ? TEXT_ON_DARK
        : variant === 'active'
          ? CSS_PALETTE.accent
          : CSS_PALETTE.ink,
    )

    if (enabled !== this.enabled) {
      this.enabled = enabled
      if (enabled) {
        this.hit.setInteractive({ useHandCursor: true })
      } else {
        this.hit.disableInteractive()
        this.hovered = false
        this.pressed = false
      }
    }

    this.root.setAlpha(enabled ? 1 : 0.35)
    this.draw()
  }

  private draw(): void {
    const halfW = this.width / 2
    const halfH = this.height / 2
    let fill: number = PALETTE.bg
    let fillAlpha = 0.9
    let stroke: number = PALETTE.accent
    let strokeAlpha = 0.55

    if (this.variant === 'primary') {
      fill = this.hovered
        ? Phaser.Display.Color.IntegerToColor(PALETTE.accent).brighten(22).color
        : PALETTE.accent
      fillAlpha = 1
      stroke = fill
      strokeAlpha = 0.9
    } else if (this.variant === 'active') {
      fill = PALETTE.accent
      fillAlpha = this.hovered ? 0.28 : 0.16
      stroke = PALETTE.accent
      strokeAlpha = 0.9
    } else if (this.hovered) {
      fill = Phaser.Display.Color.IntegerToColor(PALETTE.bgSoft).darken(6).color
      fillAlpha = 1
      strokeAlpha = 0.9
    }

    this.bg.clear()
    this.bg.fillStyle(fill, fillAlpha)
    this.bg.fillRoundedRect(-halfW, -halfH, this.width, this.height, 10)
    this.bg.lineStyle(1.5, stroke, strokeAlpha)
    this.bg.strokeRoundedRect(-halfW, -halfH, this.width, this.height, 10)
  }
}

export interface ShopCardHandlers {
  onBuy: (id: ConsumableId) => void
  onEquip: (id: ConsumableId) => void
}

/**
 * Card de um consumível. A parte visual é criada uma vez; `update(save)`
 * atualiza apenas os textos e os estados dos botões.
 */
export class ShopCard {
  readonly root: Phaser.GameObjects.Container
  private readonly scene: Phaser.Scene
  private readonly id: ConsumableId
  private readonly color: number
  private readonly ownedText: Phaser.GameObjects.Text
  private readonly buyButton: ShopButton
  private readonly equipButton: ShopButton

  constructor(
    scene: Phaser.Scene,
    id: ConsumableId,
    x: number,
    y: number,
    handlers: ShopCardHandlers,
  ) {
    const def = CONSUMABLES[id]
    this.scene = scene
    this.id = id
    this.color = CONSUMABLE_COLORS[id]

    this.root = scene.add.container(
      x + SHOP_CARD_WIDTH / 2,
      y + SHOP_CARD_HEIGHT / 2,
    )

    const bg = scene.add.graphics()
    bg.fillStyle(PALETTE.bgSoft, 0.92)
    bg.fillRoundedRect(
      -SHOP_CARD_WIDTH / 2,
      -SHOP_CARD_HEIGHT / 2,
      SHOP_CARD_WIDTH,
      SHOP_CARD_HEIGHT,
      CARD_RADIUS,
    )
    bg.lineStyle(1.5, PALETTE.accent, 0.28)
    bg.strokeRoundedRect(
      -SHOP_CARD_WIDTH / 2,
      -SHOP_CARD_HEIGHT / 2,
      SHOP_CARD_WIDTH,
      SHOP_CARD_HEIGHT,
      CARD_RADIUS,
    )
    this.root.add(bg)

    const tile = scene.add.graphics()
    tile.fillStyle(PALETTE.bg, 0.55)
    tile.fillRoundedRect(
      LOCAL.iconX - ICON_SIZE / 2,
      LOCAL.iconY - ICON_SIZE / 2,
      ICON_SIZE,
      ICON_SIZE,
      11,
    )
    tile.lineStyle(1, this.color, 0.3)
    tile.strokeRoundedRect(
      LOCAL.iconX - ICON_SIZE / 2,
      LOCAL.iconY - ICON_SIZE / 2,
      ICON_SIZE,
      ICON_SIZE,
      11,
    )
    this.root.add(tile)

    const icon = scene.add.graphics()
    drawConsumableIcon(
      icon,
      id,
      LOCAL.iconX,
      LOCAL.iconY,
      this.color,
      ICON_DRAW_SIZE,
    )
    this.root.add(icon)

    this.root.add(
      scene.add
        .text(LOCAL.textX, LOCAL.nameY, def.name, {
          fontFamily: FONT_SANS,
          fontSize: '18px',
          color: CSS_PALETTE.ink,
          fontStyle: 'bold',
        })
        .setLetterSpacing(0.3),
    )

    this.root.add(
      scene.add.text(LOCAL.textX, LOCAL.descriptionY, def.description, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
        wordWrap: { width: 234 },
        lineSpacing: 1,
      }),
    )

    this.root.add(
      scene.add.text(LOCAL.textX, LOCAL.priceY, `${def.price} COINS`, {
        fontFamily: FONT_MONO,
        fontSize: '13px',
        color: CSS_PALETTE.ball,
        fontStyle: 'bold',
      }),
    )

    this.ownedText = scene.add
      .text(LOCAL.ownedX, LOCAL.priceY + 2, 'OWNED 0', {
        fontFamily: FONT_MONO,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(1, 0)
    this.root.add(this.ownedText)

    this.buyButton = new ShopButton(scene, LOCAL.buttonX, LOCAL.buyY, {
      label: 'BUY',
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      variant: 'primary',
      touchOffsetY: -BUTTON_TOUCH_OFFSET,
      fontSize: '14px',
      onClick: () => handlers.onBuy(id),
    })
    this.equipButton = new ShopButton(scene, LOCAL.buttonX, LOCAL.equipY, {
      label: 'EQUIP',
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      variant: 'secondary',
      touchOffsetY: BUTTON_TOUCH_OFFSET,
      fontSize: '14px',
      onClick: () => handlers.onEquip(id),
    })
    this.root.add([this.buyButton.root, this.equipButton.root])
  }

  /** Atualiza posse, preço e estados dos botões a partir do save atual. */
  update(save: SaveV1): void {
    const owned = ownedCount(save, this.id)
    const equipped = isEquipped(save, this.id)

    this.ownedText
      .setText(`OWNED ${owned}`)
      .setAlpha(owned > 0 ? 0.95 : 0.7)

    this.buyButton.set('BUY', canBuy(save, this.id), 'primary')
    this.equipButton.set(
      equipped ? 'UNEQUIP' : 'EQUIP',
      equipped || canEquip(save, this.id),
      equipped ? 'active' : 'secondary',
    )
  }

  /** Pulso curto no card, usado como feedback de compra/equipar. */
  pulse(): void {
    this.scene.tweens.killTweensOf(this.root)
    this.root.setScale(1)
    this.scene.tweens.add({
      targets: this.root,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 90,
      yoyo: true,
      ease: 'Quad.out',
    })
  }
}
