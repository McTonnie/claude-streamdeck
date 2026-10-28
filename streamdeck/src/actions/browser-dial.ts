import {
	action,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { hub } from "../hub";
import { dialImage } from "../render/dial";
import type { Item } from "../types";

// Session browser (Stream Deck + dial): turn to step through every waiting
// session (needs first), press or tap to open it, hold a touch to dismiss it.

@action({ UUID: "com.mctonnie.claude-notify.browser" })
export class BrowserDial extends SingletonAction<JsonObject> {
	private selected = new Map<string, number>();
	private drawn = new Map<string, string>();

	constructor() {
		super();
		hub.onDraw(() => this.drawAll());
		// The age line moves on with the clock.
		setInterval(() => this.drawAll(), 30_000);
	}

	/** The selection, kept inside the list as it grows and shrinks. */
	private pick(id: string): { item: Item | null; index: number; total: number } {
		const list = hub.list("browser");
		if (list.length === 0) return { item: null, index: 0, total: 0 };
		const index = Math.min(this.selected.get(id) ?? 0, list.length - 1);
		this.selected.set(id, index);
		return { item: list[index] ?? null, index, total: list.length };
	}

	private drawAll(): void {
		this.actions.forEach((a) => {
			if (!a.isDial()) return;
			const { item, index, total } = this.pick(a.id);
			const canvas = dialImage(item, index, total, hub.bright);
			if (this.drawn.get(a.id) === canvas) return;
			this.drawn.set(a.id, canvas);
			void a.setFeedback({ canvas });
		});
	}

	override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
		hub.show(ev.action.id, "browser", ev.payload.settings);
		this.drawn.delete(ev.action.id);
		this.drawAll();
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		hub.hide(ev.action.id);
		this.drawn.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): void {
		hub.show(ev.action.id, "browser", ev.payload.settings);
	}

	override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
		const total = hub.list("browser").length;
		if (total === 0) return;
		const at = (this.selected.get(ev.action.id) ?? 0) + ev.payload.ticks;
		this.selected.set(ev.action.id, ((at % total) + total) % total);
		this.drawAll();
	}

	override onDialDown(ev: DialDownEvent<JsonObject>): void {
		hub.open(this.pick(ev.action.id).item);
	}

	override onTouchTap(ev: TouchTapEvent<JsonObject>): void {
		const { item } = this.pick(ev.action.id);
		if (ev.payload.hold) {
			if (item) hub.markSeen([item]);
			return;
		}
		hub.open(item);
	}
}
