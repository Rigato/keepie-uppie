#!/usr/bin/env node
/**
 * Smoke E2E do Keepie-Uppie (F6).
 *
 * Caminho crítico: boot → título → Play → chute → queda/morte → save → retry,
 * a estamina esgotando/bloqueando/recuperando e a barra de ativáveis
 * (Magnet, Power Kick e Streak Saver) consumindo a carga e aplicando o efeito.
 * Os cliques são de verdade (mouse via CDP); o estado é lido do objeto exposto
 * por `?debug=1` (`window.keepie`), que aponta para a cena Play em runtime.
 *
 * Uso:
 *   node scripts/smoke.mjs
 *   BASE_URL=http://localhost:5173/ node scripts/smoke.mjs
 *   CHROME_PATH=/caminho/para/chromium node scripts/smoke.mjs
 *   npx playwright-core install chromium   # fallback sem Chromium do sistema
 *
 * Sai com código 1 se qualquer passo falhar ou se houver erro de console.
 */
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH?.trim(),
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  // No CI o Chromium vem de `npx playwright-core install chromium`.
  chromium.executablePath(),
].filter((candidate) => Boolean(candidate))
const CHROME_PATH = CHROME_CANDIDATES.find((candidate) => existsSync(candidate)) ?? '/usr/bin/chromium'
const BASE_URL = process.env.BASE_URL?.trim() || 'http://localhost:4173/'
const SCREENSHOT_PATH = '/tmp/keepie-smoke.png'

const VIEWPORT = { width: 390, height: 844 }
const DEVICE_SCALE_FACTOR = 2
const WORLD_WIDTH = 540
const WORLD_HEIGHT = 1080

const TIMEOUT = {
  boot: 20_000,
  titleTap: 400,
  play: 3_000,
  falling: 1_500,
  kick: 1_000,
  death: 8_000,
  retryReady: 3_000,
  save: 1_000,
  retry: 1_000,
  bar: 1_500,
  stamina: 1_500,
  staminaRecover: 2_500,
  settle: 250,
}

const results = []
let halted = false
let page
let browser

function buildUrl() {
  const url = new URL(BASE_URL)
  url.searchParams.set('debug', '1')
  url.searchParams.set('resetSave', '1')
  return url.toString()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Poll genérico: repete `probe` até devolver algo truthy ou estourar o timeout. */
async function poll(probe, { timeout, interval = 50, label }) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeout) {
    try {
      const value = await probe()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(interval)
  }

  const elapsed = Date.now() - startedAt
  const suffix = lastError ? ` · último erro: ${lastError.message}` : ''
  throw new Error(`${label}: não aconteceu em ${elapsed}ms (limite ${timeout}ms)${suffix}`)
}

/** Passo que depende dos anteriores. Depois de uma falha, os demais são SKIP. */
async function runStep(name, fn) {
  if (halted) {
    results.push({ name, status: 'SKIP', detail: 'passo anterior falhou' })
    return
  }

  try {
    const detail = await fn()
    results.push({ name, status: 'PASS', detail })
  } catch (error) {
    halted = true
    results.push({ name, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) })
  }
}

/** Estado da cena Play, incluindo a projeção CSS do canvas. */
function readPlayState() {
  return page.evaluate(() => {
    const game = window.keepie?.game
    const scene = game?.scene?.getScene('Play')
    if (!scene) return null

    const canvas = document.querySelector('#game-root canvas')
    const rect = canvas?.getBoundingClientRect()
    const ball = scene.ball

    return {
      active: scene.scene?.isActive?.() === true,
      started: scene.started === true,
      dead: scene.dead === true,
      retryReady: scene.retryReady === true,
      ball:
        ball && Number.isFinite(ball.x) && Number.isFinite(ball.y)
          ? { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.r }
          : null,
      cameraY: Number.isFinite(scene.cameraY) ? scene.cameraY : 0,
      meters: Number.isFinite(scene.meters) ? scene.meters : 0,
      canvas:
        rect && rect.width > 0 && rect.height > 0
          ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          : null,
    }
  })
}

function consoleErrorsHeader(count) {
  return count === 0 ? 'Erros de console (0)' : `Erros de console (${count})`
}

async function printSummary(url, consoleErrors) {
  console.log('')
  console.log(`Keepie-Uppie smoke · ${url}`)
  console.log(`Chromium: ${CHROME_PATH} · viewport ${VIEWPORT.width}x${VIEWPORT.height} @${DEVICE_SCALE_FACTOR}x`)
  console.log('')

  for (const result of results) {
    console.log(`  ${result.status.padEnd(4)}  ${result.name}`)
    if (result.detail) console.log(`        ${result.detail}`)
  }

  console.log('')
  console.log(consoleErrorsHeader(consoleErrors.length))
  for (const error of consoleErrors) {
    console.log(`  - ${error}`)
  }

  const failed = results.filter((r) => r.status === 'FAIL').length + (consoleErrors.length > 0 ? 1 : 0)
  const passed = results.filter((r) => r.status === 'PASS').length
  const ok = failed === 0 && results.every((r) => r.status !== 'SKIP')

  console.log('')
  console.log(ok ? `Resultado: PASS (${passed}/${results.length})` : `Resultado: FAIL (${failed} falha(s))`)
  return ok
}

async function main() {
  const url = buildUrl()
  const consoleErrors = []

  if (!existsSync(CHROME_PATH)) {
    console.error(
      `[smoke] Chromium não encontrado em "${CHROME_PATH}".\n` +
        '         Defina CHROME_PATH ou instale o Chromium em /usr/bin/chromium,\n' +
        '         /usr/bin/chromium-browser ou /usr/bin/google-chrome.',
    )
    process.exitCode = 1
    return
  }

  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--disable-dev-shm-usage'],
    })

    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    })
    page = await context.newPage()

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`)
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${error.stack || error.message}`)
    })

    let playState

    await runStep('Boot: canvas e cena Title', async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.boot })
      await page.waitForSelector('#game-root canvas', { state: 'visible', timeout: TIMEOUT.boot })

      const boot = await poll(
        () =>
          page.evaluate(() => {
            const game = window.keepie?.game
            const title = game?.scene?.getScene('Title')
            const canvas = document.querySelector('#game-root canvas')
            const rect = canvas?.getBoundingClientRect()
            if (!title || !title.scene.isActive() || !rect || rect.width === 0) return null
            return { width: Math.round(rect.width), height: Math.round(rect.height) }
          }),
        { timeout: TIMEOUT.boot, label: 'cena Title ativa' },
      )

      return `canvas CSS ${boot.width}x${boot.height} · cena Title ativa`
    })

    await runStep('Loja: BACK não reabre a loja', async () => {
      // A loja volta ao título no release do BACK, que fica na mesma
      // coordenada do botão SHOP do título. Este passo é a regressão do bug.
      await sleep(400)
      const canvas = await page.evaluate(() => {
        const rect = document.querySelector('#game-root canvas')?.getBoundingClientRect()
        return rect
          ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
          : null
      })
      if (!canvas) throw new Error('canvas sem tamanho')

      const toCss = (worldX, worldY) => ({
        x: canvas.left + (worldX / WORLD_WIDTH) * canvas.width,
        y: canvas.top + (worldY / WORLD_HEIGHT) * canvas.height,
      })

      const shopButton = toCss(270, 977)
      await page.mouse.click(shopButton.x, shopButton.y)
      await poll(
        () =>
          page.evaluate(() => {
            const game = window.keepie?.game
            return game?.scene?.getScene('Shop')?.scene?.isActive?.() === true
          }),
        { timeout: TIMEOUT.play, interval: 40, label: 'cena Shop ativa' },
      )

      const backButton = toCss(270, 976)
      await page.mouse.click(backButton.x, backButton.y)
      await sleep(500)

      const afterBack = await page.evaluate(() => {
        const game = window.keepie?.game
        return {
          title: game?.scene?.getScene('Title')?.scene?.isActive?.() === true,
          shop: game?.scene?.getScene('Shop')?.scene?.isActive?.() === true,
        }
      })
      if (!afterBack.title || afterBack.shop) {
        throw new Error(
          `esperava Title ativo e Shop inativo; recebi ${JSON.stringify(afterBack)}`,
        )
      }
      return 'Shop → BACK → Title, sem reabrir a loja'
    })

    await runStep('Save: loadout de teste', async () => {
      // Semeia o loadout pelo registry (o caminho de compra/equipar é coberto
      // pela loja e pela validação manual). Assim o Play já nasce com os três
      // ativáveis na barra, sem depender de moedas acumuladas.
      const seeded = await page.evaluate(() => {
        const game = window.keepie?.game
        const save = game?.registry?.get('save')
        if (!game || !save) return null
        game.registry.set('save', {
          ...save,
          inventory: { net: 1, magnet: 1, chutao: 1, streak: 1 },
          loadout: ['magnet', 'chutao', 'streak'],
        })
        return { bestMeters: save.bestMeters }
      })
      if (!seeded) throw new Error('save ausente no registry')
      return 'inventário 1× cada · loadout magnet/chutao/streak'
    })

    await runStep('Título: primeiro toque', async () => {
      const x = Math.round(VIEWPORT.width / 2)
      const y = Math.round(VIEWPORT.height * 0.7)
      await page.mouse.click(x, y)
      await sleep(TIMEOUT.titleTap)
      return `toque em (${x}, ${y}) · aguardado ${TIMEOUT.titleTap} ms`
    })

    await runStep('Play: cena ativa e bola', async () => {
      playState = await poll(
        async () => {
          const state = await readPlayState()
          return state?.active && state.ball ? state : null
        },
        { timeout: TIMEOUT.play, interval: 40, label: 'cena Play com bola' },
      )

      const bar = await page.evaluate(() => {
        const scene = window.keepie?.game?.scene?.getScene('Play')
        return scene?.consumableBar?.visibleIds ?? null
      })
      if (!Array.isArray(bar) || bar.length !== 3) {
        throw new Error(`barra com 3 ativáveis esperada; recebi ${JSON.stringify(bar)}`)
      }

      return `bola em (${playState.ball.x.toFixed(0)}, ${playState.ball.y.toFixed(0)}) · y de tela ${(playState.ball.y - playState.cameraY).toFixed(0)} · barra ${bar.join('/')}`
    })

    await runStep('Chute: bola em queda', async () => {
      const falling = await poll(
        async () => {
          const state = await readPlayState()
          if (!state?.active || !state.ball || state.dead || state.started) return null
          return state.ball.vy > 0 ? state : null
        },
        { timeout: TIMEOUT.falling, interval: 30, label: 'bola em queda (vy > 0)' },
      )

      const { ball, canvas } = falling
      if (!canvas) throw new Error('canvas sem tamanho para calcular o clique')

      // Toca fora da janela do PERFECT (0.6r) para manter o arco normal;
      // assim a morte fica determinística e não depende do bônus do perfect.
      const worldX = ball.x + ball.r * 0.6
      const worldY = ball.y - falling.cameraY
      const x = canvas.left + (worldX / WORLD_WIDTH) * canvas.width
      const y = canvas.top + (worldY / WORLD_HEIGHT) * canvas.height

      await page.mouse.click(x, y)

      const kicked = await poll(
        async () => {
          const state = await readPlayState()
          return state?.started && state.ball && state.ball.vy < 0 ? state : null
        },
        { timeout: TIMEOUT.kick, interval: 25, label: 'chute registrado (started + vy < 0)' },
      )

      return `clique em (${x.toFixed(1)}, ${y.toFixed(1)}) · vy ${ball.vy.toFixed(0)} → ${kicked.ball.vy.toFixed(0)} u/s`
    })

    await runStep('Morte, retry pronto e save', async () => {
      const dead = await poll(
        async () => {
          const state = await readPlayState()
          return state?.dead ? state : null
        },
        { timeout: TIMEOUT.death, interval: 100, label: 'morte da bola' },
      )

      const ready = await poll(
        async () => {
          const state = await readPlayState()
          return state?.retryReady ? state : null
        },
        { timeout: TIMEOUT.retryReady, interval: 50, label: 'retryReady' },
      )

      const save = await poll(
        () =>
          page.evaluate(() => {
            const raw = localStorage.getItem('keepie.save')
            if (!raw) return null
            try {
              const parsed = JSON.parse(raw)
              return Number.isFinite(parsed?.bestMeters) ? parsed : null
            } catch {
              return null
            }
          }),
        { timeout: TIMEOUT.save, interval: 50, label: 'save em localStorage' },
      )

      if (save.bestMeters < 0) {
        throw new Error(`save inválido: bestMeters=${save.bestMeters}`)
      }

      return `${dead.meters.toFixed(1)} m · retryReady=${ready.retryReady} · save bestMeters=${save.bestMeters}`
    })

    await runStep('Retry: morte zerada', async () => {
      const canvas = playState?.canvas
      const x = canvas ? canvas.left + canvas.width / 2 : VIEWPORT.width / 2
      const y = canvas ? canvas.top + canvas.height / 2 : VIEWPORT.height / 2
      await page.mouse.click(x, y)

      const retried = await poll(
        async () => {
          const state = await readPlayState()
          return state?.active && state.dead === false ? state : null
        },
        { timeout: TIMEOUT.retry, interval: 25, label: 'retry (dead === false)' },
      )

      return `toque em (${x.toFixed(0)}, ${y.toFixed(0)}) · dead=false · started=${retried.started}`
    })

    await runStep('Estamina: 4 toques esgotam, bloqueia e recupera', async () => {
      // Congela spawners, gols e morte como o passo da barra. Física e câmera
      // também ficam paradas: os cliques são reais, então a bola precisa estar
      // exatamente em (270, 600) do mundo para o toque ser válido.
      const setup = await page.evaluate(() => {
        const scene = window.keepie?.game?.scene?.getScene('Play')
        if (!scene) return null

        scene.spawner.update = () => []
        scene.interactiveSpawner.update = () => []
        scene.goalSpawner.update = () => null
        for (const obstacle of scene.obstacles) obstacle.destroy()
        scene.obstacles = []
        for (const item of scene.interactives) item.destroy()
        scene.interactives = []
        for (const goal of scene.goals) goal.destroy()
        scene.goals = []
        scene.die = () => {}
        scene.updateCamera = () => {}
        scene.stepPhysics = () => {}
        scene.started = true
        scene.streak.reset()
        scene.stamina.reset()
        scene.ball.x = 270
        scene.ball.y = 600
        scene.ball.vx = 0
        scene.ball.vy = 0
        scene.arcApexY = 600
        scene.cameraY = 0
        scene.bufferedTap = null
        scene.cameras.main.setScroll(0, 0)

        const rect = document.querySelector('#game-root canvas')?.getBoundingClientRect()
        const canvas =
          rect && rect.width > 0
            ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
            : null
        return { canvas, max: scene.stamina.max, recoverMs: scene.stamina.recoverMs }
      })
      if (!setup) throw new Error('cena Play ausente')
      if (!setup.canvas) throw new Error('canvas sem tamanho')

      const toCss = (worldX, worldY) => ({
        x: setup.canvas.left + (worldX / WORLD_WIDTH) * setup.canvas.width,
        y: setup.canvas.top + (worldY / WORLD_HEIGHT) * setup.canvas.height,
      })
      const point = toCss(270, 600)
      const place = () =>
        page.evaluate(() => {
          const scene = window.keepie.game.scene.getScene('Play')
          scene.ball.x = 270
          scene.ball.y = 600
          scene.ball.vx = 0
          scene.ball.vy = 0
          scene.arcApexY = 600
          scene.cameraY = 0
          scene.bufferedTap = null
          scene.cameras.main.setScroll(0, 0)
        })
      const read = () =>
        page.evaluate(() => {
          const scene = window.keepie.game.scene.getScene('Play')
          return {
            exhausted: scene.stamina.exhausted,
            value: scene.stamina.value,
            max: scene.stamina.max,
            streak: scene.streak.count,
            vy: scene.ball.vy,
            overlayAlpha: scene.exhaustOverlay.alpha,
            overlayVisible: scene.exhaustOverlay.visible,
            label: scene.staminaBar.label.text,
            streakHud: scene.streakText.text,
          }
        })

      for (let i = 0; i < 4; i += 1) {
        await place()
        await page.mouse.click(point.x, point.y)
        if (i < 3) await sleep(60)
      }

      const spent = await read()
      if (!spent.exhausted) throw new Error(`4 chutes não esgotaram: ${JSON.stringify(spent)}`)
      if (spent.value > 10) throw new Error(`barra não zerou: ${spent.value.toFixed(1)}`)
      if (spent.streak !== 4) throw new Error(`streak ${spent.streak}; esperava 4`)
      if (!spent.streakHud.includes('NICE') || !spent.streakHud.includes('+2.0%')) {
        throw new Error(`HUD do streak sem NICE/+2.0%: "${spent.streakHud}"`)
      }
      if (!spent.label.includes('EXHAUSTED')) {
        throw new Error(`rótulo da barra: "${spent.label}"`)
      }

      // O tween do cinza dura 180 ms: mede depois de assentar, não no 1º frame.
      await sleep(250)
      const faded = await poll(
        async () => {
          const state = await read()
          return state.exhausted && state.overlayAlpha > 0.1 ? state : null
        },
        { timeout: TIMEOUT.stamina, interval: 40, label: 'overlay cinza na exaustão' },
      )
      if (!faded.overlayVisible) throw new Error('overlay cinza não ficou visível')

      // 5º clique: não compute chute, não mexe no streak, não gasta Chutão.
      await place()
      const beforeStreak = (await read()).streak
      await page.mouse.click(point.x, point.y)
      const blocked = await read()
      if (!blocked.exhausted) throw new Error('5º clique encerrou a exaustão')
      if (blocked.streak !== beforeStreak) {
        throw new Error(`toque bloqueado mudou o streak: ${beforeStreak} → ${blocked.streak}`)
      }
      if (blocked.vy !== 0) throw new Error(`toque bloqueado alterou vy: ${blocked.vy}`)

      await sleep(setup.recoverMs + 400)
      const recovered = await poll(
        async () => {
          const state = await read()
          return !state.exhausted &&
            state.value >= state.max - 0.5 &&
            state.overlayAlpha < 0.02 &&
            !state.overlayVisible &&
            state.label === 'STAMINA'
            ? state
            : null
        },
        {
          timeout: TIMEOUT.staminaRecover,
          interval: 50,
          label: 'barra cheia e overlay limpo após a recarga',
        },
      )
      if (recovered.value !== recovered.max) {
        throw new Error(`recarga incompleta: ${recovered.value.toFixed(1)}/${recovered.max}`)
      }

      // Deixa o cenário limpo para o passo seguinte da barra de ativáveis.
      await page.evaluate(() => {
        const scene = window.keepie.game.scene.getScene('Play')
        scene.stamina.reset()
        scene.streak.reset()
      })

      return (
        `4 chutes → 0/${setup.max} · streak ${spent.streak} (${spent.streakHud}) · ` +
        `cinza α ${faded.overlayAlpha.toFixed(2)} · 5º toque sem streak/vy · ` +
        `recarga ${setup.recoverMs}ms`
      )
    })

    await runStep('Barra: ativáveis gastam a carga', async () => {
      // O save semeado antes do primeiro toque volta no retry. Congela spawners
      // e a morte para medir só a barra, sem o passo depender da física da run.
      const setup = await page.evaluate(() => {
        const scene = window.keepie?.game?.scene?.getScene('Play')
        if (!scene) return null

        scene.spawner.update = () => []
        scene.interactiveSpawner.update = () => []
        scene.goalSpawner.update = () => null
        for (const obstacle of scene.obstacles) obstacle.destroy()
        scene.obstacles = []
        for (const item of scene.interactives) item.destroy()
        scene.interactives = []
        for (const goal of scene.goals) goal.destroy()
        scene.goals = []
        scene.die = () => {}
        // O passo da estamina congelou a câmera; aqui o zoom do voo precisa
        // voltar a rodar (a física continua congelada para o chute determinístico).
        delete scene.updateCamera
        scene.started = true
        scene.startY = 0
        scene.minY = 0
        scene.ball.x = 270
        scene.ball.y = 620
        scene.ball.vx = 0
        scene.ball.vy = 0
        scene.arcApexY = 620
        scene.cameraY = 0
        scene.cameras.main.setScroll(0, 0)

        const rect = document.querySelector('#game-root canvas')?.getBoundingClientRect()
        const canvas =
          rect && rect.width > 0
            ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
            : null
        return {
          bar: [...scene.consumableBar.visibleIds],
          runItems: [...scene.runItems],
          canvas,
        }
      })
      if (!setup) throw new Error('cena Play ausente')
      if (!setup.canvas) throw new Error('canvas sem tamanho')
      if (setup.bar.join(',') !== 'magnet,chutao,streak') {
        throw new Error(`barra inicial ${JSON.stringify(setup.bar)}; esperava magnet,chutao,streak`)
      }
      if (setup.runItems.join(',') !== 'magnet,chutao,streak') {
        throw new Error(`runItems ${JSON.stringify(setup.runItems)}; esperava os três ativáveis`)
      }

      const toCss = (worldX, worldY) => ({
        x: setup.canvas.left + (worldX / WORLD_WIDTH) * setup.canvas.width,
        y: setup.canvas.top + (worldY / WORLD_HEIGHT) * setup.canvas.height,
      })
      const slotX = (id) =>
        page.evaluate(
          (slotId) =>
            window.keepie?.game?.scene?.getScene('Play')?.consumableBar?.slots?.get(slotId)
              ?.container?.x ?? null,
          id,
        )
      const readSave = () =>
        page.evaluate(() => {
          const raw = localStorage.getItem('keepie.save')
          if (!raw) return null
          try {
            return JSON.parse(raw)
          } catch {
            return null
          }
        })
      const tapSlot = async (id) => {
        const x = await slotX(id)
        if (!Number.isFinite(x)) throw new Error(`slot ${id} não encontrado na barra`)
        const point = toCss(x, 1002)
        await page.mouse.click(point.x, point.y)
      }

      // 1) Magnet: o toque liga o efeito e gasta a unidade na hora.
      await tapSlot('magnet')
      const magnet = await poll(
        async () => {
          const state = await page.evaluate(() => {
            const scene = window.keepie?.game?.scene?.getScene('Play')
            return scene
              ? {
                  remaining: Math.round(scene.magnetEndsAt - scene.time.now),
                  bar: [...scene.consumableBar.visibleIds],
                }
              : null
          })
          if (!state || state.remaining <= 0) return null
          const save = await readSave()
          if (!save || save.inventory?.magnet !== 0) return null
          return { ...state, save }
        },
        { timeout: TIMEOUT.bar, interval: 40, label: 'Magnet ativo e unidade gasta' },
      )
      if (magnet.bar.includes('magnet')) throw new Error('Magnet continuou na barra depois de ativar')
      if (magnet.save.inventory.net !== 1) throw new Error('Safety Net foi gasta sem salvar a bola')

      // 2) Power Kick: ativa, arma e o próximo chute válido sai a 2750 u/s.
      await tapSlot('chutao')
      await poll(
        () =>
          page.evaluate(() => {
            const scene = window.keepie?.game?.scene?.getScene('Play')
            const save = window.keepie?.game?.registry?.get('save')
            return Boolean(scene?.chutaoArmed && save?.inventory?.chutao === 0)
          }),
        { timeout: TIMEOUT.bar, interval: 40, label: 'Power Kick armado e unidade gasta' },
      )
      const armedBar = await page.evaluate(() => [
        ...window.keepie.game.scene.getScene('Play').consumableBar.visibleIds,
      ])
      if (!armedBar.includes('chutao')) throw new Error('anel do Power Kick sumiu antes do chute')

      const kick = await page.evaluate(() => {
        const scene = window.keepie.game.scene.getScene('Play')
        scene.ball.x = 270
        scene.ball.y = 640
        scene.ball.vx = 0
        scene.ball.vy = 900
        scene.arcApexY = 300
        scene.bufferedTap = null
        scene.handleTap(290, 640)
        return {
          speed: Math.round(Math.hypot(scene.ball.vx, scene.ball.vy)),
          armed: scene.chutaoArmed,
          bar: [...scene.consumableBar.visibleIds],
        }
      })
      if (kick.armed) throw new Error('Power Kick continuou armado depois do chute')
      if (kick.bar.includes('chutao')) throw new Error('Power Kick continuou na barra depois do chute')
      if (kick.speed < 2740 || kick.speed > 2760) {
        throw new Error(`chute do Power Kick a ${kick.speed} u/s; esperava ~2750`)
      }

      // O chute forte afasta a câmera de forma contínua; no voo o HUD continua
      // com contra-escala (mesmo tamanho/posição na tela). Depois, ao forçar a
      // queda da bola, o zoom volta ao normal sem pulso nem reset.
      await sleep(450)
      const wide = await page.evaluate(() => {
        const scene = window.keepie.game.scene.getScene('Play')
        const zoom = scene.cameras.main.zoom
        return {
          zoom,
          hudScale: scene.uiRoot.scaleX,
          hudX: scene.uiRoot.x,
          viewWidth: scene.cameras.main.width,
        }
      })
      if (!(wide.zoom < 0.995)) {
        throw new Error(`zoom aberto esperado (<0.995); recebi ${wide.zoom.toFixed(4)}`)
      }
      if (Math.abs(wide.hudScale - 1 / wide.zoom) >= 0.02) {
        throw new Error(
          `HUD não contra-escalou: scale ${wide.hudScale.toFixed(4)} vs 1/zoom ${(1 / wide.zoom).toFixed(4)}`,
        )
      }
      const expectedHudX = (wide.viewWidth / 2) * (1 - 1 / wide.zoom)
      if (Math.abs(wide.hudX - expectedHudX) >= 1) {
        throw new Error(
          `HUD deslocou: x ${wide.hudX.toFixed(2)} vs esperado ${expectedHudX.toFixed(2)}`,
        )
      }

      await page.evaluate(() => {
        const scene = window.keepie.game.scene.getScene('Play')
        scene.ball.y = scene.cameraY + scene.cameras.main.height * 0.85
        scene.ball.vy = 900
      })
      await sleep(500)
      const zoomBack = await page.evaluate(() => {
        const zoom = window.keepie?.game?.scene?.getScene('Play')?.cameras?.main?.zoom
        return Number.isFinite(zoom) ? zoom : -1
      })
      if (!(zoomBack > 0.99)) {
        throw new Error(`zoom não voltou ao normal (>0.99); recebi ${zoomBack.toFixed(4)}`)
      }

      // 3) Streak Saver: ativa e o próximo whiff não zera o streak.
      await tapSlot('streak')
      await poll(
        () =>
          page.evaluate(() => {
            const scene = window.keepie?.game?.scene?.getScene('Play')
            const save = window.keepie?.game?.registry?.get('save')
            return Boolean(scene?.streakSaverArmed && save?.inventory?.streak === 0)
          }),
        { timeout: TIMEOUT.bar, interval: 40, label: 'Streak Saver armado e unidade gasta' },
      )
      const streak = await page.evaluate(() => {
        const scene = window.keepie.game.scene.getScene('Play')
        scene.streak.registerKick()
        scene.streak.registerKick()
        scene.streak.registerKick()
        const before = scene.streak.count
        scene.registerWhiff()
        return {
          before,
          after: scene.streak.count,
          armed: scene.streakSaverArmed,
          bar: [...scene.consumableBar.visibleIds],
        }
      })
      if (streak.after !== streak.before) {
        throw new Error(`whiff quebrou o streak protegido: ${streak.before} → ${streak.after}`)
      }
      if (streak.armed) throw new Error('Streak Saver continuou armado depois do whiff')
      if (streak.bar.length > 0) {
        throw new Error(`barra deveria esvaziar; ainda tem ${streak.bar.join(',')}`)
      }

      const finalSave = await poll(
        async () => {
          const save = await readSave()
          const usedUp =
            save?.inventory?.magnet === 0 &&
            save?.inventory?.chutao === 0 &&
            save?.inventory?.streak === 0
          return usedUp ? save : null
        },
        { timeout: TIMEOUT.bar, interval: 40, label: 'consumo persistido no save' },
      )
      if (finalSave.inventory.net !== 1) throw new Error('Safety Net passiva foi consumida')
      if (finalSave.loadout.length !== 0) {
        throw new Error(`loadout deveria esvaziar; ficou ${JSON.stringify(finalSave.loadout)}`)
      }

      return (
        `Magnet ${magnet.remaining} ms · Power Kick ${kick.speed} u/s · ` +
        `zoom ${wide.zoom.toFixed(3)}→${zoomBack.toFixed(3)} · HUD ×${wide.hudScale.toFixed(3)} @x${wide.hudX.toFixed(1)} · ` +
        `streak ${streak.before}→${streak.after} · net intacta`
      )
    })

    await runStep('Bola: padrão gira e acabamento fica parado', async () => {
      // A rotação é visual: o padrão (gomos) acompanha o vx; o container
      // externo (squash), o glow e o marcador de Ponto Doce não podem girar.
      // A cena já está com spawners e morte congelados pelo passo da barra.
      const sample = async (vx, waitMs) => {
        await page.evaluate((speed) => {
          const scene = window.keepie.game.scene.getScene('Play')
          scene.ball.x = 270
          scene.ball.y = 700
          scene.ball.vx = speed
          scene.ball.vy = 0
          scene.arcApexY = 700
          scene.cameraY = 0
          scene.cameras.main.setScroll(0, 0)
          scene.ballSpin.angle = 0
          scene.ballSpin.residual = 0
          scene.ballArt.pattern.setRotation(0)
        }, vx)
        await sleep(waitMs)
        return page.evaluate(() => {
          const scene = window.keepie.game.scene.getScene('Play')
          return {
            pattern: scene.ballArt.pattern.rotation,
            outer: scene.ballView.rotation,
            glow: scene.ballView.list[0].rotation,
            marker: scene.sweetMarker.rotation,
          }
        })
      }

      const right = await sample(600, 160)
      if (!(right.pattern > 0.05)) {
        throw new Error(`vx>0 não girou o padrão (${right.pattern.toFixed(3)} rad)`)
      }
      const left = await sample(-600, 160)
      if (!(left.pattern < -0.05)) {
        throw new Error(`vx<0 não girou o padrão (${left.pattern.toFixed(3)} rad)`)
      }
      if (left.outer !== 0) throw new Error(`container externo girou: ${left.outer}`)
      if (left.glow !== 0) throw new Error(`glow girou junto: ${left.glow}`)
      if (left.marker !== 0) throw new Error(`marcador girou junto: ${left.marker}`)

      return `vx +600 → ${right.pattern.toFixed(2)} rad · vx −600 → ${left.pattern.toFixed(2)} rad · glow e marcador parados`
    })

    await runStep('Barreira: quica para cima e para o lado', async () => {
      // Planta uma barreira isolada e derruba a bola na metade esquerda: o
      // quique tem de subir e sair para a esquerda, sem drenar e sem matar.
      await page.evaluate(() => {
        const scene = window.keepie.game.scene.getScene('Play')
        // O passo da estamina congela física e câmera; aqui a bola precisa cair.
        delete scene.stepPhysics
        delete scene.updateCamera
        scene.die = () => {}
        scene.started = true
        for (const obstacle of scene.obstacles) obstacle.destroy()
        scene.obstacles = []
        for (const item of scene.interactives) item.destroy()
        scene.interactives = []
        for (const goal of scene.goals) goal.destroy()
        scene.goals = []
        scene.goalSpawner.update = () => null
        scene.interactiveSpawner.update = () => []
        scene.ball.x = 250
        scene.ball.y = 650
        scene.ball.vx = 0
        scene.ball.vy = 500
        scene.arcApexY = 650
        scene.cameraY = 0
        scene.cameras.main.setScroll(0, 0)
        let fired = false
        scene.spawner.update = () => {
          if (fired) return []
          fired = true
          return [
            {
              kind: 'barrier',
              x: 270,
              y: 700,
              width: 152,
              height: 32,
              direction: 1,
              variation: 0.5,
            },
          ]
        }
      })

      const bounce = await poll(
        () =>
          page.evaluate(() => {
            const scene = window.keepie.game.scene.getScene('Play')
            const ball = scene?.ball
            if (!ball) return null
            return ball.vy < -100
              ? { vx: ball.vx, vy: ball.vy, obstacles: scene.obstacles.length }
              : null
          }),
        { timeout: 2000, interval: 30, label: 'quique da barreira' },
      )
      if (bounce.obstacles < 1) throw new Error('a barreira não nasceu')
      if (!(bounce.vx < -100)) {
        throw new Error(`quique lateral esperado para a esquerda; vx=${bounce.vx}`)
      }
      if (!(bounce.vy < -500)) throw new Error(`quique para cima fraco; vy=${bounce.vy}`)
      return `vx ${Math.round(bounce.vx)} · vy ${Math.round(bounce.vy)} · obstáculo ${bounce.obstacles}`
    })

    await runStep('Console sem erros', async () => {
      await sleep(TIMEOUT.settle)
      if (consoleErrors.length > 0) {
        throw new Error(`${consoleErrors.length} erro(s) de console/pageerror`)
      }
      return 'nenhum pageerror ou console.error'
    })

    const ok = await printSummary(url, consoleErrors)

    if (!ok) {
      try {
        await page.screenshot({ path: SCREENSHOT_PATH, timeout: 5_000 })
        console.log(`Screenshot: ${SCREENSHOT_PATH}`)
      } catch {
        // screenshot é opcional
      }
      process.exitCode = 1
    }
  } catch (error) {
    console.error('[smoke] falha inesperada:', error)
    results.push({
      name: 'Execução',
      status: 'FAIL',
      detail: error instanceof Error ? error.message : String(error),
    })
    await printSummary(url, consoleErrors)
    if (page) {
      try {
        await page.screenshot({ path: SCREENSHOT_PATH, timeout: 5_000 })
        console.log(`Screenshot: ${SCREENSHOT_PATH}`)
      } catch {
        // screenshot é opcional
      }
    }
    process.exitCode = 1
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // o processo já vai terminar; não mascara a falha original
      }
    }
  }
}

await main()
