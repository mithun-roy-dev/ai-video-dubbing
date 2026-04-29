import { useState, useRef, useEffect } from 'react'
import { LANGUAGES, QUICK_PAIRS } from '../lib/languages'
import { useAppStore } from '../store/useAppStore'

interface LanguageDropdownProps {
  id: string
  value: string
  onChange: (code: string) => void
  label: string
}

function LanguageDropdown({ id, value, onChange, label }: LanguageDropdownProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(query.toLowerCase()) ||
      l.code.toLowerCase().includes(query.toLowerCase())
  )

  const selectedLang = LANGUAGES.find((l) => l.code === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="lang-dropdown" ref={ref}>
      <label className="lang-dropdown__label">{label}</label>
      <button
        id={id}
        className="lang-dropdown__trigger"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="lang-dropdown__value">
          {selectedLang ? `${selectedLang.name} (${selectedLang.code})` : 'Select language'}
        </span>
        <span className={`lang-dropdown__arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="lang-dropdown__menu">
          <input
            className="lang-dropdown__search"
            placeholder="Search language..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className="lang-dropdown__list">
            {filtered.map((lang) => (
              <li
                key={lang.code}
                className={`lang-dropdown__item ${lang.code === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(lang.code)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span>{lang.name}</span>
                <span className="lang-dropdown__native">{lang.nativeName}</span>
                <span className="lang-dropdown__code">{lang.code}</span>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="lang-dropdown__empty">No languages found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function LanguageSelect() {
  const { sourceLang, targetLang, setSourceLang, setTargetLang } = useAppStore()

  const swapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
  }

  return (
    <div className="lang-select-wrapper">
      <div className="lang-select-row">
        <LanguageDropdown
          id="source-language"
          value={sourceLang}
          onChange={setSourceLang}
          label="Source Language"
        />
        <button
          id="swap-languages"
          className="lang-swap-btn"
          onClick={swapLanguages}
          title="Swap languages"
          type="button"
        >
          ⇄
        </button>
        <LanguageDropdown
          id="target-language"
          value={targetLang}
          onChange={setTargetLang}
          label="Target Language"
        />
      </div>

      <div className="quick-pairs">
        <span className="quick-pairs__label">Quick select:</span>
        {QUICK_PAIRS.map((pair) => (
          <button
            key={`${pair.src}-${pair.tgt}`}
            id={`quick-pair-${pair.src}-${pair.tgt}`}
            className={`quick-pair-btn ${sourceLang === pair.src && targetLang === pair.tgt ? 'active' : ''}`}
            onClick={() => {
              setSourceLang(pair.src)
              setTargetLang(pair.tgt)
            }}
            type="button"
          >
            {pair.label}
          </button>
        ))}
      </div>
    </div>
  )
}
