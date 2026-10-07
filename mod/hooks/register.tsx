import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { pressedLabel } from '../shared/prompt.mjs'
import type { FixReport, FixStatus, Incoming, Receiver } from '../types'

// The mod adds what only the terminal and the desktop app can do to the plugin, whose MCP server
// runs the receiver and whose command hooks follow each report in every surface, the VS Code
// extension included: it submits each report as a prompt the moment it arrives, and draws the
// Fix queue pane.

const PANE = 'fix-queue'
const TITLE = 'Fix queue'

const reports = atom({ plugin: 'composablefix', key: 'reports' } as const, [])
const receiver = atom({ plugin: 'composablefix', key: 'receiver' } as const, {
  state: 'starting',
  detail: '',
})
const now = atom({ plugin: 'composablefix', key: 'now' } as const, 0)

type Standing = { role: 'hub' | 'member' | null; receiving: boolean; holder: string | null }

type ReceiverEvent =
  | ({ type: 'ready'; port: number } & Standing)
  | ({ type: 'role'; port: number } & Standing)
  | { type: 'off' }
  | { type: 'error'; message: string }
  | { type: 'notice'; message: string }
  | { type: 'launched' }
  | { type: 'report'; report: Incoming }
  | { type: 'status'; id: string; status: FixStatus }

const LOOK: Record<FixStatus, { mark: string; label: string; color: string }> = {
  queued: { mark: '○', label: 'queued', color: 'yellow' },
  fixing: { mark: '◆', label: 'fixing', color: 'cyan' },
  rebuilding: { mark: '▲', label: 'rebuilding', color: 'magenta' },
  live: { mark: '✔', label: 'live', color: 'green' },
  stopped: { mark: '✘', label: 'not rebuilt', color: 'red' },
}

const isActive = (report: FixReport) => report.status !== 'live' && report.status !== 'stopped'

// The receiver's own port, which the follower names.
let port: number | null = null
// The report whose turn is running; its prompt was submitted by this mod.
let current: string | null = null

const patch = ($: EngineInterface, id: string, change: (report: FixReport) => FixReport) =>
  update($, reports, all => all.map(one => (one.id === id ? change(one) : one)))

/** Shows the report and submits it as a prompt, once any turn already running has ended. */
async function accept($: EngineInterface, incoming: Incoming) {
  const report: FixReport = { ...incoming, edited: [] }
  await update($, reports, all => [...all.filter(one => one.id !== report.id), report].slice(-50))
  $.ui.toast(`Fix request ${report.id}: ${report.comment}`)

  // As the person's own words: they typed the comment, and the engine adds no frame around it.
  // The prompt hook takes the report for this session; so does the receiver, should it not run.
  await $.prompt.submit({ text: incoming.prompt, asUser: true })
  current = report.id
  if (port !== null) {
    await $.http.fetch(`http://127.0.0.1:${port}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [report.id] }),
    })
  }
}

async function listen($: EngineInterface) {
  await update($, receiver, (): Receiver => ({ state: 'starting', detail: '' }))
  const child = $.process.spawn({ argv: ['node', `${$.plugin.root}/server/follow.mjs`] })
  let pending = ''

  // Where this session stands, once the follower says: receiving the project's reports, or
  // standing by while another session of the project receives them.
  const stands = async ({ role, receiving, holder }: Standing) => {
    if (receiving) {
      // The hub holds the apps' port; a member gets its project's reports through it.
      const detail = `127.0.0.1:${role === 'hub' ? 4747 : `${port}, through 4747`}`
      await update($, receiver, (): Receiver => ({ state: 'listening', detail }))
      return
    }
    const was = await read($, receiver)
    const where = holder ? `the session in ${holder}` : 'another session'
    await update($, receiver, (): Receiver => ({ state: 'standby', detail: `reports go to ${where}`, notice: '/fix-take moves them to this session.' }))
    if (was.state !== 'standby') $.ui.toast(`composablefix: reports go to ${where}; /fix-take moves them here`)
  }

  try {
    for await (const { stream, text } of child) {
      if (stream === 'stderr') {
        $.ui.log(text, { to: 'debug' })
        continue
      }
      pending += text
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''

      for (const line of lines.filter(Boolean)) {
        const event = JSON.parse(line) as ReceiverEvent
        if (event.type === 'ready') {
          // The pane opens unasked only in a session that has a ComposableFix project.
          if (port === null) void $.ui.open({ id: PANE, title: TITLE })
          port = event.port
          await stands(event)
        } else if (event.type === 'role') {
          if (port !== null) await stands(event)
        } else if (event.type === 'off') {
          await update($, receiver, (): Receiver => ({ state: 'off', detail: 'no ComposableFix project in this folder' }))
        } else if (event.type === 'error') {
          await update($, receiver, (): Receiver => ({ state: 'failed', detail: event.message }))
          $.ui.toast(`composablefix: ${event.message}`)
        } else if (event.type === 'notice') {
          await update($, receiver, (was): Receiver => ({ ...was, notice: event.message }))
        } else if (event.type === 'status') {
          const finishedAt = event.status === 'live' || event.status === 'stopped' ? Date.now() : null
          await patch($, event.id, one => ({ ...one, status: event.status, finishedAt: one.finishedAt ?? finishedAt }))
        } else if (event.type === 'report') {
          void accept($, event.report)
        }
      }
    }
  } catch (error) {
    await update($, receiver, (): Receiver => ({ state: 'failed', detail: String(error) }))
    return
  }

  // The follower has exited. Say so, unless it already said why.
  await update($, receiver, (was): Receiver =>
    was.state === 'failed' || was.state === 'off' ? was : { state: 'failed', detail: 'follower stopped; run /reload-plugins' },
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'fix-queue',
      description: 'Show the fix requests sent from the Android app on the emulator or device',
    })
    await $.command.register({
      name: 'fix-take',
      description: "Receive the Android app's fix requests in this session instead of another one",
    })
    const started = await next(e)

    void listen($)
    // Keeps the elapsed seconds of a running fix ticking in the pane.
    $.clock.every(1000, () => {
      void (async () => {
        if ((await read($, reports)).some(isActive)) {
          await update($, now, () => Date.now())
        }
      })()
    })

    return started
  })

  on('command.run', { command: 'fix-queue' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Fix queue opened.' }
  })

  on('command.run', { command: 'fix-take' }, async $ => {
    if (port === null) return { text: 'No receiver in this session: the folder holds no ComposableFix project.' }
    const answer = await $.http.fetch(`http://127.0.0.1:${port}/take`, { method: 'POST', body: '{}' })
    const { receiving } = JSON.parse(answer.text) as { receiving: boolean }

    return { text: receiving ? "This session now receives the app's fix requests." : 'The hub could not be reached; try again.' }
  })

  // The files Claude edits for the report, for the pane. Failing to note one must not fail the call.
  on('tool.call', async ($, e, next) => {
    const id = current
    if (id !== null && e.agentId === undefined && (e.tool === 'Edit' || e.tool === 'Write')) {
      const name = e.file_path.split('/').pop() ?? e.file_path
      await patch($, id, one => (one.edited.includes(name) ? one : { ...one, edited: [...one.edited, name] }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) current = null

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, reports)
    const link = await read($, receiver)
    const clock = (await read($, now)) || (await $.clock.now())
    const width = Math.max(20, e.props.bodyColumns)
    // Each report takes five rows; the newest ones are kept in view.
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 30) - 6) / 5))

    return (
      <Box flexDirection="column" width={width}>
        <Text color={link.state === 'failed' ? 'red' : link.state === 'listening' ? 'green' : 'yellow'}>
          {link.state === 'listening' ? '●' : '○'} {link.state} <Text dimColor>{link.detail}</Text>
        </Text>
        {link.notice !== undefined && (
          <Text dimColor wrap="wrap">
            {link.notice}
          </Text>
        )}

        {list.length === 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text>No fix requests yet.</Text>
            <Text dimColor wrap="wrap">
              Long press any element in the app, type what is wrong and press Return.
            </Text>
          </Box>
        )}

        {list.slice(-room).map(report => {
          const look = LOOK[report.status]
          const seconds = Math.max(0, Math.round(((report.finishedAt ?? clock) - report.receivedAt) / 1000))

          return (
            <Box flexDirection="column" marginTop={1}>
              <Box justifyContent="space-between">
                <Text color={look.color} bold>
                  {look.mark} {report.id} {look.label}
                </Text>
                <Text dimColor>{seconds}s</Text>
              </Box>
              <Text bold wrap="truncate-end">
                “{report.comment}”
              </Text>
              <Text wrap="truncate-middle">{pressedLabel(report)}</Text>
              {report.source !== null && (
                <Text dimColor wrap="truncate-start">
                  {report.source}
                </Text>
              )}
              {report.edited.length > 0 && (
                <Text color="cyan" wrap="truncate-end">
                  edited {report.edited.join(', ')}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
