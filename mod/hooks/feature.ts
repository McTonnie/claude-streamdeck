import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Settings } from '../types'

// What one feature of mctonnie-mods is. To add a mod: write features/<name>.tsx
// exporting its Feature (id, label, settings) and its parts as plain
// `export async function`s, then list both in features/index.ts. Its settings
// show in the Mods panel by themselves; its row (if any) shows in the band.
// (The engine follows `$` across files only into function declarations.)

/** The pack's colours, shared by the panel and any feature's row. */
export const C = {
  BG: '#24221c',
  TEXT: '#e8e2d2',
  MUTED: '#8d8775',
  EMPTY: '#4a463b',
  INK: '#1c1a16',
  ORANGE: '#ff6b1a',
  YELLOW: '#f5a623',
  GREEN: '#8fb573',
  BLUE: '#6aaabd',
} as const

export type Ui = ReturnType<EngineInterface['ui']['resolve']>

/** A tool call as a feature sees it: the tool's name and its input fields. */
export type ToolCall = { tool: string; [field: string]: unknown }

/** One setting: a small set of choices, shown as buttons in the Mods panel. */
export type Setting = {
  key: string
  label: string
  options: { value: string; label: string; color?: string }[]
  default: string
}

export type Feature = { id: string; label: string; settings: Setting[] }

export const settings = atom({ plugin: 'mctonnie-mods', key: 'settings' } as const, {} as Settings)

const STORE_KEY = 'settings'

/** The setting's chosen value, or its default. */
export async function get($: EngineInterface, f: Feature, key: string): Promise<string> {
  const s = (await read($, settings)) as Settings
  const def = f.settings.find(x => x.key === key)?.default ?? ''
  const v = s[`${f.id}.${key}`]
  return typeof v === 'string' ? v : def
}

/** Choose a value; remembered across sessions. */
export async function set($: EngineInterface, f: Feature, key: string, value: string): Promise<void> {
  const next = await update($, settings, s => ({ ...s, [`${f.id}.${key}`]: value }))
  await $.store.set(STORE_KEY, next)
}

export async function load($: EngineInterface): Promise<void> {
  const stored = await $.store.get(STORE_KEY)
  if (stored && typeof stored === 'object') await update($, settings, () => ({ ...(stored as Settings) }))
}
