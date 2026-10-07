import type { Accessibility, AccessibilityElement, AndroidApp, FixReport, Incoming } from '../types'

/** What a `[fix …]` prompt calls for; sent with the system prompt while the mod is loaded. */
export const INSTRUCTIONS = `# Fix requests from the running app

A prompt that ends with a line like

[fix r1] TextView "+€4,650.00" near "Northwind GmbH", "Salary, September" · Activity screen · com.example/.MainActivity on emulator-5554 · .composablefix/reports/r1.png
[fix r2] card.holderName · app/src/main/kotlin/com/example/home/WalletCard.kt:86 · TextView "Vladimir Berestnev" near "CARD HOLDER" · com.example/.MainActivity on emulator-5554 · .composablefix/reports/r2.png

was sent by the composablefix mod from the Android app running on an emulator or a device: someone long-pressed an element and typed the text above that line. The line holds the report's id and what is known about the element: the name and the file and line of its Modifier.fixable("name") when the app marks it; what accessibility says it is (its type, label, value, the control around it and the labels beside it in the same row); the screen's name when the app gives one; the app's launch component and the device's adb serial; and a screenshot with the element outlined in red, or a red ring where the finger was.

When a prompt carries that line:
- Treat the text above it as the request. It may be a bug ("button is shifted") or a change ("make this green").
- With a file and line, start there: the cause is on that composable or the one it wraps.
- Without one, find the composable by searching the Kotlin sources (and XML layouts) for the label and the labels beside it; a label made from data (an amount, a date) is found through the code that formats it, so search the neighbouring fixed labels first.
- Make the smallest change that does what was asked. Do not refactor.
- Open the screenshot only when the text and the code leave the request unclear.
- Then install the debug build with Gradle (\`./gradlew :app:installDebug\`, with the app's module) and start it again with \`adb -s <serial> shell am start -n <component>\` from the line, so the change is on screen: the report counts as fixed once the app has launched again.
- Answer in one or two sentences: what was wrong and what changed.`

/** One accessibility element in words: its type, then its label, value and identifier. */
function describeOne(element: AccessibilityElement) {
  const parts = [element.type]
  if (element.label) parts.push(JSON.stringify(element.label))
  if (element.value && element.value !== element.label) parts.push(`= ${JSON.stringify(element.value)}`)
  if (element.identifier) parts.push(`#${element.identifier}`)
  return parts.join(' ')
}

/** What accessibility says was pressed, in one phrase for the prompt and the pane. */
export function describeAccessibility({ element, within, nearby }: Accessibility) {
  let text = describeOne(element)
  if (within) text += ` in ${describeOne(within)}`
  if (nearby.length > 0) text += ` near ${nearby.map(label => JSON.stringify(label)).join(', ')}`
  return text
}

/** The app that sent the report and the device it runs on: what relaunching it takes. */
function describeApp({ component, package: name, serial }: AndroidApp) {
  const app = component ?? name
  return serial ? `${app} on ${serial}` : app
}

/**
 * The prompt: the person's comment as they typed it, then one line of context.
 * `INSTRUCTIONS` tells the model what a message carrying a `[fix …]` line calls for.
 */
export function promptFor(incoming: Incoming, source: string | null) {
  const { accessibility, android, comment, element, id, screen, screenshot, touch } = incoming
  const context = [
    element?.name,
    source,
    accessibility ? describeAccessibility(accessibility) : null,
    // A marked element says where it is; otherwise the screen's name helps find it.
    !element && screen ? `${screen} screen` : null,
    !element && !accessibility && touch ? `touch at ${Math.round(touch.x)},${Math.round(touch.y)}` : null,
    android ? describeApp(android) : null,
    screenshot,
  ].filter((part): part is string => Boolean(part))

  return `${comment}\n\n[fix ${id}] ${context.join(' · ')}`
}

/** How the pane names what was pressed: the `.fixable` name, else what accessibility said. */
export function pressedLabel({ element, accessibility, screen }: Pick<FixReport, 'element' | 'accessibility' | 'screen'>) {
  if (element) return element
  if (accessibility) return describeAccessibility(accessibility)
  return screen ? `${screen} screen` : 'unnamed element'
}

/**
 * Whether a shell command installs the app: a Gradle install task (installDebug,
 * :app:installStagingDebug) or `adb install`. The pane shows the report as rebuilding meanwhile;
 * whether the fix reached the screen comes from the app itself, when it launches.
 */
export function isInstall(command: string) {
  return /\bgradlew?\b[^\n;&|]*\binstall[A-Z]\w*/.test(command) || /\badb\b[^\n;&|]*\binstall(?:-multiple)?\s/.test(command)
}
