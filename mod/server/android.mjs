// What the receiver needs from the device, through adb: keeping the app able to reach the
// receiver (`adb reverse` maps the device's 127.0.0.1:4747 to this Mac's), finding the device a
// report came from, and reading the screen's accessibility tree with `uiautomator dump`. Also
// finds a `.fixable` call's source file, which the app knows only by its package. No
// dependencies beside adb itself.
import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync, readdirSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { homedir } from 'node:os'
import { delimiter, dirname, join, sep } from 'node:path'
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

  // `none` keeps adb out entirely: the receiver's own tests set it.
  if (env.COMPOSABLEFIX_ADB === 'none') return found
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

const GRADLE_SETTINGS = ['settings.gradle.kts', 'settings.gradle']
const GRADLE_BUILDS = ['build.gradle.kts', 'build.gradle']

/** The folders under `dir`, the hidden and the built ones left out. */
function folders(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !SKIPPED.has(entry.name))
      .map(entry => join(dir, entry.name))
  } catch {
    return []
  }
}

const mentions = (path, pattern) => {
  try {
    return pattern.test(readFileSync(path, 'utf8'))
  } catch {
    return false
  }
}

/**
 * Whether the Gradle build in `dir` uses ComposableFix: its settings, its version catalog or the
 * build file of the build or of a module (up to two levels down) names it.
 */
export function usesComposableFix(dir) {
  const named = /composablefix/i
  if (!GRADLE_SETTINGS.some(name => existsSync(join(dir, name)))) return false
  const files = [
    ...GRADLE_SETTINGS.map(name => join(dir, name)),
    join(dir, 'gradle', 'libs.versions.toml'),
    ...[dir, ...folders(dir), ...folders(dir).flatMap(folders)].flatMap(module => GRADLE_BUILDS.map(name => join(module, name))),
  ]
  return files.some(file => mentions(file, named))
}

/**
 * The ComposableFix project a session in `cwd` serves: the Gradle build in that folder, else the
 * nearest one up to two levels below it, as in a repository with the app in `android/`. Null when
 * there is none: such a session takes no reports.
 */
export function findProject(cwd) {
  const children = folders(cwd)
  for (const dir of [cwd, ...children, ...children.flatMap(folders)]) {
    if (usesComposableFix(dir)) return dir
  }
  return null
}

// Folders that hold no sources of the app's own.
const SKIPPED = new Set(['build', 'node_modules', '.git', '.gradle', '.idea', '.kotlin', '.composablefix'])
// A session opened in a big folder (a home folder, say) is not walked whole.
const MOST_ENTRIES = 50_000

const APPLICATION_ID = /\bapplicationId\s*(?:=|\()?\s*["']([\w.]+)["']/g
const NAMESPACE = /\bnamespace\s*(?:=|\()?\s*["']([\w.]+)["']/g
const MANIFEST_PACKAGE = /<manifest\b[^>]*\bpackage="([\w.]+)"/g

/**
 * What a project holds, from one walk: its Kotlin and Java sources by file name, the application
 * ids and namespaces its Gradle files declare (and its manifests' packages), and the packages its
 * sources are in, from their folders under `src/<set>/java|kotlin`.
 */
export function indexProject(root) {
  const sources = new Map()
  const applicationIds = new Set()
  const namespaces = new Set()
  const packages = new Set()
  let entriesLeft = MOST_ENTRIES

  const collect = (path, pattern, into) => {
    try {
      for (const [, id] of readFileSync(path, 'utf8').matchAll(pattern)) into.add(id)
    } catch {}
  }
  const walk = dir => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (--entriesLeft < 0) return
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name) && !entry.name.startsWith('.')) walk(path)
      } else if (/\.(kt|java)$/.test(entry.name)) {
        sources.set(entry.name, [...(sources.get(entry.name) ?? []), path])
        const folders = dir.split(sep)
        const at = folders.findLastIndex((name, i) => (name === 'java' || name === 'kotlin') && folders[i - 2] === 'src')
        if (at >= 0) packages.add(folders.slice(at + 1).join('.'))
      } else if (entry.name === 'build.gradle' || entry.name === 'build.gradle.kts') {
        collect(path, APPLICATION_ID, applicationIds)
        collect(path, NAMESPACE, namespaces)
      } else if (entry.name === 'AndroidManifest.xml') {
        collect(path, MANIFEST_PACKAGE, namespaces)
      }
    }
  }
  walk(root)
  return { sources, applicationIds, namespaces, packages }
}

/** An index of the project that is built on first use, and again on a miss, at most every `wait` ms. */
function projectIndex(root, wait) {
  let index = null
  let builtAt = 0
  return {
    get: () => {
      if (index === null) {
        index = indexProject(root)
        builtAt = Date.now()
      }
      return index
    },
    rebuild: () => {
      if (Date.now() - builtAt < wait) return false
      index = indexProject(root)
      builtAt = Date.now()
      return true
    },
  }
}

/**
 * Whether an app is the project's: its package is an application id the project declares (with
 * a suffix such as `.debug` or without), one of its namespaces, or a package its sources are in.
 * The hub asks every session about every app it has not placed yet, so a miss walks the project
 * again at most every ten seconds.
 */
export function appFinder(root) {
  const index = projectIndex(root, 10_000)
  const owns = app => {
    const { applicationIds, namespaces, packages } = index.get()
    return (
      [...applicationIds].some(id => app === id || app.startsWith(id + '.')) || namespaces.has(app) || packages.has(app)
    )
  }
  return app => Boolean(app) && (owns(app) || (index.rebuild() && owns(app)))
}

/**
 * The path of a `.fixable` call's file, from what the app knows of it: the package's folders and
 * the file's name (`com/example/home/Card.kt`). The file whose path ends that way, else the only
 * file of that name; else the name as the app gave it.
 */
export function sourceFinder(root) {
  const index = projectIndex(root, 0)
  const find = file => {
    const candidates = index.get().sources.get(file.split('/').pop()) ?? []
    const suffix = sep + file.split('/').join(sep)
    return candidates.find(path => path.endsWith(suffix)) ?? (candidates.length === 1 ? candidates[0] : null)
  }
  return file => {
    if (!file) return file
    return find(file) ?? (index.rebuild() ? find(file) : null) ?? file
  }
}
