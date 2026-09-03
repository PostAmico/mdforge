# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Value labels on charts are now drawn by mdforge's own built-in Chart.js plugin. This removes the `chartjs-plugin-datalabels` dependency entirely and fixes a crash where labels on certain pie/arc geometries failed to render headlessly. Pie/doughnut show value + percentage; bar/funnel/waterfall show the value above each item. Labels are on by default and can be disabled per render.

## [0.1.0] - 2026-09-01

Initial public release.

### Added
- `markdownToPdf(content, options?)` — markdown → PDF (`pdfkit`, no headless browser).
- `markdownToDocx(content, options?)` — markdown → editable DOCX (`docx`).
- JSON chart blocks (`json-chart` / `chart` fences) rendered to high-resolution images.
- Chart normalizer: accepts loosely-shaped chart JSON and produces a canonical schema; 22 chart types via a Chart.js adapter. Available standalone at `@postamico/mdforge/chart-normalizer`.
- Optional `canvas` dependency: charts render when installed, and are skipped gracefully otherwise. `isChartRenderingAvailable()` and `ChartRenderingUnavailableError` for control.
- GitHub Flavored Markdown support (tables, task lists, code, blockquotes) plus custom content blocks (`<metrics_grid>`, `<workflow_timeline>`, `<lead_list>`, and more).
- Dual ESM + CJS builds with TypeScript types.

[Unreleased]: https://github.com/PostAmico/mdforge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/PostAmico/mdforge/releases/tag/v0.1.0
