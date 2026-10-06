import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
    // src-tauri holds no frontend sources; watching it makes Vite choke on
    // cargo-locked build artifacts (EBUSY on Windows) during `tauri dev`.
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: { target: "esnext" }
});
