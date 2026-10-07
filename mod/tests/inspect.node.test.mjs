// node --test mod/tests/*.node.test.mjs: the accessibility lookup against a `uiautomator dump` of
// Tally's Home screen, and against small trees for what that screen does not hold.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { parseHierarchy } from '../server/android.mjs'
import { elementAt } from '../server/inspect.mjs'

const tree = parseHierarchy(readFileSync(new URL('./fixtures/android-home-screen.xml', import.meta.url), 'utf8'))
// The emulator's density: a row's reach is 12dp.
const slop = 12 * 2.4375
const frame = (x, y, width, height) => ({ x, y, width, height })

test('a text on the card comes with the labels beside it', () => {
  const found = elementAt(tree, { x: 232, y: 1085 }, { slop })

  assert.deepEqual(found.element, { type: 'TextView', label: 'Vladimir Berestnev', value: null, identifier: null })
  assert.deepEqual(found.nearby, ['CARD HOLDER', 'EXPIRES', '09/29', 'VISA'])
  // The platform's own content frame names nothing of the app.
  assert.equal(found.within, null)
})

test('an amount in a row comes with its row and not the next one', () => {
  const found = elementAt(tree, { x: 882, y: 1944 }, { slop })

  assert.equal(found.element.label, '+€4,650.00')
  assert.ok(found.nearby.includes('Northwind GmbH'))
  assert.ok(found.nearby.includes('Salary, September'))
  assert.ok(!found.nearby.includes('Uber'))
  assert.ok(!found.nearby.includes('BVG'))
})

test("ComposableFix's own banner is never what was pressed", () => {
  // The banner, tagged composablefix.banner, lies over the greeting.
  const found = elementAt(tree, { x: 320, y: 240 }, { slop })

  assert.equal(found.element.label, 'Vladimir')
  assert.ok(!found.nearby.includes('Queued in Claude Code'))
})

test('an icon names the control around it', () => {
  const screen = [
    {
      type: 'View',
      label: 'Activity',
      identifier: 'tabBar.activity',
      frame: frame(0, 2200, 360, 120),
      children: [{ type: 'ImageView', label: 'chart', frame: frame(150, 2210, 60, 60), children: [] }],
    },
  ]
  const found = elementAt(screen, { x: 180, y: 2240 })

  assert.equal(found.element.type, 'ImageView')
  assert.deepEqual([found.within.label, found.within.identifier], ['Activity', 'tabBar.activity'])
})

test('a touch on nothing named finds nothing', () => {
  assert.equal(elementAt(tree, { x: 540, y: 2380 }, { slop }), null)
})
