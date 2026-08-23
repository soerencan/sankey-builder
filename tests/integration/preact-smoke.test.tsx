// @vitest-environment happy-dom

import { Window } from "happy-dom";
import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Proves the toolchain (tsconfig `jsx`/`jsxImportSource`, Vitest's esbuild
 * transform, and `bun build`) resolves `.tsx` through Preact's own JSX
 * runtime with no compat shim, and that a Preact root targets the DOM of
 * whichever document its container belongs to. Realm-discriminating
 * invariants (which window's constructors survive a cross-window mount)
 * belong to cross-realm.test.ts, not here.
 */
function Greeting({ name }: { name: string }) {
	return <p class="greeting">Hello, {name}!</p>;
}

describe("Preact toolchain smoke test", () => {
	let otherWindow: Window | undefined;

	afterEach(async () => {
		await otherWindow?.happyDOM.close();
		otherWindow = undefined;
	});

	it("mounts, updates, and unmounts cleanly in the ambient happy-dom document", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		render(<Greeting name="World" />, container);
		const paragraph = container.querySelector("p.greeting");
		expect(paragraph?.textContent).toBe("Hello, World!");

		render(<Greeting name="Preact" />, container);
		expect(container.querySelector("p.greeting")?.textContent).toBe("Hello, Preact!");

		render(null, container);
		expect(container.innerHTML).toBe("");

		container.remove();
	});

	it("mounts, updates, and unmounts cleanly in a second, independent window's document", () => {
		otherWindow = new Window();
		const otherDocument = otherWindow.document as unknown as Document;
		const container = otherDocument.createElement("div");
		otherDocument.body.appendChild(container);

		render(<Greeting name="World" />, container);
		const paragraph = container.querySelector("p.greeting");
		expect(paragraph?.textContent).toBe("Hello, World!");
		// Preact's own DOM creation reaches for the ambient global `document`,
		// not the container's ownerDocument — this pins that node insertion
		// still lands the element in otherDocument's realm regardless.
		expect(paragraph?.ownerDocument).toBe(otherDocument);

		render(<Greeting name="Preact" />, container);
		expect(container.querySelector("p.greeting")?.textContent).toBe("Hello, Preact!");

		render(null, container);
		expect(container.innerHTML).toBe("");
	});
});
