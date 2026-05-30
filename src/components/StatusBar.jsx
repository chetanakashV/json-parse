function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function StatusBar({ error, stats, selectedPath, isDark, border }) {
  const bg = isDark ? '#161b22' : '#f6f8fa'
  const text = isDark ? '#8b949e' : '#656d76'
  const validColor = error ? '#f85149' : '#3fb950'

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: 0, padding: '0 12px',
      height: 24,
      background: bg,
      borderTop: `1px solid ${border}`,
      fontSize: 11, color: text,
      flexShrink: 0, flexWrap: 'wrap', overflow: 'hidden',
    }}>
      {/* Validity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: validColor, flexShrink: 0 }} />
        <span style={{ color: validColor, fontWeight: 500 }}>
          {error ? 'Invalid' : 'Valid JSON'}
        </span>
      </div>

      <Divider border={border} />

      <Stat label="Lines" value={stats.lines} />
      <Stat label="Size" value={fmt(stats.byteSize)} />

      {!error && stats.keys > 0 && (
        <>
          <Stat label="Keys" value={stats.keys} />
          <Stat label="Depth" value={stats.depth} />
        </>
      )}

      {selectedPath && (
        <>
          <Divider border={border} />
          <span style={{ fontFamily: 'monospace', color: isDark ? '#58a6ff' : '#0969da', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
            {selectedPath}
          </span>
        </>
      )}

      {error && (
        <>
          <Divider border={border} />
          <span style={{ color: '#f85149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
            {error}
          </span>
        </>
      )}
    </div>
  )
}

function Divider({ border }) {
  return <div style={{ width: 1, height: 12, background: border, margin: '0 10px' }} />
}

function Stat({ label, value }) {
  return (
    <span style={{ marginRight: 10 }}>
      <span style={{ opacity: 0.6 }}>{label}: </span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </span>
  )
}
