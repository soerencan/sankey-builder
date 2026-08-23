import { afterEach } from "vitest";
import type { AppHandle } from "../../src/app";
import { startApp } from "../../src/app";
import { STORAGE_KEY } from "../../src/persist";
import { bodyMarkup } from "./fixture";

export interface AppFixture {
	app: AppHandle;
	doc: Document;
}

/**
 * Installs the real index.html body markup and clears localStorage, without
 * booting the app — for tests that assert on static layout, or that manage
 * their own startApp()/destroy() lifecycle (e.g. booting more than once).
 */
export function installMarkup(doc: Document = document): void {
	doc.body.innerHTML = bodyMarkup();
	localStorage.clear();
}

let mounted: AppHandle | undefined;

// Registered once, when a test file imports this module — Vitest's default
// per-file isolation keeps `mounted` and this hook scoped to that file, so
// each test's app is destroyed without every test having to do it by hand.
afterEach(() => {
	mounted?.destroy();
	mounted = undefined;
});

/**
 * Boots a real AppHandle against fresh markup and storage for a single test.
 * Not for tests that boot the app more than once (a second call would wipe
 * the DOM installMarkup() just built) — those call startApp()/destroy()
 * directly instead.
 */
export function mountApp(doc: Document = document): AppFixture {
	installMarkup(doc);
	mounted = startApp(doc);
	return { app: mounted, doc };
}

export function click(target: Element | null | undefined): void {
	target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

export function fireInput(target: Element | null | undefined): void {
	target?.dispatchEvent(new Event("input", { bubbles: true }));
}

export function fireChange(target: Element | null | undefined): void {
	target?.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Queries `root` and throws if nothing matches — for elements a test needs to exist. */
export function requireElement<T extends Element>(
	selector: string,
	root: ParentNode = document,
): T {
	const el = root.querySelector<T>(selector);
	if (!el) throw new Error(`expected an element matching "${selector}"`);
	return el;
}

export function getStoredState() {
	return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
}
