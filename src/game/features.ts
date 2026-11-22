/**
 * Flags de apresentação debug/tuning. A build publicável mantém tudo desligado.
 * `?ring=1` mostra o anel da área de chute (alvo e mira).
 */
const params = new URLSearchParams(window.location.search)

export const FEATURES = {
  kickRing: params.get('ring') === '1',
} as const
