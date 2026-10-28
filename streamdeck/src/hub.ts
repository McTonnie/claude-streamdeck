import streamDeck from "@elgato/streamdeck";
import path from "node:path";

import { openSession } from "./open";
import { type Chime, play, soundFile, warmUp } from "./sound/player";
import { desktopInfo } from "./store/desktop";
import { loadMemory, memory, saveMemory, silenced } from "./store/memory";
import { readStates, watchStates } from "./store/states";
import type { BusyItem, ComboSettings, Item, Kind, KeySettings, SessionState } from "./types";

// The plugin's one source of truth: the waiting sessions in two queues, which
// keys are on screen with which settings, the blink phase, presses, and the
// sounds. Actions draw from it and tell it what was pressed.

export type ActionType = "needs" | "finished" | "combined" | "mute" | "browser" | "status";
type Visible = { type: ActionType; settings: Record<string, unknown> };

const BLINK_MS = 500;
const REMINDER_CHECK_MS = 30_000;

function alive(pid: number | null): boolean {
	if (pid === null) return true;
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === "EPERM";
	}
}

/**
 * The busy session a state file stands for, or null when it should be dropped:
 * idle, seen, archived or gone from the Desktop app, or (working and needs alike)
 * its process ended. A finished task stays until seen, its process or not.
 */
function toBusy(s: SessionState): BusyItem | null {
	if (s.state === "idle" || memory.seen[s.id] === s.since) return null;
	if (s.state !== "finished" && (s.ended || !alive(s.pid))) return null;
	const info = desktopInfo(s.id);
	if (info === "missing" || (info !== "unknown" && info.archived)) return null;
	const folder = path.basename(s.cwd);
	const title = (info !== "unknown" && info.title) || folder || "Claude";
	return { id: s.id, status: s.state, needsKind: s.kind, since: s.since, title, folder };
}

/** The waiting item (needs answer or finished) a busy session stands for. */
const toItem = (b: BusyItem): Item | null =>
	b.status === "working" ? null : { id: b.id, kind: b.status, needsKind: b.needsKind, since: b.since, title: b.title };

class Hub {
	needs: Item[] = [];
	finished: Item[] = [];
	/** Every busy session (working, needs answer, finished and not seen), most recent change first. */
	busy: BusyItem[] = [];
	/** Bright or dim half of the blink. */
	bright = true;

	private visible = new Map<string, Visible>();
	private cursors = new Map<string, number>();
	private known = new Set<string>();
	private started = false;
	private lastChime: Record<Kind, number> = { needs: 0, finished: 0 };
	private drawers = new Set<() => void>();

	start(): void {
		loadMemory();
		this.refresh();
		this.started = true;
		watchStates(() => this.refresh());
		setInterval(() => {
			this.bright = !this.bright;
			if (this.needs.length + this.finished.length > 0) this.draw();
		}, BLINK_MS);
		setInterval(() => this.remind(), REMINDER_CHECK_MS);
		warmUp();
	}

	/** Calls `fn` whenever what the keys show may have changed. */
	onDraw(fn: () => void): void {
		this.drawers.add(fn);
	}

	draw(): void {
		for (const fn of this.drawers) {
			try {
				fn();
			} catch (err) {
				streamDeck.logger.error(`draw failed: ${String(err)}`);
			}
		}
	}

	/** Reads the state files again, chimes for new waiting states, redraws. */
	refresh(): void {
		const states = readStates();
		this.busy = states
			.map(toBusy)
			.filter((b): b is BusyItem => b !== null)
			.sort((a, b) => b.since - a.since);
		const items = this.busy.map(toItem).filter((i): i is Item => i !== null);
		const bySince = (a: Item, b: Item) => a.since - b.since;
		this.needs = items.filter((i) => i.kind === "needs").sort(bySince);
		this.finished = items.filter((i) => i.kind === "finished").sort(bySince);

		const keys = new Set(items.map((i) => `${i.id}|${i.kind}|${i.since}`));
		if (this.started) {
			const arrived = items.filter((i) => !this.known.has(`${i.id}|${i.kind}|${i.since}`));
			if (arrived.some((i) => i.kind === "needs")) this.chime("needs", false);
			if (arrived.some((i) => i.kind === "finished")) this.chime("finished", false);
		}
		this.known = keys;

		// Forget seen marks whose session file is gone.
		const ids = new Set(states.map((s) => s.id));
		let pruned = false;
		for (const id of Object.keys(memory.seen)) {
			if (!ids.has(id)) {
				delete memory.seen[id];
				pruned = true;
			}
		}
		if (pruned) saveMemory();
		this.draw();
	}

	/** The queue a key of this type works through: needs first, then finished. */
	list(type: ActionType): Item[] {
		if (type === "needs") return this.needs;
		if (type === "finished") return this.finished;
		return [...this.needs, ...this.finished];
	}

	/** The item the next press of this key opens. */
	next(actionId: string, type: ActionType): Item | null {
		const list = this.list(type);
		if (list.length === 0) return null;
		return list[(this.cursors.get(actionId) ?? 0) % list.length] ?? null;
	}

	/** Opens the next item (or the last used session), moving this key on. */
	press(actionId: string, type: ActionType): void {
		const list = this.list(type);
		if (list.length === 0) {
			openSession(null);
			return;
		}
		const at = (this.cursors.get(actionId) ?? 0) % list.length;
		const item = list[at]!;
		openSession(item.id);
		if (item.kind === "finished") {
			// Opened from the deck counts as seen; the next item moves into this place.
			this.cursors.set(actionId, at);
			this.markSeen([item]);
		} else {
			this.cursors.set(actionId, at + 1);
			this.draw();
		}
	}

	/** Opens one item (the dial's selection). */
	open(item: Item | null): void {
		openSession(item?.id ?? null);
		if (item?.kind === "finished") this.markSeen([item]);
	}

	/** Opens a busy session (the status dial's selection); a finished one counts as seen. */
	openBusy(item: BusyItem | null): void {
		openSession(item?.id ?? null);
		if (item?.status === "finished") this.markSeen([item]);
	}

	/** Hides these items until their session changes state again. */
	markSeen(items: { id: string; since: number }[]): void {
		if (items.length === 0) return;
		for (const i of items) memory.seen[i.id] = i.since;
		saveMemory();
		this.refresh();
	}

	setMuted(muted: boolean): void {
		memory.muted = muted;
		saveMemory();
		this.draw();
	}

	// --- Keys on screen and their settings -------------------------------------

	show(actionId: string, type: ActionType, settings: Record<string, unknown>): void {
		this.visible.set(actionId, { type, settings });
	}

	hide(actionId: string): void {
		this.visible.delete(actionId);
	}

	/** The settings a kind's sound comes from: a dedicated key, else Combined, else the dial. */
	private source(kind: Kind): Visible | null {
		const all = [...this.visible.values()];
		return (
			all.find((v) => v.type === kind) ??
			all.find((v) => v.type === "combined") ??
			all.find((v) => v.type === "browser") ??
			null
		);
	}

	/** The main chime file and volume for a kind, from those settings. */
	sound(kind: Kind, v: Visible): { file: string; volume: number } {
		if (v.type === "needs" || v.type === "finished") {
			const s = v.settings as KeySettings;
			return { file: soundFile(s.sound, s.soundFile, kind), volume: Number(s.volume ?? 70) };
		}
		const s = v.settings as ComboSettings;
		const choice = kind === "needs" ? s.needsSound : s.finishedSound;
		const custom = kind === "needs" ? s.needsFile : s.finishedFile;
		return { file: soundFile(choice, custom, kind), volume: Number(s.volume ?? 70) };
	}

	/** One chime per event, whichever keys show it. */
	private chime(kind: Kind, reminder: boolean): void {
		this.lastChime[kind] = Date.now();
		if (silenced()) return;
		const v = this.source(kind);
		if (!v) return;
		const main = this.sound(kind, v);
		const s = v.settings as KeySettings & ComboSettings;
		const file = reminder && s.reminderSound !== "main" ? soundFile("reminder", undefined, "reminder" as Chime) : main.file;
		play(file, main.volume);
	}

	/** Repeats a kind's chime every N minutes (the source key's setting) while something still waits. */
	private remind(): void {
		for (const kind of ["needs", "finished"] as const) {
			if (this.list(kind).length === 0) continue;
			const v = this.source(kind);
			// The dial reminds only when asked to; keys every 5 minutes unless set otherwise.
			const every = Number((v?.settings as KeySettings | undefined)?.reminder ?? (v?.type === "browser" ? "0" : "5"));
			if (!v || !(every > 0)) continue;
			if (Date.now() - this.lastChime[kind] >= every * 60_000) this.chime(kind, true);
		}
	}
}

export const hub = new Hub();
