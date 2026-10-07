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

/** A report as the receiver prints it, one JSON line each. */
export type Incoming = {
  id: string
  comment: string
  screen: string
  screenshot: string | null
  /** In screen pixels. */
  touch?: { x: number; y: number }
  android?: AndroidApp
  /** The element marked with `Modifier.fixable` under the touch, when there is one. */
  element?: {
    name: string
    file: string
    line: number
  }
  accessibility?: Accessibility | null
}

export type FixReport = {
  id: string
  comment: string
  /** The `.fixable` name of what was pressed, when the app marks it. */
  element: string | null
  accessibility: Accessibility | null
  /** `path:line` of the element's declaration, relative to the project. */
  source: string | null
  screen: string
  screenshot: string | null
  status: FixStatus
  receivedAt: number
  finishedAt: number | null
  /** Names of the files Claude edited for this report. */
  edited: string[]
}

export type Receiver = {
  state: 'starting' | 'listening' | 'failed'
  detail: string
  /** Advice that stays in the pane: how to install adb, say. */
  notice?: string
}

declare module 'claude-code' {
  interface PluginState {
    composablefix: { reports: FixReport[]; receiver: Receiver; now: number }
  }
}
