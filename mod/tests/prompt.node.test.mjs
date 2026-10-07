// node --test mod/tests/*.node.test.mjs: a report in words, as Claude reads it and the pane shows it.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { describeAccessibility, isInstall, pressedLabel, promptFor, reportIds } from '../shared/prompt.mjs'

const amount = {
  element: { type: 'TextView', label: '+€4,650.00', value: null, identifier: null },
  within: null,
  nearby: ['Northwind GmbH', 'Salary, September'],
}
const tally = { package: 'dev.composablefix.tally', component: 'dev.composablefix.tally/.MainActivity', pid: 5971, serial: 'emulator-5554' }

test('an unmarked element is named by accessibility and the screen', () => {
  const prompt = promptFor(
    { id: 'r1', comment: 'Income should be green', screen: 'Activity', screenshot: 'android/.composablefix/reports/r1.png', touch: { x: 882, y: 1944 }, android: tally, accessibility: amount },
    null,
  )

  assert.equal(
    prompt,
    'Income should be green\n\n' +
      '[fix r1] TextView "+€4,650.00" near "Northwind GmbH", "Salary, September" · Activity screen · ' +
      'dev.composablefix.tally/.MainActivity on emulator-5554 · android/.composablefix/reports/r1.png',
  )
})

test('a marked element leads with its name and source line', () => {
  const prompt = promptFor(
    {
      id: 'r2',
      comment: 'name is cut off',
      screen: 'Home',
      screenshot: null,
      android: tally,
      element: { name: 'card.holderName' },
      accessibility: { element: { type: 'TextView', label: 'Vladimir Berestnev', value: null, identifier: null }, within: null, nearby: ['CARD HOLDER'] },
    },
    'android/tally/src/main/kotlin/dev/composablefix/tally/home/WalletCard.kt:86',
  )

  assert.equal(
    prompt,
    'name is cut off\n\n' +
      '[fix r2] card.holderName · android/tally/src/main/kotlin/dev/composablefix/tally/home/WalletCard.kt:86 · ' +
      'TextView "Vladimir Berestnev" near "CARD HOLDER" · dev.composablefix.tally/.MainActivity on emulator-5554',
  )
})

test('with nothing known, the touch point and the app stand in', () => {
  const prompt = promptFor(
    { id: 'r3', comment: 'Too dark', screen: '', screenshot: null, touch: { x: 120.4, y: 339.6 }, android: { package: 'dev.composablefix.tally' }, accessibility: null },
    null,
  )

  assert.equal(prompt, 'Too dark\n\n[fix r3] touch at 120,340 · dev.composablefix.tally')
})

test('an icon is described with the control around it and its value', () => {
  assert.equal(
    describeAccessibility({
      element: { ...amount.element, type: 'ImageView', label: 'chart', identifier: 'tab.icon' },
      within: { ...amount.element, type: 'View', label: 'Activity', identifier: 'tabBar.activity' },
      nearby: [],
    }),
    'ImageView "chart" #tab.icon in View "Activity" #tabBar.activity',
  )
  assert.equal(describeAccessibility({ element: { ...amount.element, type: 'View', label: 'Shop', value: '€493' }, within: null, nearby: [] }), 'View "Shop" = "€493"')
})

test('the pane names a marked element, else what accessibility said, else the screen', () => {
  assert.equal(pressedLabel({ element: 'home.quickActions.send', accessibility: amount, screen: 'Home' }), 'home.quickActions.send')
  assert.equal(pressedLabel({ element: null, accessibility: amount, screen: 'Activity' }), 'TextView "+€4,650.00" near "Northwind GmbH", "Salary, September"')
  assert.equal(pressedLabel({ element: null, accessibility: null, screen: 'Activity' }), 'Activity screen')
  assert.equal(pressedLabel({ element: null, accessibility: null, screen: '' }), 'unnamed element')
})

test('a Gradle install task or adb install is an install', () => {
  assert.equal(isInstall('./gradlew :app:installDebug'), true)
  assert.equal(isInstall('cd android && ./gradlew installStagingDebug && adb shell am start -n a/.Main'), true)
  assert.equal(isInstall('gradle :tally:installDebug -q'), true)
  assert.equal(isInstall('adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk'), true)
  assert.equal(isInstall('./gradlew assembleDebug'), false)
  assert.equal(isInstall('adb uninstall dev.composablefix.tally'), false)
  assert.equal(isInstall('npm install && ./gradlew test'), false)
})

test("a prompt's [fix …] lines name its reports", () => {
  assert.deepEqual(reportIds('Too dark\n\n[fix r3] touch at 1,2\n\nalso [fix r12] x'), ['r3', 'r12'])
  assert.deepEqual(reportIds('no reports here'), [])
})
