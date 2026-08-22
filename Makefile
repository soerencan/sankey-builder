.PHONY: lint format typecheck freshness check build watch test

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
# The esbuild option set (bundle, format=iife, no minify, no extra flags)
# lives once in package.json's "bundle" script; this target, watch, and
# freshness all invoke it rather than repeating the flags, so the artifact
# they build/check can't drift.
build:
	bun run build

# Rebuild on change, for local dev against the file:// artifact
watch:
	bun run watch

# Verify the committed app.js is up to date with src/, without assuming a
# clean worktree (no git diff — see PLAN.md "Committed bundle").
freshness:
	mkdir -p .scratch
	bun run bundle --outfile=.scratch/app.js
	cmp app.js .scratch/app.js || { echo "app.js is stale — run make build"; exit 1; }

check: typecheck freshness

# Run all tests
test:
	bun run test
