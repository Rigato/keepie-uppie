import type Phaser from 'phaser'
import { ACTIVATABLE_IDS, type ActivatableId } from '../core/consumables'
import { FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { CONSUMABLE_COLORS, drawConsumableIcon } from './consumable-icons'

/**
 * Layout da barra em unidades de tela. A barra fica presa à câmera no canto
 * inferior esquerdo, longe do bloco de pausa/HUD do canto direito.
 */
const LAYOUT = {
  depth: 102,
  slotSize: 72,
  slotRadius: 12,
  touchWidth: 86,
  touchHeight: 94,
  gap: 12,
  firstCenterX: 72,
  centerY: 1002,
  iconSize: 64,
  /** O desenho do ícone sobe um pouco para o rótulo caber dentro do slot. */
  iconY: -9,
  labelY: 26,
  labelSize: 10,
  ringSize: 80,
  ringRadius: 15,
} as const

/** Distância entre centros: o desenho de 72 + o respiro de 12. */
const SLOT_PITCH = LAYOUT.slotSize + LAYOUT.gap

/** Rótulo curto: o nome completo não cabe no slot de 72. */
const SHORT_LABEL: Record<ActivatableId, string> = {
  magnet: 'MAGNET',
  chutao: 'KICK',
  streak: 'STREAK',
}

interface SlotView {
  container: Phaser.GameObjects.Container
  ring: Phaser.GameObjects.Graphics
  zone: Phaser.GameObjects.Zone
  pulse?: Phaser.Tweens.Tween
}

/**
 * Barra de consumíveis ativáveis da run: até três slots fixos na tela.
 * As unidades visíveis são definidas por `refresh`; tocar num slot chama
 * `onActivate` no `pointerdown` (sem `pointerup`, para não vazar entre cenas).
 */
export class ConsumableBar {
  private readonly scene: Phaser.Scene
  private readonly onActivate: (id: ActivatableId) => void
  private readonly slots = new Map<ActivatableId, SlotView>()
  private readonly armed = new Set<ActivatableId>()
  private visibleIds: ActivatableId[] = []

  constructor(
    scene: Phaser.Scene,
    items: ActivatableId[],
    onActivate: (id: ActivatableId) => void,
  ) {
    this.scene = scene
    this.onActivate = onActivate

    for (const id of ACTIVATABLE_IDS) {
      this.slots.set(id, this.createSlot(id))
    }

    this.refresh(items)
  }

  /** Itens ainda disponíveis nesta run (os já usados somem). */
  refresh(items: ActivatableId[]): void {
    const available = new Set(items)
    this.visibleIds = ACTIVATABLE_IDS.filter((id) => available.has(id))

    for (const id of ACTIVATABLE_IDS) {
      const slot = this.slots.get(id)
      if (!slot) continue

      const index = this.visibleIds.indexOf(id)
      if (index < 0) {
        this.hideSlot(slot)
        continue
      }

      const wasVisible = slot.container.visible
      const x = LAYOUT.firstCenterX + index * SLOT_PITCH

      slot.container.setPosition(x, LAYOUT.centerY).setVisible(true)
      slot.zone
        .setPosition(x, LAYOUT.centerY)
        .setVisible(true)
        .setInteractive({ useHandCursor: true })

      if (!wasVisible) {
        // Um toque pode ter deixado o slot no meio do squash; volta ao normal.
        this.scene.tweens.killTweensOf(slot.container)
        slot.container.setScale(1)
      }

      this.applyArmed(id)
    }
  }

  /** Marca um item armado (Chutão / Streak Saver) com anel pulsante. */
  setArmed(id: ActivatableId, armed: boolean): void {
    if (armed) this.armed.add(id)
    else this.armed.delete(id)
    this.applyArmed(id)
  }

  /** A coordenada é de TELA (mundo - cameraY), não de mundo. */
  contains(screenX: number, screenY: number): boolean {
    const halfWidth = LAYOUT.touchWidth / 2
    const halfHeight = LAYOUT.touchHeight / 2

    for (let index = 0; index < this.visibleIds.length; index += 1) {
      const centerX = LAYOUT.firstCenterX + index * SLOT_PITCH
      if (
        Math.abs(screenX - centerX) <= halfWidth &&
        Math.abs(screenY - LAYOUT.centerY) <= halfHeight
      ) {
        return true
      }
    }

    return false
  }

  private createSlot(id: ActivatableId): SlotView {
    const color = CONSUMABLE_COLORS[id]
    const half = LAYOUT.slotSize / 2
    const ringHalf = LAYOUT.ringSize / 2
    const container = this.scene.add
      .container(0, LAYOUT.centerY)
      .setScrollFactor(0)
      .setDepth(LAYOUT.depth)
      .setVisible(false)

    const ring = this.scene.add.graphics()
    ring.lineStyle(6, color, 0.22)
    ring.strokeRoundedRect(-ringHalf, -ringHalf, LAYOUT.ringSize, LAYOUT.ringSize, LAYOUT.ringRadius)
    ring.lineStyle(2.5, color, 1)
    ring.strokeRoundedRect(-ringHalf, -ringHalf, LAYOUT.ringSize, LAYOUT.ringSize, LAYOUT.ringRadius)
    ring.setVisible(false)

    const card = this.scene.add.graphics()
    card.fillStyle(PALETTE.bgSoft, 0.94)
    card.fillRoundedRect(-half, -half, LAYOUT.slotSize, LAYOUT.slotSize, LAYOUT.slotRadius)
    card.lineStyle(2, color, 0.7)
    card.strokeRoundedRect(-half, -half, LAYOUT.slotSize, LAYOUT.slotSize, LAYOUT.slotRadius)

    const icon = this.scene.add.graphics()
    drawConsumableIcon(icon, id, 0, LAYOUT.iconY, color, LAYOUT.iconSize)

    const label = this.scene.add
      .text(0, LAYOUT.labelY, SHORT_LABEL[id], {
        fontFamily: FONT_SANS,
        fontSize: `${LAYOUT.labelSize}px`,
        color: CSS_PALETTE.inkDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.5)

    container.add([ring, card, icon, label])

    const zone = this.scene.add
      .zone(0, LAYOUT.centerY, LAYOUT.touchWidth, LAYOUT.touchHeight)
      .setScrollFactor(0)
      .setDepth(LAYOUT.depth)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })

    zone.on('pointerdown', () => {
      if (!container.visible) return

      this.onActivate(id)

      // Se a cena consumiu o item e chamou refresh, o slot já está invisível:
      // aí não há feedback para tocar. Caso contrário, um squash curto.
      if (!container.visible) return
      this.scene.tweens.killTweensOf(container)
      container.setScale(1)
      this.scene.tweens.add({
        targets: container,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 70,
        yoyo: true,
        ease: 'Quad.out',
      })
    })

    return { container, ring, zone }
  }

  private hideSlot(slot: SlotView): void {
    slot.container.setVisible(false)
    slot.zone.setVisible(false)
    if (slot.zone.input) slot.zone.input.enabled = false

    this.scene.tweens.killTweensOf(slot.container)
    slot.container.setScale(1)
    this.stopPulse(slot)
  }

  private applyArmed(id: ActivatableId): void {
    const slot = this.slots.get(id)
    if (!slot) return

    const shouldPulse = this.armed.has(id) && slot.container.visible

    if (!shouldPulse) {
      this.stopPulse(slot)
      return
    }

    if (slot.pulse) return

    slot.ring.setVisible(true).setScale(1).setAlpha(1)
    slot.pulse = this.scene.tweens.add({
      targets: slot.ring,
      alpha: { from: 0.95, to: 0.35 },
      scaleX: { from: 1, to: 1.07 },
      scaleY: { from: 1, to: 1.07 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    })
  }

  private stopPulse(slot: SlotView): void {
    if (slot.pulse) {
      this.scene.tweens.killTweensOf(slot.ring)
      slot.pulse = undefined
    }
    slot.ring.setVisible(false).setScale(1).setAlpha(1)
  }
}
