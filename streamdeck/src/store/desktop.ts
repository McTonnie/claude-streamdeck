import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// The Claude Desktop app's own session files (read only):
// %LOCALAPPDATA%\Claude-Data\claude_*\claude-code-sessions\<account>\<org>\local_<uuid>.json,
// holding the sidebar title and whether the session is archived. The folder
// names carry app-specific ids, so they are found by pattern.

const ROOT = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Claude-Data");
const DIRS_TTL_MS = 30_000;

export type DesktopInfo = { title: string | null; archived: boolean };

let dirs: string[] = [];
let dirsAt = 0;
const cache = new Map<string, { mtimeMs: number; info: DesktopInfo }>();

const subdirs = (dir: string): string[] => {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => path.join(dir, d.name));
	} catch {
		return [];
	}
};

function sessionDirs(): string[] {
	if (Date.now() - dirsAt < DIRS_TTL_MS) return dirs;
	dirsAt = Date.now();
	dirs = subdirs(ROOT)
		.filter((d) => path.basename(d).startsWith("claude_"))
		.flatMap((d) => subdirs(path.join(d, "claude-code-sessions")))
		.flatMap(subdirs);
	return dirs;
}

/**
 * The session's title and archived flag; "missing" when the app has no such
 * session; "unknown" when the app's sessions folder can't be found at all.
 */
export function desktopInfo(id: string): DesktopInfo | "missing" | "unknown" {
	const found = sessionDirs();
	if (found.length === 0) return "unknown";
	for (const dir of found) {
		const file = path.join(dir, `${id}.json`);
		let mtimeMs: number;
		try {
			mtimeMs = statSync(file).mtimeMs;
		} catch {
			continue;
		}
		const hit = cache.get(file);
		if (hit && hit.mtimeMs === mtimeMs) return hit.info;
		try {
			const j = JSON.parse(readFileSync(file, "utf8")) as { title?: unknown; isArchived?: unknown };
			const info = { title: typeof j.title === "string" && j.title.trim() ? j.title.trim() : null, archived: j.isArchived === true };
			cache.set(file, { mtimeMs, info });
			return info;
		} catch {
			return hit?.info ?? { title: null, archived: false };
		}
	}
	return "missing";
}
