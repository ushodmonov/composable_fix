// The hub: whichever session's receiver holds the port the apps send to (4747). Every receiver
// also listens on a port of its own and registers it here; the hub hands each request from an
// app to the session opened in that app's project, found by asking each session whether the
// app's package is its project's. The newest such session wins, so a second session in the same
// project takes the reports over. No dependencies.
import { createServer, request } from 'node:http'

/** Who registers here; a hub that answers this is one of ours. */
export const HUB = 'composablefix'

// A session that has not registered again for this long is gone.
const STALE_MS = 10_000
// Where an app's reports go is asked again after this long.
const PLACED_MS = 5_000

/** One request to a session's own port; resolves to its status and body. */
function send(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {},
        timeout: 30_000,
      },
      response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => resolve({ status: response.statusCode ?? 502, body: Buffer.concat(chunks) }))
      },
    )
    outgoing.on('timeout', () => outgoing.destroy(new Error('timed out')))
    outgoing.on('error', reject)
    outgoing.end(body)
  })
}

const reply = (res, code, body) => {
  const text = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': text.length })
  res.end(text)
}

export function createHub() {
  // By port: { port, cwd, since, seen }.
  const sessions = new Map()
  // By app: { port, at }.
  const placed = new Map()

  /** Adds a session, or notes that it is still there. */
  function register(port, cwd) {
    const known = sessions.get(port)
    sessions.set(port, { port, cwd, since: known?.since ?? Date.now(), seen: Date.now() })
  }

  function forget(port) {
    sessions.delete(port)
    for (const [app, place] of placed) if (place.port === port) placed.delete(app)
  }

  /** The newest session whose project the app is, or null; a session that does not answer is forgotten. */
  async function ownerOf(app) {
    const known = placed.get(app)
    if (known && Date.now() - known.at < PLACED_MS && sessions.has(known.port)) return known.port

    const newestFirst = [...sessions.values()].sort((a, b) => b.since - a.since)
    for (const { port } of newestFirst) {
      try {
        const { body } = await send(port, 'GET', `/owns?app=${encodeURIComponent(app)}`)
        if (JSON.parse(body.toString('utf8')).owns === true) {
          placed.set(app, { port, at: Date.now() })
          return port
        }
      } catch {
        forget(port)
      }
    }
    placed.delete(app)
    return null
  }

  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', async () => {
      const body = chunks.length > 0 ? Buffer.concat(chunks) : null
      const url = new URL(req.url ?? '/', 'http://hub')

      if (req.method === 'POST' && url.pathname === '/hub/register') {
        try {
          const { port, cwd } = JSON.parse(body?.toString('utf8') ?? '{}')
          register(Number(port), String(cwd))
          return reply(res, 200, { hub: HUB })
        } catch (error) {
          return reply(res, 400, { error: String(error) })
        }
      }

      const app = url.searchParams.get('app')
      if (!app) return reply(res, 400, { error: 'the request names no app' })

      // A session that dies between the question and the request is passed over for the next.
      for (let tries = 0; tries < 3; tries++) {
        const port = await ownerOf(app)
        if (port === null) break
        try {
          const answer = await send(port, req.method ?? 'GET', req.url ?? '/', body)
          return reply(res, answer.status, answer.body)
        } catch {
          forget(port)
        }
      }
      reply(res, 404, { error: `no Claude Code session has the project of ${app} open` })
    })
  })

  setInterval(() => {
    for (const session of sessions.values()) if (Date.now() - session.seen > STALE_MS) forget(session.port)
  }, 2_000).unref()

  return { server, register }
}

/**
 * Registers a session's port with the hub on `hubPort`. Resolves when a hub took it; rejects with
 * `code` ECONNREFUSED when nothing holds the port, or `NOT_A_HUB` when something else does.
 */
export async function join(hubPort, port, cwd) {
  const { status, body } = await send(hubPort, 'POST', '/hub/register', Buffer.from(JSON.stringify({ port, cwd })))
  let answer = null
  try {
    answer = JSON.parse(body.toString('utf8'))
  } catch {}
  if (status !== 200 || answer?.hub !== HUB) {
    throw Object.assign(new Error(`port ${hubPort} is held by something else`), { code: 'NOT_A_HUB' })
  }
}
