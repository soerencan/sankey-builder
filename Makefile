.PHONY: lint format typecheck check test

# Lint (no fixes)
lint:
	bun run lint

# Fix linting and formatting issues
format:
	bun run format

# Type-check code
typecheck:
	bun run check

check: typecheck

# Run tests
test:
	bun run test
