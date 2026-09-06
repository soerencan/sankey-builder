import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageNotice {
	name: string;
	version: string;
	license: string;
	licenseText: string;
}

interface PackageManifest {
	name: string;
	version: string;
	license?: string;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
}

function readManifest(dir: string): PackageManifest {
	return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageManifest;
}

/** Node's resolution walk, so a nested node_modules (version conflict) is attributed as installed rather than as whatever got hoisted. */
function resolvePackageDir(name: string, fromDir: string): string | undefined {
	let dir = fromDir;
	for (;;) {
		const candidate = join(dir, "node_modules", name);
		try {
			readFileSync(join(candidate, "package.json"));
			return candidate;
		} catch {
			// Not here; keep walking up.
		}
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

function readLicenseText(dir: string): string | undefined {
	const file = readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry));
	return file === undefined ? undefined : readFileSync(join(dir, file), "utf8");
}

/**
 * Walks the production dependency closure from rootDir's package.json and
 * returns one notice per installed package, sorted by name.
 *
 * Attributes every installed module, not just what tree-shaking keeps in the
 * bundle: over-attribution is harmless, under-attribution is not. Throws
 * rather than skipping when a package has no license file or field, for the
 * same reason.
 */
export function collectProductionNotices(rootDir: string): PackageNotice[] {
	const root = readManifest(rootDir);
	const queue: Array<{ name: string; fromDir: string; optional: boolean }> = [];
	const enqueue = (manifest: PackageManifest, fromDir: string) => {
		for (const name of Object.keys(manifest.dependencies ?? {})) {
			queue.push({ name, fromDir, optional: false });
		}
		for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
			queue.push({ name, fromDir, optional: true });
		}
	};
	enqueue(root, rootDir);

	const seen = new Map<string, PackageNotice>();
	while (queue.length > 0) {
		const { name, fromDir, optional } = queue.shift() as (typeof queue)[number];
		const dir = resolvePackageDir(name, fromDir);
		if (dir === undefined) {
			if (optional) continue;
			throw new Error(`${name} (required from ${fromDir}) is not installed`);
		}
		const manifest = readManifest(dir);
		const key = `${manifest.name}@${manifest.version}`;
		if (seen.has(key)) continue;

		const licenseText = readLicenseText(dir);
		if (licenseText === undefined) throw new Error(`${key} ships no license file`);
		if (manifest.license === undefined) throw new Error(`${key} declares no license field`);
		seen.set(key, {
			name: manifest.name,
			version: manifest.version,
			license: manifest.license,
			licenseText: licenseText.trim(),
		});
		enqueue(manifest, dir);
	}

	return [...seen.values()].sort(
		(a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
	);
}

function escapeHtml(text: string): string {
	return text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A self-contained page: the site's stylesheet is content-hashed, and pulling it in for one static page isn't worth coupling the generator to the bundle. */
export function renderThirdPartyLicensesHtml(notices: PackageNotice[]): string {
	const sections = notices.map(
		(notice) =>
			`<section>\n<h2>${escapeHtml(notice.name)} ${escapeHtml(notice.version)} <small>(${escapeHtml(notice.license)})</small></h2>\n<pre>${escapeHtml(notice.licenseText)}</pre>\n</section>`,
	);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Third-Party Licenses · Sankey Builder</title>
<style>
:root { color-scheme: light dark; }
body {
  margin: 0 auto;
  padding: 1.5rem;
  max-width: 44rem;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif;
  line-height: 1.5;
  background: light-dark(#f8f9fa, #16191d);
  color: light-dark(#0d0f12, #f8f9fa);
}
a { color: inherit; }
h2 { font-size: 1.1rem; margin: 2rem 0 0.5rem; }
h2 small { font-weight: normal; opacity: 0.7; }
pre { white-space: pre-wrap; font-size: 0.85rem; margin: 0; }
</style>
</head>
<body>
<h1>Third-Party Licenses</h1>
<p>Sankey Builder bundles the packages below. Each notice is reproduced from
the package as installed when the site was built. <a href="./">Back to the app</a>.</p>
${sections.join("\n")}
</body>
</html>
`;
}

const isCliEntry =
	process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCliEntry) {
	const outFile = process.argv[2];
	if (outFile === undefined) {
		console.error("usage: bun scripts/third-party-licenses.ts <output-file>");
		process.exit(2);
	}
	const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	writeFileSync(outFile, renderThirdPartyLicensesHtml(collectProductionNotices(rootDir)));
}
