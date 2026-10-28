import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SdState } from '../../types'
import { C, get } from '../feature'
import type { Feature, ToolCall } from '../feature'

// STREAM DECK: tells the Claude Notify Stream Deck plugin (streamdeck/ in this
// repository) what this Desktop session is doing. One JSON file per session in
// ~/.claude/streamdeck/sessions/<local_id>.json, rewritten on each change; the
// plugin watches the folder. Desktop sessions only: only they can be opened by link.

const DIR = '.claude/streamdeck/sessions'
/** Tools that wait on the user's answer, and the kind each one is. */
const ASKING: Record<string, SdState['kind']> = { AskUserQuestion: 'question', ExitPlanMode: 'plan' }
const WRAP_UP = 'mcp__ccd_turn__wrap_up'
/** Background task types that watch for events for the whole session (a live artifact link, a log tail) rather than doing work that ends. */
const WATCHERS = /monitor/i

/** A background task as the Stop event lists it. */
export type BgTask = { type: string; status: string; description: string }

const sd = atom({ plugin: 'mctonnie-mods', key: 'sd' } as const, null as SdState | null)
/** The Desktop next-step box of this turn asked the user something. */
const asked = atom({ plugin: 'mctonnie-mods', key: 'sdAsked' } as const, false)
/** This session's own process id, so the plugin can tell a dead session; null when unknown. */
const pid = atom({ plugin: 'mctonnie-mods', key: 'sdPid' } as const, null as number | null)

export const streamdeck: Feature = {
  id: 'streamdeck',
  label: 'Stream Deck',
  settings: [
    {
      key: 'report',
      label: 'Report session states to the Claude Notify plugin',
      options: [
        { value: 'on', label: 'On', color: C.GREEN },
        { value: 'off', label: 'Off' },
      ],
      default: 'on',
    },
  ],
}

/** The file of this session, or null outside a Desktop session or when switched off. */
async function fileOf($: EngineInterface): Promise<string | null> {
  if ((await get($, streamdeck, 'report')) === 'off') return null
  if ((await $.env.get('CLAUDE_CODE_ENTRYPOINT')) !== 'claude-desktop') return null
  const id = await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')
  const home = await $.env.get('USERPROFILE')
  if (!id || !/^local_[A-Za-z0-9-]+$/.test(id) || !home) return null
  return `${home.replace(/\\/g, '/')}/${DIR}/${id}.json`
}

/** Moves this session to `state`; the file is rewritten only when something changed. */
async function setState($: EngineInterface, state: SdState['state'], kind: SdState['kind'] = null, ended = false, bg: string[] = []): Promise<void> {
  const file = await fileOf($)
  if (!file) return
  const old = await read($, sd)
  if (old && old.state === state && old.kind === kind && old.ended === ended && (old.bg ?? []).join('\n') === bg.join('\n')) return
  const now = await $.clock.now()
  const next: SdState = {
    v: 1,
    id: file.slice(file.lastIndexOf('/') + 1, -'.json'.length),
    cliId: await $.session.id(),
    pid: await read($, pid),
    cwd: await $.session.cwd(),
    state,
    kind,
    since: old && old.state === state && old.kind === kind ? old.since : now,
    ended,
    updatedAt: now,
    ...(bg.length > 0 ? { bg } : {}),
  }
  await update($, sd, () => next)
  await $.fs.write(file, JSON.stringify(next, null, 2))
}

/** The parent of a child process is this session's claude.exe (CLAUDE_PID is set for children only, so a session started from another session would read its parent's). */
async function ownPid($: EngineInterface): Promise<number | null> {
  try {
    const r = await $.process.run([
      'powershell.exe',
      '-NoProfile',
      '-Command',
      '(Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId',
    ])
    const n = Number(r.stdout.trim())
    return r.exitCode === 0 && Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** A new or resumed session: keep what the file says (a finished task stays finished), else idle. */
export async function streamdeckStart($: EngineInterface): Promise<void> {
  const file = await fileOf($)
  if (!file) return
  if ((await read($, pid)) === null) {
    const found = await ownPid($)
    await update($, pid, () => found)
  }
  let kept: SdState | null = null
  try {
    const parsed = JSON.parse(String(await $.fs.read(file))) as SdState
    if (parsed?.v === 1) kept = parsed
  } catch {}
  // A needs state can't outlive the process that was asking.
  if (kept && kept.state === 'finished') {
    await update($, sd, () => ({ ...kept, ended: true }))
    await setState($, 'finished', null, false)
  } else {
    await setState($, 'idle')
  }
}

export async function streamdeckTurnStart($: EngineInterface): Promise<void> {
  await update($, asked, () => false)
  await setState($, 'working')
}

/** A permission prompt or a question is up: tool_name tells which kind. */
export async function streamdeckPermission($: EngineInterface, toolName: string): Promise<void> {
  await setState($, 'needs', ASKING[toolName] ?? 'permission')
}

export async function streamdeckNotification($: EngineInterface, type: string): Promise<void> {
  // This notice also follows a question asked through a prompt: keep the kind already known.
  if (type === 'permission_prompt') {
    if ((await read($, sd))?.state !== 'needs') await setState($, 'needs', 'permission')
  }
  else if (type === 'elicitation_dialog') await setState($, 'needs', 'form')
}

export async function streamdeckBeforeTool($: EngineInterface, call: ToolCall): Promise<void> {
  const kind = ASKING[call.tool]
  if (kind) await setState($, 'needs', kind)
  if (call.tool === WRAP_UP && typeof call.ask === 'string' && call.ask.trim()) await update($, asked, () => true)
}

/** The tool went on (answered, allowed or denied): the session works again. */
export async function streamdeckAfterTool($: EngineInterface, call: ToolCall): Promise<void> {
  if (call.tool === WRAP_UP) return
  if ((await read($, sd))?.state === 'needs') await setState($, 'working')
}

/**
 * The turn ended: finished only when no background work (a command, a subagent,
 * a workflow, a side session) is left to wake it. Watchers don't count; what
 * still runs is written to the file as `bg`, to see why a session stays working.
 */
export async function streamdeckStop($: EngineInterface, tasks: BgTask[]): Promise<void> {
  const work = tasks.filter(t => !WATCHERS.test(t.type) && !/^(completed|failed|killed|stopped|cancell?ed|done)$/i.test(t.status))
  if (work.length > 0) return setState($, 'working', null, false, work.map(t => `${t.type} ${t.status}: ${t.description.slice(0, 80)}`))
  if (await read($, asked)) return setState($, 'needs', 'ask')
  await setState($, 'finished')
}

/** A turn that was interrupted, refused or died on an error: no Stop follows, and nothing runs any more. */
export async function streamdeckTurnDone($: EngineInterface, reason: string): Promise<void> {
  if (reason === 'answer') return
  if ((await read($, sd))?.state === 'working') await setState($, 'idle')
}

export async function streamdeckEnd($: EngineInterface): Promise<void> {
  const s = await read($, sd)
  await setState($, s?.state ?? 'working', s?.kind ?? null, true)
}
