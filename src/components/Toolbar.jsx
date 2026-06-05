import { useRef } from 'react'
import {
  AlignLeft, Minimize2, Copy, Trash2, Upload, Download,
  ArrowUpDown, Sun, Moon, Check, Pencil, Braces, Play,
} from 'lucide-react'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
const parseShortcut = isMac ? '⌘↵' : 'Ctrl+↵'

function Btn({ onClick, title, children, isDark, active }) {
  const border = isDark ? '#30363d' : '#d0d7de'
  const activeColor = isDark ? '#1f6feb' : '#0969da'
  const bg = active ? activeColor : 'transparent'
  const color = active ? '#fff' : isDark ? '#c9d1d9' : '#24292f'

  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 9px',
        background: bg,
        border: `1px solid ${active ? 'transparent' : border}`,
        borderRadius: 6,
        color, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = isDark ? '#21262d' : '#f3f4f6'
          e.currentTarget.style.borderColor = isDark ? '#58a6ff' : '#0969da'
          e.currentTarget.style.color = isDark ? '#e6edf3' : '#0969da'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = border
          e.currentTarget.style.color = color
        }
      }}
    >
      {children}
    </button>
  )
}

function IconBtn({ onClick, title, children, isDark }) {
  const border = isDark ? '#30363d' : '#d0d7de'
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28,
        background: 'transparent',
        border: `1px solid ${border}`,
        borderRadius: 6,
        color: isDark ? '#8b949e' : '#656d76',
        cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = isDark ? '#21262d' : '#f3f4f6'
        e.currentTarget.style.color = isDark ? '#e6edf3' : '#1f2328'
        e.currentTarget.style.borderColor = isDark ? '#58a6ff' : '#0969da'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = isDark ? '#8b949e' : '#656d76'
        e.currentTarget.style.borderColor = border
      }}
    >
      {children}
    </button>
  )
}

const Sep = ({ isDark }) => (
  <div style={{ width: 1, height: 18, background: isDark ? '#30363d' : '#d0d7de', flexShrink: 0 }} />
)

export default function Toolbar({
  mode, manualParse, onEdit, onParse, onGenerateTypes,
  onFormat, onMinify, onCopy, onClear, onUpload, onDownload,
  onSortKeys, sortKeys, theme, onThemeToggle,
  isDark, copied, hasJson,
}) {
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) onUpload(f)
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>

      {/* Output: Edit + Generate Types; Input + manual: Parse */}
      {mode === 'output' ? (
        <>
          <Btn onClick={onEdit} title="Back to editor" isDark={isDark}>
            <Pencil size={12} /> Edit
          </Btn>
          <Btn onClick={onGenerateTypes} title="Generate type definitions" isDark={isDark}>
            <Braces size={12} /> Generate Types
          </Btn>
          <Sep isDark={isDark} />
        </>
      ) : manualParse ? (
        <>
          <Btn onClick={onParse} title={`Parse JSON (${parseShortcut})`} isDark={isDark}>
            <Play size={12} /> Parse
            <span style={{ opacity: 0.5, fontSize: 10, fontFamily: 'monospace', marginLeft: 2 }}>
              {parseShortcut}
            </span>
          </Btn>
          <Sep isDark={isDark} />
        </>
      ) : null}

      {/* Format / Minify / Sort */}
      <Btn onClick={onFormat} title="Format / Beautify" isDark={isDark}>
        <AlignLeft size={12} /> Format
      </Btn>
      {mode === 'output' && (
        <Btn onClick={onMinify} title="Minify JSON" isDark={isDark}>
          <Minimize2 size={12} /> Minify
        </Btn>
      )}
      <Btn onClick={onSortKeys} title="Sort object keys A→Z" isDark={isDark} active={sortKeys}>
        <ArrowUpDown size={12} /> Sort
      </Btn>

      <Sep isDark={isDark} />

      {/* Icon actions */}
      <IconBtn onClick={onCopy} title="Copy to clipboard" isDark={isDark}>
        {copied
          ? <Check size={13} style={{ color: '#3fb950' }} strokeWidth={2.5} />
          : <Copy size={13} />}
      </IconBtn>

      {/* Upload only in input mode */}
      {mode === 'input' && (
        <IconBtn onClick={() => fileRef.current?.click()} title="Open JSON file" isDark={isDark}>
          <Upload size={13} />
        </IconBtn>
      )}
      <input ref={fileRef} type="file" accept=".json,.txt" onChange={handleFile} style={{ display: 'none' }} />

      <IconBtn onClick={onDownload} title="Download JSON" isDark={isDark} disabled={!hasJson}>
        <Download size={13} />
      </IconBtn>
      <IconBtn onClick={onClear} title="Clear" isDark={isDark}>
        <Trash2 size={13} />
      </IconBtn>

      <Sep isDark={isDark} />

      <IconBtn onClick={onThemeToggle} title="Toggle light/dark theme" isDark={isDark}>
        {isDark ? <Sun size={13} /> : <Moon size={13} />}
      </IconBtn>
    </div>
  )
}
