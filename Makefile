.PHONY: lint format typecheck freshness check build watch test test-unit test-smoke

# Lint (no fixes)
lint:
	bun run lint

# Fix linting and formatting issues
format:
	bun run format

# Type-check code
typecheck:
	bun run check

# Build the committed app.js bundle from src/
#
# Must use the exact same esbuild option set as tests/smoke.test.ts
# (bundle, format=iife, no minify, no extra flags) so the artifact the smoke
# test exercises matches the one this target produces and commits.
build:
	bun run build

# Rebuild on change, for local dev against the file:// artifact
watch:
	bun run watch

# Verify the committed app.js is up to date with src/, without assuming a
# clean worktree (no git diff — see PLAN.md "Committed bundle").
freshness:
	mkdir -p .scratch
	bun x esbuild src/main.ts --bundle --format=iife --outfile=.scratch/app.js
	cmp app.js .scratch/app.js || { echo "app.js is stale — run make build"; exit 1; }

check: typecheck freshness

# Run all tests
test:
	bun run test

# Run unit tests only (excludes the artifact smoke test)
test-unit:
	bun run test:unit

# Run only the artifact smoke test
test-smoke:
	bun run test:smoke
