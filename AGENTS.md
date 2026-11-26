This is my personal watch-list app.
The main function is to show me what tv series or movie I should watch next.

## Development

### Taste

- No Amending. Never use `git commit --amend`. Always create new, discrete commits for every set of changes.
- Inferred types over annotations. `any` is the enemy.

### Build and Test

- This project uses bun. Examples: `bun run lint`, `bun run build`, `bun run test --no-watch`.
- Run a single spec file: `bun run test -- --include="src/app/utils/form.utils.spec.ts" --no-watch`
- Run a single test by name (regex): `bun run test -- --filter="toPositiveNumber" --no-watch`
- To get test code coverage run: `bun run test -- --coverage --no-watch`
- Browser test (one journey against the production build, slow): `bun run e2e`. On NixOS point it at a system browser: `E2E_CHROMIUM_PATH=$(which chromium) bun run e2e`. Keep it to this single journey; cover everything else with Vitest specs.
