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

export function renderThirdPartyLicenses(notices: PackageNotice[]): string {
	const sections = notices.map(
		(notice) =>
			`## ${notice.name} ${notice.version} (${notice.license})\n\n\`\`\`\n${notice.licenseText}\n\`\`\`\n`,
	);
	return [
		"# Third-Party Licenses",
		"",
		"Generated at build time from the installed production dependency closure",
		"(every package npm installs for the site's runtime dependencies, whether",
		"or not the emitted bundle still contains its code). Do not edit by hand.",
		"",
		...sections,
	].join("\n");
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
	writeFileSync(outFile, renderThirdPartyLicenses(collectProductionNotices(rootDir)));
}
