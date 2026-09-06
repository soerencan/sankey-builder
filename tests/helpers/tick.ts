/**
 * Awaits one microtask. A `useState` update is *stored* synchronously but
 * only *rendered* on Preact's next microtask-scheduled flush, unlike a
 * committed action's controller-driven `commit()`, which calls Preact's
 * `render()` synchronously. Tests asserting a state-only effect immediately
 * after firing an event that has no other synchronous side effect must
 * await this first.
 */
export async function tick(): Promise<void> {
	await Promise.resolve();
}

/**
 * Awaits one macrotask turn (a `setTimeout(0)`), for effects a `Promise`
 * microtask flush doesn't cover — e.g. code under test that itself defers
 * work with `setTimeout`.
 */
export async function settle(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
