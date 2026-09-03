# Contributing to mdforge

Thanks for your interest in improving mdforge! This guide covers the basics.

## Getting started

```bash
git clone https://github.com/PostAmico/mdforge.git
cd mdforge
npm install
```

`canvas` is an optional native dependency used for chart rendering. On most
systems `npm install` builds it automatically; if it fails, see the
[node-canvas install guide](https://github.com/Automattic/node-canvas#compiling)
for the required system libraries. The library and its non-chart tests work
without it.

## Project layout

- `src/index.ts` — public package entry point.
- `src/lib/export/` — the PDF and DOCX pipelines (`markdown-to-pdf.ts`, `markdown-to-docx.ts`), chart extraction, and preprocessing.
- `src/lib/chart-normalizer/` — the pure, zero-dependency chart normalizer and the Chart.js adapter.
- `src/app/`, `src/components/` — the Next.js demo app (not part of the published package).
- `test/` — the Vitest suite.

## Development scripts

| Script | What it does |
| ------ | ------------ |
| `npm run typecheck` | Type-check the library (`tsconfig.build.json`). |
| `npm test` | Run the Vitest suite. |
| `npm run build` | Build the publishable library with tsup. |
| `npm run demo:dev` | Run the live Next.js demo. |

## Before opening a pull request

1. Add or update tests for your change. The test suite is the spec, especially
   for the normalizer — new input shapes should come with a fixture.
2. Run `npm run typecheck` and `npm test`; both must pass.
3. Keep the public API stable, or note breaking changes in `CHANGELOG.md`.
4. Keep the core lightweight — avoid adding runtime dependencies to the library
   without discussion. Chart-related deps belong in `optionalDependencies`.

## Reporting bugs

Open an issue with a minimal reproduction: the markdown or chart JSON input, the
expected output, and what you got instead.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
