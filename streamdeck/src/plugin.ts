import streamDeck from "@elgato/streamdeck";

import { BrowserDial } from "./actions/browser-dial";
import { MuteKey } from "./actions/mute";
import { CombinedKey, FinishedKey, NeedsKey } from "./actions/waiting-key";
import { hub } from "./hub";

// Claude Notify: Stream Deck keys and a dial for Claude Desktop sessions that
// need an answer or have finished, fed by the mctonnie-mods pack's state files.

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new NeedsKey());
streamDeck.actions.registerAction(new FinishedKey());
streamDeck.actions.registerAction(new CombinedKey());
streamDeck.actions.registerAction(new MuteKey());
streamDeck.actions.registerAction(new BrowserDial());

// What the plugin process was started with, for diagnosing launches from it.
streamDeck.logger.info(`env: SystemRoot=${process.env.SystemRoot ?? "-"} PATH=${(process.env.PATH ?? "-").slice(0, 120)}`);

hub.start();
void streamDeck.connect();
