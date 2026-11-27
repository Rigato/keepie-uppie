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
  | 'barrier'
  | 'breakable'
  | 'bird'
  | 'bumper'
  | 'ramp'
  | 'coin'
  | 'ring'
  | 'spring'
  | 'pickupMagnet'
  | 'pickupAimed'
  | 'pickupShield'
  | 'pickupSweet'
  | 'goal'

/** Obstáculos que o spawner coloca no caminho. */
export type ObstacleKind = 'barrier' | 'breakable' | 'bird' | 'bumper' | 'ramp'

/** Interativos do jogo. */
export type InteractiveKind =
  | 'coin'
  | 'ring'
  | 'spring'
  | 'pickupMagnet'
  | 'pickupAimed'
  | 'pickupShield'
  | 'pickupSweet'

export interface InteractiveSpawn {
  kind: InteractiveKind
  x: number
  y: number
  /** Variação visual determinística (0..1). */
  variation: number
  /** Só em moedas: vale `coinSpecialValue` e tem desenho próprio. */
  special?: boolean
  /**
   * Só em moedas: id incremental do conjunto (um padrão inteiro = um id).
   * Serve para agrupar/testar e não afeta gameplay. Incrementa apenas quando o
   * conjunto é aceito pelo layout.
   */
  setId?: number
}

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

export interface ObstacleSpawn {
  kind: ObstacleKind
  /** Centro do obstáculo no mundo. */
  x: number
  y: number
  width: number
  height: number
  /** Para birds: sentido da travessia (-1 esquerda, +1 direita). */
  direction: 1 | -1
  /** Variação visual determinística (0..1). */
  variation: number
}

/** Estado visível da run consumido pelas entidades interativas. */
export interface RunContext {
  meters: number
  coins: number
  streak: number
  feverActive: boolean
  time: number
}
