// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it } from "vitest";

/** Proves the toolchain resolves `.tsx` through Preact's own JSX runtime with no compat shim. */
function Greeting({ name }: { name: string }) {
	return <p class="greeting">Hello, {name}!</p>;
}

describe("Preact toolchain smoke test", () => {
	it("mounts, updates, and unmounts cleanly", () => {
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
});
