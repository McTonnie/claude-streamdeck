// Writes the plugin's three chimes as 16-bit mono WAV files, made from sine
// tones with a bell-like envelope. Run with `npm run sounds`.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const RATE = 44100;
const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../com.mctonnie.claude-notify.sdPlugin/sounds");

/** A bell tone: the note plus two quieter overtones, a 5 ms attack and an exponential decay. */
function bell(samples, start, freq, length, decay, gain) {
	const from = Math.round(start * RATE);
	const n = Math.round(length * RATE);
	for (let i = 0; i < n && from + i < samples.length; i++) {
		const t = i / RATE;
		const attack = Math.min(1, t / 0.005);
		const env = attack * Math.exp(-t / decay);
		const wave =
			Math.sin(2 * Math.PI * freq * t) +
			0.35 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t / (decay / 2)) +
			0.12 * Math.sin(2 * Math.PI * freq * 3.01 * t) * Math.exp(-t / (decay / 3));
		samples[from + i] += gain * env * wave;
	}
}

function wav(samples) {
	const data = Buffer.alloc(samples.length * 2);
	const peak = Math.max(...samples.map(Math.abs), 1e-9);
	const scale = 0.89 / peak;
	samples.forEach((s, i) => data.writeInt16LE(Math.round(s * scale * 32767), i * 2));
	const head = Buffer.alloc(44);
	head.write("RIFF", 0);
	head.writeUInt32LE(36 + data.length, 4);
	head.write("WAVEfmt ", 8);
	head.writeUInt32LE(16, 16);
	head.writeUInt16LE(1, 20); // PCM
	head.writeUInt16LE(1, 22); // mono
	head.writeUInt32LE(RATE, 24);
	head.writeUInt32LE(RATE * 2, 28);
	head.writeUInt16LE(2, 32);
	head.writeUInt16LE(16, 34);
	head.write("data", 36);
	head.writeUInt32LE(data.length, 40);
	return Buffer.concat([head, data]);
}

const make = (seconds, draw) => {
	const s = new Array(Math.round(seconds * RATE)).fill(0);
	draw(s);
	return wav(s);
};

const SOUNDS = {
	// Needs answer: a rising two-note call (E5 → B5), asks for attention.
	"needs.wav": make(0.75, (s) => {
		bell(s, 0, 659.25, 0.5, 0.12, 1);
		bell(s, 0.17, 987.77, 0.58, 0.16, 1);
	}),
	// Finished: one soft, longer ding (A5).
	"finished.wav": make(1.2, (s) => bell(s, 0, 880, 1.2, 0.35, 1)),
	// Reminder: a short, quiet double tick (E6).
	"reminder.wav": make(0.3, (s) => {
		bell(s, 0, 1318.5, 0.12, 0.03, 0.6);
		bell(s, 0.11, 1318.5, 0.15, 0.03, 0.45);
	}),
};

mkdirSync(OUT, { recursive: true });
for (const [name, buf] of Object.entries(SOUNDS)) {
	writeFileSync(path.join(OUT, name), buf);
	console.log(`wrote ${name} (${buf.length} bytes)`);
}
