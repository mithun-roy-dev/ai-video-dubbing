import { useCallback, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

const VALID_EXTENSIONS = ['mp4', 'mkv', 'mov', 'avi', 'webm']
const SUPPORTED_LABEL = 'MP4  MKV  MOV  AVI  WebM'

function getExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

interface DropZoneProps {
  onFileSelect: (path: string) => void
}

export function DropZone({ onFileSelect }: DropZoneProps) {
  const { videoPath, setVideoPath } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      const ext = getExtension(file.name)
      if (!VALID_EXTENSIONS.includes(ext)) {
        setError(`Unsupported format "${ext.toUpperCase()}". Please use: ${SUPPORTED_LABEL}`)
        return
      }
      setError(null)
      // In Tauri we get the path from the drag event
      const path = (file as unknown as { path?: string }).path ?? file.name
      setVideoPath(path)
      onFileSelect(path)
    },
    [setVideoPath, onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleClick = async () => {
    // Dynamically import to avoid issues in non-Tauri environments
    try {
      const { pickVideoFile } = await import('../tauri-commands/fileDialog')
      const path = await pickVideoFile()
      if (path) {
        setVideoPath(path)
        onFileSelect(path)
        setError(null)
      }
    } catch (err) {
      console.error('File dialog error:', err)
    }
  }

  return (
    <div className="dropzone-wrapper">
      <div
        id="video-dropzone"
        className={`dropzone ${isDragging ? 'dropzone--dragging' : ''} ${videoPath ? 'dropzone--filled' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Video file drop zone"
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        {videoPath ? (
          <div className="dropzone__filled">
            <div className="dropzone__icon">🎬</div>
            <div className="dropzone__filename">{videoPath.split(/[\\/]/).pop()}</div>
            <button
              className="dropzone__clear"
              onClick={(e) => {
                e.stopPropagation()
                setVideoPath(null)
              }}
            >
              ✕ Remove
            </button>
          </div>
        ) : (
          <div className="dropzone__empty">
            <div className="dropzone__icon">📁</div>
            <p className="dropzone__label">Drop video here or click to upload</p>
            <p className="dropzone__formats">{SUPPORTED_LABEL}</p>
          </div>
        )}
      </div>
      {error && <p className="dropzone__error">{error}</p>}
    </div>
  )
}
