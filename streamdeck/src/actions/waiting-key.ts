import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { hub } from "../hub";
import { keyImage } from "../render/key";
import { play } from "../sound/player";
import type { Kind } from "../types";

// The three waiting keys. A short press opens the next waiting session; a
// press of 0.7 s or more dismisses everything on that key. Each key draws its
// own face from the hub on every change and blink.

const HOLD_MS = 700;
const SOUND_KEYS = ["sound", "soundFile", "needsSound", "needsFile", "finishedSound", "finishedFile", "volume"];

class WaitingKey extends SingletonAction<JsonObject> {
	private drawn = new Map<string, string>();
	private downAt = new Map<string, number>();

	constructor(private readonly type: "needs" | "finished" | "combined") {
		super();
		hub.onDraw(() => this.drawAll());
	}

	private drawAll(): void {
		this.actions.forEach((a) => {
			if (!a.isKey()) return;
			const settings = (this.settingsOf.get(a.id) ?? {}) as { showTitle?: boolean };
			const image = keyImage({
				type: this.type,
				needs: hub.needs.length,
				finished: hub.finished.length,
				bright: hub.bright,
				next: settings.showTitle === false ? null : hub.next(a.id, this.type),
			});
			if (this.drawn.get(a.id) === image) return;
			this.drawn.set(a.id, image);
			void a.setImage(image);
		});
	}

	private settingsOf = new Map<string, JsonObject>();

	override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
		this.settingsOf.set(ev.action.id, ev.payload.settings);
		hub.show(ev.action.id, this.type, ev.payload.settings);
		this.drawn.delete(ev.action.id);
		this.drawAll();
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		this.settingsOf.delete(ev.action.id);
		this.drawn.delete(ev.action.id);
		hub.hide(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): void {
		const before = this.settingsOf.get(ev.action.id) ?? {};
		const after = ev.payload.settings;
		this.settingsOf.set(ev.action.id, after);
		hub.show(ev.action.id, this.type, after);
		this.drawn.delete(ev.action.id);
		this.drawAll();
		// A changed sound or volume plays once, as a preview.
		const changed = SOUND_KEYS.filter((k) => before[k] !== after[k]);
		if (changed.length > 0) {
			const kind: Kind = this.type === "combined" ? (changed.some((k) => k.startsWith("finished")) ? "finished" : "needs") : this.type;
			const s = hub.sound(kind, { type: this.type, settings: after });
			play(s.file, s.volume);
		}
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		this.downAt.set(ev.action.id, Date.now());
	}

	override onKeyUp(ev: KeyUpEvent<JsonObject>): void {
		const held = Date.now() - (this.downAt.get(ev.action.id) ?? Date.now());
		this.downAt.delete(ev.action.id);
		if (held >= HOLD_MS) {
			const all = hub.list(this.type);
			streamDeck.logger.info(`${this.type}: dismissed ${all.length}`);
			hub.markSeen(all);
			void ev.action.showOk();
			return;
		}
		hub.press(ev.action.id, this.type);
	}
}

@action({ UUID: "com.mctonnie.claude-notify.needs" })
export class NeedsKey extends WaitingKey {
	constructor() {
		super("needs");
	}
}

@action({ UUID: "com.mctonnie.claude-notify.finished" })
export class FinishedKey extends WaitingKey {
	constructor() {
		super("finished");
	}
}

@action({ UUID: "com.mctonnie.claude-notify.combined" })
export class CombinedKey extends WaitingKey {
	constructor() {
		super("combined");
	}
}
