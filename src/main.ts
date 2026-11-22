import Phaser from 'phaser'
import './styles.css'
import { audio } from './fx/audio'
import { createGameConfig } from './game/config'
import { DEBUG_STATE } from './game/debug-state'
import { createPlatform } from './platform/boot'
import { SaveStore } from './platform/storage'
import { DebugOverlay } from './scenes/DebugOverlay'
import { PlayScene } from './scenes/PlayScene'
import { BootScene, TitleScene } from './scenes/TitleScene'

async function boot(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const debug = params.get('debug') === '1'
  const slowParam = Number(params.get('slow') ?? '1')
  const timeScale = Number.isFinite(slowParam) ? Math.min(2, Math.max(0.1, slowParam)) : 1
  DEBUG_STATE.enabled = debug

  const platform = await createPlatform()
  const saveStore = new SaveStore(platform.storage)

  if (params.get('resetSave') === '1') await saveStore.reset()
  const save = await saveStore.load()
  audio.setMuted(save.muted)

  const scenes: Phaser.Types.Scenes.SceneType[] = [BootScene, TitleScene, PlayScene]
  if (debug) scenes.push(DebugOverlay)

  const game = new Phaser.Game(
    createGameConfig('game-root', scenes, (instance) => {
      instance.registry.set('platform', platform)
      instance.registry.set('saveStore', saveStore)
      instance.registry.set('save', save)
      instance.registry.set('debug', debug)
      instance.registry.set('timeScale', timeScale)
    }),
  )

  platform.onPause(() => game.loop.sleep())
  platform.onResume(() => game.loop.wake())

  const unlock = (): void => void audio.unlock()
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })

  if (debug) {
    // Acesso manual pelo console/DevTools durante o teste.
    ;(window as unknown as { keepie: unknown }).keepie = { game, audio, platform }
  }
}

boot().catch((error: unknown) => {
  console.error('[boot]', error)
  const root = document.getElementById('game-root')
  if (!root) return
  const box = document.createElement('div')
  box.className = 'fatal'
  box.textContent = `Failed to start.\n${String(error)}`
  root.replaceChildren(box)
})
