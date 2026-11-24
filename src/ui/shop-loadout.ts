import Phaser from 'phaser'
import { CONSUMABLES, LOADOUT_SIZE, type ConsumableId } from '../core/consumables'
import { FONT_MONO, FONT_SANS } from '../game/config'
import { CSS_PALETTE, PALETTE } from '../game/palette'
import { CONSUMABLE_COLORS } from './shop-card'

const SLOT_WIDTH = 140
const SLOT_HEIGHT = 72
const SLOT_GAP = 20
const SLOT_TOP_OFFSET = 74
const SLOT_RADIUS = 12

/**
 * Painel do loadout pré-run: título "LOADOUT n/3" e três slots fixos.
 * Os slots mostram um ponto colorido + nome curto, ou "EMPTY".
 */
export class LoadoutPanel {
  private readonly scene: Phaser.Scene
  private readonly x: number
  private readonly y: number
  private readonly heading: Phaser.GameObjects.Text
  private readonly gfx: Phaser.GameObjects.Graphics
  private readonly slots: Phaser.GameObjects.Container[]

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y

    this.heading = scene.add
      .text(x, y, `LOADOUT 0/${LOADOUT_SIZE}`, {
        fontFamily: FONT_SANS,
        fontSize: '15px',
        color: CSS_PALETTE.ink,
        fontStyle: 'bold',
      })
      .setLetterSpacing(2)

    this.gfx = scene.add.graphics()
    this.slots = Array.from({ length: LOADOUT_SIZE }, (_, index) =>
      scene.add.container(
        x + index * (SLOT_WIDTH + SLOT_GAP) + SLOT_WIDTH / 2,
        y + SLOT_TOP_OFFSET + SLOT_HEIGHT / 2,
      ),
    )
  }

  update(loadout: readonly ConsumableId[]): void {
    const visible = loadout.slice(0, LOADOUT_SIZE)
    this.heading.setText(`LOADOUT ${visible.length}/${LOADOUT_SIZE}`)

    this.gfx.clear()
    for (let index = 0; index < LOADOUT_SIZE; index += 1) {
      const id = visible[index]
      const slotX = this.x + index * (SLOT_WIDTH + SLOT_GAP)
      const slotY = this.y + SLOT_TOP_OFFSET
      const color = id ? CONSUMABLE_COLORS[id] : PALETTE.accent

      this.gfx.fillStyle(PALETTE.bgSoft, id ? 0.95 : 0.62)
      this.gfx.fillRoundedRect(slotX, slotY, SLOT_WIDTH, SLOT_HEIGHT, SLOT_RADIUS)
      this.gfx.lineStyle(1.5, color, id ? 0.55 : 0.16)
      this.gfx.strokeRoundedRect(slotX, slotY, SLOT_WIDTH, SLOT_HEIGHT, SLOT_RADIUS)

      const slot = this.slots[index]
      slot.removeAll(true)

      if (id) {
        const dot = this.scene.add.circle(-SLOT_WIDTH / 2 + 20, 0, 6, color)
        dot.setStrokeStyle(1, PALETTE.ink, 0.18)
        slot.add(dot)
        slot.add(
          this.scene.add.text(
            -SLOT_WIDTH / 2 + 34,
            0,
            CONSUMABLES[id].name,
            {
              fontFamily: FONT_SANS,
              fontSize: '13px',
              color: CSS_PALETTE.ink,
              fontStyle: 'bold',
            },
          ).setOrigin(0, 0.5),
        )
      } else {
        slot.add(
          this.scene.add
            .text(0, 0, 'EMPTY', {
              fontFamily: FONT_MONO,
              fontSize: '12px',
              color: CSS_PALETTE.inkDim,
            })
            .setOrigin(0.5)
            .setAlpha(0.5),
        )
      }
    }
  }
}
