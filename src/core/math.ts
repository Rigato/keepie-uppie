export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1)
}

/** Interpolação suave (ease-in-out) entre `edge0` e `edge1`. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return smoothstep01(t)
}

/** `smoothstep` já normalizado para t em 0..1. */
export function smoothstep01(t: number): number {
  const c = clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}

export interface ScalarAnchor {
  meters: number
  value: number
}

/**
 * Interpola âncoras (metros, valor) com smoothstep entre as duas vizinhas.
 * Fora da faixa devolve o valor da âncora mais próxima (sem degraus).
 */
export function sampleAnchors(anchors: readonly ScalarAnchor[], meters: number): number {
  if (anchors.length === 0) return 0
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (!first || !last) return 0
  if (meters <= first.meters) return first.value
  if (meters >= last.meters) return last.value

  for (let i = 1; i < anchors.length; i += 1) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (!a || !b || meters > b.meters) continue
    const t = smoothstep01((meters - a.meters) / (b.meters - a.meters))
    return lerp(a.value, b.value, t)
  }
  return last.value
}
