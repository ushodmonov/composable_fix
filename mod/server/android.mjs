// What the receiver needs from the device, through adb: keeping the app able to reach the
// receiver (`adb reverse` maps the device's 127.0.0.1:4747 to this Mac's), finding the device a
// report came from, and reading the screen's accessibility tree with `uiautomator dump`. Also
// finds a `.fixable` call's source file, which the app knows only by its package. No
// dependencies beside adb itself.
import { execFile } from 'node:child_process'
import { accessSync, constants, readdirSync } from 'node:fs'
import { connect } from 'node:net'
import { homedir } from 'node:os'
import { delimiter, join, sep } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Where adb may be, most specific first: COMPOSABLEFIX_ADB, the SDK's own variables, `PATH`, then the SDK's usual homes. */
export function adbCandidates(env = process.env) {
  const found = []
  const add = path => {
    try {
      accessSync(path, constants.X_OK)
      if (!found.includes(path)) found.push(path)
    } catch {}
  }

  if (env.COMPOSABLEFIX_ADB) add(env.COMPOSABLEFIX_ADB)
  for (const sdk of [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]) {
    if (sdk) add(join(sdk, 'platform-tools', 'adb'))
  }
  for (const dir of (env.PATH ?? '').split(delimiter).filter(Boolean)) add(join(dir, 'adb'))
  add(join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'))
  add(join(homedir(), 'Android', 'Sdk', 'platform-tools', 'adb'))

  return found
}

/**
 * Whether an adb server is running. Asking adb anything starts one, which a session with no device
 * has no use for; a device or an emulator has one running already.
 */
export function adbServerRunning(env = process.env) {
  const port = Number(env.ANDROID_ADB_SERVER_PORT ?? 5037)
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port })
    socket.setTimeout(500)
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('timeout', () => (socket.destroy(), resolve(false)))
    socket.once('error', () => resolve(false))
  })
}

/** The serials of the devices adb can talk to. */
export async function devices(adb) {
  const { stdout } = await run(adb, ['devices'], { timeout: 5_000 })
  return stdout
    .split('\n')
    .slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial)
}

/** Maps the device's own loopback port to this Mac's. */
export async function reverse(adb, serial, port) {
  await run(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], { timeout: 5_000 })
}

/**
 * The device a report came from: the only one, else the one where the app's package runs with
 * the process id the app sent.
 */
export async function serialOf(adb, app) {
  const serials = await devices(adb)
  if (serials.length <= 1 || !app?.package) return serials[0] ?? null
  for (const serial of serials) {
    try {
      const { stdout } = await run(adb, ['-s', serial, 'shell', 'pidof', app.package], { timeout: 5_000 })
      if (stdout.trim().split(/\s+/).includes(String(app.pid))) return serial
    } catch {}
  }
  return null
}

const DUMP = '/data/local/tmp/composablefix-ui.xml'

/** The screen's accessibility tree: a list of root elements, as `parseHierarchy` gives them. */
export async function describeScreen(adb, serial) {
  const { stdout } = await run(adb, ['-s', serial, 'exec-out', `uiautomator dump ${DUMP} >/dev/null && cat ${DUMP}`], {
    timeout: 20_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (!stdout.includes('<hierarchy')) throw new Error(stdout.trim() || 'uiautomator dump answered nothing')
  return parseHierarchy(stdout)
}

const TAG = /<(\/?)([\w-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g
const ATTRIBUTE = /([\w:-]+)="([^"]*)"/g
const BOUNDS = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

const unescape = text =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, name) => {
    if (name[0] !== '#') return ENTITIES[name] ?? entity
    return String.fromCodePoint(name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
  })

/**
 * One `<node>` as the lookup reads it: the class for the type; the content description, else the
 * text, for the label; the text as the value when both are there; the resource id without its
 * package (a Compose test tag shows as the id itself), unless the platform's own (`android:id/
 * content` names no element of the app); the bounds as a frame, in pixels.
 */
function toElement(attributes) {
  const description = attributes['content-desc'] || null
  const text = attributes.text || null
  const id = attributes['resource-id']?.startsWith('android:id/') ? null : attributes['resource-id'] || null
  const [, left, top, right, bottom] = (attributes.bounds ?? '').match(BOUNDS)?.map(Number) ?? []

  return {
    type: (attributes.class || 'View').split('.').pop(),
    label: description ?? text,
    value: description && text && text !== description ? text : null,
    identifier: id ? id.replace(/^[\w.]+:id\//, '') : null,
    frame: left === undefined ? null : { x: left, y: top, width: right - left, height: bottom - top },
    children: [],
  }
}

/** `uiautomator dump`'s XML as a list of root elements. */
export function parseHierarchy(xml) {
  const roots = []
  const open = []
  for (const [, closing, name, attributes, selfClosing] of xml.matchAll(TAG)) {
    if (name !== 'node') continue
    if (closing) {
      open.pop()
      continue
    }
    const element = toElement(Object.fromEntries([...attributes.matchAll(ATTRIBUTE)].map(([, key, value]) => [key, unescape(value)])))
    ;(open.at(-1)?.children ?? roots).push(element)
    if (!selfClosing) open.push(element)
  }
  return roots
}

// Folders that hold no sources of the app's own.
const SKIPPED = new Set(['build', 'node_modules', '.git', '.gradle', '.idea', '.kotlin', '.composablefix'])

/** Every Kotlin and Java source under the folder, by file name. */
function indexSources(root) {
  const index = new Map()
  const walk = dir => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name) && !entry.name.startsWith('.')) walk(join(dir, entry.name))
      } else if (/\.(kt|java)$/.test(entry.name)) {
        index.set(entry.name, [...(index.get(entry.name) ?? []), join(dir, entry.name)])
      }
    }
  }
  walk(root)
  return index
}

/**
 * The path of a `.fixable` call's file, from what the app knows of it: the package's folders and
 * the file's name (`com/example/home/Card.kt`). The file whose path ends that way, else the only
 * file of that name; else the name as the app gave it. The index is built once, and again when a
 * file is not in it.
 */
export function sourceFinder(root) {
  let index = null
  const find = file => {
    const name = file.split('/').pop()
    const candidates = index.get(name) ?? []
    const suffix = sep + file.split('/').join(sep)
    return candidates.find(path => path.endsWith(suffix)) ?? (candidates.length === 1 ? candidates[0] : null)
  }

  return file => {
    if (!file) return file
    index ??= indexSources(root)
    let found = find(file)
    if (found === null) {
      index = indexSources(root)
      found = find(file)
    }
    return found ?? file
  }
}
