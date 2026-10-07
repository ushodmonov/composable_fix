// The plugin's command hooks, which Claude Code runs in the terminal and in the VS Code extension
// alike. Each tells this session's receiver (the plugin's MCP server) what the session does:
//
//   prompt  a prompt carrying `[fix …]` lines takes those reports; reports nobody has taken are
//           added to the prompt, unless the mod (terminal) submits them as prompts of their own
//   tool    a Gradle install or `adb install` starts: the reports being fixed are rebuilding
//   stop    the turn ended: what launched stays live, the rest is not rebuilt
//
// A hook that cannot reach the receiver does nothing and lets the session go on. No dependencies.
import { readFileSync } from 'node:fs'

import { isInstall, reportIds } from '../shared/prompt.mjs'
import { find } from '../server/discover.mjs'

const event = process.argv[2]
const input = (() => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
})()
const session = input.session_id ?? null
const port = find(process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd())

async function call(method, path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3_000),
  })
  return response.json()
}

async function run() {
  if (port === null) return
  if (event === 'prompt') {
    const carried = reportIds(input.prompt)
    if (carried.length > 0) await call('POST', '/deliver', { ids: carried, session })

    const { auto, reports } = await call('GET', '/pending')
    if (auto || reports.length === 0) return
    await call('POST', '/deliver', { ids: reports.map(report => report.id), session })
    const context =
      'Fix reports sent from the app with ComposableFix are waiting. Treat each one as a request from the person, as the composablefix instructions say:\n\n' +
      reports.map(report => report.prompt).join('\n\n---\n\n')
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } }))
  } else if (event === 'tool') {
    if (input.tool_name === 'Bash' && isInstall(String(input.tool_input?.command ?? ''))) {
      await call('POST', '/install', { session })
    }
  } else if (event === 'stop') {
    await call('POST', '/turn-end', { session })
  }
}

run().catch(() => {})
