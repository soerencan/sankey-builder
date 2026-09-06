import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not process.cwd(), so it's stable
// regardless of which directory vitest is invoked from.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let cached: string | undefined;

/** Scripts are stripped because tests boot startApp() themselves. */
export function stripToBodyMarkup(html: string): string {
	const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(html);
	if (!bodyMatch) throw new Error("html has no <body> to extract");
	return bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/g, "");
}

/** The real index.html rather than a hand-rolled fixture, so integration tests exercise the actual markup. */
export function bodyMarkup(): string {
	if (cached !== undefined) return cached;
	const html = readFileSync(join(REPO_ROOT, "index.html"), "utf8");
	cached = stripToBodyMarkup(html);
	return cached;
}
