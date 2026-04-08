# Contributing to Claw Design

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/prodoxx/claw-design.git
cd claw-design

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start in dev mode (hot reload for Electron)
npm run dev
```

## Project Structure

```
src/
  cli/          # CLI entry point and commands
  main/         # Electron main process
  renderer/     # Overlay and sidebar HTML/CSS/JS
  preload/      # IPC bridge scripts (preload scripts)
tests/          # Vitest tests
```

## Making Changes

1. Fork the repository
2. Create a branch from `main` (`git checkout -b my-feature`)
3. Implement your changes
4. Add or update tests as needed
5. Run `npm test` to verify everything passes
6. Open a pull request

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Every commit message should have a type prefix:

| Type | Purpose |
|------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `test:` | Adding or updating tests |
| `refactor:` | Code cleanup, no behavior change |
| `chore:` | Maintenance, dependencies, tooling |

Example:

```
feat: add keyboard shortcut for selection mode
fix: prevent overlay from blocking scroll events
docs: update CLI options table in README
```

## Pull Request Process

1. Fill out the PR template completely
2. Ensure `npm test` passes
3. One approval is required before merging
4. Keep PRs focused -- one feature or fix per PR

## Reporting Issues

Use the GitHub issue templates when filing bugs or requesting features:

- **Bug reports**: Include reproduction steps, expected vs actual behavior, and your environment info
- **Feature requests**: Describe the problem you're trying to solve, not just the solution you want

## Code Style

- TypeScript strict mode is enabled
- Tests use Vitest
- Follow existing patterns in the codebase
- Run `npm run typecheck` to verify types before submitting

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
