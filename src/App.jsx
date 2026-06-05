import { useState, useCallback, useEffect, useMemo } from 'react'
import Editor from './components/Editor'
import TreeView from './components/TreeView'
import GraphView from './components/GraphView'
import Toolbar from './components/Toolbar'
import StatusBar from './components/StatusBar'
import GenerateModal from './components/GenerateModal'

function computeStats(input, parsed) {
  const byteSize = new Blob([input]).size
  const lines = input ? input.split('\n').length : 0
  if (!parsed) return { byteSize, lines, keys: 0, depth: 0 }

  let keyCount = 0
  function countKeys(obj) {
    if (obj === null || typeof obj !== 'object') return
    const ks = Object.keys(obj)
    keyCount += ks.length
    ks.forEach(k => countKeys(obj[k]))
  }
  countKeys(parsed)

  function getDepth(obj) {
    if (obj === null || typeof obj !== 'object') return 0
    const vals = Object.values(obj)
    if (!vals.length) return 1
    return 1 + Math.max(...vals.map(getDepth))
  }

  return { byteSize, lines, keys: keyCount, depth: getDepth(parsed) }
}

export default function App() {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('input') // 'input' | 'output'
  const [theme, setTheme] = useState('dark')
  const [viewMode, setViewMode] = useState('tree')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState('')
  const [sortKeys, setSortKeys] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [copied, setCopied] = useState(false)
  const [forceRevision, setForceRevision] = useState(0)
  const [forceTarget, setForceTarget] = useState('collapsed')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [manualParse, setManualParse] = useState(false)

  const forceTree = useCallback((target) => {
    setForceTarget(target)
    setForceRevision(r => r + 1)
  }, [])

  // Auto-parse while in auto mode (before user has ever clicked Edit)
  useEffect(() => {
    if (manualParse) return
    if (!input.trim()) { setParsed(null); setError(null); return }
    try { setParsed(JSON.parse(input)); setError(null) }
    catch (e) { setError(e.message); setParsed(null) }
  }, [input, manualParse])

  useEffect(() => {
    if (manualParse) return
    if (parsed !== null) setMode(prev => prev === 'input' ? 'output' : prev)
  }, [parsed, manualParse])

  const handleParse = useCallback(() => {
    if (!input.trim()) { setParsed(null); setError(null); return }
    try { setParsed(JSON.parse(input)); setError(null); setMode('output') }
    catch (e) { setError(e.message); setParsed(null) }
  }, [input])

  const handleFormat = useCallback(() => {
    try { setInput(JSON.stringify(JSON.parse(input), null, 2)) } catch {}
  }, [input])

  const handleMinify = useCallback(() => {
    try { setInput(JSON.stringify(JSON.parse(input))) } catch {}
  }, [input])

  const handleCopy = useCallback(async () => {
    const content = parsed ? JSON.stringify(parsed, null, 2) : input
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [parsed, input])

  const handleClear = useCallback(() => {
    setInput('')
    setParsed(null)
    setError(null)
    setSelectedPath('')
    setSearchQuery('')
    setMode('input')
    setManualParse(false)
  }, [])

  const handleUpload = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => setInput(e.target.result)
    reader.readAsText(file)
  }, [])

  const handleDownload = useCallback(() => {
    const content = parsed ? JSON.stringify(parsed, null, 2) : input
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [parsed, input])

  const handleEdit = useCallback(() => {
    setManualParse(true)
    setMode('input')
    setSelectedPath('')
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return
      e.preventDefault()
      if (mode === 'input' && manualParse) handleParse()
      else if (mode === 'output') handleEdit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, manualParse, handleParse, handleEdit])

  const stats = useMemo(() => computeStats(input, parsed), [input, parsed])

  const matchCount = useMemo(() => {
    if (!searchQuery || !parsed) return 0
    const q = caseSensitive ? searchQuery : searchQuery.toLowerCase()
    const check = (text) => {
      const t = caseSensitive ? String(text) : String(text).toLowerCase()
      return t.includes(q) ? 1 : 0
    }
    let count = 0
    function traverse(value, key) {
      const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
      if (key !== undefined) count += check(key)
      if (type !== 'object' && type !== 'array') count += check(type === 'null' ? 'null' : value)
      if (type === 'object') Object.entries(value).forEach(([k, v]) => traverse(v, k))
      if (type === 'array') value.forEach(v => traverse(v, undefined))
    }
    traverse(parsed, undefined)
    return count
  }, [parsed, searchQuery, caseSensitive])

  const isDark = theme === 'dark'
  const C = {
    bg:        isDark ? '#0d1117' : '#ffffff',
    headerBg:  isDark ? '#161b22' : '#f6f8fa',
    border:    isDark ? '#30363d' : '#d0d7de',
    text:      isDark ? '#e6edf3' : '#1f2328',
    muted:     isDark ? '#8b949e' : '#656d76',
    searchBg:  isDark ? '#0d1117' : '#ffffff',
    accent:    '#58a6ff',
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', gap: 12,
        background: C.headerBg,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: C.text }}>
            JSON<span style={{ color: C.accent }}>Parse</span>
          </span>
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', background: isDark ? '#21262d' : '#eaeef2', borderRadius: 20, color: C.muted }}>
            v1.0
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
        <Toolbar
          mode={mode}
          manualParse={manualParse}
          onEdit={handleEdit}
          onParse={handleParse}
          onGenerateTypes={() => setShowGenerateModal(true)}
          onFormat={handleFormat}
          onMinify={handleMinify}
          onCopy={handleCopy}
          onClear={handleClear}
          onUpload={handleUpload}
          onDownload={handleDownload}
          onSortKeys={() => setSortKeys(s => !s)}
          sortKeys={sortKeys}
          theme={theme}
          onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          isDark={isDark}
          copied={copied}
          hasJson={!!parsed}
        />
        <a
          href="https://github.com/chetanakashV/json-parse"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, flexShrink: 0,
            color: isDark ? '#8b949e' : '#656d76',
            border: `1px solid ${isDark ? '#30363d' : '#d0d7de'}`,
            borderRadius: 6,
            transition: 'all 0.12s',
            textDecoration: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark ? '#21262d' : '#f3f4f6'
            e.currentTarget.style.color = isDark ? '#e6edf3' : '#1f2328'
            e.currentTarget.style.borderColor = isDark ? '#58a6ff' : '#0969da'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = isDark ? '#8b949e' : '#656d76'
            e.currentTarget.style.borderColor = isDark ? '#30363d' : '#d0d7de'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {mode === 'input' ? (
          /* ── Input mode: full-screen editor ── */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {error && input.trim() && (
              <div style={{
                padding: '6px 16px',
                background: isDark ? 'rgba(248,81,73,0.08)' : '#fff5f4',
                borderBottom: `1px solid ${isDark ? 'rgba(248,81,73,0.3)' : '#f5a9a7'}`,
                color: isDark ? '#f85149' : '#c63333',
                fontSize: 12, fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                {error}
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor value={input} onChange={setInput} theme={theme} isDark={isDark} />
            </div>
          </div>
        ) : (
          /* ── Output mode: tabbed view ── */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Sub-header: view tabs + search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 12px',
              borderBottom: `1px solid ${C.border}`,
              background: C.headerBg,
              flexShrink: 0,
            }}>
              {/* View tabs */}
              <div style={{ display: 'flex', background: isDark ? '#0d1117' : '#eaeef2', borderRadius: 7, padding: 2, gap: 1, flexShrink: 0 }}>
                {[['tree', 'Tree'], ['graph', 'Graph'], ['raw', 'Raw']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setViewMode(val)}
                    style={{
                      padding: '3px 12px',
                      borderRadius: 5,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      background: viewMode === val ? (isDark ? '#21262d' : '#ffffff') : 'transparent',
                      color: viewMode === val ? (isDark ? '#e6edf3' : '#1f2328') : (isDark ? '#8b949e' : '#656d76'),
                      boxShadow: viewMode === val ? (isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.1)') : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Expand / Collapse all — tree only */}
              {viewMode === 'tree' && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {[['Expand All', 'expanded'], ['Collapse All', 'collapsed']].map(([label, target]) => (
                    <button
                      key={target}
                      onClick={() => forceTree(target)}
                      style={{
                        padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 500,
                        border: `1px solid ${C.border}`, background: 'transparent',
                        color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Search (hidden for graph view) */}
              {viewMode !== 'graph' && (
                <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search keys and values…"
                    style={{
                      width: '100%',
                      background: C.searchBg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: '4px 10px',
                      paddingRight: searchQuery ? 96 : 40,
                      fontSize: 12, color: C.text,
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = C.accent }}
                    onBlur={e => { e.target.style.borderColor = C.border }}
                  />
                  {/* Right side: count + Aa toggle */}
                  <div style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'all',
                  }}>
                    {searchQuery && (
                      <span style={{
                        fontSize: 11, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                        color: matchCount > 0 ? (isDark ? '#8b949e' : '#656d76') : '#f85149',
                        minWidth: 24, textAlign: 'right',
                      }}>
                        {matchCount}
                      </span>
                    )}
                    <button
                      onClick={() => setCaseSensitive(c => !c)}
                      title={caseSensitive ? 'Case sensitive (on)' : 'Case sensitive (off)'}
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        border: `1px solid ${caseSensitive ? C.accent : C.border}`,
                        background: caseSensitive ? (isDark ? 'rgba(88,166,255,0.15)' : 'rgba(9,105,218,0.08)') : 'transparent',
                        color: caseSensitive ? C.accent : C.muted,
                        fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', lineHeight: 1.6,
                        fontFamily: 'system-ui',
                        transition: 'all 0.12s',
                        userSelect: 'none',
                      }}
                    >
                      Aa
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            {viewMode === 'graph' ? (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <GraphView data={parsed} isDark={isDark} />
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto', padding: viewMode === 'raw' ? 16 : 12 }}>
                {viewMode === 'tree' ? (
                  <TreeView
                    data={parsed}
                    searchQuery={searchQuery}
                    caseSensitive={caseSensitive}
                    sortKeys={sortKeys}
                    onPathSelect={setSelectedPath}
                    isDark={isDark}
                    forceRevision={forceRevision}
                    forceTarget={forceTarget}
                  />
                ) : (
                  <pre style={{
                    fontSize: 13, lineHeight: 1.6,
                    fontFamily: "'Menlo', 'Monaco', 'Consolas', monospace",
                    color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(parsed, sortKeys ? (_, v) => {
                      if (v && typeof v === 'object' && !Array.isArray(v))
                        return Object.fromEntries(Object.entries(v).sort())
                      return v
                    } : undefined, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <StatusBar
        error={mode === 'input' ? error : null}
        stats={stats}
        selectedPath={selectedPath}
        isDark={isDark}
        border={C.border}
      />

      {showGenerateModal && (
        <GenerateModal
          data={parsed}
          isDark={isDark}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  )
}
