import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let cached: string | undefined;

/**
 * Extracts an HTML document's <body> contents with <script> tags stripped —
 * shared by bodyMarkup() below and tests/dist.test.ts, both of which boot
 * startApp() themselves rather than relying on a document's own script tags.
 */
export function stripToBodyMarkup(html: string): string {
	const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(html);
	if (!bodyMatch) throw new Error("html has no <body> to extract");
	return bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/g, "");
}

/**
 * Real markup, not a hand-rolled fixture, so integration tests exercise the
 * actual element ids/structure — but with <script> tags stripped, since
 * startApp() (not index.html's own script tags) is what boots the page under
 * test. Read once and cached: index.html doesn't change between tests.
 */
export function bodyMarkup(): string {
	if (cached !== undefined) return cached;
	const html = readFileSync(join(REPO_ROOT, "index.html"), "utf8");
	cached = stripToBodyMarkup(html);
	return cached;
}
