# Contributing

Thanks for your interest in MTG Collector. This is a personal project
maintained on spare time: issues and small pull requests are welcome, large
changes should start with an issue so we can agree on the approach first.

## Development setup

See [doc/installation.md](doc/installation.md) to run the stack with Docker
Compose, then:

```bash
cd backend && npm ci && npm run lint && npm test
cd frontend && npm ci && npm run lint && npm test && npm run build
```

Backend integration tests need PostgreSQL and Redis and run when
`RUN_DB_TESTS=1` is set (CI does this).

## Conventions

- Code, comments and commit messages in English.
- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `docs:`, `refactor:`, `chore:`. One commit per logical change.
- CI (lint, tests, build) must pass.

## License

By contributing, you agree that your contributions are licensed under the
[GNU AGPL-3.0](LICENSE).
