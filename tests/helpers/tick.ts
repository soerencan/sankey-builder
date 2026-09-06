/**
 * One microtask: a `useState` update renders on Preact's next microtask
 * flush, unlike the controller's `commit()`, which renders synchronously.
 */
export async function tick(): Promise<void> {
	await Promise.resolve();
}

/** One macrotask, for code under test that defers work with `setTimeout`. */
export async function settle(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
