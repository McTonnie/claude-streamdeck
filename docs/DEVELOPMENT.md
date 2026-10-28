# Development

How Claude Notify is built, and how to change, test and release it.

## Layout

```text
.claude-plugin/marketplace.json   makes this repo a Claude Code marketplace ("mctonnie")
mod/                              Claude Code mod pack "mctonnie-mods"
  .claude-plugin/plugin.json
  hooks/hooks.json                → register.tsx
  hooks/register.tsx              events → features; McT Mods button, /mct-mods, settings panel
  hooks/feature.ts                Feature type, settings storage, colours
  hooks/features/index.ts         the list of features and what each event calls
  hooks/features/streamdeck.ts    the Stream Deck feature: writes the state files
  types/index.d.ts                state contract (SdState, the pack's $.state values)
streamdeck/                       Stream Deck plugin "Claude Notify"
  src/plugin.ts                   registers the actions, starts the hub
  src/hub.ts                      queues, arrivals, presses, blink, sound choice, reminders
  src/store/states.ts             reads and watches the state files
  src/store/desktop.ts            titles and archived flag from the Desktop app's session files
  src/store/memory.ts             seen list, mute, quiet hours (~/.claude/streamdeck/plugin.json)
  src/render/key.ts, dial.ts      SVG key faces and the touch-strip canvas
  src/sound/player.ts             one hidden PowerShell with WPF MediaPlayer plays the chimes
  src/open.ts                     opens claude://code/continue?session=… via rundll32
  src/actions/                    needs / finished / combined keys, mute, session-browser dial
  scripts/                        make-sounds.mjs, make-icons.mjs, make-plugin-icon.ps1
  com.mctonnie.claude-notify.sdPlugin/   manifest, images, sounds, settings pages, dial layout
```

## The state file (the contract between the two parts)

`~/.claude/streamdeck/sessions/<local_id>.json`, written only by the mod and rewritten on every change:

```json
{
  "v": 1,
  "id": "local_<uuid>",
  "cliId": "<Claude Code session uuid>",
  "pid": 12345,
  "cwd": "C:\\path\\to\\project",
  "state": "working | needs | finished",
  "kind": "permission | question | plan | form | ask | null",
  "since": 1790000000000,
  "ended": false,
  "updatedAt": 1790000000000,
  "bg": ["shell running: npm test"]
}
```

`since` changes whenever the state or kind changes. The plugin hides an item once its `id` + `since` pair is marked seen, so a new event lights the key again. `bg` is there only when background work kept a session from counting as finished.

### Which Claude event sets which state (mod)

| Event | State |
| --- | --- |
| `turn.start` (main loop) | `working` |
| `classic.PermissionRequest` | `needs`: `question` for AskUserQuestion, `plan` for ExitPlanMode, else `permission` |
| `classic.Notification` `permission_prompt` | `needs` / `permission`, unless already `needs` |
| `classic.Notification` `elicitation_dialog` | `needs` / `form` |
| `tool.call` AskUserQuestion / ExitPlanMode (before) | `needs` / `question` or `plan`. After the call returns: `working` |
| `tool.call` `mcp__ccd_turn__wrap_up` with an `ask` | remembered; the turn's Stop becomes `needs` / `ask` |
| `classic.Stop` | `working` if non-watcher background tasks still run, else `needs` / `ask` or `finished` |
| `session.end` | `ended: true` |

Only Desktop sessions write a file (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, id from `CLAUDE_CODE_HOST_SESSION_ID`). The mod reads its own `claude.exe` process id once at session start through PowerShell (`CLAUDE_PID` is meant for child processes).

### What the plugin drops

`working` sessions; `needs` whose process is gone or that has `ended`; sessions archived in the Desktop app or missing from its session list. A `finished` session stays until it's opened from the deck, dismissed, replied to or archived.

## Build and run

Node 24 and the Stream Deck app (7.1+) on Windows.

```bash
cd streamdeck
npm install
npm run build          # rollup → com.mctonnie.claude-notify.sdPlugin/bin/plugin.js
npm run typecheck
npx streamdeck validate com.mctonnie.claude-notify.sdPlugin
```

To run your local build in Stream Deck:

```bash
npx streamdeck dev     # once: developer mode
npx streamdeck link com.mctonnie.claude-notify.sdPlugin
```

Then quit and reopen Stream Deck. After later builds, `npx streamdeck restart com.mctonnie.claude-notify` should reload the plugin. On some setups it reports success without restarting; if so, restart the Stream Deck app. The plugin logs `env: …` at start, so you can see which build is running. Logs: `com.mctonnie.claude-notify.sdPlugin/logs/`.

Regenerate assets: `npm run sounds` (the three chimes) and `npm run icons` (SVG images + PNG plugin icon).

### Running the mod from this folder

Don't install the marketplace copy at the same time, or both copies will write the same files. Instead, start Claude Code with the folder:

```bash
claude --plugin-dir ./mod
```

Or list the folder in `CLAUDE_CODE_PLUGIN_DIRS`. The mod loads at session start.

Validate and type-check:

```bash
claude plugin validate .
```

```bash
claude plugin validate mod
```

For a type check, use a `tsconfig.json` with the options from the header of the engine's `claude-code.d.ts` (Claude Code writes it to `mod/.claude-plugin/types/` once it has loaded the mod from a folder you own), including `mod/hooks` and `mod/types`, then run `tsc -p <that tsconfig>`.

A headless check that a turn ends as `finished`:

```bash
CLAUDE_CODE_ENTRYPOINT=claude-desktop CLAUDE_CODE_HOST_SESSION_ID=local_test-1 claude --plugin-dir ./mod -p "Reply with just ok."
```

Then read `~/.claude/streamdeck/sessions/local_test-1.json` and delete it afterwards. The plugin ignores it anyway, because the Desktop app has no such session.

## Adding another mod to the pack

1. Write `mod/hooks/features/<name>.ts`, exporting its `Feature` (`id`, `label`, `settings`) and its parts as plain `export async function`s.
2. List it in `FEATURES` in `features/index.ts` and call its parts from the `features*` functions there (start, before/after tool, turn start, stop, rows, prompt lines…). Its settings then show in the McT Mods panel.
3. Declare any `$.state` values it keeps in `mod/types/index.d.ts` under `'mctonnie-mods'`.
4. Bump `version` in `mod/.claude-plugin/plugin.json`, validate, and describe it in the README.

## Testing by hand

1. Ask a new Desktop session for something that needs your approval: Needs answer + Combined (amber) blink and chime; press → that session opens; approve → the key goes out.
2. A question menu and a plan approval light the same way.
3. Let a turn finish: Finished + Combined (green) blink with a ding; press → it opens and goes out.
4. Two waiting sessions: presses alternate between them; Combined opens needs first.
5. Hold a lit key about 1 s: everything on it is dismissed.
6. Dial: turn, press or tap, long touch.
7. Mute (no sound, keys still blink); quiet hours around the current time shows `QUIET`.
8. Key settings: change sound or volume (a preview plays), your own file, a 2-minute reminder.
9. Archive a finished session: it drops off within about 30 s.

## Release

1. Bump versions: `streamdeck/com.mctonnie.claude-notify.sdPlugin/manifest.json` (`Version`, four parts), `streamdeck/package.json`, and `mod/.claude-plugin/plugin.json` if the mod changed.
2. `cd streamdeck && npm run pack` → `streamdeck/dist/com.mctonnie.claude-notify.streamDeckPlugin`.
3. Commit, tag `vX.Y.Z`, push, and attach the installer to a GitHub release with exactly that file name. The README's install prompt downloads `releases/latest/download/com.mctonnie.claude-notify.streamDeckPlugin`.
