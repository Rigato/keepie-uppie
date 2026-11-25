/**
 * Layout de spawn: puro, determinístico e independente de Phaser/física.
 *
 * Convenção: `SpawnRect` usa o CENTRO (`cx`, `cy`) e `width`/`height`, igual aos
 * specs de obstáculos/interativos/gols. Os `bounds` vivos das entidades usam o
 * canto superior esquerdo; `rectFromBounds` converte entre as duas convenções.
 * Nenhuma função aqui altera velocidade, colisão ou câmera — só posições de spawn.
 */

export interface SpawnRect {
  cx: number
  cy: number
  width: number
  height: number
}

/** Forma estrutural de `Phaser.Geom.Rectangle` (x/y do canto superior esquerdo). */
export interface BoundsLike {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutWorld {
  width: number
  wallWidth: number
}

export interface PlacementOptions {
  /** Retângulo desejado, no centro. */
  rect: SpawnRect
  /** Retângulos já ocupados (vivos + aceitos neste lote). */
  occupied: readonly SpawnRect[]
  /** PRNG determinístico fornecido pelo chamador. */
  rng: () => number
  world: LayoutWorld
  /** Folga mínima entre bordas (AABB). Default 0. */
  gap?: number
  /** Tentativas de x lateral por nível. Default 16. */
  attempts?: number
  /** Níveis extras de recuo vertical (y decrescente = mais longe da câmera). Default 4. */
  levels?: number
}

export interface GroupPlacementOptions extends Omit<PlacementOptions, 'rect'> {
  /**
   * Membros do grupo já no formato desejado, em coordenadas de mundo (centro).
   * Cada membro deve incluir seu próprio raio/meia-largura: a caixa união
   * resultante já carrega o padding do maior elemento do grupo.
   */
  rects: readonly SpawnRect[]
  /**
   * Centro desejado da caixa união. Se omitido, usa o centro da união de
   * `rects`. Serve para o Lote B trocar a trilha por padrões sem refazer o layout.
   */
  anchor?: { cx: number; cy: number }
}

export interface PlacementDelta {
  dx: number
  dy: number
}

export function spawnRect(cx: number, cy: number, width: number, height: number): SpawnRect {
  return { cx, cy, width, height }
}

/** Converte bounds (canto superior esquerdo) para rect de centro. */
export function rectFromBounds(bounds: BoundsLike): SpawnRect {
  return spawnRect(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    bounds.width,
    bounds.height,
  )
}

/** Menor retângulo que contém todos os membros; `null` se o grupo estiver vazio. */
export function unionRect(rects: readonly SpawnRect[]): SpawnRect | null {
  if (rects.length === 0) return null
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const rect of rects) {
    left = Math.min(left, rect.cx - rect.width / 2)
    right = Math.max(right, rect.cx + rect.width / 2)
    top = Math.min(top, rect.cy - rect.height / 2)
    bottom = Math.max(bottom, rect.cy + rect.height / 2)
  }

  return spawnRect((left + right) / 2, (top + bottom) / 2, right - left, bottom - top)
}

/** AABB em centro: sobreposição com folga `gap` entre bordas. */
export function overlaps(a: SpawnRect, b: SpawnRect, gap = 0): boolean {
  return (
    Math.abs(a.cx - b.cx) < (a.width + b.width) / 2 + gap &&
    Math.abs(a.cy - b.cy) < (a.height + b.height) / 2 + gap
  )
}

export function isFree(
  rect: SpawnRect,
  occupied: readonly SpawnRect[],
  gap = 0,
): boolean {
  return !occupied.some((other) => overlaps(rect, other, gap))
}

export function shiftRect(rect: SpawnRect, delta: PlacementDelta): SpawnRect {
  return spawnRect(rect.cx + delta.dx, rect.cy + delta.dy, rect.width, rect.height)
}

/**
 * Encaixa um retângulo sem sobrepor `occupied`:
 *  1. tenta manter o x desejado (sem consumir rng);
 *  2. se bloqueado, sorteia x dentro das paredes até encontrar um livre;
 *  3. se não há x livre, recua o y em (maior altura + gap) e repete;
 *  4. se ainda não couber, devolve `null` — o spec é pulado, nunca forçado.
 *
 * O rng é sempre o recebido, então a mesma seed reproduz o mesmo layout.
 */
export function resolvePlacement(options: PlacementOptions): SpawnRect | null {
  const { rect, occupied, rng, world, gap = 0, attempts = 16, levels = 4 } = options
  const minX = world.wallWidth + rect.width / 2
  const maxX = world.width - world.wallWidth - rect.width / 2
  const span = Math.max(0, maxX - minX)
  // Recuar pela maior altura presente evita que um obstáculo alto no mesmo
  // corredor continue bloqueando o próximo nível.
  let stepHeight = rect.height
  for (const other of occupied) stepHeight = Math.max(stepHeight, other.height)
  const verticalStep = stepHeight + gap

  for (let level = 0; level <= levels; level += 1) {
    const cy = rect.cy - level * verticalStep
    const candidate = spawnRect(rect.cx, cy, rect.width, rect.height)
    if (isFree(candidate, occupied, gap)) return candidate

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      candidate.cx = minX + rng() * span
      if (isFree(candidate, occupied, gap)) return spawnRect(candidate.cx, cy, rect.width, rect.height)
    }
  }

  return null
}

/**
 * Resolve o grupo como uma única caixa união e devolve o delta a aplicar em
 * TODOS os membros. A forma (trilha/padrão) nunca é deformada.
 */
export function resolveGroupPlacement(options: GroupPlacementOptions): PlacementDelta | null {
  const union = unionRect(options.rects)
  if (!union) return null

  const anchor = options.anchor ?? { cx: union.cx, cy: union.cy }
  const desired = spawnRect(anchor.cx, anchor.cy, union.width, union.height)
  const resolved = resolvePlacement({ ...options, rect: desired })
  if (!resolved) return null

  return { dx: resolved.cx - union.cx, dy: resolved.cy - union.cy }
}
