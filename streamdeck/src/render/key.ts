import type { Item } from "../types";

// Key faces as SVG (144×144, Stream Deck scales them to the device):
// Needs answer = amber "?", Finished = green check, Combined = a diagonal
// split of both. Waiting keys swap between bright and dim; idle ones are grey.

export const COLORS = {
	bg: "#12141a",
	needs: "#f0a64a",
	needsInk: "#1d1408",
	finished: "#74c48a",
	finishedInk: "#0f1f14",
	working: "#7fb2d9",
	idle: "#2b2f39",
	idleInk: "#5b6170",
	text: "#e3e5ea",
	muted: "#8d93a3",
	red: "#e2574c",
};

const FONT = "Segoe UI, Arial, sans-serif";

export const esc = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Cuts a title to about `max` characters, with an ellipsis. */
export const cut = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export const svgUrl = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const QUESTION = (x: number, y: number, size: number, fill: string) =>
	`<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${size}" fill="${fill}">?</text>`;

const CHECK = (cx: number, cy: number, s: number, stroke: string) => {
	const p = (dx: number, dy: number) => `${cx + dx * s},${cy + dy * s}`;
	return `<polyline points="${p(-0.42, 0.02)} ${p(-0.12, 0.32)} ${p(0.44, -0.3)}" fill="none" stroke="${stroke}" stroke-width="${0.17 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const badge = (n: number, fill: string, ink: string) =>
	n > 0
		? `<circle cx="117" cy="27" r="21" fill="${ink}"/><text x="117" y="35" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${n > 9 ? 19 : 24}" fill="${fill}">${n > 99 ? "99+" : n}</text>`
		: "";

const titleBar = (title: string | null, fill: string) =>
	title
		? `<rect y="110" width="144" height="34" fill="${COLORS.bg}" opacity="0.88"/><text x="72" y="134" text-anchor="middle" font-family="${FONT}" font-size="17" fill="${fill}">${esc(cut(title, 13))}</text>`
		: "";

export type KeyFace = {
	type: "needs" | "finished" | "combined";
	needs: number;
	finished: number;
	bright: boolean;
	/** The session the next press opens; null to hide the title line. */
	next: Item | null;
};

export function keyImage(f: KeyFace): string {
	const parts: string[] = [];
	const dim = f.bright ? 1 : 0.38;
	if (f.type === "combined") {
		const n = f.needs > 0;
		const d = f.finished > 0;
		parts.push(`<rect width="144" height="144" fill="${COLORS.bg}"/>`);
		parts.push(`<polygon points="0,0 144,0 0,144" fill="${n ? COLORS.needs : COLORS.idle}" opacity="${n ? dim : 1}"/>`);
		parts.push(`<polygon points="144,0 144,144 0,144" fill="${d ? COLORS.finished : COLORS.idle}" opacity="${d ? dim : 1}"/>`);
		parts.push(QUESTION(42, 70, 52, n ? COLORS.needsInk : COLORS.idleInk));
		parts.push(CHECK(100, 92, 44, d ? COLORS.finishedInk : COLORS.idleInk));
		parts.push(badge(f.needs + f.finished, COLORS.text, COLORS.bg));
	} else {
		const count = f.type === "needs" ? f.needs : f.finished;
		const lit = count > 0;
		const fill = f.type === "needs" ? COLORS.needs : COLORS.finished;
		const ink = f.type === "needs" ? COLORS.needsInk : COLORS.finishedInk;
		parts.push(`<rect width="144" height="144" fill="${COLORS.bg}"/>`);
		parts.push(`<rect width="144" height="144" fill="${lit ? fill : COLORS.idle}" opacity="${lit ? dim : 1}"/>`);
		const y = f.next ? -10 : 0;
		parts.push(
			f.type === "needs"
				? QUESTION(72, 98 + y, 84, lit ? ink : COLORS.idleInk)
				: CHECK(62, 78 + y, 64, lit ? ink : COLORS.idleInk),
		);
		parts.push(badge(count, fill, ink));
	}
	if (f.next) parts.push(titleBar(f.next.title, f.next.kind === "needs" ? COLORS.needs : COLORS.finished));
	return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${parts.join("")}</svg>`);
}

/** The mute key: a speaker, struck through while muted; "QUIET" during quiet hours. */
export function muteImage(muted: boolean, quietNow: boolean): string {
	const ink = muted ? COLORS.red : quietNow ? COLORS.muted : COLORS.text;
	const waves = muted
		? `<path d="M92 54 L124 90 M124 54 L92 90" stroke="${COLORS.red}" stroke-width="9" stroke-linecap="round"/>`
		: `<path d="M94 56 q12 16 0 32 M104 44 q24 28 0 56" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
	const label = muted ? "MUTED" : quietNow ? "QUIET" : "";
	return svgUrl(
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
			`<rect width="144" height="144" fill="${muted ? "#2a1715" : COLORS.idle}"/>` +
			`<path d="M28 58 h20 l28 -24 v76 l-28 -24 h-20 z" fill="${ink}"/>` +
			waves +
			(label ? `<text x="72" y="134" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="18" fill="${ink}">${label}</text>` : "") +
			`</svg>`,
	);
}

/** Breaks text into at most `lines` lines of about `width` characters, the last one cut with an ellipsis. */
function wrap(text: string, width: number, lines: number): string[] {
	const out: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const next = line ? `${line} ${word}` : word;
		if (next.length <= width) {
			line = next;
			continue;
		}
		if (line) out.push(line);
		line = word.length > width ? cut(word, width) : word;
	}
	if (line) out.push(line);
	if (out.length > lines) {
		const kept = out.slice(0, lines);
		kept[lines - 1] = cut(`${kept[lines - 1]} ${out[lines]}`, width);
		return kept;
	}
	return out;
}

export type ShortcutFace = {
	/** The key's text: the user's own label, else the session's title; null before a session is picked. */
	label: string | null;
	/** Status text and colour while the session is busy; null when idle. */
	status: { text: string; color: string } | null;
	/** Dim half of a blink (needs answer only). */
	dim: boolean;
};

/** A Session shortcut key: its label, and a coloured status band along the bottom while the session is busy. */
export function shortcutImage(f: ShortcutFace): string {
	const parts = [`<rect width="144" height="144" fill="${COLORS.idle}"/>`];
	if (!f.label) {
		parts.push(`<text x="72" y="66" text-anchor="middle" font-family="${FONT}" font-size="19" fill="${COLORS.muted}">Pick a</text>`);
		parts.push(`<text x="72" y="90" text-anchor="middle" font-family="${FONT}" font-size="19" fill="${COLORS.muted}">session</text>`);
	} else {
		const lines = wrap(f.label, 11, 3);
		const top = (f.status ? 60 : 76) - (lines.length - 1) * 13;
		lines.forEach((l, i) =>
			parts.push(`<text x="72" y="${top + i * 26}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="21" fill="${COLORS.text}">${esc(l)}</text>`),
		);
	}
	if (f.status) {
		parts.push(`<rect y="106" width="144" height="38" fill="${f.status.color}" opacity="${f.dim ? 0.35 : 1}"/>`);
		parts.push(`<text x="72" y="132" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="18" fill="${COLORS.bg}">${esc(f.status.text)}</text>`);
	}
	return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${parts.join("")}</svg>`);
}
