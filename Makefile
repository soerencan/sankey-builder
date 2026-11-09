.PHONY: dev build test test-unit test-dist lint format typecheck

dev:
	bun run dev

# Use this instead of bare `bun build` so dist/ is cleaned and third-party
# license notices are generated.
build:
	bun run build

test:
	bun run test

test-unit:
	bun run test:unit

test-dist:
	bun run test:dist

lint:
	bun run lint

format:
	bun run format

typecheck:
	bun run check
