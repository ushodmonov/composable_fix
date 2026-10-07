import { expect, test } from 'claude-code/testing'

import type { Accessibility } from '../types'
import { describeAccessibility, isInstall, pressedLabel, promptFor } from '../hooks/prompt'

const amount: Accessibility = {
  element: {
    type: 'TextView',
    label: '+€4,650.00',
    value: null,
    identifier: null,
  },
  within: null,
  nearby: ['Northwind GmbH', 'Salary, September'],
}

const tally = { package: 'dev.composablefix.tally', component: 'dev.composablefix.tally/.MainActivity', pid: 5971, serial: 'emulator-5554' }

test('an unmarked element is named by accessibility and the screen', () => {
  const prompt = promptFor(
    {
      id: 'r1',
      comment: 'Income should be green',
      screen: 'Activity',
      screenshot: '.composablefix/reports/r1.png',
      touch: { x: 882, y: 1944 },
      android: tally,
      accessibility: amount,
    },
    null,
  )

  expect(prompt).toBe(
    'Income should be green\n\n' +
      '[fix r1] TextView "+€4,650.00" near "Northwind GmbH", "Salary, September" · Activity screen · ' +
      'dev.composablefix.tally/.MainActivity on emulator-5554 · .composablefix/reports/r1.png',
  )
})

test('a marked element leads with its name and source line', () => {
  const prompt = promptFor(
    {
      id: 'r2',
      comment: 'name is cut off',
      screen: 'Home',
      screenshot: '.composablefix/reports/r2.png',
      touch: { x: 232, y: 1085 },
      android: tally,
      element: { name: 'card.holderName', file: '/p/tally/src/main/kotlin/dev/composablefix/tally/home/WalletCard.kt', line: 86 },
      accessibility: {
        element: { type: 'TextView', label: 'Vladimir Berestnev', value: null, identifier: null },
        within: null,
        nearby: ['CARD HOLDER'],
      },
    },
    'tally/src/main/kotlin/dev/composablefix/tally/home/WalletCard.kt:86',
  )

  expect(prompt).toBe(
    'name is cut off\n\n' +
      '[fix r2] card.holderName · tally/src/main/kotlin/dev/composablefix/tally/home/WalletCard.kt:86 · ' +
      'TextView "Vladimir Berestnev" near "CARD HOLDER" · dev.composablefix.tally/.MainActivity on emulator-5554 · .composablefix/reports/r2.png',
  )
})

test('with nothing known, the touch point and the app stand in', () => {
  const prompt = promptFor(
    {
      id: 'r3',
      comment: 'Too dark',
      screen: '',
      screenshot: null,
      touch: { x: 120.4, y: 339.6 },
      android: { package: 'dev.composablefix.tally' },
      accessibility: null,
    },
    null,
  )

  // Without a device found, the app alone.
  expect(prompt).toBe('Too dark\n\n[fix r3] touch at 120,340 · dev.composablefix.tally')
})

test('an icon is described with the control around it and its value', () => {
  expect(
    describeAccessibility({
      element: { ...amount.element, type: 'ImageView', label: 'chart', identifier: 'tab.icon' },
      within: { ...amount.element, type: 'View', label: 'Activity', identifier: 'tabBar.activity' },
      nearby: [],
    }),
  ).toBe('ImageView "chart" #tab.icon in View "Activity" #tabBar.activity')
  expect(describeAccessibility({ element: { ...amount.element, type: 'View', label: 'Shop', value: '€493' }, within: null, nearby: [] })).toBe(
    'View "Shop" = "€493"',
  )
})

test('the pane names a marked element, else what accessibility said, else the screen', () => {
  expect(pressedLabel({ element: 'home.quickActions.send', accessibility: amount, screen: 'Home' })).toBe('home.quickActions.send')
  expect(pressedLabel({ element: null, accessibility: amount, screen: 'Activity' })).toBe(
    'TextView "+€4,650.00" near "Northwind GmbH", "Salary, September"',
  )
  expect(pressedLabel({ element: null, accessibility: null, screen: 'Activity' })).toBe('Activity screen')
  expect(pressedLabel({ element: null, accessibility: null, screen: '' })).toBe('unnamed element')
})

test('a Gradle install task or adb install shows as rebuilding', () => {
  expect(isInstall('./gradlew :app:installDebug')).toBe(true)
  expect(isInstall('cd android && ./gradlew installStagingDebug && adb shell am start -n a/.Main')).toBe(true)
  expect(isInstall('gradle :tally:installDebug -q')).toBe(true)
  expect(isInstall('adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk')).toBe(true)
  expect(isInstall('./gradlew assembleDebug')).toBe(false)
  expect(isInstall('adb uninstall dev.composablefix.tally')).toBe(false)
  expect(isInstall('npm install && ./gradlew test')).toBe(false)
})
