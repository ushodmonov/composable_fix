// Receives fix reports from an app's ComposableFix debug build and hands them to the
// composablefix mod: one JSON line on stdout per event. Started by the mod with
// $.process.spawn and killed with it. Every session runs one, on a port of its own; the one
// that holds the apps' port (4747) is also the hub, which hands each request to the session
// opened in the app's project (hub.mjs). No dependencies beside adb, which is optional: it
// tells which element a report's touch landed on, and lets a device reach this Mac.
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join as joinPath } from 'node:path'

import * as android from './android.mjs'
import { createHub, join } from './hub.mjs'
import { elementAt } from './inspect.mjs'

const PORT = Number(process.env.COMPOSABLEFIX_PORT ?? 4747)
const dir = joinPath(process.cwd(), '.composablefix')
const reportsDir = joinPath(dir, 'reports')
const statusFile = joinPath(dir, 'status.json')
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
    writeFileSync(joinPath(reportsDir, `${id}.ax.json`), JSON.stringify(tree))
  } catch {}
  // The tree is in pixels; a row's reach is 12dp.
  return elementAt(tree, report.touch, { slop: 12 * (report.density ?? 1) })
}

const findSource = android.sourceFinder(process.cwd())
const isOurs = android.appFinder(process.cwd())

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

// The folder is made, and the previous run's reports cleared, when the first report arrives: a
// session in a folder without the app leaves no trace in it. A previous run's statuses are
// cleared at once, so a launch never follows a report of a session gone.
let prepared = false
function prepare() {
  if (prepared) return
  prepared = true
  rmSync(reportsDir, { recursive: true, force: true })
  mkdirSync(reportsDir, { recursive: true })
}
rmSync(statusFile, { force: true })

/** This session's own server: the hub forwards to it the requests of the apps of its project. */
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'GET' && url.pathname === '/owns') {
    return reply(res, 200, { owns: isOurs(url.searchParams.get('app')) })
  }

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
        prepare()
        const id = `r${++count}`
        let screenshot = null
        if (screenshotPNG) {
          screenshot = joinPath('.composablefix', 'reports', `${id}.png`)
          writeFileSync(joinPath(process.cwd(), screenshot), Buffer.from(screenshotPNG, 'base64'))
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

  reply(res, 404, { error: 'not found' })
})

// What this receiver is to the others: the hub, a session registered with the hub, or neither
// yet. Checked every few seconds, so when the hub's session ends another receiver takes its place.
let role = null
let hub = null
let blocked = false

function becomes(next) {
  if (role === next) return
  role = next
  emit({ type: 'ready', port: PORT, role })
}

async function takePart(own) {
  if (hub !== null) {
    hub.register(own, process.cwd())
    return
  }
  try {
    await join(PORT, own, process.cwd())
    blocked = false
    becomes('member')
  } catch (error) {
    if (error.code === 'NOT_A_HUB') {
      if (!blocked) emit({ type: 'error', message: `port ${PORT} is held by something else: another tool's receiver, or an older one` })
      blocked = true
      return
    }
    if (error.code !== 'ECONNREFUSED') return
    // Nothing holds the port: take it.
    const candidate = createHub()
    candidate.server.once('error', () => {})
    candidate.server.listen(PORT, '127.0.0.1', () => {
      hub = candidate
      hub.register(own, process.cwd())
      blocked = false
      becomes('hub')
      // Android devices come and go; each one that arrives gets the port mapped.
      const upkeep = () => keepReversed().catch(error => process.stderr.write(`adb reverse: ${error.message}\n`))
      void upkeep()
      setInterval(upkeep, 5_000).unref()
    })
  }
}

server.on('error', error => {
  emit({ type: 'error', message: String(error) })
  process.exit(1)
})

server.listen(0, '127.0.0.1', () => {
  const own = server.address().port
  const tick = () => takePart(own).catch(error => process.stderr.write(`hub: ${error.message}\n`))
  void tick()
  setInterval(tick, 3_000).unref()
})
