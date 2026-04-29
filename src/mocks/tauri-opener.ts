/**
 * Browser/Vite mock for @tauri-apps/plugin-opener
 */
export async function revealItemInDir(_path: string): Promise<void> {
  console.log(`[mock] revealItemInDir: ${_path}`)
}
