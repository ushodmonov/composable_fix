// How the plugin's other parts find this session's receiver: the MCP server notes its port and
// folder in a file of its own under the temporary folder, and a command hook or the mod's
// follower looks for the newest one whose folder is theirs. No dependencies.
import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const folder = () => join(process.env.COMPOSABLEFIX_SESSIONS ?? tmpdir(), 'composablefix-sessions')

const real = path => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

const isAlive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/** Notes this process's receiver; returns what takes the note back. */
export function announce(port, cwd) {
  mkdirSync(folder(), { recursive: true })
  const file = join(folder(), `${process.pid}.json`)
  writeFileSync(file, JSON.stringify({ port, cwd: real(cwd), pid: process.pid, since: Date.now() }))
  return () => rmSync(file, { force: true })
}

/** The port of the newest live receiver of the folder, or null. */
export function find(cwd) {
  const wanted = real(cwd)
  let names = []
  try {
    names = readdirSync(folder())
  } catch {
    return null
  }
  const notes = names.flatMap(name => {
    try {
      return [JSON.parse(readFileSync(join(folder(), name), 'utf8'))]
    } catch {
      return []
    }
  })
  const newest = notes
    .filter(note => note.cwd === wanted && isAlive(note.pid))
    .sort((a, b) => b.since - a.since)[0]
  return newest?.port ?? null
}
