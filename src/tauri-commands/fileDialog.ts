import { open, save } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'

/**
 * Open a native OS file picker for video files.
 * Returns the selected file path, or null if cancelled.
 */
export async function pickVideoFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: 'Video Files',
        extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm'],
      },
    ],
  })
  return typeof result === 'string' ? result : null
}

/**
 * Open a native OS folder picker.
 * Returns the selected folder path, or null if cancelled.
 */
export async function pickFolder(): Promise<string | null> {
  const result = await open({
    multiple: false,
    directory: true,
  })
  return typeof result === 'string' ? result : null
}

/**
 * Open a native OS save dialog for the dubbed output video.
 */
export async function saveVideoAs(defaultName: string): Promise<string | null> {
  const result = await save({
    defaultPath: defaultName,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  })
  return result ?? null
}

/**
 * Reveal a file in Finder (macOS) or Explorer (Windows).
 */
export async function openInExplorer(filePath: string): Promise<void> {
  await revealItemInDir(filePath)
}
