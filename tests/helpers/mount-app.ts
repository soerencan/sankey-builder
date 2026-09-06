import { afterEach } from "vitest";
import type { AppHandle } from "../../src/app/start-app";
import { startApp } from "../../src/app/start-app";
import { STORAGE_KEY } from "../../src/platform/storage";
import { bodyMarkup } from "./fixture";

export { settle, tick } from "./tick";
export { accessibleName, allByRole, byRole } from "./dom-queries";

export interface AppFixture {
	app: AppHandle;
}

/** For tests that assert on static layout or manage their own startApp()/destroy() lifecycle. */
export function installMarkup(): void {
	document.body.innerHTML = bodyMarkup();
	localStorage.clear();
}

let mounted: AppHandle | undefined;

// Vitest's per-file isolation scopes `mounted` and this hook to the
// importing test file.
afterEach(() => {
	mounted?.destroy();
	mounted = undefined;
});

/** One boot per test; a second call throws. Tests that boot more than once use installMarkup() + startApp() directly. */
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
