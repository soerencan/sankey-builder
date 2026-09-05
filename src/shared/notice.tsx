import type { Notice, NoticeKind } from "../app/notices";

// Display order; also the fixed slot order — every kind renders its own
// always-present div (empty when inactive) so the ids below stay stable
// across renders for :empty CSS and direct-id test lookups.
const NOTICE_ORDER: readonly NoticeKind[] = ["graph", "storage", "io"];

// Fixed ids (#error/#storage-notice/#io-notice) that tests and style.css
// selectors depend on directly.
const NOTICE_ID: Record<NoticeKind, string> = {
	graph: "error",
	storage: "storage-notice",
	io: "io-notice",
};

export interface NoticeRegionProps {
	notices: readonly Notice[];
}

/**
 * Presentational only — the controller derives `notices` and decides when to
 * re-render. Renders all three kind slots unconditionally (empty ones
 * collapse via style.css's `:empty` rule) so a kind's live region always
 * exists for assistive tech to already be tracking before it ever has
 * content.
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
						// biome-ignore lint/a11y/useSemanticElements: <output> represents the result of a form calculation, not an arbitrary status message, so role="status" on a plain <div> is the correct match here.
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
