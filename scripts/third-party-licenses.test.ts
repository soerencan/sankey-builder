import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { collectProductionNotices, renderThirdPartyLicensesHtml } from "./third-party-licenses";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface FakePackage {
	name: string;
	version: string;
	license?: string;
	licenseFile?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function writePackage(dir: string, pkg: FakePackage): void {
	mkdirSync(dir, { recursive: true });
	const { licenseFile, ...manifest } = pkg;
	writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
	if (licenseFile !== undefined) writeFileSync(join(dir, licenseFile), `Copyright ${pkg.name}`);
}

describe("collectProductionNotices", () => {
	const scratchDirs: string[] = [];
	function scratch(): string {
		const dir = mkdtempSync(join(tmpdir(), "licenses-"));
		scratchDirs.push(dir);
		return dir;
	}
	afterEach(() => {
		for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	it("follows transitive dependencies, skips devDependencies, and respects nested node_modules", () => {
		const root = scratch();
		writePackage(root, {
			name: "app",
			version: "0.0.0",
			dependencies: { a: "*" },
			devDependencies: { tool: "*" },
		});
		writePackage(join(root, "node_modules/a"), {
			name: "a",
			version: "1.0.0",
			license: "MIT",
			licenseFile: "LICENSE",
			dependencies: { shared: "*" },
		});
		// a depends on shared@2 (nested); the hoisted shared@1 is unreachable.
		writePackage(join(root, "node_modules/a/node_modules/shared"), {
			name: "shared",
			version: "2.0.0",
			license: "ISC",
			licenseFile: "LICENSE.md",
		});
		writePackage(join(root, "node_modules/shared"), {
			name: "shared",
			version: "1.0.0",
			license: "ISC",
			licenseFile: "LICENSE",
		});
		writePackage(join(root, "node_modules/tool"), {
			name: "tool",
			version: "9.0.0",
			license: "MIT",
			licenseFile: "COPYING",
		});

		expect(collectProductionNotices(root).map((n) => `${n.name}@${n.version}`)).toEqual([
			"a@1.0.0",
			"shared@2.0.0",
		]);
	});

	it("fails rather than silently omitting a package without a license file", () => {
		const root = scratch();
		writePackage(root, { name: "app", version: "0.0.0", dependencies: { a: "*" } });
		writePackage(join(root, "node_modules/a"), { name: "a", version: "1.0.0", license: "MIT" });

		expect(() => collectProductionNotices(root)).toThrow(/a@1\.0\.0 ships no license file/);
	});

	it("fails when a required dependency is not installed", () => {
		const root = scratch();
		writePackage(root, { name: "app", version: "0.0.0", dependencies: { missing: "*" } });

		expect(() => collectProductionNotices(root)).toThrow(/missing .* is not installed/);
	});
});

describe("against this repository's installed dependencies", () => {
	const notices = collectProductionNotices(REPO_ROOT);
	const names = new Set(notices.map((n) => n.name));

	it("covers every direct production dependency and none of the dev tooling", () => {
		for (const name of [
			"d3-sankey",
			"d3-scale",
			"d3-scale-chromatic",
			"d3-selection",
			"preact",
			"sortablejs",
		]) {
			expect(names.has(name)).toBe(true);
		}
		for (const name of ["vitest", "typescript", "happy-dom", "@biomejs/biome"]) {
			expect(names.has(name)).toBe(false);
		}
	});

	it("carries the ColorBrewer notice embedded in d3-scale-chromatic's license", () => {
		const chromatic = notices.find((n) => n.name === "d3-scale-chromatic");
		expect(chromatic?.licenseText).toContain("ColorBrewer");
	});

	it("renders one section per package with its license text", () => {
		const html = renderThirdPartyLicensesHtml(notices);
		for (const notice of notices) {
			expect(html).toContain(
				`<h2>${notice.name} ${notice.version} <small>(${notice.license})</small></h2>`,
			);
			// Quotes are left alone, so real license texts survive verbatim.
			expect(html).toContain(notice.licenseText);
		}
	});
});

describe("renderThirdPartyLicensesHtml", () => {
	it("escapes markup in license text so a notice can't inject into the page", () => {
		const html = renderThirdPartyLicensesHtml([
			{
				name: "x",
				version: "1.0.0",
				license: "MIT",
				licenseText: "<script>alert(1)</script> & co",
			},
		]);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&#60;script&#62;alert(1)&#60;/script&#62; &#38; co");
	});
});
