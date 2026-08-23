// lib.dom.d.ts declares `URL` and `AbortController` only as ambient globals
// (`declare var URL: ...`), not as members of the `Window` interface — even
// though every real window exposes both as its own properties. This
// augmentation closes that typing gap so `win.URL`/`win.AbortController`
// (the app's own window, threaded explicitly rather than read off the
// ambient global — see start-app.ts, features/files/controls.ts,
// features/diagram/export.ts) type-check against their real runtime shape.
interface Window {
	readonly URL: typeof URL;
	readonly AbortController: typeof AbortController;
}
