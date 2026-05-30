import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { LANGUAGES } from '../utils/generateTypes'

export default function GenerateModal({ data, isDark, onClose }) {
  const [selectedLang, setSelectedLang] = useState('typescript')
  const [copied, setCopied] = useState(false)
  const [output, setOutput] = useState('')

  const C = {
    bg:       isDark ? '#0d1117' : '#ffffff',
    overlay:  'rgba(0,0,0,0.6)',
    header:   isDark ? '#161b22' : '#f6f8fa',
    border:   isDark ? '#30363d' : '#d0d7de',
    text:     isDark ? '#e6edf3' : '#1f2328',
    muted:    isDark ? '#8b949e' : '#656d76',
    sidebar:  isDark ? '#0d1117' : '#f6f8fa',
    sideHov:  isDark ? '#21262d' : '#eaeef2',
    selBg:    isDark ? '#21262d' : '#dbeafe',
    selText:  isDark ? '#58a6ff' : '#0969da',
    codeBg:   isDark ? '#161b22' : '#f6f8fa',
    accent:   '#58a6ff',
  }

  useEffect(() => {
    const lang = LANGUAGES.find(l => l.id === selectedLang)
    if (!lang || !data) { setOutput(''); return }
    try {
      setOutput(lang.fn(data))
    } catch (e) {
      setOutput(`// Error generating types:\n// ${e.message}`)
    }
  }, [selectedLang, data])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [output])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const currentLang = LANGUAGES.find(l => l.id === selectedLang)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: C.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 820, height: '80vh', maxHeight: 640,
        background: C.bg, borderRadius: 10,
        border: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: C.header,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Generate Types</span>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, cursor: 'pointer', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#21262d' : '#eaeef2'; e.currentTarget.style.color = C.text }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Sidebar */}
          <div style={{
            width: 160, flexShrink: 0,
            borderRight: `1px solid ${C.border}`,
            background: C.sidebar,
            overflowY: 'auto', padding: '8px 6px',
          }}>
            {LANGUAGES.map(lang => {
              const active = lang.id === selectedLang
              return (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLang(lang.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', marginBottom: 1,
                    borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    background: active ? C.selBg : 'transparent',
                    color: active ? C.selText : C.muted,
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.sideHov; e.currentTarget.style.color = C.text } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted } }}
                >
                  {lang.label}
                </button>
              )
            })}
          </div>

          {/* Code panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Code toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px',
              borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
              background: C.codeBg,
            }}>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>
                {currentLang?.label}.{currentLang?.ext}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 5,
                  border: `1px solid ${C.border}`,
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 11, fontWeight: 500, color: C.muted,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
              >
                {copied
                  ? <><Check size={11} style={{ color: '#3fb950' }} /> Copied</>
                  : <><Copy size={11} /> Copy</>
                }
              </button>
            </div>

            {/* Code output */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <pre style={{
                margin: 0,
                fontSize: 12, lineHeight: 1.65,
                fontFamily: "'Menlo','Monaco','Consolas',monospace",
                color: C.text,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {output || '// No data'}
              </pre>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
