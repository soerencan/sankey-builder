.PHONY: dev build test test-unit test-dist lint format typecheck

# Serve the app locally with Bun's dev server (HMR, on-the-fly TS/bundling)
dev:
	bun run dev

# Canonical clean production build: emits dist/ (hashed JS/CSS bundle plus a
# generated third-party-licenses.html). This is what CI's artifact job and
# tests/build/dist.test.ts exercise — always run this rather than the bare
# `bun build` invocation to get the licenses file and a clean dist/ dir.
build:
	bun run build

# Run all tests
test:
	bun run test

# Run tests except the build-running dist smoke test — fast local loop
test-unit:
	bun run test:unit

# Run the dist smoke test (builds dist/ from scratch, then boots it)
test-dist:
	bun run test:dist

# Lint (no fixes)
lint:
	bun run lint

# Fix linting and formatting issues
format:
	bun run format

# Type-check code
typecheck:
	bun run check
