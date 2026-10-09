import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'

/**
 * Serves CLIENT_CONFIG (an ignored, deployment-specific file) as
 * /client-config.json in dev and preview, like the compose mount does for the
 * container. Without it the committed public/client-config.json is served.
 */
export function clientConfigFile(file: string | undefined): Plugin {
  const path = file?.trim() ? resolve(file.trim()) : null
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    if (!path || req.url?.split('?')[0] !== '/client-config.json') return next()
    readFile(path).then(
      (body) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
      },
      next,
    )
  }
  return {
    name: 'client-config-file',
    configureServer: (server) => {
      server.middlewares.use(serve)
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(serve)
    },
  }
}
