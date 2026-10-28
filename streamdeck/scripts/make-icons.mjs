// Writes the plugin's static images as SVG: list icons (white line art, as
// Stream Deck tints them), default key faces, and the plugin and category icons.
// Run with `npm run icons`.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../com.mctonnie.claude-notify.sdPlugin/imgs");
const AMBER = "#f0a64a";
const GREEN = "#74c48a";
const IDLE = "#2b2f39";
const IDLE_INK = "#5b6170";
const BG = "#12141a";
const FONT = "Segoe UI, Arial, sans-serif";

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
const q = (x, y, s, fill) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${s}" fill="${fill}">?</text>`;
const check = (cx, cy, s, stroke) =>
	`<polyline points="${cx - 0.42 * s},${cy + 0.02 * s} ${cx - 0.12 * s},${cy + 0.32 * s} ${cx + 0.44 * s},${cy - 0.3 * s}" fill="none" stroke="${stroke}" stroke-width="${0.17 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
const speaker = (fill) => `<path d="M28 58 h20 l28 -24 v76 l-28 -24 h-20 z" fill="${fill}"/><path d="M94 56 q12 16 0 32 M104 44 q24 28 0 56" stroke="${fill}" stroke-width="7" fill="none" stroke-linecap="round"/>`;

/** 144 px faces, the list icons drawn from them in white at 20 px scale. */
const FILES = {
	"actions/needs-key.svg": svg(144, `<rect width="144" height="144" fill="${IDLE}"/>${q(72, 98, 84, IDLE_INK)}`),
	"actions/finished-key.svg": svg(144, `<rect width="144" height="144" fill="${IDLE}"/>${check(72, 72, 82, IDLE_INK)}`),
	"actions/combined-key.svg": svg(
		144,
		`<rect width="144" height="144" fill="${BG}"/><polygon points="0,0 144,0 0,144" fill="${IDLE}"/><polygon points="144,0 144,144 0,144" fill="${IDLE}"/>${q(42, 70, 52, IDLE_INK)}${check(100, 92, 44, IDLE_INK)}`,
	),
	"actions/mute-key.svg": svg(144, `<rect width="144" height="144" fill="${IDLE}"/>${speaker("#e3e5ea")}`),
	"actions/browser-key.svg": svg(144, `<rect width="144" height="144" fill="${IDLE}"/>${q(52, 92, 64, AMBER)}${check(98, 70, 48, GREEN)}`),
	"actions/status-key.svg": svg(
		144,
		`<rect width="144" height="144" fill="${IDLE}"/><rect x="22" y="34" width="12" height="76" rx="4" fill="#7fb2d9"/><path d="M48 50 h70 M48 72 h52 M48 94 h62" stroke="#e3e5ea" stroke-width="9" stroke-linecap="round"/>`,
	),
	"actions/shortcut-key.svg": svg(
		144,
		`<rect width="144" height="144" fill="${IDLE}"/><path d="M58 40 h-14 a10 10 0 0 0 -10 10 v44 a10 10 0 0 0 10 10 h44 a10 10 0 0 0 10 -10 v-14" stroke="#e3e5ea" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M76 36 h32 v32 M106 38 l-40 40" stroke="#e3e5ea" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
	),
	"actions/needs.svg": svg(20, q(10, 17, 18, "#ffffff")),
	"actions/finished.svg": svg(20, check(10, 10, 16, "#ffffff")),
	"actions/combined.svg": svg(20, `<polygon points="1,1 19,1 1,19" fill="none" stroke="#ffffff" stroke-width="1.6"/>${check(13, 13, 8, "#ffffff")}`),
	"actions/mute.svg": svg(20, `<g transform="scale(0.139)">${speaker("#ffffff")}</g>`),
	"actions/browser.svg": svg(20, `<circle cx="10" cy="10" r="7.5" fill="none" stroke="#ffffff" stroke-width="1.8"/><path d="M10 3 v4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>`),
	"actions/status.svg": svg(20, `<path d="M3 4 v12" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><path d="M7 6 h10 M7 10 h7 M7 14 h9" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>`),
	"actions/shortcut.svg": svg(20, `<path d="M8 4 h-3 a1.5 1.5 0 0 0 -1.5 1.5 v9.5 a1.5 1.5 0 0 0 1.5 1.5 h9.5 a1.5 1.5 0 0 0 1.5 -1.5 v-3" stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M11 3.5 h5.5 v5.5 M16 4 l-7 7" stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
	"plugin/category.svg": svg(28, `${q(10, 22, 22, "#ffffff")}${check(20, 16, 11, "#ffffff")}`),
	// The plugin icon is a PNG (Stream Deck requires it): scripts/make-plugin-icon.ps1.
};

for (const [name, text] of Object.entries(FILES)) {
	const file = path.join(ROOT, name);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, text);
}
console.log(`wrote ${Object.keys(FILES).length} images`);
