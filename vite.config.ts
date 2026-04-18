import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/app.ts",
    outDir: "dist",
    target: "node20",
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "app.js"
      }
    }
  }
});
