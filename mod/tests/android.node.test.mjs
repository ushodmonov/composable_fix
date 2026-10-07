// node --test mod/tests/*.node.test.mjs: reading `uiautomator dump`'s XML, and finding the source
// file of a mark from what the app knows of it.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { appFinder, parseHierarchy, sourceFinder } from '../server/android.mjs'

test('a node is named by its description, its text, and its id without the package', () => {
  const [root] = parseHierarchy(
    '<?xml version="1.0"?><hierarchy rotation="0">' +
      '<node class="android.widget.FrameLayout" resource-id="android:id/content" text="" content-desc="" bounds="[0,0][400,800]">' +
      '<node class="android.widget.ImageView" resource-id="com.example:id/send" text="" content-desc="Send &amp; close" bounds="[10,20][58,68]" />' +
      '<node class="android.widget.TextView" resource-id="" text="Line one&#10;&quot;two&quot; &lt;3" content-desc="" bounds="[0,100][400,140]" />' +
      '<node class="android.view.View" resource-id="home.total" text="€12" content-desc="Total" bounds="[0,200][400,260]" />' +
      '</node></hierarchy>',
  )

  assert.deepEqual(
    root.children.map(({ type, label, value, identifier }) => [type, label, value, identifier]),
    [
      ['ImageView', 'Send & close', null, 'send'],
      ['TextView', 'Line one\n"two" <3', null, null],
      ['View', 'Total', '€12', 'home.total'],
    ],
  )
  assert.equal(root.identifier, null)
  assert.deepEqual(root.children[0].frame, { x: 10, y: 20, width: 48, height: 48 })
})

test("a mark's file is found by its package's folders, else by its name", () => {
  const root = mkdtempSync(join(tmpdir(), 'composablefix-'))
  const write = path => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), '')
  }
  write('app/src/main/kotlin/com/example/home/Card.kt')
  write('wear/src/main/kotlin/com/example/wear/Card.kt')
  write('app/src/main/java/com/example/Other.kt')
  write('app/build/generated/com/example/Generated.kt')

  try {
    const find = sourceFinder(root)
    assert.equal(find('com/example/home/Card.kt'), join(root, 'app/src/main/kotlin/com/example/home/Card.kt'))
    assert.equal(find('com/example/wear/Card.kt'), join(root, 'wear/src/main/kotlin/com/example/wear/Card.kt'))
    // A file whose folders do not follow its package is found by its name when only one has it.
    assert.equal(find('com/example/misplaced/Other.kt'), join(root, 'app/src/main/java/com/example/Other.kt'))
    // Build output is no source; what cannot be found is passed on as the app gave it.
    assert.equal(find('com/example/Generated.kt'), 'com/example/Generated.kt')

    // A file added after the first lookup is found too.
    write('app/src/main/kotlin/com/example/New.kt')
    assert.equal(find('com/example/New.kt'), join(root, 'app/src/main/kotlin/com/example/New.kt'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('an app is the project that declares its id, its namespace, or holds its package', () => {
  const root = mkdtempSync(join(tmpdir(), 'composablefix-'))
  const write = (path, text = '') => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write('app/build.gradle.kts', 'android {\n  namespace = "com.example.shop"\n  defaultConfig {\n    applicationId = "com.example.shop.app"\n  }\n}\n')
  write('legacy/build.gradle', "android {\n    defaultConfig {\n        applicationId 'org.legacy'\n    }\n}\n")
  write('feature/src/main/kotlin/com/example/feature/Screen.kt')

  try {
    const isOurs = appFinder(root)
    assert.equal(isOurs('com.example.shop.app'), true)
    // A build type's suffix keeps the id.
    assert.equal(isOurs('com.example.shop.app.debug'), true)
    assert.equal(isOurs('com.example.shop'), true)
    assert.equal(isOurs('org.legacy'), true)
    assert.equal(isOurs('com.example.feature'), true)
    // Nothing that only shares a beginning.
    assert.equal(isOurs('com.example'), false)
    assert.equal(isOurs('com.example.shopping'), false)
    assert.equal(isOurs('dev.composablefix.tally'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
