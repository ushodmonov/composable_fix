// node --test mod/tests/*.node.test.mjs: the command hooks, run as Claude Code runs them, tell the
// session's receiver what the session does with the reports.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { announce } from '../server/discover.mjs'
import { startSession } from '../server/session.mjs'
import { call, freePort, project, report } from './helpers.mjs'

process.env.COMPOSABLEFIX_ADB = 'none'
process.env.COMPOSABLEFIX_SESSIONS = mkdtempSync(join(tmpdir(), 'composablefix-sessions-'))

const hook = new URL('../hooks/command.mjs', import.meta.url).pathname

/** Runs the hook for `event` with `input` on stdin, as Claude Code would in the folder. */
function fire(event, input, folder) {
  return new Promise((resolve, reject) => {
    const child = execFile('node', [hook, event], { env: { ...process.env, CLAUDE_PROJECT_DIR: folder } }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    )
    child.stdin.end(JSON.stringify(input))
  })
}

test('a message takes the waiting reports, an install rebuilds them and the end of the turn settles them', async () => {
  const folder = project()
  const hub = await freePort()
  const session = await startSession({ cwd: folder.root, port: hub, graceMs: 50 })
  const withdraw = announce(session.port, folder.root)
  try {
    await call(hub, 'POST', '/report?app=com.example.shop', report('Too dark'))

    const out = JSON.parse(await fire('prompt', { session_id: 's1', prompt: 'fix it' }, folder.root))
    assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
    assert.match(out.hookSpecificOutput.additionalContext, /Too dark\n\n\[fix r1\]/)
    assert.equal(session.report('r1').status, 'fixing')
    // Taken once: the next message adds nothing.
    assert.equal(await fire('prompt', { session_id: 's1', prompt: 'and?' }, folder.root), '')

    await fire('tool', { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'ls' } }, folder.root)
    assert.equal(session.report('r1').status, 'fixing')
    await fire('tool', { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'cd android && ./gradlew :app:installDebug' } }, folder.root)
    assert.equal(session.report('r1').status, 'rebuilding')

    await call(hub, 'POST', '/launched?app=com.example.shop')
    await fire('stop', { session_id: 's1' }, folder.root)
    assert.equal(session.report('r1').status, 'live')
  } finally {
    withdraw()
    session.close()
    folder.remove()
  }
})

test("a prompt the mod submitted takes its report, and the waiting ones are left to the mod", async () => {
  const folder = project()
  const hub = await freePort()
  const session = await startSession({ cwd: folder.root, port: hub })
  const withdraw = announce(session.port, folder.root)
  try {
    await call(hub, 'POST', '/report?app=com.example.shop', report('First'))
    await call(hub, 'POST', '/report?app=com.example.shop', report('Second'))
    // The mod's follower is listening.
    void call(session.port, 'GET', '/events?after=999&wait=200')
    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(await fire('prompt', { session_id: 's1', prompt: 'First\n\n[fix r1] com.example.shop' }, folder.root), '')
    assert.equal(session.report('r1').status, 'fixing')
    assert.equal(session.report('r2').status, 'queued')
  } finally {
    withdraw()
    session.close()
    folder.remove()
  }
})

test('a hook in a folder with no receiver does nothing', async () => {
  assert.equal(await fire('prompt', { session_id: 's1', prompt: 'hello' }, tmpdir()), '')
})
