// node --test mod/tests/*.node.test.mjs: a session's receiver follows each report from the app to
// the screen, as the app, the hooks and the tools tell it.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { startSession } from '../server/session.mjs'
import { call, freePort, project, report, until } from './helpers.mjs'

process.env.COMPOSABLEFIX_ADB = 'none'

test('a report goes from queued to live as the session takes it, installs and the app launches', async () => {
  const folder = project()
  const hub = await freePort()
  const session = await startSession({ cwd: folder.root, port: hub })
  try {
    assert.equal(session.project, folder.android)
    const sent = await call(hub, 'POST', '/report?app=com.example.shop', report('Too dark', { name: 'card', file: 'com/example/shop/Card.kt', line: 7 }))
    assert.equal(sent.id, 'r1')

    const { auto, reports } = await call(session.port, 'GET', '/pending')
    assert.equal(auto, false)
    assert.equal(reports.length, 1)
    // The mark's file is found in the project and named from the session's folder.
    assert.match(reports[0].prompt, /^Too dark\n\n\[fix r1\] card · android\/app\/src\/main\/kotlin\/com\/example\/shop\/Card\.kt:7 · com\.example\.shop\/\.MainActivity$/)

    await call(session.port, 'POST', '/deliver', { ids: ['r1'], session: 's1' })
    assert.equal((await call(hub, 'GET', '/status?id=r1&app=com.example.shop')).status, 'fixing')
    await call(session.port, 'POST', '/install', { session: 's1' })
    assert.equal(session.report('r1').status, 'rebuilding')

    const launched = await call(hub, 'POST', '/launched?app=com.example.shop')
    assert.deepEqual([launched.id, launched.status], ['r1', 'live'])
    await call(session.port, 'POST', '/turn-end', { session: 's1' })
    assert.equal(session.report('r1').status, 'live')
  } finally {
    session.close()
    folder.remove()
  }
})

test('a turn that ends while the app restarts waits a moment for the launch, and gives up after it', async () => {
  const folder = project()
  const hub = await freePort()
  const session = await startSession({ cwd: folder.root, port: hub, graceMs: 200 })
  try {
    await call(hub, 'POST', '/report?app=com.example.shop', report('First'))
    await call(hub, 'POST', '/report?app=com.example.shop', report('Second'))
    await call(session.port, 'POST', '/deliver', { ids: ['r1'], session: 's1' })
    await call(session.port, 'POST', '/install', { session: 's1' })
    await call(session.port, 'POST', '/turn-end', { session: 's1' })
    // The next report's turn has started before the app says it is up: the launch is the first's.
    await call(session.port, 'POST', '/deliver', { ids: ['r2'], session: 's1' })
    await call(hub, 'POST', '/launched?app=com.example.shop')
    assert.equal(session.report('r1').status, 'live')
    assert.equal(session.report('r2').status, 'fixing')

    await call(session.port, 'POST', '/install', { session: 's1' })
    await call(session.port, 'POST', '/turn-end', { session: 's1' })
    assert.equal(session.report('r2').status, 'rebuilding')
    await until(() => session.report('r2').status === 'stopped')
  } finally {
    session.close()
    folder.remove()
  }
})

test("of two sessions of a project the first receives the reports, until the other takes them", async () => {
  const folder = project()
  const hub = await freePort()
  const first = await startSession({ cwd: folder.root, port: hub })
  const second = await startSession({ cwd: folder.android, port: hub })
  try {
    await until(() => second.standing().holder !== null)
    assert.equal(first.standing().receiving, true)
    assert.deepEqual(second.standing(), { receiving: false, holder: folder.root })
    await call(hub, 'POST', '/report?app=com.example.shop', report('To the first'))
    assert.equal(first.reports().length, 1)

    assert.equal((await second.take()).receiving, true)
    await call(hub, 'POST', '/report?app=com.example.shop', report('To the second'))
    assert.equal(second.reports()[0].comment, 'To the second')
  } finally {
    first.close()
    second.close()
    folder.remove()
  }
})

test('a folder with no ComposableFix project starts no receiver', async () => {
  const folder = project()
  try {
    assert.equal(await startSession({ cwd: `${folder.android}/app`, port: await freePort() }), null)
  } finally {
    folder.remove()
  }
})
