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
