/**
 * Browser/Vite mock for Tauri APIs.
 * Used when running `npm run dev` (no Rust/Tauri shell).
 * In the real Tauri desktop app, these are replaced by native implementations.
 */

// ─── @tauri-apps/plugin-shell mock ───────────────────────────────────────────
export class Command {
  static sidecar(_bin: string) {
    return {
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      spawn: async () => ({ kill: async () => {} }),
      stdin: { write: async () => {} },
    }
  }
}

export class Child {
  kill = async () => {}
}
