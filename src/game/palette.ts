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
  /** Bola de futebol: base clara, gomos escuros e costura. */
  ballBase: 0xf8f4e8,
  ballPatch: 0x1a2a3d,
  ballSeam: 0xd6e2ec,
  wall: 0xa3c2d9,
  /** Entorno/arquibancada fora do campo: um tom abaixo do wall, sem brigar com o céu. */
  stands: 0x93b3cc,
  danger: 0xd64545,
  /** Barreira de jogadores de falta: azul forte, short claro, dois tons de pele. */
  barrier: 0x1466c8,
  barrierShorts: 0xe8eef5,
  barrierSkinA: 0xf0c49a,
  barrierSkinB: 0xb87a55,
  barrierDark: 0x14243a,
  breakable: 0xb05a36,
  bird: 0x4f60a8,
  coin: 0xf5c542,
  /** Moeda especial: laranja quente + halo/star em dourado-claro. */
  coinSpecial: 0xf06a1f,
  coinSpecialGlow: 0xffe08a,
  ring: 0x0b7a70,
  spring: 0xd94f7a,
  magnet: 0x6a55c8,
  aimed: 0xd97a1e,
  /** Bumper (almofada radial) e Ramp (barra diagonal). */
  bumper: 0x18a0b8,
  ramp: 0x6b7f96,
  /** Powerups de proteção e precisão. */
  shield: 0x3f8ec9,
  sweet: 0xc0509a,
  /** Gol: postes claros com rede accent. */
  goal: 0xf8f4e8,
  fever: 0xd9661a,
  /** Camada cinza-azulada da exaustão: dessatura o mundo, não o HUD. */
  exhaust: 0x5c6a75,
} as const

export const CSS_PALETTE = {
  ink: '#13233a',
  inkDim: '#4a5f78',
  accent: '#0b7a70',
  /** Dourado de texto: o amarelo da bola é claro demais para texto no céu. */
  ball: '#9a5c0a',
  danger: '#c23a3a',
  fever: '#c25612',
  shield: '#2f6f9e',
  sweet: '#a33279',
} as const
