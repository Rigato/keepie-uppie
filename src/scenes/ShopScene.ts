import Phaser from 'phaser'
import {
  CONSUMABLE_IDS,
  type ConsumableId,
} from '../core/consumables'
import { buy, canBuy, canEquip, isEquipped, toggleEquip } from '../core/shop'
import { audio } from '../fx/audio'
import { BUILD_LABEL } from '../game/build-info'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { TUNING } from '../game/tuning'
import {
  DEFAULT_SAVE,
  type SaveStore,
  type SaveV1,
} from '../platform/storage'
import { drawBackdrop } from '../ui/backdrop'
import { SHOP_CARD_WIDTH, ShopButton, ShopCard } from '../ui/shop-card'
import { LoadoutPanel } from '../ui/shop-loadout'

const CARD_X = 40
const CARD_TOPS = [236, 398, 560] as const
const NOTE_Y = 722
const LOADOUT_Y = 752
const BACK_Y = 976
const BUILD_Y = 1040

/**
 * Loja de consumíveis. Lê o save do registry, compra/equipa com as funções
 * puras de `core/shop` e persiste pelo `saveStore`. `refresh()` atualiza só a
 * parte dinâmica, sem reiniciar a cena.
 */
export class ShopScene extends Phaser.Scene {
  private readonly cards = new Map<ConsumableId, ShopCard>()
  private balanceGroup?: Phaser.GameObjects.Container
  private balanceText?: Phaser.GameObjects.Text
  private balanceCoin?: Phaser.GameObjects.Arc
  private loadout?: LoadoutPanel
  private leaving = false

  constructor() {
    super('Shop')
  }

  create(): void {
    const { width } = TUNING.world
    this.leaving = false
    this.cards.clear()

    drawBackdrop(this, { walls: false })

    this.add
      .text(width / 2, 96, 'SHOP', {
        fontFamily: FONT_SANS,
        fontSize: '44px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)

    this.balanceGroup = this.add.container(width / 2, 146)
    this.balanceCoin = this.add
      .circle(0, 0, 7, PALETTE.coin)
      .setStrokeStyle(1.5, PALETTE.ballShade, 0.9)
    this.balanceText = this.add
      .text(0, 0, 'COINS 0', {
        fontFamily: FONT_MONO,
        fontSize: '16px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    this.balanceGroup.add([this.balanceCoin, this.balanceText])

    this.add
      .text(width / 2, 180, 'EQUIP UP TO 3 · USED DURING A RUN', {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3)

    // Régua discreta separando o cabeçalho dos cards.
    const rule = this.add.graphics()
    rule.lineStyle(1, PALETTE.accent, 0.14)
    rule.lineBetween(CARD_X, 210, CARD_X + SHOP_CARD_WIDTH, 210)

    CONSUMABLE_IDS.forEach((id, index) => {
      this.cards.set(
        id,
        new ShopCard(
          this,
          id,
          CARD_X,
          CARD_TOPS[index],
          {
            onBuy: (item) => this.buyItem(item),
            onEquip: (item) => this.toggleEquipItem(item),
          },
        ),
      )
    })

    this.add
      .text(
        width / 2,
        NOTE_Y,
        'Coins are earned in runs. Items are used during a run.',
        {
          fontFamily: FONT_SANS,
          fontSize: '11px',
          color: CSS_PALETTE.inkDim,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.8)

    this.loadout = new LoadoutPanel(this, CARD_X, LOADOUT_Y)

    new ShopButton(this, width / 2, BACK_Y, {
      label: 'BACK',
      width: 200,
      height: 54,
      variant: 'secondary',
      touchWidth: 224,
      touchHeight: 64,
      fontSize: '18px',
      letterSpacing: 3,
      onClick: () => this.goBack(),
    })

    this.add
      .text(width / 2, BUILD_Y, BUILD_LABEL, {
        fontFamily: FONT_SANS,
        fontSize: '11px',
        color: CSS_PALETTE.inkDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.5)

    this.input.keyboard?.on('keydown-ESC', () => this.goBack())

    // O card pode ser criado antes do primeiro refresh: desenha o estado atual.
    this.refresh()
  }

  /** Atualiza saldo, cards e loadout a partir do save do registry. */
  refresh(): void {
    const save = this.currentSave()
    this.syncBalance(save.totalCoins)
    for (const card of this.cards.values()) card.update(save)
    this.loadout?.update(save.loadout)
  }

  /**
   * Compra uma unidade. Retorna false (com whiff) quando falta moeda.
   * Público para a cena poder ser dirigida por testes/console.
   */
  buyItem(id: ConsumableId): boolean {
    const save = this.currentSave()
    if (!canBuy(save, id)) {
      audio.play('whiff')
      this.shakeBalance()
      return false
    }

    const next = buy(save, id)
    this.commit(next)
    audio.play('ui')
    this.refresh()
    this.cards.get(id)?.pulse()
    this.pulseBalance()
    return true
  }

  /**
   * Equipa ou desequipa (desequipar não exige posse). Retorna false, com
   * whiff, quando o item não pode entrar no loadout.
   */
  toggleEquipItem(id: ConsumableId): boolean {
    const save = this.currentSave()
    if (!isEquipped(save, id) && !canEquip(save, id)) {
      audio.play('whiff')
      return false
    }

    const next = toggleEquip(save, id)
    this.commit(next)
    audio.play('ui')
    this.refresh()
    this.cards.get(id)?.pulse()
    return true
  }

  private currentSave(): SaveV1 {
    return (this.registry.get('save') as SaveV1 | undefined) ?? DEFAULT_SAVE
  }

  private commit(next: SaveV1): void {
    this.registry.set('save', next)
    const store = this.registry.get('saveStore') as SaveStore | undefined
    if (store) void store.save(next)
  }

  /** Centraliza o conjunto moeda + "COINS n" no topo. */
  private syncBalance(coins: number): void {
    const group = this.balanceGroup
    const text = this.balanceText
    const coin = this.balanceCoin
    if (!group || !text || !coin) return

    text.setText(`COINS ${coins}`)
    const radius = 7
    const gap = 8
    const totalWidth = radius * 2 + gap + text.width
    const left = -totalWidth / 2

    coin.setPosition(left + radius, 0)
    text.setPosition(left + radius * 2 + gap, 0)
    group.setPosition(TUNING.world.width / 2, 146).setScale(1)
  }

  private pulseBalance(): void {
    const group = this.balanceGroup
    if (!group) return
    this.tweens.killTweensOf(group)
    this.syncBalance(this.currentSave().totalCoins)
    this.tweens.add({
      targets: group,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 90,
      yoyo: true,
      ease: 'Quad.out',
    })
  }

  private shakeBalance(): void {
    const group = this.balanceGroup
    if (!group) return
    const baseX = TUNING.world.width / 2
    this.tweens.killTweensOf(group)
    group.setPosition(baseX - 5, 146).setScale(1)
    this.tweens.add({
      targets: group,
      x: baseX + 5,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => group.setX(baseX),
    })
  }

  private goBack(): void {
    if (this.leaving) return
    this.leaving = true
    audio.play('ui')
    this.scene.start('Title')
  }
}
