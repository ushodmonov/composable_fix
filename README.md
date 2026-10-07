# ComposableFix

**English** | [O'zbekcha](README.uz.md) | [Русский](README.ru.md)

Long press any element of your Jetpack Compose app in a debug build, type what is wrong, press Return. The report lands in the Claude Code session already running in your project: the element, the line of Kotlin that marks it, a screenshot, your words. Claude fixes the code, installs the app again and relaunches it, and a banner in the app follows the fix from queued to live.

![Long presses on an Android emulator send reports to Claude Code: a shifted button, square corners, a cut-off name and a red income amount, each fixed by Claude and reinstalled](docs/demo.gif)

[Watch the demo in full quality (MP4, 72 s)](docs/demo.mp4). It was recorded live on an Android emulator: a Claude Code session in the terminal, with the plugin, fixed Tally's four seeded bugs from the reports. Only the waits are sped up.

ComposableFix is the Jetpack Compose port of [FixKit](https://github.com/ostiums/fixkit), which does the same for SwiftUI apps in the iOS simulator. For Flutter apps, see [WidgetFix](https://github.com/ushodmonov/widget_fix).

ComposableFix has two parts:

- **the composablefix plugin** for Claude Code receives the reports, in the terminal and in the VS Code extension: its MCP server runs the receiver, its command hooks follow each report, and its mod submits each report as a prompt the moment it arrives;
- **the ComposableFix Android library** sends them from a debug build. Release builds depend on `composablefix-noop` instead, which does nothing.

## Requirements

- Claude Code 2.1.287 or later.
- Node.js 18.2 or later; the plugin's receiver and hooks run on it.
- Jetpack Compose 1.10 or later, and Android 8.0 (API 26) or later for screenshots. The library builds from API 23, where it draws the screenshot itself.
- An Android emulator, or a device connected over USB or wireless debugging.
- adb, from the Android SDK's platform-tools. It tells which element a report's touch landed on, and lets a device reach the Mac. The plugin looks for it in `COMPOSABLEFIX_ADB`, then in `ANDROID_HOME` and `ANDROID_SDK_ROOT`, then on `PATH`, then in `~/Library/Android/sdk`. Without adb, an emulator's reports still arrive with the screenshot and the touch point.

## Installation

### 1. The plugin

```bash
claude plugin marketplace add ushodmonov/composable_fix
claude plugin install composablefix@composablefix
```

The plugin loads in every Claude Code session from then on, in the terminal and in the VS Code extension alike. Only a session started in a project that uses ComposableFix, or in a folder up to two levels above one, takes reports: its MCP server starts the receiver with the session and stops it when the session ends. Sessions in other folders leave the reports alone; see [Several projects](#several-projects). WidgetFix's mod uses the same port, 4747, so enable one of the two.

### 2. The library

Until the library is published, include this repository's Android build from a checkout. Gradle then substitutes the two coordinates with its modules. In `settings.gradle.kts`:

```kotlin
includeBuild("../composable_fix/android")
```

In the app module's `build.gradle.kts`:

```kotlin
dependencies {
    debugImplementation("dev.composablefix:composablefix:0.1.0")
    releaseImplementation("dev.composablefix:composablefix-noop:0.1.0")
}
```

`./gradlew publishToMavenLocal` in `android/` publishes both to `~/.m2` instead, for a project that resolves from `mavenLocal()`.

### 3. One wrapper around the root

```kotlin
import dev.composablefix.ComposableFixHost

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            ComposableFixHost {
                App()
            }
        }
    }
}
```

That is the whole integration. The library adds the `INTERNET` permission to debug builds and needs no network security config: it talks to the receiver over a plain socket, which no cleartext policy covers. The next section explains what the host does.

### 4. The project folder

The plugin writes reports to `.composablefix/` in the Gradle project's root, the folder with `settings.gradle.kts`; add `.composablefix/` to `.gitignore`. Start `claude` in that folder, or in a folder up to two levels above it, as in a repository with the app in `android/`: the plugin finds the nearest project below and gives Claude every path from the session's folder (`android/.composablefix/reports/r1.png`). In VS Code, the extension's session runs in the folder VS Code has open. To let Claude open the screenshots without asking each time, allow it in the project's Claude Code settings:

```json
{ "permissions": { "allow": ["Read(./.composablefix/**)"] } }
```

In a session above the project the path carries the project's folder: `Read(./android/.composablefix/**)`. Claude asks before it runs the Gradle install and `adb` unless you allow those too.

## Why `ComposableFixHost` wraps the root

The library does nothing until this composable runs. It does five things:

- **The long press.** It watches every press before the app's own gestures see it, in Compose's initial pass. Buttons, lists and pagers keep working. Once a press has lasted half a second without moving, it belongs to ComposableFix: the rest of it is consumed, so the control under the finger does not also act on it.
- **The composer.** It draws the dimmed screen with the pressed element lit and the comment field above the keyboard. When the keyboard would cover the element, it slides the app up. Back closes it.
- **The banners.** It shows the report's progress at the top of the screen: sent, queued, fixing, rebuilding, fixed.
- **The launch signal.** When the process starts it tells the receiver the app is up. A launch while Claude works on a report is how the plugin learns the fix is on screen, whether Claude installed it with Gradle or you pressed Run in Android Studio. After the relaunch the app picks up the report's progress again. An activity recreated by a rotation or a fold does not count as a launch.
- **Test tags in the accessibility tree.** It sets `testTagsAsResourceId`, so a `Modifier.testTag` shows in reports as the element's identifier.

The composer and the banners are drawn above the content passed to `ComposableFixHost`. Around the activity's whole `setContent` they cover the screen, above navigation and tab bars. So wrap the root once: a second host would draw a second composer. Dialogs, popups and `ModalBottomSheet` are windows of their own, above the host, so a long press inside one does nothing.

In a release build `composablefix-noop` provides the same functions: `ComposableFixHost` draws the content and nothing else, and the marks return the modifier unchanged. None of the library, and not its permission, is in the APK.

## Using `Modifier.fixable`

Nothing has to be marked. Without marks, the receiver reads the screen's accessibility tree with `uiautomator dump` and names the element under the finger, with the labels beside it. Claude then finds the composable by searching the sources for those labels:

```
Income should be green

[fix r1] TextView "+€4,650.00" near "Northwind GmbH", "Salary, September" · Activity screen · dev.composablefix.tally/.MainActivity on emulator-5554 · .composablefix/reports/r1.png
```

The line ends with the app's launch component and the device's adb serial, which Claude uses to start the app again. Mark an element with `Modifier.fixable` when you want its reports to point at an exact line:

```kotlin
@Composable
fun WalletCard(card: PaymentCard, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(card.number, Modifier.fixable("card.number"))
        Text(card.holder, Modifier.width(110.dp).fixable("card.holderName"))
    }
}

WalletCard(card, Modifier.fixable("home.walletCard"))
```

What a mark changes:

- **The report names the element and its line.** The mark records the file and line it was called from, read from the call stack. The app knows the file by its package's folders (`dev/composablefix/tally/features/home/WalletCard.kt`), and the receiver finds it among the project's Kotlin and Java sources. The prompt leads with the name and the path relative to the project, so Claude starts reading at that line:

  ```
  [fix r2] card.holderName · android/tally/src/main/kotlin/dev/composablefix/tally/features/home/WalletCard.kt:86 · TextView "Vladimir Berestnev" near "CARD HOLDER", "EXPIRES" · dev.composablefix.tally/.MainActivity on emulator-5554 · .composablefix/reports/r2.png
  ```

- **The composer lights the element's frame** and labels it with the name and the file, and the screenshot outlines that frame. Without a mark, the screenshot has a ring where the finger was.
- **Nested marks resolve to the innermost one.** A press on the holder name above reports `card.holderName`, a press elsewhere on the card reports `home.walletCard`.

Put the mark on the composable whose code you want Claude to open: the `Text` itself for a typo or a colour, the container for spacing or layout. A mark sees the element where the modifiers before it put it, so write `Modifier.offset(…).fixable(…)` to light where an offset element is drawn. A name only has to make sense to you; it may carry data, as in `Modifier.fixable("transaction.amount.${transaction.merchant}")`.

`Modifier.fixScreen("Home")` names the screen on display. The name goes with every report as `Home screen`, which helps Claude find unmarked elements. Apply it to each screen's root, or `Modifier.fixScreen(selectedTab.title)` on the layout that holds the tabs.

## Use it

1. Install a debug build on an emulator or a device, and open it.
2. Start `claude` in the project folder, or open the folder in VS Code and start a Claude Code conversation there. In the terminal, the Fix queue pane opens in a terminal 144 columns or wider; `/fix-queue` opens it at any width. When another session of the same project already receives the reports, this one stands by and says so; `/fix-take`, or asking Claude to take the reports (the `take_reports` tool), moves them to it.
3. Long press an element in the app, type what is wrong, press Return. Back, or a tap on the dimmed screen, closes the composer.

Each report arrives as a prompt of its own, in the terminal and in the VS Code extension. Where a host does not run the plugin's mod, a report comes with your next message instead, and asking Claude to watch for fix reports has it wait for each one (the `wait_for_report` tool).

The pane and the banner in the app move through `queued`, `fixing`, `rebuilding` and `live`. While a Gradle install task or `adb install` runs, the report shows as rebuilding. It turns live when the app launches again while Claude works on it, and stays live if Claude finishes with an answer. Reports sent while Claude works on one wait in the queue.

## Devices

The app looks for the receiver at `127.0.0.1:4747` on its own device, then at `10.0.2.2:4747`, which is how an emulator names the computer it runs on.

| Where the app runs | What it needs |
| --- | --- |
| Android emulator | nothing |
| a device on USB or wireless debugging | nothing: the receiver keeps `adb reverse tcp:4747 tcp:4747` set for every device adb sees |

The receiver only maps the port once an adb server is running, and never starts one. With several devices, it tells which one sent a report by the app's process id.

## Several projects

Reports go to a session opened in the app's project, so several projects can be open at once, each with its own app and its own Claude Code session. The app sends everything to `127.0.0.1:4747`. The first receiver takes that port and becomes the hub; every receiver, the hub's included, also listens on a port of its own and registers with the hub, with its project. For each request the hub asks the projects whether the app is theirs: whether the project's Gradle files declare its application id (with or without a suffix such as `.debug`) or its namespace, or its sources are in its package. So:

- a session in a folder without a ComposableFix project starts no receiver, and leaves no `.composablefix/` behind;
- of two sessions of the same project the first keeps the reports, so a second `claude` for a side question does not catch them; `/fix-take` in the second, or its `take_reports` tool, moves them there;
- when the hub's session ends, another session's receiver takes the port over within a few seconds.

An app that no open session claims gets no answer, and its banner says Claude Code is not listening.

## How it works

```
app (ComposableFix) ──POST /report?app=…──▶ hub: 127.0.0.1:4747, one session's receiver
        ▲                                          │ to the session of the app's project
        │ POST /launched,                          ▼
        │ GET /status                  receiver: the plugin's MCP server ──adb uiautomator dump──▶ device
        └──────────────────────────────────────────┤  ▲ prompt, install, turn end: command hooks
                                                   │  │ list, wait, take, set status: MCP tools
                                                   ▼
                                 the mod: each report as a prompt, the Fix queue pane
```

The receiver runs in the plugin's MCP server, which Claude Code starts with every session, in the terminal and in the VS Code extension. The app sends a report once its composer has closed, and the receiver reads the screen's accessibility tree before it answers; until then the app takes no new long press. The receiver picks the deepest named element under the touch point and the labels beside it in the same row, saves the screenshot and the whole tree in `.composablefix/reports/`, and finds the device and the marked element's source file.

The mod submits each report as a prompt; where a host does not run it, the `UserPromptSubmit` hook adds the waiting reports to the next message. The receiver keeps every report's status, which the app polls: a prompt that carries the report makes it `fixing`, a Gradle install or `adb install` in that session (the `PreToolUse` hook) `rebuilding`, the app's launch `live`, and the end of the turn without a launch (the `Stop` hook) `stopped`. The MCP server also hands Claude the instructions for the `[fix …]` line, and its tools: `list_reports`, `get_report`, `wait_for_report`, `take_reports` and `set_status`.

`COMPOSABLEFIX_PORT` moves the hub's port, but the app always sends to 4747.

## Example: Tally

`android/tally/` is the Jetpack Compose version of the SwiftUI wallet from the original FixKit, with the same four seeded UI bugs, linked to the library in this repository.

```bash
git clone https://github.com/ushodmonov/composable_fix && cd composable_fix
./scripts/reset-demo.sh          # puts the bugs back, builds, installs and launches Tally
claude --plugin-dir ./mod        # the plugin from this checkout
```

In VS Code, which takes no `--plugin-dir`, add the checkout as a marketplace and install from it: `claude plugin marketplace add .` and `claude plugin install composablefix@composablefix`. The plugin is then read from the folder, and `/reload-plugins` picks up an edit.

| Where | Long press | A comment that works |
| --- | --- | --- |
| Home | the Send button | button is shifted |
| Home | the Top up button | corners don't match the others |
| Home or Cards | the card holder name | name is cut off |
| Home or Activity | a green-category amount such as the salary | income should be green |

Each one is a one-line slip in the code. The reset script restores them from the git tag `demo-start`, the commit that seeded them. It installs on the device adb sees; set `ANDROID_SERIAL` when there are several.

## Development

`scripts/test.sh` runs every check: `claude plugin validate` on the marketplace and the plugin, the mod's tests (`claude plugin test mod`), the receiver's tests (`node --test`: the lookup against a dump of Tally's Home screen, the hub's routing, a session's reports from queued to live, the command hooks and the MCP server), the library's unit tests, and Tally's debug and release builds.

## License

MIT, see [LICENSE](LICENSE).
