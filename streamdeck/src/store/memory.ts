import streamDeck from "@elgato/streamdeck";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// What the plugin itself remembers, in its own file beside the state folder
// (the mod never writes it, so the two can't race): which waiting states were
// seen or dismissed, mute, and quiet hours.

const FILE = path.join(os.homedir(), ".claude", "streamdeck", "plugin.json");

export type Quiet = { on: boolean; from: string; to: string };

export type Memory = {
	/** Session id → the `since` of the state that was seen or dismissed. */
	seen: Record<string, number>;
	muted: boolean;
	quiet: Quiet;
};

export const memory: Memory = { seen: {}, muted: false, quiet: { on: false, from: "23:00", to: "08:00" } };

export function loadMemory(): void {
	try {
		const m = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Memory>;
		if (m.seen && typeof m.seen === "object") memory.seen = m.seen;
		memory.muted = m.muted === true;
		if (m.quiet) memory.quiet = { ...memory.quiet, ...m.quiet };
	} catch {}
}

export function saveMemory(): void {
	try {
		mkdirSync(path.dirname(FILE), { recursive: true });
		writeFileSync(FILE, JSON.stringify(memory, null, 2));
	} catch (err) {
		streamDeck.logger.warn(`could not save ${FILE}: ${String(err)}`);
	}
}

const minutes = (hhmm: string): number | null => {
	const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	return h < 24 && min < 60 ? h * 60 + min : null;
};

/** Inside the quiet hours window right now (a window may run past midnight). */
export function inQuietHours(now = new Date()): boolean {
	const q = memory.quiet;
	if (!q.on) return false;
	const from = minutes(q.from);
	const to = minutes(q.to);
	if (from === null || to === null || from === to) return false;
	const t = now.getHours() * 60 + now.getMinutes();
	return from < to ? t >= from && t < to : t >= from || t < to;
}

export const silenced = (): boolean => memory.muted || inQuietHours();
