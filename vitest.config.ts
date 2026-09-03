import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // The export tests generate real PDF/DOCX/PNG buffers, which can take a
    // moment on the first canvas/chart.js load.
    testTimeout: 20000,
  },
});
