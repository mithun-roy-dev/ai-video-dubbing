/**
 * Browser/Vite mock for @tauri-apps/plugin-dialog
 */
export async function open(_opts?: unknown): Promise<string | null> {
  // Use a real browser file picker for a better development experience
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*'
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Return a simulated full path based on the file name
        resolve(`C:\\Users\\User\\Videos\\${file.name}`)
      } else {
        resolve(null)
      }
      document.body.removeChild(input)
    }

    input.oncancel = () => {
      resolve(null)
      document.body.removeChild(input)
    }

    input.style.display = 'none'
    document.body.appendChild(input)
    input.click()
  })
}


export async function save(_opts?: unknown): Promise<string | null> {
  return '/demo/output_dubbed_en.mp4'
}
