import { defineConfig } from "tsup";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * Everything declared as a dependency, optional dependency, or peer dependency
 * is kept EXTERNAL so it is never bundled into our output. This is what keeps
 * `mdforge` lightweight: pdfkit/docx/marked and the optional chart stack
 * (canvas, chart.js, plugins) are `require`d at runtime, not inlined. Without
 * this, tsup would inline `canvas` — including its 600KB+ native `.node`
 * binary — into the bundle.
 */
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

/**
 * Build config for the publishable `mdforge` library.
 *
 * Two entry points:
 *   - index            → the full library (markdownToPdf/Docx + normalizer)
 *   - chart-normalizer → the standalone, zero-dependency normalizer + adapter
 *
 * The demo app (src/app, src/components) is NOT part of the build.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "chart-normalizer": "src/lib/chart-normalizer/full.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  // Sourcemaps roughly triple the published size for marginal benefit in a
  // library this small; keep the install featherweight.
  sourcemap: false,
  clean: true,
  treeshake: true,
  splitting: false,
  target: "node18",
  tsconfig: "tsconfig.build.json",
  external,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
