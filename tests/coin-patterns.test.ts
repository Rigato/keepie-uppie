import { describe, expect, it } from 'vitest'
import {
  buildCoinOffsets,
  coinRadiusFor,
  coinValueFor,
  pickCoinPattern,
  pickSpecialIndex,
  type CoinOffset,
  type CoinPatternId,
} from '../src/core/coin-patterns'
import { mulberry32 } from '../src/core/spawner'
import { TUNING } from '../src/game/tuning'

const IDS: readonly CoinPatternId[] = [
  'trail',
  'row',
  'square',
  'diamond',
  'star',
  'zigzag',
]
const SPACING = TUNING.interactive.coinSpacing
const ARC = TUNING.interactive.coinArc
/** A folga AABB do layout é mais restritiva que a distância euclidiana pedida. */
const MIN_AABB =
  TUNING.collect.coinRadius + TUNING.collect.coinSpecialRadius + TUNING.spawn.overlapGap
const MIN_EUCLIDEAN = TUNING.collect.coinRadius + TUNING.collect.coinSpecialRadius + 4

function offsets(id: CoinPatternId): CoinOffset[] {
  return buildCoinOffsets(id, SPACING, ARC)
}

describe('buildCoinOffsets', () => {
  it('devolve a contagem esperada para cada padrão', () => {
    expect(offsets('trail')).toHaveLength(6)
    expect(offsets('row')).toHaveLength(4)
    expect(offsets('square')).toHaveLength(8)
    expect(offsets('diamond')).toHaveLength(8)
    expect(offsets('star')).toHaveLength(10)
    expect(offsets('zigzag')).toHaveLength(6)
  })

  it('mantém a forma de cada desenho', () => {
    const trail = offsets('trail')
    for (let i = 1; i < trail.length; i += 1) {
      expect(trail[i]!.y).toBeGreaterThan(trail[i - 1]!.y)
    }

    const row = offsets('row')
    expect(new Set(row.map((p) => Math.round(p.y))).size).toBe(1)
    expect(new Set(row.map((p) => p.x)).size).toBe(row.length)

    const square = offsets('square')
    expect(square.some((p) => p.x === 0 && p.y === 0)).toBe(false)
    expect(Math.max(...square.map((p) => Math.abs(p.x)))).toBeCloseTo(SPACING, 6)
    expect(Math.max(...square.map((p) => Math.abs(p.y)))).toBeCloseTo(SPACING, 6)

    const diamond = offsets('diamond')
    expect(diamond.some((p) => Math.abs(p.x) === 2 * SPACING)).toBe(true)
    expect(diamond.some((p) => Math.abs(p.y) === 2 * SPACING)).toBe(true)

    const star = offsets('star')
    expect(star[0]!.x).toBeCloseTo(0, 6)
    expect(star[0]!.y).toBeCloseTo(Math.max(...star.map((p) => p.y)), 6)
    for (let i = 0; i < star.length; i += 2) {
      expect(Math.hypot(star[i]!.x, star[i]!.y)).toBeCloseTo(SPACING * 2.2, 5)
    }
    for (let i = 1; i < star.length; i += 2) {
      expect(Math.hypot(star[i]!.x, star[i]!.y)).toBeCloseTo(SPACING * 1.05, 5)
    }

    const zigzag = offsets('zigzag')
    for (let i = 1; i < zigzag.length; i += 1) {
      expect(Math.sign(zigzag[i]!.x)).toBe(-Math.sign(zigzag[i - 1]!.x))
      expect(zigzag[i]!.y).toBeGreaterThan(zigzag[i - 1]!.y)
    }
  })

  it('respeita o espaçamento mínimo interno em todos os padrões', () => {
    for (const id of IDS) {
      const points = offsets(id)
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const a = points[i]!
          const b = points[j]!
          const dx = Math.abs(a.x - b.x)
          const dy = Math.abs(a.y - b.y)
          expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(MIN_EUCLIDEAN)
          // O resolvedor usa AABB com gap; uma das dimensões precisa separar.
          expect(dx >= MIN_AABB || dy >= MIN_AABB).toBe(true)
        }
      }
    }
  })

  it('é puro e determinístico', () => {
    for (const id of IDS) {
      expect(buildCoinOffsets(id, SPACING, ARC)).toEqual(offsets(id))
      // Não altera nada recebido nem guarda estado entre chamadas.
      expect(buildCoinOffsets(id, SPACING, ARC)).toEqual(offsets(id))
    }
  })
})

describe('pickCoinPattern', () => {
  it('só devolve ids válidos', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 500; i += 1) {
      expect(IDS).toContain(pickCoinPattern(0, rng))
    }
  })

  it('respeita os pesos configurados', () => {
    const rng = mulberry32(1234)
    const draws = 40_000
    const total = TUNING.interactive.coinPatterns.reduce((sum, p) => sum + p.weight, 0)
    const counts = new Map<CoinPatternId, number>(IDS.map((id) => [id, 0]))
    for (let i = 0; i < draws; i += 1) {
      const id = pickCoinPattern(i % 3000, rng)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    for (const pattern of TUNING.interactive.coinPatterns) {
      const expected = (pattern.weight / total) * draws
      const got = counts.get(pattern.id) ?? 0
      expect(Math.abs(got - expected) / expected).toBeLessThan(0.12)
    }
    // A estrela continua sendo a mais rara.
    const star = counts.get('star') ?? 0
    for (const id of IDS) {
      if (id !== 'star') expect(counts.get(id)!).toBeGreaterThan(star)
    }
  })

  it('é estável com a mesma seed e não depende da altitude', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const low = Array.from({ length: 200 }, () => pickCoinPattern(0, a))
    const lowAgain = Array.from({ length: 200 }, () => pickCoinPattern(0, b))
    expect(low).toEqual(lowAgain)

    const c = mulberry32(7)
    const high = Array.from({ length: 200 }, () => pickCoinPattern(2500, c))
    expect(high).toEqual(low)
  })
})

describe('pickSpecialIndex', () => {
  it('devolve um índice inteiro dentro do conjunto', () => {
    for (const count of [4, 6, 8, 10]) {
      const rng = mulberry32(count * 31)
      for (let i = 0; i < 500; i += 1) {
        const index = pickSpecialIndex(count, rng)
        expect(Number.isInteger(index)).toBe(true)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(count)
      }
    }
    expect(pickSpecialIndex(0, mulberry32(1))).toBe(0)
  })

  it('é determinístico e cobre todos os índices', () => {
    const a = mulberry32(555)
    const b = mulberry32(555)
    const seen = new Set<number>()
    for (let i = 0; i < 200; i += 1) {
      const x = pickSpecialIndex(6, a)
      expect(x).toBe(pickSpecialIndex(6, b))
      seen.add(x)
    }
    expect(seen.size).toBe(6)
  })
})

describe('coinRadiusFor / coinValueFor', () => {
  it('usa a tuning como fonte única', () => {
    expect(coinRadiusFor(false)).toBe(TUNING.collect.coinRadius)
    expect(coinRadiusFor(true)).toBe(TUNING.collect.coinSpecialRadius)
    expect(coinValueFor(false)).toBe(TUNING.collect.coinValue)
    expect(coinValueFor(true)).toBe(TUNING.collect.coinSpecialValue)
    expect(coinValueFor(true) * TUNING.streak.coinMultiplier).toBe(10)
  })
})
