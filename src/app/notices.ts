/**
 * PLAN.md's "Notice policy" shape — `NoticeRegion`'s prop element type (see
 * shared/notice.tsx). The controller (start-app.tsx) derives at most one
 * `Notice` per `kind` and hands the active set to `App` on every render.
 */
export type NoticeKind = "graph" | "storage" | "io";
export type NoticeTone = "info" | "warning" | "error";

export interface Notice {
	readonly kind: NoticeKind;
	readonly tone: NoticeTone;
	readonly message: string;
}
