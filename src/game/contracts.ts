export interface Vec2 {
  x: number
  y: number
}

/** Bola como o gameplay enxerga: posição, velocidade e raio. */
export interface BallLike extends Vec2 {
  vx: number
  vy: number
  r: number
}

export type EntityKind =
  | 'hard'
  | 'soft'
  | 'breakable'
  | 'bird'
  | 'coin'
  | 'ring'
  | 'spring'
  | 'pickupMagnet'
  | 'pickupAimed'

/**
 * Efeito de um contato no gameplay. Cada entidade devolve isto; a cena aplica.
 * 'none' = encostou mas nada muda; 'reflect' = quique espelhado; 'damp' = dreno;
 * 'shatter' = rompeu; 'collect' = coletou; 'launch' = mola; 'deflect' = desvio leve.
 */
export type ContactResult = 'none' | 'reflect' | 'damp' | 'shatter' | 'collect' | 'launch' | 'deflect'

export interface Contact {
  kind: EntityKind
  result: ContactResult
  point: Vec2
  /** Intensidade normalizada 0..1 para feedback (som, shake, partículas). */
  strength: number
}

/** Estado visível da run consumido pelas entidades interativas. */
export interface RunContext {
  meters: number
  coins: number
  streak: number
  feverActive: boolean
  time: number
}
