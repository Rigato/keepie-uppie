declare const __BUILD_SHA__: string

/** Fase do plano técnico que este build contém. Atualizar no início de cada fase. */
export const BUILD_PHASE = 'F7'
export const BUILD_VERSION = '0.9.0-mvp1'
export const BUILD_SHA = typeof __BUILD_SHA__ === 'undefined' ? 'dev' : __BUILD_SHA__
export const BUILD_LABEL = `${BUILD_PHASE} · ${BUILD_VERSION} · ${BUILD_SHA}`
