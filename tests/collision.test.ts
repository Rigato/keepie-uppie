import { describe, expect, it } from 'vitest'
import { circleCircleHit, circleRectHit, reflectVelocity } from '../src/core/collision'

const bar = { x: 100, y: 200, width: 200, height: 20 }

describe('circleRectHit', () => {
  it('acerta por cima com normal para cima', () => {
    const hit = circleRectHit(200, 195, 10, bar)
    expect(hit).not.toBeNull()
    expect(hit?.normal).toEqual({ x: 0, y: -1 })
    expect(hit?.penetration).toBeCloseTo(5, 5)
    expect(hit?.point).toEqual({ x: 200, y: 200 })
  })

  it('acerta por baixo com normal para baixo', () => {
    const hit = circleRectHit(200, 225, 10, bar)
    expect(hit?.normal).toEqual({ x: 0, y: 1 })
    expect(hit?.penetration).toBeCloseTo(5, 5)
  })

  it('acerta pela esquerda com normal horizontal', () => {
    const hit = circleRectHit(90, 210, 14, bar)
    expect(hit?.normal).toEqual({ x: -1, y: 0 })
    expect(hit?.penetration).toBeCloseTo(4, 5)
  })

  it('não acerta quando está longe', () => {
    expect(circleRectHit(200, 150, 10, bar)).toBeNull()
    expect(circleRectHit(50, 210, 10, bar)).toBeNull()
  })

  it('resolve centro dentro do retângulo pelo lado mais próximo', () => {
    const hit = circleRectHit(200, 208, 10, bar)
    expect(hit?.normal).toEqual({ x: 0, y: -1 })
    expect(hit?.penetration).toBeCloseTo(18, 5)
  })
})

describe('circleCircleHit', () => {
  it('detecta sobreposição e devolve a normal de B para A', () => {
    const hit = circleCircleHit(100, 100, 20, 130, 100, 20)
    expect(hit).not.toBeNull()
    expect(hit?.normal).toEqual({ x: -1, y: 0 })
    expect(hit?.penetration).toBeCloseTo(10, 5)
  })

  it('no limite exato conta como contato sem penetração', () => {
    const hit = circleCircleHit(0, 0, 10, 20, 0, 10)
    expect(hit).not.toBeNull()
    expect(hit?.penetration).toBeCloseTo(0, 5)
    expect(circleCircleHit(0, 0, 10, 20.01, 0, 10)).toBeNull()
  })
})

describe('reflectVelocity', () => {
  it('reflete queda em superfície horizontal', () => {
    expect(reflectVelocity(0, 100, { x: 0, y: -1 })).toEqual({ vx: 0, vy: -100 })
  })

  it('reflete velocidade lateral em parede', () => {
    expect(reflectVelocity(-100, 0, { x: 1, y: 0 })).toEqual({ vx: 100, vy: 0 })
  })

  it('preserva o ângulo espelhado na diagonal', () => {
    expect(reflectVelocity(80, 100, { x: 0, y: -1 })).toEqual({ vx: 80, vy: -100 })
  })

  it('aplica restituição', () => {
    const v = reflectVelocity(0, 100, { x: 0, y: -1 }, 0.9)
    expect(v.vy).toBeCloseTo(-90, 5)
  })
})
