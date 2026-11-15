import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "bundle",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      external: ["/static/anna-apps/_sdk/latest/index.js"]
    }
  }
});
