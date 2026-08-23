import type { Notice, NoticeKind } from "../app/notices";

// Display order per PLAN.md's Notice policy; also the fixed slot order — every
// kind renders its own always-present div (empty when inactive) so the ids
// below stay stable across renders for :empty CSS and direct-id test lookups.
const NOTICE_ORDER: readonly NoticeKind[] = ["graph", "storage", "io"];

// Pinned to the legacy container ids (#error/#storage-notice/#io-notice) so
// existing tests and style.css selectors keep working unchanged.
const NOTICE_ID: Record<NoticeKind, string> = {
	graph: "error",
	storage: "storage-notice",
	io: "io-notice",
};

export interface NoticeRegionProps {
	notices: readonly Notice[];
}

/**
 * One visually consolidated region replacing the three previously unstyled
 * top-level containers (PLAN.md's Notice policy) — presentational only, the
 * controller derives `notices` and decides when to re-render. Renders all
 * three kind slots unconditionally (empty ones collapse via style.css's
 * `:empty` rule) so a kind's live region always exists for assistive tech to
 * already be tracking before it ever has content.
 */
export function NoticeRegion({ notices }: NoticeRegionProps) {
	return (
		<div class="notice-region">
			{NOTICE_ORDER.map((kind) => {
				const notice = notices.find((candidate) => candidate.kind === kind);
				return (
					<div
						key={kind}
						id={NOTICE_ID[kind]}
						// biome-ignore lint/a11y/useSemanticElements: role="status" on a <div> (not <output>) matches index.html's original markup exactly.
						role="status"
						aria-live="polite"
						class={notice ? `notice-${notice.tone}` : undefined}
					>
						{notice?.message ?? ""}
					</div>
				);
			})}
		</div>
	);
}
