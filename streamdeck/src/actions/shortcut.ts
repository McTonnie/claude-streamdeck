import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import path from "node:path";

import { hub } from "../hub";
import { openSession } from "../open";
import { STATUS_COLOR, statusLabel } from "../render/dial";
import { shortcutImage } from "../render/key";
import { desktopSessions } from "../store/desktop";
import type { ShortcutSettings } from "../types";

// Session shortcut: a key tied to one session the user picks (a master
// session, say). A press opens it; the key shows the session's title (or the
// user's own label) and, while the session is busy, a coloured status band.
// Its settings page fills the session dropdown through the `getSessions`
// data source (sdpi-components).

const DATA_SOURCE = "getSessions";

@action({ UUID: "com.mctonnie.claude-notify.shortcut" })
export class ShortcutKey extends SingletonAction<JsonObject> {
	private settingsOf = new Map<string, ShortcutSettings>();
	private drawn = new Map<string, string>();

	constructor() {
		super();
		hub.onDraw(() => this.drawAll());
		// A renamed session's title, and a status that changed without an event.
		setInterval(() => this.drawAll(), 30_000);
	}

	private drawAll(): void {
		this.actions.forEach((a) => {
			if (!a.isKey()) return;
			const s = this.settingsOf.get(a.id) ?? {};
			const item = s.sessionId ? hub.statusOf(s.sessionId) : null;
			const custom = s.label?.trim();
			const image = shortcutImage({
				label: s.sessionId ? custom || item?.title || "Session" : null,
				status: item && item.status !== "idle" ? { text: statusLabel(item), color: STATUS_COLOR[item.status] } : null,
				dim: item?.status === "needs" && !hub.bright,
			});
			if (this.drawn.get(a.id) === image) return;
			this.drawn.set(a.id, image);
			void a.setImage(image);
		});
	}

	private take(id: string, settings: JsonObject): void {
		const s = settings as ShortcutSettings;
		this.settingsOf.set(id, s);
		hub.show(id, "shortcut", settings);
		this.drawn.delete(id);
		this.drawAll();
	}

	override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
		this.take(ev.action.id, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		this.settingsOf.delete(ev.action.id);
		this.drawn.delete(ev.action.id);
		hub.hide(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): void {
		this.take(ev.action.id, ev.payload.settings);
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		const id = this.settingsOf.get(ev.action.id)?.sessionId;
		if (!id) {
			void ev.action.showAlert();
			return;
		}
		openSession(id);
		const item = hub.statusOf(id);
		if (item?.status === "finished") hub.markSeen([item]);
	}

	/** The settings page asks for the sessions to pick from: every Desktop session not archived, most recent first. */
	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, JsonObject>): void {
		const p = ev.payload as { event?: string } | null;
		if (p?.event !== DATA_SOURCE) return;
		const items = desktopSessions().map((d) => {
			const folder = path.basename(d.cwd);
			const title = d.title || folder || d.id;
			return { value: d.id, label: folder && folder !== title ? `${title} — ${folder}` : title };
		});
		void streamDeck.ui.sendToPropertyInspector({ event: DATA_SOURCE, items });
	}
}
