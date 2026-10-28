# claude-streamdeck (Claude Notify)

Public repo `McTonnie/claude-streamdeck` (MIT). Two parts that ship together:
- `mod/`: the Claude Code mod pack **mctonnie-mods** ("⚙ McT Mods" button, `/mct-mods`). Its Stream Deck feature writes each Claude Desktop session's state to `~/.claude/streamdeck/sessions/<local_id>.json`. New publishable mods go in here as features (`mod/hooks/features/<name>.ts`, listed in `features/index.ts`). The maintainer's private mods live outside this repo (where: local `docs/notes.md`).
- `streamdeck/`: the Stream Deck plugin **Claude Notify** (`com.mctonnie.claude-notify`), which watches those files.
- `.claude-plugin/marketplace.json` makes the repo a Claude Code marketplace (`mctonnie`).

## Run and test
- Read `docs/DEVELOPMENT.md` (how it works, build, test, release) and the local `docs/notes.md` (git-ignored: history, decisions, personal test notes).
- Plugin: in `streamdeck/`: `npm install`, `npm run build`, `npm run typecheck`, `npx streamdeck validate com.mctonnie.claude-notify.sdPlugin`, `npm run pack` (installer in `streamdeck/dist/`).
- After a plugin build the user must quit and reopen Stream Deck: `streamdeck restart` reports success but doesn't restart the process on this PC, and Claude can't restart the app.
- Mod: `claude plugin validate .` (repo root: marketplace + mod) and `claude plugin validate mod`. Type-check with a tsconfig that includes the engine's `claude-code.d.ts` (see `docs/DEVELOPMENT.md`).

## Working here
- Update `docs/notes.md` at each checkpoint so a fresh chat can pick up from it.
- Nothing personal goes into tracked files: no user paths, no private-mod code.
- Ask before pushing, tagging or publishing a release.
