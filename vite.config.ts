import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isTauriDev = !!process.env.TAURI_ENV_TARGET_TRIPLE;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,

  // Alias Tauri plugins to mocks when running plain `npm run dev` (no Tauri shell)
  resolve: {
    alias: isTauriDev
      ? {}
      : {
          "@tauri-apps/plugin-shell": path.resolve(__dirname, "src/mocks/tauri-shell.ts"),
          "@tauri-apps/plugin-dialog": path.resolve(__dirname, "src/mocks/tauri-dialog.ts"),
          "@tauri-apps/plugin-fs": path.resolve(__dirname, "src/mocks/tauri-fs.ts"),
          "@tauri-apps/plugin-opener": path.resolve(__dirname, "src/mocks/tauri-opener.ts"),
        },
  },

  server: {
    port: 3420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

