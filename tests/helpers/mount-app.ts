import { afterEach } from "vitest";
import type { AppHandle } from "../../src/app/start-app";
import { startApp } from "../../src/app/start-app";
import { STORAGE_KEY } from "../../src/platform/storage";
import { bodyMarkup } from "./fixture";

export interface AppFixture {
	app: AppHandle;
}

/**
 * Installs the real index.html body markup and clears localStorage, without
 * booting the app — for tests that assert on static layout, or that manage
 * their own startApp()/destroy() lifecycle (e.g. booting more than once).
 */
export function installMarkup(): void {
	document.body.innerHTML = bodyMarkup();
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
 * Not for tests that boot the app more than once — a second call throws;
 * use installMarkup() + startApp() directly instead.
 */
export function mountApp(): AppFixture {
	if (mounted) {
		throw new Error(
			"mountApp() called while a previous app is still mounted; for multi-boot tests use installMarkup() and startApp() directly.",
		);
	}
	installMarkup();
	mounted = startApp(document);
	return { app: mounted };
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

/**
 * Awaits one microtask. A row-local `useState` update (e.g. a link-value
 * draft's aria-invalid/error text — see link-row.tsx) is *stored*
 * synchronously but only *rendered* on Preact's next microtask-scheduled
 * flush, unlike a committed action's controller-driven `refresh()`, which
 * calls Preact's `render()` synchronously. Tests asserting a draft-only
 * effect immediately after firing an event that has no other synchronous
 * side effect must await this first.
 */
export async function tick(): Promise<void> {
	await Promise.resolve();
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
