import Phaser from 'phaser'
import { PALETTE } from '../game/palette'

/**
 * Bola de futebol clássica, desenhada como uma textura a partir do icosaedro
 * truncado real (12 pentágonos + 20 hexágonos). A projeção 3D dá o padrão
 * autêntico — pentágono central e cinco gomos na borda — sem a simetria de
 * "flor" de um ícone desenhado em anel.
 *
 * A textura é gerada no canvas em 4× a resolução de exibição e cacheada por
 * raio no TextureManager da cena, então cada bola é um único Image dentro de
 * um Container. O caller posiciona/escala o container à vontade.
 */

const PHI = (1 + Math.sqrt(5)) / 2
const SUPERSAMPLE = 4
const CAMERA_DISTANCE = 4.1
/** Escala do padrão dentro do contorno (1 = gomos até a silhueta). */
const PATTERN_SCALE = 1
const TEXTURE_VERSION = 1

type Vec3 = { x: number; y: number; z: number }

type Face = {
  /** Pontos do gomo, no espaço do sólido (raio ~1). */
  points: Vec3[]
  /** Gomo escuro (pentágono) ou claro (hexágono). */
  dark: boolean
}

type ProjectedFace = {
  points: { x: number; y: number }[]
  normal: Vec3
  centroid: Vec3
  dark: boolean
}

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

function length(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

function normalize(v: Vec3): Vec3 {
  const l = length(v) || 1
  return vec(v.x / l, v.y / l, v.z / l)
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
}

function lerpColor(a: number, b: number, t: number): [number, number, number] {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ]
}

function rgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function shade(color: number, factor: number): [number, number, number] {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * factor)))
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * factor)))
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * factor)))
  return [r, g, b]
}

/** Icosaedro regular: 12 vértices, 20 faces triangulares. */
function buildIcosahedron(): { vertices: Vec3[]; faces: [number, number, number][] } {
  const raw: Vec3[] = []
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      raw.push(vec(0, a, b * PHI))
      raw.push(vec(a, b * PHI, 0))
      raw.push(vec(a * PHI, 0, b))
    }
  }

  const faces: [number, number, number][] = []
  for (let i = 0; i < raw.length; i += 1) {
    for (let j = i + 1; j < raw.length; j += 1) {
      const dij =
        (raw[i].x - raw[j].x) ** 2 +
        (raw[i].y - raw[j].y) ** 2 +
        (raw[i].z - raw[j].z) ** 2
      if (Math.abs(dij - 4) > 1e-6) continue
      for (let k = j + 1; k < raw.length; k += 1) {
        const dik = dot(raw[i], raw[i]) + dot(raw[k], raw[k]) - 2 * dot(raw[i], raw[k])
        const djk = dot(raw[j], raw[j]) + dot(raw[k], raw[k]) - 2 * dot(raw[j], raw[k])
        if (Math.abs(dik - 4) > 1e-6 || Math.abs(djk - 4) > 1e-6) continue
        const ab = vec(raw[j].x - raw[i].x, raw[j].y - raw[i].y, raw[j].z - raw[i].z)
        const ac = vec(raw[k].x - raw[i].x, raw[k].y - raw[i].y, raw[k].z - raw[i].z)
        const normal = cross(ab, ac)
        const centroid = vec(
          raw[i].x + raw[j].x + raw[k].x,
          raw[i].y + raw[j].y + raw[k].y,
          raw[i].z + raw[j].z + raw[k].z,
        )
        if (dot(normal, centroid) < 0) faces.push([i, k, j])
        else faces.push([i, j, k])
      }
    }
  }

  return { vertices: raw.map(normalize), faces }
}

/** Ordena pontos ao redor de um eixo (para o contorno do pentágono). */
function sortAround(points: Vec3[], axis: Vec3): Vec3[] {
  const n = normalize(axis)
  const helper = Math.abs(n.y) < 0.9 ? vec(0, 1, 0) : vec(1, 0, 0)
  const u = normalize(cross(helper, n))
  const w = cross(n, u)
  return [...points].sort(
    (a, b) => Math.atan2(dot(a, w), dot(a, u)) - Math.atan2(dot(b, w), dot(b, u)),
  )
}

function buildTruncatedIcosahedron(): Face[] {
  const { vertices, faces: triangles } = buildIcosahedron()

  // Vizinhos de cada vértice original (as arestas das 20 faces triangulares).
  const neighbours: Set<number>[] = vertices.map(() => new Set<number>())
  for (const [a, b, c] of triangles) {
    neighbours[a].add(b)
    neighbours[a].add(c)
    neighbours[b].add(a)
    neighbours[b].add(c)
    neighbours[c].add(a)
    neighbours[c].add(b)
  }

  // 12 pentágonos: um em volta de cada vértice do icosaedro, nos pontos a 1/3
  // do caminho até os cinco vizinhos.
  const result: Face[] = vertices.map((v, i) => {
    const points = [...neighbours[i]].map((j) => normalize(lerp(v, vertices[j], 1 / 3)))
    return { points: sortAround(points, v), dark: true }
  })

  // 20 hexágonos: cada face triangular original, truncada nos três cantos.
  for (const [a, b, c] of triangles) {
    const A = vertices[a]
    const B = vertices[b]
    const C = vertices[c]
    const hex = [
      normalize(lerp(A, B, 1 / 3)),
      normalize(lerp(A, B, 2 / 3)),
      normalize(lerp(B, C, 1 / 3)),
      normalize(lerp(B, C, 2 / 3)),
      normalize(lerp(C, A, 1 / 3)),
      normalize(lerp(C, A, 2 / 3)),
    ]
    result.push({ points: hex, dark: false })
  }

  return result
}

/**
 * Gera a textura uma única vez por raio. O canvas tem margem transparente
 * para o contorno e para o antialias; a bola continua com o raio pedido.
 */
function ensureBallTexture(scene: Phaser.Scene, radius: number): string {
  const key = `keepie-ball-v${TEXTURE_VERSION}-${Math.round(radius * 10)}`
  if (scene.textures.exists(key)) return key

  const radiusPx = radius * SUPERSAMPLE
  const margin = Math.ceil(radiusPx * 0.09) + 4
  const size = Math.ceil(radiusPx * 2 + margin * 2)
  const texture = scene.textures.createCanvas(key, size, size)
  if (!texture) throw new Error('Não foi possível criar a textura da bola')

  const ctx = texture.getContext()
  ctx.clearRect(0, 0, size, size)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const cx = size / 2
  const cy = size / 2

  // A câmera olha quase de frente para um vértice do icosaedro: assim o
  // pentágono central aparece, com os cinco vizinhos na borda. O leve tilt
  // desloca o miolo para cima/esquerda e quebra a simetria de ícone.
  const { vertices } = buildIcosahedron()
  const front = vertices[0]
  const upHint = vec(0, 1, 0)
  const xAxis = normalize(cross(upHint, front))
  const yAxis = normalize(cross(front, xAxis))

  const yaw = -0.10
  const pitch = -0.13
  const roll = -0.3
  const cosY = Math.cos(yaw)
  const sinY = Math.sin(yaw)
  const cosP = Math.cos(pitch)
  const sinP = Math.sin(pitch)
  const cosR = Math.cos(roll)
  const sinR = Math.sin(roll)

  const orient = (p: Vec3): Vec3 => {
    const aligned = vec(dot(p, xAxis), dot(p, yAxis), dot(p, front))
    // roll no plano da tela
    const rx = aligned.x * cosR - aligned.y * sinR
    const ry = aligned.x * sinR + aligned.y * cosR
    // yaw em torno de Y
    const yx = rx * cosY + aligned.z * sinY
    const yz = -rx * sinY + aligned.z * cosY
    // pitch em torno de X
    const py = ry * cosP - yz * sinP
    const pz = ry * sinP + yz * cosP
    return vec(yx, py, pz)
  }

  const project = (p: Vec3): { x: number; y: number } => {
    const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE - p.z)
    return {
      x: cx + p.x * PATTERN_SCALE * perspective * radiusPx,
      y: cy - p.y * PATTERN_SCALE * perspective * radiusPx,
    }
  }

  const light = normalize(vec(-0.5, 0.62, 0.72))

  const drawFace = (face: ProjectedFace): void => {
    const [r, g, b] = face.dark
      ? shade(PALETTE.ballPatch, 0.78 + 0.5 * Math.max(0, dot(face.normal, light)))
      : [0, 0, 0]
    ctx.beginPath()
    for (let i = 0; i < face.points.length; i += 1) {
      const p = face.points[i]
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.closePath()
    if (face.dark) {
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fill()
    } else {
      // Painéis claros: variação sutil de luz, sem virar mosaico.
      const ndl = Math.max(0, dot(face.normal, light))
      ctx.fillStyle = ndl > 0.62 ? 'rgba(255, 255, 255, 0.055)' : 'rgba(19, 35, 58, 0.035)'
      ctx.fill()
    }
  }

  const faces = buildTruncatedIcosahedron()
  const projected: ProjectedFace[] = []

  for (const face of faces) {
    const pts = face.points.map(orient)
    const normal = normalize(cross(
      vec(pts[1].x - pts[0].x, pts[1].y - pts[0].y, pts[1].z - pts[0].z),
      vec(pts[2].x - pts[0].x, pts[2].y - pts[0].y, pts[2].z - pts[0].z),
    ))
    let outward = normal
    const center = vec(
      pts.reduce((s, p) => s + p.x, 0) / pts.length,
      pts.reduce((s, p) => s + p.y, 0) / pts.length,
      pts.reduce((s, p) => s + p.z, 0) / pts.length,
    )
    if (dot(outward, center) < 0) outward = vec(-outward.x, -outward.y, -outward.z)
    if (outward.z <= 0.025) continue
    projected.push({ points: pts.map(project), normal: outward, centroid: center, dark: face.dark })
  }

  projected.sort((a, b) => a.centroid.z - b.centroid.z)

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2)
  ctx.clip()

  // 1. Corpo com gradiente radial (luz no canto superior esquerdo).
  const body = ctx.createRadialGradient(
    cx - radiusPx * 0.42,
    cy - radiusPx * 0.46,
    radiusPx * 0.08,
    cx + radiusPx * 0.02,
    cy + radiusPx * 0.06,
    radiusPx * 1.12,
  )
  const baseLight = lerpColor(PALETTE.ballBase, 0xffffff, 0.55)
  const baseDeep = lerpColor(PALETTE.ballBase, PALETTE.ballSeam, 0.3)
  body.addColorStop(0, `rgb(${baseLight[0]}, ${baseLight[1]}, ${baseLight[2]})`)
  body.addColorStop(0.58, rgba(PALETTE.ballBase, 1))
  body.addColorStop(1, `rgb(${baseDeep[0]}, ${baseDeep[1]}, ${baseDeep[2]})`)
  ctx.fillStyle = body
  ctx.fillRect(0, 0, size, size)

  // 2. Faces visíveis (pentágonos escuros e facetas claras).
  for (const face of projected) drawFace(face)

  // 3. Costuras: sombra fina embaixo + fio claro de costura em cima.
  const seams = new Map<string, [number, number, number, number]>()
  const edgeKey = (a: { x: number; y: number }, b: { x: number; y: number }): string => {
    const pa = `${Math.round(a.x * 4)},${Math.round(a.y * 4)}`
    const pb = `${Math.round(b.x * 4)},${Math.round(b.y * 4)}`
    return pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`
  }
  for (const face of projected) {
    for (let i = 0; i < face.points.length; i += 1) {
      const a = face.points[i]
      const b = face.points[(i + 1) % face.points.length]
      seams.set(edgeKey(a, b), [a.x, a.y, b.x, b.y])
    }
  }

  const seamShadow = Math.max(1, radiusPx * 0.029)
  const seamLight = Math.max(0.7, radiusPx * 0.013)
  ctx.strokeStyle = rgba(PALETTE.ballPatch, 0.36)
  ctx.lineWidth = seamShadow
  for (const [, [x1, y1, x2, y2]] of seams) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.strokeStyle = rgba(PALETTE.ballSeam, 0.72)
  ctx.lineWidth = seamLight
  for (const [, [x1, y1, x2, y2]] of seams) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // 4. Sombra global no canto inferior direito.
  const shadeGrad = ctx.createRadialGradient(
    cx + radiusPx * 0.78,
    cy + radiusPx * 0.84,
    radiusPx * 0.05,
    cx + radiusPx * 0.62,
    cy + radiusPx * 0.68,
    radiusPx * 1.05,
  )
  shadeGrad.addColorStop(0, rgba(PALETTE.ballPatch, 0.17))
  shadeGrad.addColorStop(0.62, rgba(PALETTE.ballPatch, 0.06))
  shadeGrad.addColorStop(1, rgba(PALETTE.ballPatch, 0))
  ctx.fillStyle = shadeGrad
  ctx.fillRect(0, 0, size, size)

  // 5. Vinheta de borda: dá volume à esfera, sem escurecer o brilho.
  const rim = ctx.createRadialGradient(cx, cy, radiusPx * 0.58, cx, cy, radiusPx)
  rim.addColorStop(0, rgba(PALETTE.ballPatch, 0))
  rim.addColorStop(0.9, rgba(PALETTE.ballPatch, 0.008))
  rim.addColorStop(1, rgba(PALETTE.ballPatch, 0.06))
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)

  // 6. Brilho suave no canto superior esquerdo.
  const shine = ctx.createRadialGradient(
    cx - radiusPx * 0.36,
    cy - radiusPx * 0.4,
    0,
    cx - radiusPx * 0.36,
    cy - radiusPx * 0.4,
    radiusPx * 0.5,
  )
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
  shine.addColorStop(0.4, 'rgba(255, 255, 255, 0.18)')
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = shine
  ctx.fillRect(0, 0, size, size)

  // 7. Fio de luz na borda superior esquerda (leitura contra o céu).
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)'
  ctx.lineWidth = Math.max(1, radiusPx * 0.028)
  ctx.beginPath()
  ctx.arc(cx, cy, radiusPx * 0.915, Math.PI * 1.04, Math.PI * 1.46)
  ctx.stroke()

  ctx.restore()

  // 8. Contorno escuro por cima de tudo (fora do clip para o traço inteiro).
  ctx.strokeStyle = rgba(PALETTE.ink, 0.9)
  ctx.lineWidth = Math.max(1.5, radius * 0.055) * SUPERSAMPLE
  ctx.beginPath()
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2)
  ctx.stroke()

  texture.refresh()
  return key
}

/**
 * Cria a bola centrada na origem do container. O chamador posiciona o
 * container e aplica squash/stretch nele.
 */
export function createBallView(
  scene: Phaser.Scene,
  radius: number,
): Phaser.GameObjects.Container {
  const key = ensureBallTexture(scene, radius)
  const image = scene.add.image(0, 0, key).setScale(1 / SUPERSAMPLE)
  return scene.add.container(0, 0, [image])
}

/** Variante opcional para telas de preview/dev. */
export function createBallPreview(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
): Phaser.GameObjects.Container {
  return createBallView(scene, radius).setPosition(x, y)
}
