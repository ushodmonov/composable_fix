// node --test mod/tests/*.node.test.mjs: the MCP server, spoken to over stdio as Claude Code does.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { test } from 'node:test'

import { call, freePort, project, report } from './helpers.mjs'

const server = new URL('../server/mcp.mjs', import.meta.url).pathname

/** Starts the server in `cwd`; `ask` sends a request and resolves its answer. */
async function start(cwd) {
  const sessions = mkdtempSync(join(tmpdir(), 'composablefix-sessions-'))
  const hub = await freePort()
  const child = spawn('node', [server], {
    cwd,
    env: { ...process.env, COMPOSABLEFIX_ADB: 'none', COMPOSABLEFIX_PORT: String(hub), COMPOSABLEFIX_SESSIONS: sessions },
  })
  const answers = new Map()
  createInterface({ input: child.stdout }).on('line', line => {
    const message = JSON.parse(line)
    answers.get(message.id)?.(message)
  })
  let id = 0
  const ask = (method, params) =>
    new Promise(resolve => {
      answers.set(++id, resolve)
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  const exited = new Promise(resolve => child.on('exit', resolve))
  return { child, ask, hub, sessions: join(sessions, 'composablefix-sessions'), exited }
}

test('in a project it gives the instructions and the tools, and leaves with the session', async () => {
  const folder = project()
  const { child, ask, hub, sessions, exited } = await start(folder.root)
  try {
    const { result } = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
    assert.equal(result.serverInfo.name, 'composablefix')
    assert.match(result.instructions, /\[fix r1\]/)

    const { result: listed } = await ask('tools/list', {})
    assert.deepEqual(listed.tools.map(tool => tool.name), ['list_reports', 'get_report', 'wait_for_report', 'take_reports', 'set_status'])

    assert.equal((await ask('tools/call', { name: 'list_reports', arguments: {} })).result.content[0].text, 'No reports yet.')
    const waiting = ask('tools/call', { name: 'wait_for_report', arguments: { seconds: 10 } })
    await new Promise(resolve => setTimeout(resolve, 300))
    await call(hub, 'POST', '/report?app=com.example.shop', report('Too dark'))
    assert.match((await waiting).result.content[0].text, /^Too dark\n\n\[fix r1\]/)

    const set = await ask('tools/call', { name: 'set_status', arguments: { id: 'r1', status: 'live' } })
    assert.match(set.result.content[0].text, /^r1 live: "Too dark"/)
    assert.equal(readdirSync(sessions).length, 1)
  } finally {
    child.stdin.end()
    await exited
    folder.remove()
  }
  // Gone with its session, and its note with it.
  assert.equal(readdirSync(sessions).length, 0)
})

test('in a folder with no project it stays quiet', async () => {
  const { child, ask, exited } = await start(mkdtempSync(join(tmpdir(), 'composablefix-empty-')))
  try {
    const { result } = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
    assert.equal(result.instructions, undefined)
    const called = await ask('tools/call', { name: 'list_reports', arguments: {} })
    assert.equal(called.result.isError, true)
  } finally {
    child.stdin.end()
    await exited
  }
})
