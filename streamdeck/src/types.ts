/** What the mod pack's Stream Deck feature writes per Desktop session (its `SdState`, see mod/types), version 1. */
export type SessionState = {
	v: 1;
	id: string;
	cliId: string;
	pid: number | null;
	cwd: string;
	/** idle: open with no turn running (never shown); working: a turn or its background work runs. */
	state: "idle" | "working" | "needs" | "finished";
	kind: NeedsKind | null;
	since: number;
	ended: boolean;
	updatedAt: number;
};

export type NeedsKind = "permission" | "question" | "plan" | "form" | "ask";

/** The two things a key can wait for. */
export type Kind = "needs" | "finished";

/** One waiting session, as the keys and the dial show it. */
export type Item = {
	id: string;
	kind: Kind;
	needsKind: NeedsKind | null;
	since: number;
	title: string;
};

/** One busy session, as the status dial shows it: working, needs answer, or finished and not seen. */
export type BusyItem = {
	id: string;
	status: "working" | Kind;
	needsKind: NeedsKind | null;
	since: number;
	title: string;
	/** The project folder's name. */
	folder: string;
};

/** Settings of the Needs answer and Finished keys. */
export type KeySettings = {
	sound?: string;
	soundFile?: string;
	volume?: number;
	reminder?: string;
	reminderSound?: string;
	showTitle?: boolean;
};

/** Settings of the Combined key and the dial: one sound per kind. */
export type ComboSettings = {
	needsSound?: string;
	needsFile?: string;
	finishedSound?: string;
	finishedFile?: string;
	volume?: number;
	reminder?: string;
	reminderSound?: string;
	showTitle?: boolean;
};

export type MuteSettings = {
	quietOn?: boolean;
	quietFrom?: string;
	quietTo?: string;
};
