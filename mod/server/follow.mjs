// Follows this session's receiver for the mod, which runs in the terminal and the desktop app:
// finds the receiver the plugin's MCP server runs for the session's folder and prints its events,
// one JSON line each, for the mod to submit each report as a prompt and draw the Fix queue pane.
// Started by the mod with $.process.spawn and gone with it. No dependencies.
import { findProject } from './android.mjs'
import { find } from './discover.mjs'

const print = event => process.stdout.write(JSON.stringify(event) + '\n')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

// The session that started this follower is gone when its pipe breaks or the process is handed
// to launchd.
const parent = process.ppid
process.stdout.on('error', () => process.exit(0))
setInterval(() => {
  if (process.ppid !== parent) process.exit(0)
}, 1000).unref()

// A session with no ComposableFix project here takes no reports, and has nothing to follow.
if (findProject(process.cwd()) === null) {
  print({ type: 'off' })
  process.exit(0)
}

let port = null
let followed = null
let after = 0
let waitedSince = Date.now()

for (;;) {
  if (port === null) {
    port = find(process.cwd())
    if (port === null) {
      // The MCP server starts beside the mod; it is missing only when it failed or is disabled.
      if (Date.now() - waitedSince > 10_000) {
        print({ type: 'error', message: "the plugin's receiver is not running: check /mcp for composablefix" })
        waitedSince = Infinity
      }
      await pause(500)
      continue
    }
  }
  try {
    const response = await fetch(`http://127.0.0.1:${port}/events?after=${port === followed ? after : 0}&wait=25000`)
    const { events, role, receiving, holder } = await response.json()
    // A receiver met for the first time is told whole; one met again goes on where it was.
    if (port !== followed) {
      followed = port
      after = 0
      print({ type: 'ready', port, role, receiving, holder })
    }
    for (const event of events) {
      after = Math.max(after, event.seq)
      print(event)
    }
  } catch {
    // The receiver went away (the MCP server restarted, say): look for it again.
    port = null
    waitedSince = Date.now()
    await pause(500)
  }
}
