import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/helpers/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    coverage: { provider: "v8", include: ["src/core/**", "src/crypto/**", "src/whiteboard/**", "src/lib/**"] },
  },
});
