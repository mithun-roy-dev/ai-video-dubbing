import { useRef, useEffect, useState } from 'react'
import { useJobStore } from '../store/useJobStore'

export function LogViewer() {
  const { logs } = useJobStore()
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!collapsed && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, collapsed])

  return (
    <div className="log-viewer">
      <button
        id="log-toggle"
        className="log-viewer__toggle"
        onClick={() => setCollapsed((c) => !c)}
        type="button"
      >
        {collapsed ? '▶ Show Live Log' : '▼ Hide Live Log'}
        <span className="log-viewer__count">{logs.length} lines</span>
      </button>

      {!collapsed && (
        <div className="log-viewer__content">
          <textarea
            readOnly
            className="log-viewer__textarea"
            value={logs.join('\n')}
            aria-label="Live processing log"
          />
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
