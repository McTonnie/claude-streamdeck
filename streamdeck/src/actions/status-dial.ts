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
import { statusImage } from "../render/dial";
import type { BusyItem } from "../types";

// Session status (Stream Deck + dial): every busy session (working, needs
// answer, finished and not seen), most recent change first, with its state and
// how long it has been in it; with "Show all sessions" on, every session of the
// Desktop app, the idle ones too. Turn to switch, press or tap to open. No sounds.

@action({ UUID: "com.mctonnie.claude-notify.status" })
export class StatusDial extends SingletonAction<JsonObject> {
	/** The session each dial shows, by id, so it stays put while the order changes. */
	private selected = new Map<string, string>();
	private lastIndex = new Map<string, number>();
	private drawn = new Map<string, string>();
	/** Dials with "Show all sessions" on. */
	private showAll = new Set<string>();

	constructor() {
		super();
		hub.onDraw(() => this.drawAll());
		// The time line moves on with the clock, and working sessions don't blink.
		setInterval(() => this.drawAll(), 30_000);
	}

	/** What this dial steps through: the busy sessions, or all of them. */
	private list(id: string): BusyItem[] {
		return this.showAll.has(id) ? hub.all : hub.busy;
	}

	/** The selection: the same session if it is still listed, else the one now at its old place. */
	private pick(id: string): { item: BusyItem | null; index: number; total: number } {
		const list = this.list(id);
		if (list.length === 0) return { item: null, index: 0, total: 0 };
		let index = list.findIndex((b) => b.id === this.selected.get(id));
		if (index < 0) index = Math.min(this.lastIndex.get(id) ?? 0, list.length - 1);
		const item = list[index]!;
		this.selected.set(id, item.id);
		this.lastIndex.set(id, index);
		return { item, index, total: list.length };
	}

	private drawAll(): void {
		this.actions.forEach((a) => {
			if (!a.isDial()) return;
			const { item, index, total } = this.pick(a.id);
			const canvas = statusImage(item, index, total, hub.bright, this.showAll.has(a.id) ? "No sessions" : "No busy sessions");
			if (this.drawn.get(a.id) === canvas) return;
			this.drawn.set(a.id, canvas);
			void a.setFeedback({ canvas });
		});
	}

	private take(id: string, settings: JsonObject): void {
		if (settings.allSessions === true) this.showAll.add(id);
		else this.showAll.delete(id);
		this.drawn.delete(id);
		this.drawAll();
	}

	override onWillAppear(ev: WillAppearEvent<JsonObject>): void {
		this.take(ev.action.id, ev.payload.settings);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): void {
		this.take(ev.action.id, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		this.drawn.delete(ev.action.id);
	}

	override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
		const list = this.list(ev.action.id);
		if (list.length === 0) return;
		const { index } = this.pick(ev.action.id);
		const to = (((index + ev.payload.ticks) % list.length) + list.length) % list.length;
		this.selected.set(ev.action.id, list[to]!.id);
		this.lastIndex.set(ev.action.id, to);
		this.drawAll();
	}

	override onDialDown(ev: DialDownEvent<JsonObject>): void {
		hub.openBusy(this.pick(ev.action.id).item);
	}

	override onTouchTap(ev: TouchTapEvent<JsonObject>): void {
		if (ev.payload.hold) return;
		hub.openBusy(this.pick(ev.action.id).item);
	}
}
