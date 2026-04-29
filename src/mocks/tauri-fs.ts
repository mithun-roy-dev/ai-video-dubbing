/**
 * Browser/Vite mock for @tauri-apps/plugin-fs
 */
export async function copyFile(_src: string, _dest: string): Promise<void> {
  console.log(`[mock] copyFile: ${_src} → ${_dest}`)
}
