/**
 * Browser/Vite mock for Tauri APIs.
 * Used when running `npm run dev` (no Rust/Tauri shell).
 * In the real Tauri desktop app, these are replaced by native implementations.
 */

// ─── @tauri-apps/plugin-shell mock ───────────────────────────────────────────
export class Command {
  static sidecar(_bin: string) {
    const stdoutListeners: ((data: string) => void)[] = []
    const stderrListeners: ((data: string) => void)[] = []

    return {
      stdout: {
        on: (_event: string, cb: (data: string) => void) => stdoutListeners.push(cb),
      },
      stderr: {
        on: (_event: string, cb: (data: string) => void) => stderrListeners.push(cb),
      },
      spawn: async () => {
        // Simulate a running process
        setTimeout(() => {
          stdoutListeners.forEach((cb) => cb(JSON.stringify({ event: 'progress', step: 1, step_name: 'Downloading Video', pct: 10, message: 'Fetching from YouTube...' })))
        }, 1000)
        setTimeout(() => {
          stdoutListeners.forEach((cb) => cb(JSON.stringify({ event: 'progress', step: 2, step_name: 'Extracting Audio', pct: 30, message: 'Converting to MP3...' })))
        }, 3000)
        setTimeout(() => {
          stdoutListeners.forEach((cb) => cb(JSON.stringify({ event: 'progress', step: 3, step_name: 'Transcribing', pct: 50, message: 'Whisper AI is processing...' })))
        }, 5000)
        setTimeout(() => {
          stdoutListeners.forEach((cb) => cb(JSON.stringify({ event: 'done', output_path: 'output.mp4', cost_usd: 0.05, duration_sec: 120 })))
        }, 8000)

        return { kill: async () => {} }
      },
      stdin: {
        write: async (data: string) => {
          const config = JSON.parse(data)
          const isYoutube = !!config.params.youtube_url
          const target = config.params.youtube_url || config.params.video_path
          console.log('[Mock Sidecar Stdin]:', config)

          // Step 1: Initial detection
          setTimeout(() => {
            stdoutListeners.forEach((cb) =>
              cb(
                JSON.stringify({
                  event: 'progress',
                  step: 1,
                  step_name: isYoutube ? 'Download' : 'Load Video',
                  pct: 10,
                  message: isYoutube 
                    ? `Fetching from YouTube: ${target}`
                    : `Loading local file: ${target.split(/[\\/]/).pop()}`,
                })
              )
            )
          }, 500)

          // Step 2: Extraction
          setTimeout(() => {
            stdoutListeners.forEach((cb) =>
              cb(
                JSON.stringify({
                  event: 'progress',
                  step: 2,
                  step_name: 'Extract Audio',
                  pct: 30,
                  message: 'Splitting audio from video stream...',
                })
              )
            )
          }, 2500)

          // Step 3: Transcription
          setTimeout(() => {
            stdoutListeners.forEach((cb) =>
              cb(
                JSON.stringify({
                  event: 'progress',
                  step: 3,
                  step_name: 'Transcription',
                  pct: 60,
                  message: 'Running AI transcription...',
                })
              )
            )
          }, 5000)

          // Final: Done
          setTimeout(() => {
            stdoutListeners.forEach((cb) =>
              cb(
                JSON.stringify({
                  event: 'done',
                  output_path: 'output.mp4',
                  cost_usd: 0.05,
                  duration_sec: 120,
                })
              )
            )
          }, 8000)
        },
      },
    }
  }
}



export class Child {
  kill = async () => {}
}

