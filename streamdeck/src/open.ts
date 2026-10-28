import streamDeck from "@elgato/streamdeck";
import { spawn } from "node:child_process";
import path from "node:path";

// Opens the Claude Desktop app at a session through its claude:// link.
// `claude://code/continue?session=local_<uuid>` is undocumented but handled by
// Desktop 4.29 (it checks the id against the same pattern); `session=last`
// opens the most recently used session.

const ID = /^local_[A-Za-z0-9-]{1,64}$/;

/** Opens that session, or the last used one when `id` is null. */
export function openSession(id: string | null): void {
	const target = id && ID.test(id) ? id : "last";
	const link = `claude://code/continue?session=${target}`;
	streamDeck.logger.info(`open ${link}`);
	// The shell's own "open" for a URL (explorer.exe would treat it as a folder path).
	// Full path: Stream Deck starts plugins with a trimmed environment.
	const rundll = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "rundll32.exe");
	const child = spawn(rundll, ["url.dll,FileProtocolHandler", link], { detached: true, stdio: "ignore", windowsHide: true });
	child.on("error", (err) => {
		streamDeck.logger.warn(`rundll32 failed (${String(err)}), trying Stream Deck's openUrl`);
		void streamDeck.system.openUrl(link);
	});
	child.on("exit", (code) => streamDeck.logger.info(`rundll32 exit ${code}`));
	child.unref();
}
