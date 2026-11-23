#!/usr/bin/env node
/**
 * Smoke E2E do Keepie-Uppie (F6).
 *
 * Caminho crítico: boot → título → Play → chute → queda/morte → save → retry.
 * Os cliques são de verdade (mouse via CDP); o estado é lido do objeto exposto
 * por `?debug=1` (`window.keepie`), que aponta para a cena Play em runtime.
 *
 * Uso:
 *   node scripts/smoke.mjs
 *   BASE_URL=http://localhost:5173/ node scripts/smoke.mjs
 *   CHROME_PATH=/caminho/para/chromium node scripts/smoke.mjs
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
      return `bola em (${playState.ball.x.toFixed(0)}, ${playState.ball.y.toFixed(0)}) · y de tela ${(playState.ball.y - playState.cameraY).toFixed(0)}`
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
