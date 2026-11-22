import Phaser from 'phaser'
import { PALETTE } from './palette'
import { TUNING } from './tuning'

export const FONT_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
export const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export function createGameConfig(
  parent: string,
  scenes: Phaser.Types.Scenes.SceneType[],
  preBoot?: (game: Phaser.Game) => void,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: TUNING.world.width,
    height: TUNING.world.height,
    backgroundColor: PALETTE.bg,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    audio: { noAudio: true },
    fps: { target: 60 },
    scene: scenes,
    callbacks: { preBoot },
  }
}
