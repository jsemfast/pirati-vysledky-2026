import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// maplibre-gl si svůj web worker (a jeho shared chunk) hledá relativně k
// vlastnímu souboru. Servírujeme je na stabilní cestě /maplibre/ — v devu
// z middleware, v buildu jako asset (viz setWorkerUrl v BaseMapLayer.jsx).
const require = createRequire(import.meta.url)
const MAPLIBRE_WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

function maplibreWorkerAssets() {
  const read = (file) => readFileSync(require.resolve(`maplibre-gl/dist/${file}`))
  return {
    name: 'maplibre-worker',
    generateBundle() {
      for (const file of MAPLIBRE_WORKER_FILES) {
        this.emitFile({ type: 'asset', fileName: `maplibre/${file}`, source: read(file) })
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/maplibre\/([\w.-]+\.mjs)/.exec(req.url || '')
        if (!match || !MAPLIBRE_WORKER_FILES.includes(match[1])) return next()
        res.setHeader('Content-Type', 'text/javascript')
        res.end(read(match[1]))
      })
    },
  }
}

// V devu pouštíme stejnou serverovou funkci jako na Vercelu (api/volby.js),
// ať se lokálně testuje i cesta přes proxy.
function apiVolbyDev() {
  return {
    name: 'api-volby-dev',
    configureServer(server) {
      server.middlewares.use('/api/volby', async (req, res, next) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/api/volby.js')
          await handler(req, res)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorkerAssets(), apiVolbyDev()],
})
