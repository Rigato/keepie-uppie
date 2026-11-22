import { defineConfig } from 'vite'

const sha = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7)

export default defineConfig({
  // Caminhos relativos: obrigatório para rodar em subpasta (GitHub Pages, itch.io, portais).
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(sha),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
})
