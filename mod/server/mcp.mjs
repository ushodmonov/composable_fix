// The plugin's MCP server. Claude Code starts it with every session, in the terminal and in the
// VS Code extension alike, and stops it with the session. In a session whose folder holds a
// ComposableFix project it runs the session's receiver (session.mjs), hands Claude the
// instructions for `[fix …]` reports, and gives it tools to read the reports, wait for the next
// one, set where one stands and take the project's reports from another session; anywhere else
// it stays quiet. Speaks MCP over stdio as newline-delimited JSON-RPC; stdout carries nothing
// else. No dependencies.
import { createInterface } from 'node:readline'

import { INSTRUCTIONS } from '../shared/prompt.mjs'
import { announce } from './discover.mjs'
import { startSession } from './session.mjs'

const log = line => process.stderr.write(`composablefix: ${line}\n`)
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n')

const session = await startSession({ port: Number(process.env.COMPOSABLEFIX_PORT ?? 4747), log })
const withdraw = session ? announce(session.port, process.cwd()) : () => {}
const NO_PROJECT = 'This folder holds no ComposableFix project (a Gradle build that uses it, here or up to two levels below), so this session takes no reports.'

const text = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] })
const line = ({ id, status, comment, element, source, screenshot }) =>
  `${id} ${status}: "${comment}"${element ? ` · ${element}` : ''}${source ? ` · ${source}` : ''}${screenshot ? ` · ${screenshot}` : ''}`

const TOOLS = [
  {
    name: 'list_reports',
    description: 'Lists the fix reports the app sent to this session, newest last, with where each stands: queued, fixing, rebuilding, live or stopped.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      const reports = session.reports()
      return text(reports.length === 0 ? 'No reports yet.' : reports.map(line).join('\n'))
    },
  },
  {
    name: 'get_report',
    description: "Returns one report: the request with its [fix …] line, the screenshot's path, and what accessibility said about the element.",
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The report id, as r1.' } }, required: ['id'] },
    run: ({ id }) => {
      const report = session.report(id)
      return report ? text(report) : { ...text(`No report ${id}.`), isError: true }
    },
  },
  {
    name: 'wait_for_report',
    description:
      'Waits for the next report nobody has taken yet, takes it and returns its request. Use it when the person asks to watch for fix reports: fix each one as its instructions say, then call this again. Returns that nothing came when the time runs out.',
    inputSchema: {
      type: 'object',
      properties: { seconds: { type: 'number', description: 'How long to wait, at most 3600. 300 when not given.' } },
    },
    run: async ({ seconds }) => {
      const report = await session.waitForReport(Math.min(Number(seconds ?? 300), 3600))
      return text(report ? report.prompt : 'No report came.')
    },
  },
  {
    name: 'take_reports',
    description:
      "Moves the project's reports to this session when another session of the same project receives them; that one stands by.",
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const { receiving } = await session.take()
      return text(receiving ? "This session now receives the project's reports." : 'The hub could not be reached; try again in a few seconds.')
    },
  },
  {
    name: 'set_status',
    description:
      "Sets where a report stands, which the app's banner shows. The plugin follows installs and launches on its own; use this when it could not, as when the app was built another way.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['queued', 'fixing', 'rebuilding', 'live', 'stopped'] },
      },
      required: ['id', 'status'],
    },
    run: ({ id, status }) => {
      const report = session.setStatus(id, status)
      return report ? text(line(report)) : { ...text(`No report ${id}, or no status ${status}.`), isError: true }
    },
  },
]

async function handle({ id, method, params }) {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'composablefix', version: '0.2.0' },
        ...(session ? { instructions: INSTRUCTIONS } : {}),
      }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: TOOLS.map(({ run, ...tool }) => tool) }
    case 'tools/call': {
      const tool = TOOLS.find(one => one.name === params?.name)
      if (!tool) throw Object.assign(new Error(`no tool ${params?.name}`), { code: -32602 })
      if (!session) return { ...text(NO_PROJECT), isError: true }
      return await tool.run(params.arguments ?? {})
    }
    default:
      if (id === undefined) return undefined
      throw Object.assign(new Error(`no method ${method}`), { code: -32601 })
  }
}

const input = createInterface({ input: process.stdin })
input.on('line', async raw => {
  if (!raw.trim()) return
  let message
  try {
    message = JSON.parse(raw)
  } catch {
    return send({ id: null, error: { code: -32700, message: 'parse error' } })
  }
  try {
    const result = await handle(message)
    if (message.id !== undefined && result !== undefined) send({ id: message.id, result })
  } catch (error) {
    if (message.id !== undefined) send({ id: message.id, error: { code: error.code ?? -32603, message: error.message } })
  }
})

// The session is gone when its pipe closes.
const stop = () => {
  withdraw()
  session?.close()
  process.exit(0)
}
input.on('close', stop)
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
