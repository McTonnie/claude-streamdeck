import type { BusyItem, Item } from "../types";
import { COLORS, cut, esc, svgUrl } from "./key";

// The Stream Deck + touch strip above one dial (200×100): the selected waiting
// session with its kind, age and place in the list, or "All clear".

const FONT = "Segoe UI, Arial, sans-serif";

const KIND_LABEL: Record<string, string> = {
	permission: "permission",
	question: "question",
	plan: "plan approval",
	form: "form",
	ask: "question",
};

/** How the status dial names each kind of waiting. */
const NEEDS_LABEL: Record<string, string> = {
	permission: "Needs approval",
	question: "Asking you",
	plan: "Plan to approve",
	form: "Needs input",
	ask: "Asking you",
};

export function age(since: number, now = Date.now()): string {
	const min = Math.floor(Math.max(0, now - since) / 60_000);
	if (min < 1) return "just now";
	if (min < 60) return `${min} min`;
	const h = Math.floor(min / 60);
	return h < 24 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d`;
}

export function dialImage(item: Item | null, index: number, total: number, bright: boolean): string {
	const parts = [`<rect width="200" height="100" fill="${COLORS.bg}"/>`];
	if (!item) {
		parts.push(`<text x="100" y="58" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${COLORS.idleInk}">All clear</text>`);
	} else {
		const color = item.kind === "needs" ? COLORS.needs : COLORS.finished;
		const what = item.kind === "needs" ? `needs · ${KIND_LABEL[item.needsKind ?? "permission"] ?? "answer"}` : "finished";
		parts.push(`<rect width="200" height="100" fill="${color}" opacity="${bright ? 0.16 : 0.05}"/>`);
		parts.push(`<rect width="8" height="100" fill="${color}" opacity="${bright ? 1 : 0.45}"/>`);
		parts.push(`<text x="18" y="34" font-family="${FONT}" font-weight="700" font-size="20" fill="${COLORS.text}">${esc(cut(item.title, 15))}</text>`);
		parts.push(`<text x="18" y="60" font-family="${FONT}" font-size="15" fill="${color}">${esc(what)}</text>`);
		parts.push(`<text x="18" y="84" font-family="${FONT}" font-size="15" fill="${COLORS.muted}">${age(item.since)}</text>`);
		parts.push(`<text x="190" y="84" text-anchor="end" font-family="${FONT}" font-size="15" fill="${COLORS.muted}">${index + 1} / ${total}</text>`);
	}
	return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">${parts.join("")}</svg>`);
}

/** The status dial: one busy session's title, folder, state and time in it; only needs answer blinks. */
export function statusImage(item: BusyItem | null, index: number, total: number, bright: boolean): string {
	const parts = [`<rect width="200" height="100" fill="${COLORS.bg}"/>`];
	if (!item) {
		parts.push(`<text x="100" y="58" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${COLORS.idleInk}">No busy sessions</text>`);
	} else {
		const color = item.status === "needs" ? COLORS.needs : item.status === "finished" ? COLORS.finished : COLORS.working;
		const state =
			item.status === "needs" ? (NEEDS_LABEL[item.needsKind ?? "permission"] ?? "Needs you") : item.status === "finished" ? "Finished" : "Working";
		const lit = item.status !== "needs" || bright;
		parts.push(`<rect width="200" height="100" fill="${color}" opacity="${lit ? 0.16 : 0.05}"/>`);
		parts.push(`<rect width="8" height="100" fill="${color}" opacity="${lit ? 1 : 0.45}"/>`);
		parts.push(`<text x="18" y="30" font-family="${FONT}" font-weight="700" font-size="19" fill="${COLORS.text}">${esc(cut(item.title, 13))}</text>`);
		parts.push(`<text x="18" y="52" font-family="${FONT}" font-size="14" fill="${COLORS.muted}">${esc(cut(item.folder, 22))}</text>`);
		parts.push(`<text x="18" y="84" font-family="${FONT}" font-weight="600" font-size="15" fill="${color}">${esc(`${state} · ${age(item.since)}`)}</text>`);
		parts.push(`<text x="190" y="30" text-anchor="end" font-family="${FONT}" font-size="14" fill="${COLORS.muted}">${index + 1}/${total}</text>`);
	}
	return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">${parts.join("")}</svg>`);
}
