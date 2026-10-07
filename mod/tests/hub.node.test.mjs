// node --test mod/tests/*.node.test.mjs: the hub hands each app's requests to the session opened
// in that app's project, against sessions faked as small servers.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'

import { createHub, join } from '../server/hub.mjs'

/** A session that owns some apps and answers every other request with its name and the path. */
async function session(name, apps) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://session')
    const body = url.pathname === '/owns' ? { owns: apps.includes(url.searchParams.get('app')) } : { name, path: req.url }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { server, port: server.address().port }
}

async function hubOnAnyPort() {
  const hub = createHub()
  await new Promise(resolve => hub.server.listen(0, '127.0.0.1', resolve))
  return { ...hub, port: hub.server.address().port }
}

const ask = async (hub, path, init) => {
  const response = await fetch(`http://127.0.0.1:${hub.port}${path}`, init)
  return { status: response.status, body: await response.json() }
}

test("each app's requests go to the session of its project", async () => {
  const hub = await hubOnAnyPort()
  const tally = await session('tally', ['dev.composablefix.tally'])
  const shop = await session('shop', ['com.example.shop'])
  await join(hub.port, tally.port, '/work/tally')
  await join(hub.port, shop.port, '/work/shop')

  try {
    assert.deepEqual((await ask(hub, '/status?id=r1&app=dev.composablefix.tally')).body, {
      name: 'tally',
      path: '/status?id=r1&app=dev.composablefix.tally',
    })
    const report = await ask(hub, '/report?app=com.example.shop', { method: 'POST', body: '{"comment":"too dark"}' })
    assert.equal(report.body.name, 'shop')

    // An app no open project holds goes nowhere.
    const unknown = await ask(hub, '/launched?app=org.other', { method: 'POST' })
    assert.equal(unknown.status, 404)
  } finally {
    for (const one of [hub, tally, shop]) one.server.close()
  }
})

test('of two sessions in the same project, the newer one gets the reports', async () => {
  const hub = await hubOnAnyPort()
  const first = await session('first', ['dev.composablefix.tally'])
  const second = await session('second', ['dev.composablefix.tally'])
  await join(hub.port, first.port, '/work/tally')
  await new Promise(resolve => setTimeout(resolve, 5))
  await join(hub.port, second.port, '/work/tally')

  try {
    assert.equal((await ask(hub, '/status?id=r1&app=dev.composablefix.tally')).body.name, 'second')

    // When it is gone, the earlier one gets them again.
    await new Promise(resolve => second.server.close(resolve))
    hub.register(second.port, '/work/tally')
    assert.equal((await ask(hub, '/status?id=r1&app=dev.composablefix.tally')).body.name, 'first')
  } finally {
    hub.server.close()
    first.server.close()
  }
})

test('a request that names no app is refused, and only a hub answers a registration', async () => {
  const hub = await hubOnAnyPort()
  const other = await session('other', [])
  try {
    assert.equal((await ask(hub, '/status?id=r1')).status, 400)
    // Something else on the port, like another tool's receiver, is not taken for a hub.
    await assert.rejects(join(other.port, 1, '/work'), { code: 'NOT_A_HUB' })
  } finally {
    hub.server.close()
    other.server.close()
  }
})
