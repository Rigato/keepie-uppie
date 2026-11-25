/**
 * Padrões de moedas: geometria pura, determinística, sem Phaser e sem `window`.
 *
 * Convenção: `CoinOffset.y` cresce para CIMA. A cena converte cada offset para
 * coordenada de mundo com `worldY = anchorY - offset.y`. Assim a ponta da
 * estrela (`y` maior) fica no topo e a trilha sobe à medida que `i` cresce.
 *
 * Todos os padrões são rígidos: o spawner aplica o MESMO delta a todas as
 * moedas do conjunto (`resolveGroupPlacement`), então a forma nunca deforma.
 */
import { TUNING } from '../game/tuning'

export type CoinPatternId = 'trail' | 'row' | 'square' | 'diamond' | 'star' | 'zigzag'

export interface CoinOffset {
  x: number
  y: number
}

/**
 * Raios da estrela em múltiplos de `spacing`. O desenho "ideal" seria 1.5 / 0.65,
 * mas a folga AABB de `TUNING.spawn.overlapGap` entre as 10 moedas exige raios
 * maiores: com 1.5 / 0.65, pontas internas vizinhas ficam a <38 u uma da outra
 * e o resolutor de layout consideraria o grupo sobreposto. [TESTE]
 */
const STAR_OUTER_RATIO = 2.2
const STAR_INNER_RATIO = 1.05

/** Contagens fixas de cada desenho (a trilha mantém as 6 moedas originais). */
const TRAIL_COUNT = 6
const ROW_COUNT = 4

/**
 * Offsets de um padrão, centrados em (0, 0) pelo chamador. `spacing` é o passo
 * base (`TUNING.interactive.coinSpacing`) e `arc` controla o arco da trilha.
 * Nenhum par de offsets fica a menos de `coinRadius + coinSpecialRadius + 4`
 * (35 u) — na verdade todos satisfazem a folga AABB de 43 u usada pelo layout.
 */
export function buildCoinOffsets(id: CoinPatternId, spacing: number, arc: number): CoinOffset[] {
  switch (id) {
    case 'trail':
      return Array.from({ length: TRAIL_COUNT }, (_, i) => {
        const t = TRAIL_COUNT > 1 ? i / (TRAIL_COUNT - 1) : 0
        return { x: Math.sin(t * Math.PI) * arc, y: i * spacing }
      })

    case 'row':
      return Array.from({ length: ROW_COUNT }, (_, i) => ({
        x: (i - (ROW_COUNT - 1) / 2) * spacing,
        y: 0,
      }))

    case 'square':
      // Contorno 3×3 sem o centro: 8 moedas, lado 2·spacing.
      return [
        { x: -spacing, y: -spacing },
        { x: 0, y: -spacing },
        { x: spacing, y: -spacing },
        { x: -spacing, y: 0 },
        { x: spacing, y: 0 },
        { x: -spacing, y: spacing },
        { x: 0, y: spacing },
        { x: spacing, y: spacing },
      ]

    case 'diamond':
      // Losango de 8 pontas: linhas em y = -2s, -s, 0, s, 2s.
      return [
        { x: 0, y: -2 * spacing },
        { x: -spacing, y: -spacing },
        { x: spacing, y: -spacing },
        { x: -2 * spacing, y: 0 },
        { x: 2 * spacing, y: 0 },
        { x: -spacing, y: spacing },
        { x: spacing, y: spacing },
        { x: 0, y: 2 * spacing },
      ]

    case 'star': {
      // 5 pontas externas alternadas com 5 internas; ponta externa no topo.
      const offsets: CoinOffset[] = []
      for (let i = 0; i < 10; i += 1) {
        const outer = i % 2 === 0
        const radius = spacing * (outer ? STAR_OUTER_RATIO : STAR_INNER_RATIO)
        const angle = Math.PI / 2 - (i * Math.PI) / 5
        offsets.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
      }
      return offsets
    }

    case 'zigzag':
      return Array.from({ length: TRAIL_COUNT }, (_, i) => ({
        x: (i % 2 === 0 ? -1 : 1) * 0.65 * spacing,
        y: i * 0.9 * spacing,
      }))
  }
}

/**
 * Sorteia o padrão pelos pesos de `TUNING.interactive.coinPatterns`. `meters`
 * faz parte da API para futura calibração, mas HOJE não há gating por altitude:
 * todos os padrões existem desde o início (a estrela é simplesmente a mais
 * rara). O sorteio consome exatamente uma chamada do rng.
 */
export function pickCoinPattern(_meters: number, rng: () => number): CoinPatternId {
  const patterns = TUNING.interactive.coinPatterns
  const total = patterns.reduce((sum, pattern) => sum + pattern.weight, 0)
  let roll = rng() * total
  for (const pattern of patterns) {
    roll -= pattern.weight
    if (roll <= 0) return pattern.id
  }
  return patterns[patterns.length - 1]?.id ?? 'trail'
}

/** Índice da moeda especial dentro do conjunto (consome uma chamada do rng). */
export function pickSpecialIndex(count: number, rng: () => number): number {
  if (count <= 0) return 0
  const value = Math.floor(rng() * count)
  return Math.min(count - 1, Math.max(0, Number.isFinite(value) ? value : 0))
}

/** Raio de hitbox/layout: fonte única para o spawner e a fábrica de moedas. */
export function coinRadiusFor(special: boolean): number {
  return special ? TUNING.collect.coinSpecialRadius : TUNING.collect.coinRadius
}

/** Valor entregue no contato (a febre multiplica depois, na PlayScene). */
export function coinValueFor(special: boolean): number {
  return special ? TUNING.collect.coinSpecialValue : TUNING.collect.coinValue
}
