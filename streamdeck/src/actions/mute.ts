import {
	action,
	type DidReceiveSettingsEvent,
	SingletonAction,
	type WillAppearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { hub } from "../hub";
import { muteImage } from "../render/key";
import { inQuietHours, memory, saveMemory } from "../store/memory";
import type { MuteSettings } from "../types";

// The mute key: a press silences every chime (flashing goes on); its settings
// hold the quiet hours, which the plugin keeps even while the key is off screen.

@action({ UUID: "com.mctonnie.claude-notify.mute" })
export class MuteKey extends SingletonAction<JsonObject> {
	private drawn = new Map<string, string>();

	constructor() {
		super();
		hub.onDraw(() => this.drawAll());
		// Quiet hours begin and end on the clock, not on an event.
		setInterval(() => this.drawAll(), 30_000);
	}

	private drawAll(): void {
		const image = muteImage(memory.muted, inQuietHours());
		this.actions.forEach((a) => {
			if (!a.isKey() || this.drawn.get(a.id) === image) return;
			this.drawn.set(a.id, image);
			void a.setImage(image);
		});
	}

	private takeQuiet(s: MuteSettings): void {
		memory.quiet = {
			on: s.quietOn === true,
			from: s.quietFrom || memory.quiet.from,
			to: s.quietTo || memory.quiet.to,
		};
		saveMemory();
	}

	override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
		this.takeQuiet(ev.payload.settings as MuteSettings);
		this.drawn.delete(ev.action.id);
		this.drawAll();
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): void {
		this.takeQuiet(ev.payload.settings as MuteSettings);
		this.drawAll();
	}

	override onKeyDown(): void {
		hub.setMuted(!memory.muted);
	}
}
