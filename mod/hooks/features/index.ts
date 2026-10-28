import type { EngineInterface, RenderElement } from 'claude-code'

import type { Feature, ToolCall, Ui } from '../feature'
import {
  streamdeck,
  streamdeckAfterTool,
  streamdeckBeforeTool,
  streamdeckEnd,
  streamdeckNotification,
  streamdeckPermission,
  streamdeckStart,
  streamdeckStop,
  streamdeckTurnDone,
  streamdeckTurnStart,
} from './streamdeck'
import type { BgTask } from './streamdeck'

// Every feature of mctonnie-mods. A new mod: add its file next to these, list it
// in FEATURES (its settings then show in the McT Mods panel), and call its parts
// in the functions below that it has.

/** In the order the McT Mods panel shows them. */
export const FEATURES: Feature[] = [streamdeck]

export async function featuresStart($: EngineInterface): Promise<void> {
  await streamdeckStart($)
}

/** A reason refuses the call; null lets it through. */
export async function featuresBeforeTool($: EngineInterface, call: ToolCall): Promise<string | null> {
  // The Stream Deck note never blocks a call.
  try {
    await streamdeckBeforeTool($, call)
  } catch {}
  return null
}

export async function featuresAfterTool($: EngineInterface, call: ToolCall): Promise<void> {
  await streamdeckAfterTool($, call)
}

/** The main loop starts a turn: a message from the user, another session or a background task. */
export async function featuresTurnStart($: EngineInterface): Promise<void> {
  await streamdeckTurnStart($)
}

/** The main loop's turn ended; `reason` is how (answer, aborted, refusal, error). */
export async function featuresTurnDone($: EngineInterface, reason: string): Promise<void> {
  await streamdeckTurnDone($, reason)
}

/** A permission prompt (or a question asked through one) waits on the user. */
export async function featuresPermission($: EngineInterface, toolName: string): Promise<void> {
  await streamdeckPermission($, toolName)
}

export async function featuresNotification($: EngineInterface, type: string): Promise<void> {
  await streamdeckNotification($, type)
}

/** The main loop stopped; `tasks` is the background work still in flight. */
export async function featuresStop($: EngineInterface, tasks: BgTask[]): Promise<void> {
  await streamdeckStop($, tasks)
}

export async function featuresEnd($: EngineInterface): Promise<void> {
  await streamdeckEnd($)
}

/** Lines for the system prompt. */
export async function featuresPromptLines(_$: EngineInterface): Promise<string[]> {
  return []
}

/** Rows for the band above the prompt, top to bottom. */
export async function featuresRows(_$: EngineInterface, _ui: Ui): Promise<RenderElement[]> {
  return []
}
