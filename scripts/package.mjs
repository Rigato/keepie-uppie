#!/usr/bin/env node
/**
 * Empacota o MVP para portais: valida `dist/`, cria o ZIP com o CONTEÚDO de
 * `dist/` na raiz e grava o manifest com tamanho e SHA-256.
 *
 * Regras (spec §9.3): index.html na raiz, caminhos relativos, zero recurso
 * externo no HTML/CSS, ≤ 1.000 arquivos, ≤ 250 MB, path ≤ 240 caracteres.
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import JSZip from 'jszip'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'release')

const MAX_FILES = 1_000
const MAX_BYTES = 250 * 1024 * 1024
const MAX_FILE_BYTES = 200 * 1024 * 1024
const MAX_PATH = 240

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
const version = String(pkg.version ?? '0.0.0').replace(/-dev$/, '-mvp1')

const failures = []

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(abs)))
      continue
    }
    const info = await stat(abs)
    files.push({
      path: relative(DIST, abs).split(sep).join('/'),
      bytes: info.size,
    })
  }

  return files.sort((a, b) => a.path.localeCompare(b.path))
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

try {
  await stat(join(DIST, 'index.html'))
} catch {
  console.error('[package] dist/index.html ausente. Rode `npm run build` primeiro.')
  process.exit(1)
}

const files = await listFiles(DIST)
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0)
const largestPath = files.reduce((max, file) => Math.max(max, file.path.length), 0)
const indexFile = files.find((file) => file.path === 'index.html')

check(Boolean(indexFile), 'index.html precisa estar na raiz do pacote')
check(files.length <= MAX_FILES, `arquivos: ${files.length} > ${MAX_FILES}`)
check(totalBytes <= MAX_BYTES, `tamanho: ${totalBytes} > ${MAX_BYTES}`)
check(largestPath <= MAX_PATH, `maior path: ${largestPath} > ${MAX_PATH}`)

for (const file of files) {
  check(file.bytes <= MAX_FILE_BYTES, `${file.path}: ${file.bytes} > ${MAX_FILE_BYTES}`)
  check(!file.path.startsWith('/'), `${file.path}: caminho absoluto`)
  check(!file.path.includes('..'), `${file.path}: caminho com ..`)
}

const indexHtml = await readFile(join(DIST, 'index.html'), 'utf8')
const indexWithoutDataUris = indexHtml.replace(/data:[^"]+/g, '')
check(!/src="\//.test(indexHtml), 'index.html tem src absoluto')
check(!/href="\//.test(indexHtml), 'index.html tem href absoluto')
check(!/https?:\/\//i.test(indexWithoutDataUris), 'index.html referencia recurso externo')

for (const ref of indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const target = ref[1]
  if (!target || target.startsWith('data:') || target.startsWith('#') || target.startsWith('http')) {
    continue
  }
  const normalized = target.replace(/^\.\//, '')
  check(
    files.some((file) => file.path === normalized),
    `index.html referencia ${target}, que não está no pacote`,
  )
}

const cssFiles = files.filter((file) => file.path.endsWith('.css'))
for (const file of cssFiles) {
  const css = await readFile(join(DIST, file.path), 'utf8')
  check(!/url\(\s*['"]?https?:\/\//i.test(css), `${file.path}: url() externa`)
}

if (failures.length > 0) {
  console.error('[package] validação falhou:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

const zip = new JSZip()
for (const file of files) {
  zip.file(file.path, await readFile(join(DIST, file.path)))
}

const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'UNIX',
})

const sha256 = createHash('sha256').update(buffer).digest('hex')
const zipName = `keepie-uppie-v${version}.zip`

await mkdir(OUT, { recursive: true })
for (const old of await readdir(OUT)) {
  if (old.endsWith('.zip')) await rm(join(OUT, old), { force: true })
}

const zipPath = join(OUT, zipName)
await writeFile(zipPath, buffer)

const manifest = {
  name: 'keepie-uppie',
  version,
  build: 'mvp1',
  date: new Date().toISOString(),
  file: zipName,
  sizeBytes: buffer.length,
  sha256,
  fileCount: files.length,
  uncompressedBytes: totalBytes,
  largestPath,
  paths: files.map((file) => file.path),
}

await writeFile(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log('[package] validação OK')
console.log(`  arquivos: ${files.length}`)
console.log(`  conteúdo: ${(totalBytes / 1024).toFixed(1)} KiB`)
console.log(`  zip: ${(buffer.length / 1024).toFixed(1)} KiB`)
console.log(`  maior path: ${largestPath}`)
console.log(`  sha256: ${sha256}`)
console.log(`  saída: ${relative(ROOT, zipPath)}`)
