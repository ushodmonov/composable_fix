export type FixStatus = 'queued' | 'fixing' | 'rebuilding' | 'live' | 'stopped'

/** An accessibility element as the receiver summarises it. */
export type AccessibilityElement = {
  type: string
  label: string | null
  value: string | null
  identifier: string | null
}

/** What accessibility says the touch landed on. */
export type Accessibility = {
  element: AccessibilityElement
  /** The nearest named element around it: the button around an icon, say. */
  within: AccessibilityElement | null
  /** Labels of the elements beside it in the same row, nearest first. */
  nearby: string[]
}

/** The app a report came from, as the app and the receiver name it. */
export type AndroidApp = {
  package: string
  /** The launcher activity, `package/.Activity`. */
  component?: string | null
  pid?: number
  /** The adb serial of the device it runs on, when the receiver found it. */
  serial?: string | null
}

/** A report as the receiver hands it to the mod, through the follower. */
export type Incoming = {
  id: string
  comment: string
  screen: string
  /** The `Modifier.fixable` name of what was pressed, when the app marks it. */
  element: string | null
  /** `path:line` of the mark, relative to the session's folder. */
  source: string | null
  accessibility: Accessibility | null
  screenshot: string | null
  /** The prompt: the comment, then the `[fix …]` line. */
  prompt: string
  status: FixStatus
  receivedAt: number
  finishedAt: number | null
}

export type FixReport = Incoming & {
  /** Names of the files Claude edited for this report. */
  edited: string[]
}

export type Receiver = {
  /** `standby`: another session in the same project receives its reports. `off`: no ComposableFix project here. */
  state: 'starting' | 'listening' | 'standby' | 'off' | 'failed'
  detail: string
  /** Advice that stays in the pane: how to install adb, say. */
  notice?: string
}

declare module 'claude-code' {
  interface PluginState {
    composablefix: { reports: FixReport[]; receiver: Receiver; now: number }
  }
}
