import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// The Claude Desktop app's own session files (read only):
// %LOCALAPPDATA%\Claude-Data\claude_*\claude-code-sessions\<account>\<org>\local_<uuid>.json,
// holding the sidebar title, the working folder, the last activity and whether
// the session is archived. The folder names carry app-specific ids, so they are
// found by pattern.

const ROOT = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Claude-Data");
const DIRS_TTL_MS = 30_000;

export type DesktopInfo = { title: string | null; archived: boolean; cwd: string; lastActivityAt: number };

/** One session of the Desktop app's list. */
export type DesktopSession = DesktopInfo & { id: string };

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

/** A session file's facts, read again only when the file changed; null when it is missing. */
function readInfo(file: string): DesktopInfo | null {
	let mtimeMs: number;
	try {
		mtimeMs = statSync(file).mtimeMs;
	} catch {
		return null;
	}
	const hit = cache.get(file);
	if (hit && hit.mtimeMs === mtimeMs) return hit.info;
	try {
		const j = JSON.parse(readFileSync(file, "utf8")) as { title?: unknown; isArchived?: unknown; cwd?: unknown; lastActivityAt?: unknown };
		const info = {
			title: typeof j.title === "string" && j.title.trim() ? j.title.trim() : null,
			archived: j.isArchived === true,
			cwd: typeof j.cwd === "string" ? j.cwd : "",
			lastActivityAt: typeof j.lastActivityAt === "number" ? j.lastActivityAt : mtimeMs,
		};
		cache.set(file, { mtimeMs, info });
		return info;
	} catch {
		return hit?.info ?? { title: null, archived: false, cwd: "", lastActivityAt: mtimeMs };
	}
}

/**
 * The session's title and archived flag; "missing" when the app has no such
 * session; "unknown" when the app's sessions folder can't be found at all.
 */
export function desktopInfo(id: string): DesktopInfo | "missing" | "unknown" {
	const found = sessionDirs();
	if (found.length === 0) return "unknown";
	for (const dir of found) {
		const info = readInfo(path.join(dir, `${id}.json`));
		if (info) return info;
	}
	return "missing";
}

/** Every Code session in the Desktop app that is not archived, most recently active first; empty when the folder can't be found. */
export function desktopSessions(): DesktopSession[] {
	const out: DesktopSession[] = [];
	for (const dir of sessionDirs()) {
		let names: string[];
		try {
			names = readdirSync(dir);
		} catch {
			continue;
		}
		for (const name of names) {
			if (!/^local_[A-Za-z0-9-]{1,64}\.json$/.test(name)) continue;
			const info = readInfo(path.join(dir, name));
			if (info && !info.archived) out.push({ ...info, id: name.slice(0, -".json".length) });
		}
	}
	return out.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}
