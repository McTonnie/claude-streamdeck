/** Every feature's settings, `<feature>.<setting>` to the chosen option's value. */
export type Settings = Record<string, string>

/** What the STREAM DECK feature writes to ~/.claude/streamdeck/sessions/<id>.json for the Claude Notify plugin. */
export type SdState = {
  v: 1
  /** The Desktop session id, `local_<uuid>`. */
  id: string
  cliId: string
  pid: number | null
  cwd: string
  /** idle: open with no turn running; working: a turn or its background work runs. */
  state: 'idle' | 'working' | 'needs' | 'finished'
  kind: 'permission' | 'question' | 'plan' | 'form' | 'ask' | null
  /** When this state (and kind) began, ms. */
  since: number
  /** The session's process has ended. */
  ended: boolean
  updatedAt: number
  /** Background work that kept the session from counting as finished, for diagnosis. */
  bg?: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'mctonnie-mods': { settings: Settings; sd: SdState | null; sdAsked: boolean; sdPid: number | null }
  }
}
