// Receives fix reports from an app's ComposableFix debug build and hands them to the
// composablefix mod: one JSON line on stdout per event. Started by the mod with
// $.process.spawn and killed with it. One receiver owns the port at a time: a newer
// one asks the older one to leave. No dependencies beside adb, which is optional: it
// tells which element a report's touch landed on, and lets a device reach this Mac.
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as android from './android.mjs'
import { elementAt } from './inspect.mjs'

const PORT = Number(process.env.COMPOSABLEFIX_PORT ?? 4747)
const dir = join(process.cwd(), '.composablefix')
const reportsDir = join(dir, 'reports')
const statusFile = join(dir, 'status.json')
// Tells this run's report ids apart from an earlier run's.
const run = Date.now().toString(36)
let count = 0

const emit = event => process.stdout.write(JSON.stringify(event) + '\n')
const ACTIVE = new Set(['queued', 'fixing', 'rebuilding'])

// The adb that answered last; the search for one runs again only when it fails.
let adb = null

/** Runs `use` with the adb that answered last or the first that answers; null when none does. */
async function withAdb(use) {
  const candidates = adb ? [adb, ...android.adbCandidates().filter(path => path !== adb)] : android.adbCandidates()
  if (candidates.length === 0) {
    emit({ type: 'notice', message: 'Install the Android SDK platform-tools, or set COMPOSABLEFIX_ADB, so reports name the element' })
  }
  for (const path of candidates) {
    try {
      const answer = await use(path)
      adb = path
      return answer
    } catch (error) {
      process.stderr.write(`${path}: ${error.message}\n`)
    }
  }
  return null
}

// The devices whose loopback port is mapped to ours. An emulator reaches this Mac at 10.0.2.2
// without it; a device on USB only through it.
let reversed = new Set()

async function keepReversed() {
  if (!(await android.adbServerRunning())) return
  const serials = (await withAdb(path => android.devices(path))) ?? []
  const now = new Set()
  for (const serial of serials) {
    if (reversed.has(serial) || (await withAdb(path => android.reverse(path, serial, PORT))) !== null) now.add(serial)
  }
  reversed = now
}

/**
 * What accessibility says the touch landed on, or null. The app sends a report once its
 * composer has closed and waits for the answer, so the screen is what was pressed; the whole
 * tree is kept beside the screenshot.
 */
async function lookUp(id, report) {
  const serial = report.android?.serial
  if (!report.touch || !serial) return null
  const tree = await withAdb(path => android.describeScreen(path, serial))
  if (tree === null) return null
  try {
    writeFileSync(join(reportsDir, `${id}.ax.json`), JSON.stringify(tree))
  } catch {}
  // The tree is in pixels; a row's reach is 12dp.
  return elementAt(tree, report.touch, { slop: 12 * (report.density ?? 1) })
}

const findSource = android.sourceFinder(process.cwd())

/**
 * A report as the mod reads it: the device it came from, and its `.fixable` file as a path in
 * the project. The app knows its file by its package's folders alone.
 */
async function located(report) {
  const serial = await withAdb(path => android.serialOf(path, report.android))
  const element = report.element && { ...report.element, file: findSource(report.element.file) }
  return { ...report, element, android: { ...report.android, serial } }
}

// Reports reach the mod in the order they arrived, each once its own lookup is done. The
// lookups start at once, so a slow one never makes the next one read a later screen.
let delivered = Promise.resolve()

// The session that started this receiver is gone when its pipe breaks or the
// process is handed to launchd. Without this the receiver would keep the port
// and swallow every report meant for the next session.
const parent = process.ppid
process.stdout.on('error', () => process.exit(0))
setInterval(() => {
  if (process.ppid !== parent) process.exit(0)
}, 1000).unref()

// The mod writes every status change to this file; the app polls it through us.
const statuses = () => {
  try {
    return JSON.parse(readFileSync(statusFile, 'utf8'))
  } catch {
    return {}
  }
}

// With its length, so a client that reads to the end of the connection needs nothing more.
const reply = (res, code, body) => {
  const text = JSON.stringify(body)
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'GET' && url.pathname === '/status') {
    const id = url.searchParams.get('id')
    return reply(res, 200, { run, id, status: id ? (statuses()[id] ?? 'queued') : null })
  }

  // The app has launched: during a fix that means the fix is on screen, however it was built.
  // The answer is the report Claude is working on (reports are worked through in order), else
  // the newest one, for the app to follow or announce.
  if (req.method === 'POST' && url.pathname === '/launched') {
    emit({ type: 'launched' })
    const all = statuses()
    const id = Object.keys(all).find(key => ACTIVE.has(all[key])) ?? (count > 0 ? `r${count}` : null)
    return reply(res, 200, { run, id, status: id ? (all[id] ?? 'queued') : null })
  }

  if (req.method === 'POST' && url.pathname === '/report') {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const { screenshotPNG, ...sent } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const id = `r${++count}`
        let screenshot = null
        if (screenshotPNG) {
          screenshot = join('.composablefix', 'reports', `${id}.png`)
          writeFileSync(join(process.cwd(), screenshot), Buffer.from(screenshotPNG, 'base64'))
        }
        const report = located(sent).catch(() => sent)
        // The answer waits for the lookup: until it comes the app takes no new long press,
        // which would change the screen being read.
        const accessibility = report.then(found => lookUp(id, found)).catch(() => null)
        void accessibility.then(() => reply(res, 200, { id }))
        delivered = delivered.then(async () => {
          emit({ type: 'report', report: { ...(await report), id, screenshot, accessibility: await accessibility } })
        })
      } catch (error) {
        reply(res, 400, { error: String(error) })
      }
    })
    return
  }

  // A newer session's receiver asks for the port.
  if (req.method === 'POST' && url.pathname === '/shutdown') {
    reply(res, 200, { run })
    emit({ type: 'error', message: 'a newer session took over the reports' })
    server.close(() => process.exit(0))
    server.closeAllConnections()
    return
  }

  reply(res, 404, { error: 'not found' })
})

// The port is taken by an earlier receiver: one left behind by a closed session, or the
// one a reload of the mod is replacing. Ask it to leave, then try again.
let attempts = 0
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && ++attempts <= 10) {
    fetch(`http://127.0.0.1:${PORT}/shutdown`, { method: 'POST' })
      .catch(() => {})
      .finally(() => setTimeout(() => server.listen(PORT, '127.0.0.1'), 300))
    return
  }
  emit({ type: 'error', message: error.code === 'EADDRINUSE' ? `port ${PORT} is in use` : String(error) })
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  // Only the receiver that holds the port may clear the previous run's files.
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(reportsDir, { recursive: true })
  emit({ type: 'ready', port: PORT })

  // Android devices come and go; each one that arrives gets the port mapped.
  const upkeep = () => keepReversed().catch(error => process.stderr.write(`adb reverse: ${error.message}\n`))
  void upkeep()
  setInterval(upkeep, 5_000).unref()
})
