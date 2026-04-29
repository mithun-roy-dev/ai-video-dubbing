/**
 * Browser/Vite mock for @tauri-apps/plugin-dialog
 */
export async function open(_opts?: unknown): Promise<string | null> {
  // Simulate picking a file — return a fake path for dev preview
  return '/demo/sample_hindi_video.mp4'
}

export async function save(_opts?: unknown): Promise<string | null> {
  return '/demo/output_dubbed_en.mp4'
}
