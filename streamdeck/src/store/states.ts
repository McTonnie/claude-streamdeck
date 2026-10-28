import streamDeck from "@elgato/streamdeck";
import { mkdirSync, readdirSync, readFileSync, watch } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SessionState } from "../types";

// The state files the mctonnie-mods Stream Deck feature writes, one per Desktop session. The folder is
// watched, and read again every few seconds in case a change event was lost.

export const STATE_DIR = path.join(os.homedir(), ".claude", "streamdeck", "sessions");
const RESCAN_MS = 5_000;
const DEBOUNCE_MS = 120;

const STATES = new Set(["working", "needs", "finished"]);
const KINDS = new Set([null, "permission", "question", "plan", "form", "ask"]);

function parse(text: string): SessionState | null {
	const s = JSON.parse(text) as Partial<SessionState>;
	if (s?.v !== 1 || typeof s.id !== "string" || !/^local_[A-Za-z0-9-]{1,64}$/.test(s.id)) return null;
	if (!STATES.has(s.state ?? "") || !KINDS.has(s.kind ?? null) || typeof s.since !== "number") return null;
	return {
		v: 1,
		id: s.id,
		cliId: String(s.cliId ?? ""),
		pid: typeof s.pid === "number" ? s.pid : null,
		cwd: String(s.cwd ?? ""),
		state: s.state!,
		kind: s.kind ?? null,
		since: s.since,
		ended: s.ended === true,
		updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : s.since,
	};
}

/** Every valid state file; a file being written or broken is skipped this time. */
export function readStates(): SessionState[] {
	let names: string[];
	try {
		names = readdirSync(STATE_DIR);
	} catch {
		return [];
	}
	const out: SessionState[] = [];
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		try {
			const s = parse(readFileSync(path.join(STATE_DIR, name), "utf8"));
			if (s) out.push(s);
		} catch (err) {
			streamDeck.logger.debug(`state file skipped: ${name}: ${String(err)}`);
		}
	}
	return out;
}

export function watchStates(onChange: () => void): void {
	mkdirSync(STATE_DIR, { recursive: true });
	let timer: NodeJS.Timeout | undefined;
	const soon = () => {
		clearTimeout(timer);
		timer = setTimeout(onChange, DEBOUNCE_MS);
	};
	try {
		watch(STATE_DIR, soon).on("error", (err) => streamDeck.logger.warn(`watch failed: ${String(err)}`));
	} catch (err) {
		streamDeck.logger.warn(`watch failed, rescanning only: ${String(err)}`);
	}
	setInterval(onChange, RESCAN_MS);
}
