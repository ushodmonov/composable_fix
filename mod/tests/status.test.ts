import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { FixReport, Receiver } from '../types'

// The test runner has timers; the hooks module's own environment, typed here, does not.
declare function setTimeout(callback: () => void, ms: number): unknown

/** The follower's stdout as the test writes it, one JSON line per event. */
function followerLines() {
  const waiting: ((line: string | null) => void)[] = []
  const queued: (string | null)[] = []
  const take = () =>
    new Promise<string | null>(resolve => (queued.length > 0 ? resolve(queued.shift() ?? null) : waiting.push(resolve)))

  return {
    send(event: object) {
      const line = JSON.stringify(event) + '\n'
      const next = waiting.shift()
      next ? next(line) : queued.push(line)
    },
    end() {
      const next = waiting.shift()
      next ? next(null) : queued.push(null)
    },
    async *stream() {
      for (let line = await take(); line !== null; line = await take()) {
        yield { stream: 'stdout' as const, text: line }
      }
      return { value: { code: 0, signal: null } }
    },
  }
}

/** The world beneath the mod: a follower the test drives, and what the mod asks of the engine. */
function world(on: On) {
  const follower = followerLines()
  const prompts: string[] = []
  const requests: { url: string; body: string | undefined }[] = []
  const toasts: string[] = []
  // The mod's state, kept as the engine would: what the pane draws from.
  const state = new Map<string, { value: unknown; version: number }>()
  const reports = () => (state.get('composablefix/reports')?.value ?? []) as FixReport[]
  const receiver = () => state.get('composablefix/receiver')?.value as Receiver | undefined

  mock.clock(on)
  on('state.get', async (_$, e) => {
    const kept = state.get(`${e.plugin}/${e.key}`)
    return { value: { value: kept?.value, version: kept?.version ?? 0 } } as never
  })
  on('state.set', async (_$, e) => {
    const name = `${e.plugin}/${e.key}`
    const version = (state.get(name)?.version ?? 0) + 1
    state.set(name, { value: (e as { value: unknown }).value, version })
    return { value: { isSet: true as const, version } } as never
  })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('ui.toast', async (_$, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.log', async () => ({ value: undefined }))
  on('process.spawn', async function* () {
    return yield* follower.stream()
  })
  on('prompt.submit', async (_$, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('http.fetch', async (_$, e) => {
    requests.push({ url: e.url, body: e.init?.body })
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ receiving: true, holder: '/project' }) } }
  })
  on('turn.complete', async () => ({ text: '' }))

  return { follower, prompts, requests, toasts, reports, receiver }
}

/** Waits until the mod has done what a follower line asked for. */
async function until(done: () => boolean | Promise<boolean>) {
  for (let waited = 0; !(await done()); waited += 5) {
    if (waited > 2000) throw new Error('the mod never got there')
    await new Promise<void>(resolve => setTimeout(resolve, 5))
  }
}

const ready = { type: 'ready', port: 5100, role: 'hub', receiving: true, holder: '/project' }
const incoming = {
  id: 'r1',
  comment: 'Income should be green',
  screen: 'Activity',
  element: null,
  source: null,
  accessibility: null,
  screenshot: null,
  prompt: 'Income should be green\n\n[fix r1] Activity screen · dev.composablefix.tally',
  status: 'queued',
  receivedAt: 0,
  finishedAt: null,
}

test("a report the receiver hands over is submitted as the person's prompt, and taken", async ($, on) => {
  const { follower, prompts, requests } = world(on)
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  follower.send(ready)
  follower.send({ type: 'report', report: incoming, seq: 1 })

  await until(() => requests.length > 0)
  expect(prompts).toEqual([incoming.prompt])
  expect(requests[0]).toEqual({ url: 'http://127.0.0.1:5100/deliver', body: JSON.stringify({ ids: ['r1'] }) })
})

test('where a report stands reaches the pane as the receiver says it', async ($, on) => {
  const { follower, reports, receiver } = world(on)
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  follower.send(ready)
  follower.send({ type: 'report', report: incoming, seq: 1 })
  for (const status of ['fixing', 'rebuilding', 'live']) follower.send({ type: 'status', id: 'r1', status })

  await until(() => reports()[0]?.status === 'live')
  expect(reports()[0]?.finishedAt).not.toBe(null)
  expect(receiver()?.state).toBe('listening')
})

test('a session standing by says where the reports go, and /fix-take moves them here', async ($, on) => {
  const { follower, requests, toasts, receiver } = world(on)
  await $.session.start({ cwd: '/project/android', surface: 'terminal', isInteractive: true })
  follower.send({ ...ready, role: 'member', receiving: false })

  await until(() => receiver()?.state === 'standby')
  expect(toasts.some(text => text.includes('/fix-take'))).toBe(true)

  const answer = await $.command.run({
    command: 'fix-take',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  expect(requests.at(-1)?.url).toBe('http://127.0.0.1:5100/take')
  expect(answer.text).toBe("This session now receives the app's fix requests.")
})

test('in a folder with no ComposableFix project the mod stays off', async ($, on) => {
  const { follower, prompts, receiver } = world(on)
  await $.session.start({ cwd: '/elsewhere', surface: 'terminal', isInteractive: true })
  follower.send({ type: 'off' })
  follower.end()

  await until(() => receiver()?.state === 'off')
  expect(prompts).toEqual([])
})
