import type { Accessibility, AndroidApp } from '../types'

export declare const INSTRUCTIONS: string

export declare function describeAccessibility(accessibility: Accessibility): string

export declare function promptFor(
  report: {
    id: string
    comment: string
    screen: string
    screenshot: string | null
    touch?: { x: number; y: number }
    android?: AndroidApp
    element?: { name: string } | null
    accessibility?: Accessibility | null
  },
  source: string | null,
): string

export declare function pressedLabel(report: {
  element: string | null
  accessibility: Accessibility | null
  screen: string
}): string

export declare function isInstall(command: string): boolean

export declare function reportIds(text: string | null | undefined): string[]
