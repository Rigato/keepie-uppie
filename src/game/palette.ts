/** Paleta única do jogo. Formas e cores redundantes por design (legibilidade + daltonismo). */
export const PALETTE = {
  /** Céu claro: o fundo não compete com os elementos coloridos. */
  bg: 0xb7d4e8,
  bgSoft: 0xdcecf8,
  ink: 0x13233a,
  inkDim: 0x4a5f78,
  accent: 0x0b7a70,
  ball: 0xf5c542,
  ballShade: 0x9a5c0a,
  wall: 0xa3c2d9,
  danger: 0xd64545,
  hard: 0x3f5f82,
  soft: 0x2f8a6c,
  breakable: 0xb05a36,
  bird: 0x4f60a8,
  coin: 0xf5c542,
  ring: 0x0b7a70,
  spring: 0xd94f7a,
  magnet: 0x6a55c8,
  aimed: 0xd97a1e,
  fever: 0xd9661a,
} as const

export const CSS_PALETTE = {
  ink: '#13233a',
  inkDim: '#4a5f78',
  accent: '#0b7a70',
  /** Dourado de texto: o amarelo da bola é claro demais para texto no céu. */
  ball: '#9a5c0a',
  danger: '#c23a3a',
  fever: '#c25612',
} as const
