.PHONY: dev build test test-unit test-dist test-browser test-browser-ui test-browser-ci test-browser-snapshots lint format typecheck

PLAYWRIGHT_IMAGE = mcr.microsoft.com/playwright:v1.65.0-noble
PLAYWRIGHT_DOCKER = docker run --rm --init --ipc=host --platform linux/amd64 -e CI=1 -e PLAYWRIGHT_VISUAL_TESTS=1 -v "$(CURDIR):/work" -w /work $(PLAYWRIGHT_IMAGE) node node_modules/@playwright/test/cli.js

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

test-browser: build
	bun run test:browser

test-browser-ui: build
	bun run test:browser:ui

# CI reuses the production output checked by test-dist.
test-browser-ci:
	$(PLAYWRIGHT_DOCKER) test

test-browser-snapshots: build
	$(PLAYWRIGHT_DOCKER) test --project=visual --update-snapshots

lint:
	bun run lint

format:
	bun run format

typecheck:
	bun run check
