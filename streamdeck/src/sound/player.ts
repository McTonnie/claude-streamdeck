import streamDeck from "@elgato/streamdeck";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

// Plays sounds through one hidden, long-lived PowerShell that keeps WPF's
// MediaPlayer loaded (it plays .wav and .mp3 and has a volume), so a chime
// starts at once instead of after a PowerShell start-up.

/** The plugin folder: bin/plugin.js sits one level below it. */
export const PLUGIN_DIR = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

export type Chime = "needs" | "finished" | "reminder";

const BOOT = [
	"Add-Type -AssemblyName PresentationCore",
	"$global:playing = New-Object System.Collections.ArrayList",
	// Each call keeps its player referenced until it has had time to finish.
	"function Play([string]$p, [double]$v) { $m = New-Object System.Windows.Media.MediaPlayer; $m.Open([Uri]$p); $m.Volume = $v; $m.Play(); [void]$global:playing.Add(@{ m = $m; at = Get-Date }); $old = @($global:playing | Where-Object { ((Get-Date) - $_.at).TotalSeconds -gt 30 }); foreach ($o in $old) { $o.m.Close(); $global:playing.Remove($o) } }",
];

let ps: ChildProcessWithoutNullStreams | null = null;

function shell(): ChildProcessWithoutNullStreams {
	if (ps && ps.exitCode === null && !ps.killed) return ps;
	ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"], {
		windowsHide: true,
	});
	ps.on("error", (err) => streamDeck.logger.error(`sound player failed: ${String(err)}`));
	ps.on("exit", (code) => {
		streamDeck.logger.info(`sound player exited (${code})`);
		ps = null;
	});
	ps.stderr.on("data", (d: Buffer) => streamDeck.logger.warn(`sound player: ${d.toString().trim()}`));
	ps.stdout.resume();
	for (const line of BOOT) ps.stdin.write(line + "\n");
	return ps;
}

/** The file for a sound choice: a built-in chime, or the user's own file when it exists. */
export function soundFile(choice: string | undefined, custom: string | undefined, fallback: Chime): string {
	if (choice === "custom" && custom && existsSync(custom)) return custom;
	const name = choice === "needs" || choice === "finished" || choice === "reminder" ? choice : fallback;
	return path.join(PLUGIN_DIR, "sounds", `${name}.wav`);
}

/** Plays a file at a volume of 0–100. */
export function play(file: string, volume: number): void {
	const v = Math.max(0, Math.min(100, Number.isFinite(volume) ? volume : 70)) / 100;
	const quoted = `'${file.replace(/'/g, "''")}'`;
	try {
		shell().stdin.write(`Play ${quoted} ${v.toFixed(2)}\n`);
	} catch (err) {
		streamDeck.logger.error(`could not play ${file}: ${String(err)}`);
	}
}

/** Starts the player early, so the first chime is not late. */
export function warmUp(): void {
	shell();
}
