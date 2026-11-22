import { FallbackAdapter } from './fallback'
import type { PlatformHost, PlatformService } from './types'

/**
 * Detecção de host. Hoje só o fallback existe. Quando a publicação exigir,
 * adicionar aqui o adapter da Playgama (Bridge vendorizada, versão mais recente)
 * e o adapter nativo do CrazyGames. Nenhum outro arquivo pergunta o host.
 */
export function detectHost(): PlatformHost {
  const forced = new URLSearchParams(window.location.search).get('host')
  if (forced === 'fallback' || forced === 'playgama' || forced === 'crazygames') return forced
  return 'fallback'
}

/** Inicialização com timeout: SDK bloqueado nunca impede o jogo de abrir. */
export async function createPlatform(timeoutMs = 10_000): Promise<PlatformService> {
  detectHost() // reservado para os adapters de portal
  const platform = new FallbackAdapter()
  await Promise.race([
    platform.init(),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ])
  return platform
}
