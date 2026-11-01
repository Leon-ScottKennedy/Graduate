import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { themeColors } from './scripts/theme-colors.mjs'

function compressedPCTransfer(): Plugin {
  let base = '/'
  return {
    name: 'nexbuild-pc-transfer', apply: 'build', enforce: 'post',
    configResolved(config) { base = config.base },
    generateBundle(_, bundle) {
      const scene = Object.values(bundle).find(chunk => chunk.type === 'chunk' &&
        Object.keys(chunk.modules).some(name => name.replaceAll('\\', '/').endsWith('/home/pcScene.ts')))
      const html = bundle['index.html']
      if (!scene || scene.type !== 'chunk' || !html || html.type !== 'asset') return
      const modelFile = 'models/nexbuild/pc-hardware.glb.gz'
      const compressedModel = gzipSync(readFileSync(new URL('./public/models/nexbuild/pc-hardware.glb', import.meta.url)), { level: 9 })
      this.emitFile({ type: 'asset', fileName: modelFile, source: compressedModel })
      // Small, immutable pieces avoid one stalled multi-megabyte Pages response
      // holding the entire model indefinitely on unreliable connections.
      const split = (data: Buffer) => {
        const size = 16384
        const prefix = `models/nexbuild/transfer/${createHash('sha256').update(data).digest('hex').slice(0, 12)}-`
        const count = Math.ceil(data.length / size)
        for (let i = 0; i < count; i++) this.emitFile({ type: 'asset',
          fileName: `${prefix}${i}.bin`, source: data.subarray(i * size, (i + 1) * size) })
        return { prefix: base + prefix, count, size, bytes: data.length }
      }
      const parts = split(compressedModel)
      // Relative ESM imports cannot be evaluated from a Blob URL. In that case
      // retain normal Vite module loading and only compress the GLB transfer.
      const standalone = scene.imports.length === 0 && scene.dynamicImports.length === 0
      const compressedModule = standalone ? `${scene.fileName}.gz` : undefined
      const moduleData = gzipSync(scene.code, { level: 9 })
      if (compressedModule) this.emitFile({ type: 'asset', fileName: compressedModule, source: moduleData })
      const decoder = {
        js: split(gzipSync(readFileSync(new URL('./public/models/draco/draco_wasm_wrapper.js', import.meta.url)), { level: 9 })),
        wasm: split(gzipSync(readFileSync(new URL('./public/models/draco/draco_decoder.wasm', import.meta.url)), { level: 9 })),
      }
      const data = JSON.stringify({ module: base + scene.fileName,
        compressedModule: compressedModule && base + compressedModule, compressedModel: base + modelFile,
        parts, moduleParts: standalone ? split(moduleData) : undefined, decoder })
      html.source = String(html.source).replace('</head>', `<script id="nexbuild-3d-transfer" type="application/json">${data}</script>\n  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/Graduate/' : '/',
  plugins: [vue(), vueDevTools(), compressedPCTransfer()],
  // Model-conversion tools under artifacts contain unrelated HTML entrypoints.
  optimizeDeps: { entries: ['index.html'] },
  css: { postcss: { plugins: [themeColors()] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
}))
