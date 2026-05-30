import { useState, useCallback, useEffect, useMemo, memo } from 'react'

const DARK = {
  string:    '#a8cc8c',
  number:    '#d2a679',
  boolean:   '#569cd6',
  null:      '#c586c0',
  key:       '#9cdcfe',
  bracket:   '#ffd700',
  index:     '#8b949e',
  muted:     '#8b949e',
  rowHover:  '#161b22',
  copyHover: '#e6edf3',
}
const LIGHT = {
  string:    '#22863a',
  number:    '#e36209',
  boolean:   '#0550ae',
  null:      '#8250df',
  key:       '#0550ae',
  bracket:   '#953800',
  index:     '#656d76',
  muted:     '#656d76',
  rowHover:  '#f6f8fa',
  copyHover: '#1f2328',
}

function getType(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function textContains(text, query, caseSensitive) {
  if (!query) return false
  const t = caseSensitive ? String(text) : String(text).toLowerCase()
  const q = caseSensitive ? query : query.toLowerCase()
  return t.includes(q)
}

function subtreeHasMatch(value, query, caseSensitive) {
  if (!query) return false
  function walk(v, key) {
    if (key !== undefined && textContains(key, query, caseSensitive)) return true
    const t = getType(v)
    if (t !== 'object' && t !== 'array') return textContains(String(v), query, caseSensitive)
    if (t === 'object') return Object.entries(v).some(([k, cv]) => walk(cv, k))
    if (t === 'array') return v.some(item => walk(item, undefined))
    return false
  }
  return walk(value, undefined)
}

function HighlightText({ text, query, caseSensitive }) {
  const str = String(text)
  if (!query) return <>{str}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let parts
  try { parts = str.split(new RegExp(`(${escaped})`, caseSensitive ? 'g' : 'gi')) }
  catch { return <>{str}</> }
  if (parts.length === 1) return <>{str}</>
  return (
    <>
      {parts.map((p, i) => i % 2 === 1
        ? <mark key={i} style={{ background: '#fbbf24', color: '#111', borderRadius: 2, padding: '0 1px' }}>{p}</mark>
        : p
      )}
    </>
  )
}

const TreeNode = memo(function TreeNode({
  keyName, value, depth, searchQuery, caseSensitive, sortKeys,
  onPathSelect, path, colors, forceRevision, forceTarget,
}) {
  const type = getType(value)
  const isExpandable = type === 'object' || type === 'array'
  const [collapsed, setCollapsed] = useState(depth >= 2)
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  // Respond to collapse-all / expand-all
  useEffect(() => {
    if (forceRevision > 0) setCollapsed(forceTarget === 'collapsed')
  }, [forceRevision, forceTarget])

  // Auto-expand when search has matches in this subtree
  const hasDescendantMatch = useMemo(
    () => isExpandable && !!searchQuery && subtreeHasMatch(value, searchQuery, caseSensitive),
    [value, searchQuery, caseSensitive, isExpandable]
  )

  // Override local state: if search matches inside, stay open
  const effectiveCollapsed = hasDescendantMatch ? false : collapsed

  const isKeyMatch   = !!searchQuery && keyName !== undefined && textContains(keyName, searchQuery, caseSensitive)
  const isValueMatch = !!searchQuery && !isExpandable && textContains(String(value), searchQuery, caseSensitive)
  const isMatch      = isKeyMatch || isValueMatch

  const childKeys = isExpandable
    ? type === 'array'
      ? value.map((_, i) => i)
      : sortKeys ? Object.keys(value).sort() : Object.keys(value)
    : []

  const handleCopy = useCallback((e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(isExpandable ? JSON.stringify(value, null, 2) : String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [isExpandable, value])

  const handleClick = useCallback(() => {
    if (isExpandable) setCollapsed(c => !c)
    onPathSelect?.(path)
  }, [isExpandable, onPathSelect, path])

  const hl = (text) => (
    <HighlightText text={text} query={searchQuery} caseSensitive={caseSensitive} />
  )

  const renderValue = () => {
    switch (type) {
      case 'string':  return <span style={{ color: colors.string }}>"{hl(value)}"</span>
      case 'number':  return <span style={{ color: colors.number }}>{hl(String(value))}</span>
      case 'boolean': return <span style={{ color: colors.boolean }}>{hl(String(value))}</span>
      case 'null':    return <span style={{ color: colors.null }}>{hl('null')}</span>
      default:        return null
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 3,
          padding: '2px 4px', paddingLeft: depth * 18 + 4,
          borderRadius: 4,
          cursor: isExpandable ? 'pointer' : 'text',
          userSelect: 'text',
          backgroundColor: hovered ? colors.rowHover : 'transparent',
          outline: isMatch ? '1px solid rgba(251,191,36,0.4)' : 'none',
          transition: 'background-color 0.08s',
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{ width: 14, flexShrink: 0, color: colors.muted, fontSize: 9, paddingTop: 4, userSelect: 'none', opacity: isExpandable ? 1 : 0 }}>
          {effectiveCollapsed ? '▶' : '▼'}
        </span>

        {keyName !== undefined && (
          <span style={{ flexShrink: 0, color: typeof keyName === 'number' ? colors.index : colors.key }}>
            {typeof keyName === 'number'
              ? keyName
              : <>"<HighlightText text={String(keyName)} query={searchQuery} caseSensitive={caseSensitive} />"</>
            }
            <span style={{ color: colors.muted }}>: </span>
          </span>
        )}

        <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
          {isExpandable ? (
            <>
              <span style={{ color: colors.bracket }}>{type === 'array' ? '[' : '{'}</span>
              {effectiveCollapsed && (
                <>
                  <span style={{ color: colors.muted, fontSize: 11, margin: '0 4px' }}>
                    {type === 'array'
                      ? `${childKeys.length} item${childKeys.length !== 1 ? 's' : ''}`
                      : `${childKeys.length} key${childKeys.length !== 1 ? 's' : ''}`}
                  </span>
                  <span style={{ color: colors.bracket }}>{type === 'array' ? ']' : '}'}</span>
                </>
              )}
            </>
          ) : renderValue()}
        </span>

        <button
          onClick={handleCopy}
          title="Copy value"
          style={{
            flexShrink: 0, marginLeft: 4, padding: '0 3px',
            background: 'none', border: 'none',
            color: colors.muted, cursor: 'pointer', fontSize: 12, lineHeight: 1,
            opacity: hovered ? 1 : 0, transition: 'opacity 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = colors.copyHover }}
          onMouseLeave={e => { e.currentTarget.style.color = colors.muted }}
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>

      {isExpandable && !effectiveCollapsed && (
        <>
          {childKeys.map((k) => {
            const childVal = value[k]
            const childPath = type === 'array' ? `${path}[${k}]` : `${path}.${k}`
            return (
              <TreeNode
                key={`${k}-${typeof childVal}`}
                keyName={k} value={childVal}
                depth={depth + 1}
                searchQuery={searchQuery} caseSensitive={caseSensitive}
                sortKeys={sortKeys}
                onPathSelect={onPathSelect} path={childPath}
                colors={colors}
                forceRevision={forceRevision} forceTarget={forceTarget}
              />
            )
          })}
          <div style={{ paddingLeft: depth * 18 + 4 + 17, color: colors.bracket, lineHeight: 1.7, fontSize: 13 }}>
            {type === 'array' ? ']' : '}'}
          </div>
        </>
      )}
    </div>
  )
})

export default function TreeView({ data, searchQuery, caseSensitive, sortKeys, onPathSelect, isDark, forceRevision, forceTarget }) {
  const colors = isDark ? DARK : LIGHT
  return (
    <div style={{ fontFamily: "'Menlo','Monaco','Consolas',monospace", fontSize: 13, lineHeight: 1.7 }}>
      <TreeNode
        value={data} depth={0}
        searchQuery={searchQuery || ''} caseSensitive={!!caseSensitive}
        sortKeys={sortKeys}
        onPathSelect={onPathSelect} path="$"
        colors={colors}
        forceRevision={forceRevision || 0} forceTarget={forceTarget || 'collapsed'}
      />
    </div>
  )
}
