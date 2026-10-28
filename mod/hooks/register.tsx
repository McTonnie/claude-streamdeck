import type { Register } from 'claude-code'

import { C, get, load, set } from './feature'
import type { ToolCall } from './feature'
import {
  FEATURES,
  featuresAfterTool,
  featuresBeforeTool,
  featuresEnd,
  featuresNotification,
  featuresPermission,
  featuresPromptLines,
  featuresRows,
  featuresStart,
  featuresStop,
  featuresTurnDone,
  featuresTurnStart,
} from './features'

// mctonnie-mods: McTonnie's published mods in one plugin. A "McT Mods" button in
// the prompt footer (and /mct-mods) opens a panel with every feature's settings;
// a feature's row, if it has one, goes in the band above the prompt.

const PANE = 'mctonnie-mods-settings'
const TITLE = 'McT Mods settings'
const COMMAND = 'mct-mods'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await load($)
    await $.command.register({ name: COMMAND, description: 'Open the settings of the McT Mods pack (Stream Deck notifications and more)' })
    await featuresStart($)
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'McT Mods settings opened.' }
  })

  // Any feature may refuse a call before it runs; each hears it after.
  on('tool.call', async ($, e, next) => {
    const call = e as unknown as ToolCall
    const reason = await featuresBeforeTool($, call)
    if (reason) return { deny: reason }
    const r = await next(e)
    // A feature that fails here only loses its own note; it never fails the call.
    try {
      await featuresAfterTool($, call)
    } catch {}
    return r
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) await featuresTurnDone($, e.reason)
    return r
  })

  // What the session is doing, for features that report it (Stream Deck).
  // These only listen: a failing feature never changes the engine's answer.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      try {
        await featuresTurnStart($)
      } catch {}
    }
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      await featuresPermission($, e.tool_name)
    } catch {}
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.Notification', async ($, e, next) => {
    try {
      await featuresNotification($, e.notification_type)
    } catch {}
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.Stop', async ($, e, next) => {
    try {
      await featuresStop($, e.background_tasks ?? [])
    } catch {}
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    try {
      await featuresEnd($)
    } catch {}
    return next(e)
  })

  // One system prompt section holding each feature's line.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const lines = await featuresPromptLines($)
    if (lines.length === 0) return r
    return { sections: [...r.sections, { id: 'mctonnie-mods:lines', text: lines.join('\n\n'), scope: 'session' }] }
  })

  // The footer, right of the prompt: a small McT Mods button beside the engine's labels.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const below = await next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center">
        {below}
        <Button key="mct-mods" label="⚙ McT Mods" plain onPress={() => void $.ui.open({ id: PANE, title: TITLE })} />
      </Box>
    )
  })

  // The band: whatever sits beneath first, then each feature's row.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const ui = $.ui.resolve(e)
    const rows = await featuresRows($, ui)
    if (rows.length === 0) return below
    const { Box } = ui
    return (
      <Box flexDirection="column" backgroundColor={C.BG}>
        {below}
        {rows}
      </Box>
    )
  })

  // The panel: one block per feature, one line of choices per setting.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const blocks = []
    for (const f of FEATURES) {
      if (f.settings.length === 0) continue
      const lines = []
      for (const s of f.settings) {
        const now = await get($, f, s.key)
        lines.push(
          <Box key={`${f.id}.${s.key}`} flexDirection="column" marginBottom={1}>
            <Text color={C.MUTED}>{s.label}</Text>
            <Box flexDirection="row">
              {s.options.map(o =>
                o.value === now ? (
                  <Text key={`${f.id}.${s.key}.${o.value}`} backgroundColor={o.color ?? C.TEXT} color={C.INK} bold>{` ${o.label} `}</Text>
                ) : (
                  <Button key={`${f.id}.${s.key}.${o.value}`} label={o.label} onPress={() => set($, f, s.key, o.value)} />
                ),
              )}
            </Box>
          </Box>,
        )
      }
      blocks.push(
        <Box key={f.id} flexDirection="column" marginBottom={1}>
          <Text color={C.TEXT} bold>{f.label.toUpperCase()}</Text>
          {lines}
        </Box>,
      )
    }
    return (
      <Box flexDirection="column" backgroundColor={C.BG} paddingX={1}>
        {blocks}
      </Box>
    )
  })
}
