import Phaser from 'phaser'
import { CONSUMABLES, type ConsumableId } from '../core/consumables'
import { canBuy, canEquip, isEquipped, ownedCount } from '../core/shop'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import type { SaveV1 } from '../platform/storage'

export const SHOP_CARD_WIDTH = 460
export const SHOP_CARD_HEIGHT = 146

/** Cor de identidade de cada consumível (ícone, borda e slot do loadout). */
export const CONSUMABLE_COLORS: Record<ConsumableId, number> = {
  net: PALETTE.accent,
  magnet: PALETTE.magnet,
  chutao: PALETTE.aimed,
}

const CARD_RADIUS = 14
const ICON_SIZE = 64
const BUTTON_WIDTH = 120
const BUTTON_HEIGHT = 44
/** Área de toque maior que o desenho do botão: dedo no celular. */
const BUTTON_TOUCH_WIDTH = 146
const BUTTON_TOUCH_HEIGHT = 54

/** Texto claro sobre o botão primário (teal escuro). */
const TEXT_ON_DARK = '#f8f4e8'

/**
 * Coordenadas locais ao centro do card. As posições do layout são absolutas
 * (x do card = 40); estas constantes já descontam o centro (230, 73).
 */
const LOCAL = {
  iconX: -182,
  iconY: -15,
  textX: -134,
  nameY: -53,
  descriptionY: -27,
  priceY: 39,
  ownedX: -30,
  buttonX: 160,
  buyY: -30,
  equipY: 28,
} as const

export type ShopButtonVariant = 'primary' | 'secondary' | 'active'

export interface ShopButtonOptions {
  label: string
  width: number
  height: number
  variant?: ShopButtonVariant
  touchWidth?: number
  touchHeight?: number
  fontSize?: string
  letterSpacing?: number
  onClick: () => void
}

/**
 * Botão da loja: fundo em Graphics, rótulo em Text e uma Zone de toque maior
 * que o desenho. Desabilitado fica translúcido e não recebe input.
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
        0,
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
      this.draw()
    })
    this.hit.on('pointerdown', () => {
      if (!this.enabled) return
      scene.tweens.add({
        targets: this.root,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 55,
        yoyo: true,
        ease: 'Quad.out',
      })
      this.onClick()
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
      12,
    )
    tile.lineStyle(1, this.color, 0.3)
    tile.strokeRoundedRect(
      LOCAL.iconX - ICON_SIZE / 2,
      LOCAL.iconY - ICON_SIZE / 2,
      ICON_SIZE,
      ICON_SIZE,
      12,
    )
    this.root.add(tile)

    const icon = scene.add.graphics()
    drawConsumableIcon(icon, id, LOCAL.iconX, LOCAL.iconY, this.color)
    this.root.add(icon)

    this.root.add(
      scene.add
        .text(LOCAL.textX, LOCAL.nameY, def.name, {
          fontFamily: FONT_SANS,
          fontSize: '20px',
          color: CSS_PALETTE.ink,
          fontStyle: 'bold',
        })
        .setLetterSpacing(0.5),
    )

    this.root.add(
      scene.add.text(LOCAL.textX, LOCAL.descriptionY, def.description, {
        fontFamily: FONT_SANS,
        fontSize: '13px',
        color: CSS_PALETTE.inkDim,
        wordWrap: { width: 210 },
      }),
    )

    this.root.add(
      scene.add.text(LOCAL.textX, LOCAL.priceY, `${def.price} COINS`, {
        fontFamily: FONT_MONO,
        fontSize: '14px',
        color: CSS_PALETTE.ball,
        fontStyle: 'bold',
      }),
    )

    this.ownedText = scene.add
      .text(LOCAL.ownedX, LOCAL.priceY, 'OWNED 0', {
        fontFamily: FONT_MONO,
        fontSize: '12px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0, 0)
    this.root.add(this.ownedText)

    this.buyButton = new ShopButton(scene, LOCAL.buttonX, LOCAL.buyY, {
      label: 'BUY',
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      variant: 'primary',
      fontSize: '15px',
      onClick: () => handlers.onBuy(id),
    })
    this.equipButton = new ShopButton(scene, LOCAL.buttonX, LOCAL.equipY, {
      label: 'EQUIP',
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      variant: 'secondary',
      fontSize: '15px',
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

/** Ícones desenhados com Graphics: sem emoji, legíveis em qualquer fonte. */
function drawConsumableIcon(
  g: Phaser.GameObjects.Graphics,
  id: ConsumableId,
  cx: number,
  cy: number,
  color: number,
): void {
  switch (id) {
    case 'net':
      drawShieldIcon(g, cx, cy, color)
      return
    case 'magnet':
      drawMagnetIcon(g, cx, cy, color)
      return
    case 'chutao':
      drawPowerKickIcon(g, cx, cy, color)
      return
  }
}

function drawShieldIcon(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  color: number,
): void {
  const points = [
    new Phaser.Geom.Point(cx, cy - 23),
    new Phaser.Geom.Point(cx + 19, cy - 14),
    new Phaser.Geom.Point(cx + 17, cy + 5),
    new Phaser.Geom.Point(cx, cy + 24),
    new Phaser.Geom.Point(cx - 17, cy + 5),
    new Phaser.Geom.Point(cx - 19, cy - 14),
  ]

  g.fillStyle(color, 0.14)
  g.fillPoints(points, true)
  g.lineStyle(2.5, color, 1)
  g.strokePoints(points, true)

  // Checkmark: "salva uma vez", sem depender de texto.
  g.lineStyle(3, color, 1)
  g.beginPath()
  g.moveTo(cx - 8, cy + 1)
  g.lineTo(cx - 2, cy + 8)
  g.lineTo(cx + 10, cy - 8)
  g.strokePath()
}

function drawMagnetIcon(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  color: number,
): void {
  const radius = 14
  const top = cy
  const leg = 12

  g.lineStyle(8, color, 1)
  g.beginPath()
  g.arc(cx, top, radius, Math.PI, Math.PI * 2, false)
  g.moveTo(cx - radius, top)
  g.lineTo(cx - radius, top + leg)
  g.moveTo(cx + radius, top)
  g.lineTo(cx + radius, top + leg)
  g.strokePath()

  // Polos dourados, como o ímã do powerup.
  g.fillStyle(PALETTE.coin, 1)
  g.fillRect(cx - radius - 4, top + leg - 3, 8, 9)
  g.fillRect(cx + radius - 4, top + leg - 3, 8, 9)
  g.lineStyle(1, PALETTE.ballShade, 0.8)
  g.strokeRect(cx - radius - 4, top + leg - 3, 8, 9)
  g.strokeRect(cx + radius - 4, top + leg - 3, 8, 9)
}

function drawPowerKickIcon(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  color: number,
): void {
  // Linhas de velocidade atrás da bola.
  g.lineStyle(2.5, color, 0.5)
  g.lineBetween(cx - 30, cy - 14, cx - 12, cy - 14)
  g.lineBetween(cx - 32, cy - 6, cx - 10, cy - 6)
  g.lineBetween(cx - 28, cy + 2, cx - 14, cy + 2)

  // Chuteira.
  const boot = [
    new Phaser.Geom.Point(cx - 28, cy + 13),
    new Phaser.Geom.Point(cx - 4, cy + 11),
    new Phaser.Geom.Point(cx + 5, cy + 18),
    new Phaser.Geom.Point(cx + 1, cy + 25),
    new Phaser.Geom.Point(cx - 30, cy + 25),
  ]
  g.fillStyle(color, 0.95)
  g.fillPoints(boot, true)
  g.lineStyle(2, PALETTE.ink, 0.55)
  g.lineBetween(cx - 31, cy + 26, cx + 3, cy + 26)

  // Bola em primeiro plano, com gomo e costuras.
  const bx = cx + 8
  const by = cy - 8
  const radius = 14
  g.fillStyle(PALETTE.ballBase, 1)
  g.fillCircle(bx, by, radius)
  g.lineStyle(2.5, color, 1)
  g.strokeCircle(bx, by, radius)

  g.fillStyle(PALETTE.ballPatch, 0.9)
  g.fillCircle(bx, by, 4.5)

  g.lineStyle(1.5, PALETTE.ballPatch, 0.55)
  g.beginPath()
  g.arc(bx, by, radius - 3.5, -0.55, 0.55)
  g.strokePath()
  g.beginPath()
  g.arc(bx, by, radius - 3.5, Math.PI - 0.55, Math.PI + 0.55)
  g.strokePath()
}
