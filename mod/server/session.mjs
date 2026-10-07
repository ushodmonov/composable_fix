// One session's receiver: the reports of its ComposableFix project's apps and where each one
// stands. It listens on a port of its own, which the hub on the apps' port (4747) forwards to,
// and which the plugin's command hooks, its MCP tools and the mod's follower talk to:
//
//   the app       GET /owns, POST /report, GET /status, POST /launched (through the hub)
//   the hooks     GET /pending, POST /deliver, POST /install, POST /turn-end
//   the tools     GET /reports, POST /set-status, POST /wait, POST /take
//   the follower  GET /events (the mod, in the terminal: it submits each report as a prompt)
//
// The project is the Gradle build that uses ComposableFix in the session's folder or up to two
// levels below it; a session with none starts no receiver.
//
// A report is queued until a session takes it (`deliver`), fixing until an install starts
// (rebuilding), and live once the app launches; a turn that ends without that launch leaves it
// stopped. No dependencies beside adb, which is optional.
import { createServer } from 'node:http'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

import { promptFor } from '../shared/prompt.mjs'
import * as android from './android.mjs'
import { createHub, join as joinHub } from './hub.mjs'
import { elementAt } from './inspect.mjs'

const STATUSES = new Set(['queued', 'fixing', 'rebuilding', 'live', 'stopped'])
const IN_PROGRESS = new Set(['fixing', 'rebuilding'])
// `am start` returns before the app has said it is up: a launch this soon after the turn that
// installed it still shows that turn's fix.
const LAUNCH_GRACE_MS = 5_000
// The follower long-polls; while it has asked this recently, the mod delivers reports itself.
const FOLLOWED_MS = 30_000

const reply = (res, code, body) => {
  const text = JSON.stringify(body)
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

const readBody = req =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

/**
 * Starts the receiver of a session in the folder `cwd`. `port` is the apps' port, whose hub this
 * receiver joins or becomes; `log` takes lines for stderr. Resolves once it listens, or at once
 * with null when the folder holds no ComposableFix project. `graceMs` is how long a launch after a
 * turn's end still counts for it.
 */
export async function startSession({ cwd = process.cwd(), port = 4747, log = () => {}, graceMs = LAUNCH_GRACE_MS } = {}) {
  const project = android.findProject(cwd)
  if (project === null) return null

  // Tells this run's report ids apart from an earlier run's.
  const run = Date.now().toString(36)
  const reports = []
  const settling = new Map()
  const events = []
  const waiters = new Set()
  let seq = 0
  let followedAt = 0
  let notice = null

  const isOurs = android.appFinder(project)
  const findSource = android.sourceFinder(project)

  function emit(event) {
    events.push({ ...event, seq: ++seq })
    if (events.length > 500) events.shift()
    for (const wake of waiters) wake()
  }

  /** Changes a report's status, and says so to the follower. */
  function set(report, status) {
    if (report.status === status) return
    report.status = status
    if (status === 'live' || status === 'stopped') report.finishedAt ??= Date.now()
    emit({ type: 'status', id: report.id, status })
  }

  const byId = id => reports.find(report => report.id === id)
  const deliveredTo = (report, session) => report.session === session || report.session === null || session === null

  // The adb that answered last; the search for one runs again only when it fails.
  let adb = null

  /** Runs `use` with the adb that answered last or the first that answers; null when none does. */
  async function withAdb(use) {
    const candidates = adb ? [adb, ...android.adbCandidates().filter(path => path !== adb)] : android.adbCandidates()
    if (candidates.length === 0 && notice === null && process.env.COMPOSABLEFIX_ADB !== 'none') {
      notice = 'Install the Android SDK platform-tools, or set COMPOSABLEFIX_ADB, so reports name the element'
      emit({ type: 'notice', message: notice })
    }
    for (const path of candidates) {
      try {
        const answer = await use(path)
        adb = path
        return answer
      } catch (error) {
        log(`${path}: ${error.message}`)
      }
    }
    return null
  }

  // The devices whose loopback port is mapped to the hub's. An emulator reaches this Mac at
  // 10.0.2.2 without it; a device on USB only through it.
  let reversed = new Set()

  async function keepReversed() {
    if (android.adbCandidates().length === 0 || !(await android.adbServerRunning())) return
    const serials = (await withAdb(path => android.devices(path))) ?? []
    const now = new Set()
    for (const serial of serials) {
      if (reversed.has(serial) || (await withAdb(path => android.reverse(path, serial, port))) !== null) now.add(serial)
    }
    reversed = now
  }

  // The project's reports folder, cleared of an earlier run's at this run's first report.
  let prepared = false
  function reportsDir() {
    const dir = join(project, '.composablefix', 'reports')
    if (!prepared) {
      prepared = true
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /** Takes a report from the app: saves the screenshot, finds the device, the source and the element. */
  async function receive(sent) {
    const { screenshotPNG, ...rest } = sent
    const id = `r${reports.length + 1}`
    const dir = reportsDir()
    let screenshot = null
    if (screenshotPNG) {
      const file = join(dir, `${id}.png`)
      writeFileSync(file, Buffer.from(screenshotPNG, 'base64'))
      screenshot = relative(cwd, file)
    }
    const report = { id, status: 'queued', session: undefined, receivedAt: Date.now(), finishedAt: null }
    reports.push(report)

    const serial = (await withAdb(path => android.serialOf(path, rest.android))) ?? null
    // The file as the app knows it (its package's folders) when the project does not hold it.
    const file = rest.element?.file ? findSource(rest.element.file) : null
    const shown = file && isAbsolute(file) && !relative(cwd, file).startsWith('..') ? relative(cwd, file) : file
    const source = shown ? `${shown}:${rest.element.line}` : null

    // The app waits for this answer before it takes a new long press, so the screen read here is
    // the one that was pressed; the whole tree is kept beside the screenshot.
    let accessibility = null
    if (rest.touch && serial) {
      const tree = await withAdb(path => android.describeScreen(path, serial))
      if (tree !== null) {
        try {
          writeFileSync(join(dir, `${id}.ax.json`), JSON.stringify(tree))
        } catch {}
        accessibility = elementAt(tree, rest.touch, { slop: 12 * (rest.density ?? 1) })
      }
    }

    Object.assign(report, {
      comment: rest.comment,
      screen: rest.screen ?? '',
      element: rest.element?.name ?? null,
      source,
      accessibility,
      screenshot,
      android: { ...rest.android, serial },
    })
    report.prompt = promptFor({ ...rest, id, screenshot, accessibility, android: report.android }, source)
    report.session = null
    emit({ type: 'report', report: summary(report) })
    return report
  }

  const summary = ({ id, comment, screen, element, source, accessibility, screenshot, prompt, status, receivedAt, finishedAt }) => ({
    id,
    comment,
    screen,
    element,
    source,
    accessibility,
    screenshot,
    prompt,
    status,
    receivedAt,
    finishedAt,
  })

  /** Reports a session takes: queued ones start being fixed. */
  function deliver(ids, session) {
    for (const id of ids) {
      const report = byId(id)
      if (!report) continue
      if (report.session === null || report.session === undefined) report.session = session
      if (report.status === 'queued') set(report, 'fixing')
    }
  }

  /** An install under way in a session: its reports being fixed are rebuilding. */
  function install(session) {
    for (const report of reports) {
      if (report.status === 'fixing' && deliveredTo(report, session)) set(report, 'rebuilding')
    }
  }

  /** A session's turn ended: what launched stays live; a report still rebuilding waits a moment for its launch. */
  function turnEnd(session) {
    for (const report of reports) {
      if (!IN_PROGRESS.has(report.status) || !deliveredTo(report, session) || settling.has(report.id)) continue
      if (report.status === 'fixing') {
        set(report, 'stopped')
        continue
      }
      settling.set(
        report.id,
        setTimeout(() => {
          settling.delete(report.id)
          if (report.status !== 'live') set(report, 'stopped')
        }, graceMs),
      )
    }
  }

  /**
   * The app launched: during a fix, the fix is on screen, however it was built. A report whose
   * turn just ended comes first, as the next one's turn may have started already; else every
   * report being fixed, all in the one build.
   */
  function launched() {
    const waiting = reports.filter(report => settling.has(report.id))
    const live = waiting.length > 0 ? waiting : reports.filter(report => IN_PROGRESS.has(report.status))
    for (const report of live) {
      clearTimeout(settling.get(report.id))
      settling.delete(report.id)
      set(report, 'live')
    }
    emit({ type: 'launched' })
    const current = reports.find(report => IN_PROGRESS.has(report.status)) ?? live[0] ?? reports.at(-1)
    return { run, id: current?.id ?? null, status: current?.status ?? null }
  }

  /** Resolves with the events after `after`, waiting up to `ms` for one. */
  function eventsAfter(after, ms) {
    const ready = () => events.filter(event => event.seq > after)
    if (ready().length > 0 || ms <= 0) return Promise.resolve(ready())
    return new Promise(resolve => {
      const wake = () => {
        clearTimeout(timer)
        waiters.delete(wake)
        resolve(ready())
      }
      const timer = setTimeout(wake, ms)
      waiters.add(wake)
    })
  }

  /** The next report nobody has taken, taken for the tool's caller; waits up to `ms` for one. */
  async function waitForReport(ms) {
    // The reports the tool handed out before are settled as at a turn's end.
    turnEnd(null)
    const deadline = Date.now() + ms
    for (;;) {
      const next = reports.find(report => report.session === null && report.status === 'queued')
      if (next) {
        deliver([next.id], null)
        return next
      }
      const left = deadline - Date.now()
      if (left <= 0) return null
      await eventsAfter(seq, left)
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://session')
    const path = `${req.method} ${url.pathname}`
    try {
      const body = req.method === 'POST' ? JSON.parse((await readBody(req)) || '{}') : {}

      switch (path) {
        case 'GET /owns':
          return reply(res, 200, { owns: isOurs(url.searchParams.get('app')) })
        case 'GET /status': {
          const id = url.searchParams.get('id')
          return reply(res, 200, { run, id, status: byId(id)?.status ?? (id ? 'queued' : null) })
        }
        case 'POST /launched':
          return reply(res, 200, launched())
        case 'POST /report': {
          const report = await receive(body)
          return reply(res, 200, { id: report.id })
        }
        case 'GET /pending':
          return reply(res, 200, {
            auto: Date.now() - followedAt < FOLLOWED_MS,
            reports: reports.filter(report => report.session === null && report.status === 'queued').map(summary),
          })
        case 'POST /deliver':
          deliver(body.ids ?? [], body.session ?? null)
          return reply(res, 200, { ok: true })
        case 'POST /install':
          install(body.session ?? null)
          return reply(res, 200, { ok: true })
        case 'POST /turn-end':
          turnEnd(body.session ?? null)
          return reply(res, 200, { ok: true })
        case 'GET /reports':
          return reply(res, 200, { reports: reports.filter(report => report.session !== undefined).map(summary), notice })
        case 'POST /set-status': {
          const report = byId(body.id)
          if (!report || !STATUSES.has(body.status)) return reply(res, 400, { error: 'no such report or status' })
          set(report, body.status)
          return reply(res, 200, summary(report))
        }
        case 'POST /take':
          takeNext = true
          await takePart()
          return reply(res, 200, { receiving, holder })
        case 'POST /wait': {
          const report = await waitForReport(Math.min(Number(body.seconds ?? 300), 3600) * 1000)
          return reply(res, 200, { report: report ? summary(report) : null })
        }
        case 'GET /events': {
          followedAt = Date.now()
          const after = Number(url.searchParams.get('after') ?? 0)
          const found = await eventsAfter(after, Number(url.searchParams.get('wait') ?? 25_000))
          followedAt = Date.now()
          return reply(res, 200, { events: found, role, receiving, holder })
        }
        default:
          return reply(res, 404, { error: 'not found' })
      }
    } catch (error) {
      log(`${path}: ${error.message}`)
      if (!res.headersSent) reply(res, 400, { error: String(error) })
    }
  })
  server.requestTimeout = 0

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const own = server.address().port

  // What this receiver is to the others: the hub, a member registered with the hub, or neither
  // yet; and whether it receives its project's reports or stands by for another session of the
  // project. Checked every few seconds, so when the hub's session ends another takes its place.
  let role = null
  let hub = null
  let blocked = false
  let receiving = false
  let holder = null
  let takeNext = false

  function becomes(next, standing) {
    if (role === next && receiving === standing.receiving && holder === standing.holder) return
    role = next
    receiving = standing.receiving
    holder = standing.holder
    emit({ type: 'role', role, port, receiving, holder })
  }

  async function takePart() {
    const take = takeNext
    takeNext = false
    if (hub !== null) return becomes('hub', hub.register(own, cwd, project, take))
    try {
      becomes('member', await joinHub(port, own, cwd, project, take))
      blocked = false
    } catch (error) {
      if (error.code === 'NOT_A_HUB') {
        if (!blocked) emit({ type: 'error', message: `port ${port} is held by something else: another tool's receiver, or an older one` })
        blocked = true
        return
      }
      if (error.code !== 'ECONNREFUSED') return
      // Nothing holds the port: take it.
      const candidate = createHub()
      candidate.server.once('error', () => {})
      candidate.server.listen(port, '127.0.0.1', () => {
        hub = candidate
        blocked = false
        becomes('hub', hub.register(own, cwd, project, take))
        const upkeep = () => keepReversed().catch(error => log(`adb reverse: ${error.message}`))
        void upkeep()
        timers.push(setInterval(upkeep, 5_000))
      })
    }
  }

  const timers = []
  const tick = () => takePart().catch(error => log(`hub: ${error.message}`))
  await tick()
  timers.push(setInterval(tick, 3_000))

  return {
    port: own,
    project,
    role: () => role,
    standing: () => ({ receiving, holder }),
    take: async () => {
      takeNext = true
      await takePart()
      return { receiving, holder }
    },
    reports: () => reports.filter(report => report.session !== undefined).map(summary),
    report: id => {
      const report = byId(id)
      return report && report.session !== undefined ? summary(report) : null
    },
    setStatus: (id, status) => {
      const report = byId(id)
      if (!report || !STATUSES.has(status)) return null
      set(report, status)
      return summary(report)
    },
    waitForReport: async seconds => {
      const report = await waitForReport(seconds * 1000)
      return report ? summary(report) : null
    },
    close: () => {
      for (const timer of timers) clearInterval(timer)
      for (const timer of settling.values()) clearTimeout(timer)
      for (const wake of waiters) wake()
      server.closeAllConnections()
      server.close()
      hub?.server.closeAllConnections()
      hub?.server.close()
    },
  }
}
