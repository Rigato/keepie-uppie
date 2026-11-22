/** Paleta única do jogo. Formas e cores redundantes por design (legibilidade + daltonismo). */
export const PALETTE = {
  bg: 0x070b14,
  bgSoft: 0x0d1526,
  ink: 0xe8eefc,
  inkDim: 0x6f7c96,
  accent: 0x4de2c5,
  ball: 0xffd166,
  ballShade: 0xc99b2d,
  wall: 0x1b2438,
  danger: 0xff5d5d,
  hard: 0x8fa3c8,
  soft: 0x7ad1b5,
  breakable: 0xd98b5f,
  bird: 0xb7c4ff,
  coin: 0xffd166,
  ring: 0x4de2c5,
  spring: 0xff8fab,
  magnet: 0x9b8cff,
  aimed: 0xffb86b,
} as const

export const CSS_PALETTE = {
  ink: '#e8eefc',
  inkDim: '#6f7c96',
  accent: '#4de2c5',
  ball: '#ffd166',
  danger: '#ff5d5d',
} as const
