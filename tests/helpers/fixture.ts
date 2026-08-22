import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let cached: string | undefined;

/**
 * Real markup, not a hand-rolled fixture, so integration tests exercise the
 * actual element ids/structure — but with <script> tags stripped, since
 * startApp() (not index.html's own script tags) is what boots the page under
 * test. Read once and cached: index.html doesn't change between tests.
 */
export function bodyMarkup(): string {
	if (cached !== undefined) return cached;
	const html = readFileSync(join(REPO_ROOT, "index.html"), "utf8");
	const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(html);
	if (!bodyMatch) throw new Error("index.html has no <body> to extract");
	cached = bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/g, "");
	return cached;
}
