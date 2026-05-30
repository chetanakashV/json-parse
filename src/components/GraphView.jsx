import { useMemo, useState, useRef, useCallback } from 'react'

/* ── Constants ──────────────────────────────── */
const NW   = 230   // card width
const HG   = 80    // H-layout: gap between columns
const VG   = 20    // H-layout: gap between siblings
const VLG  = 80    // V-layout: gap between levels
const HSG  = 24    // V-layout: gap between siblings
const RH   = 27    // row height
const HH   = 36    // header height
const BPAD = 8     // bottom padding
const PAD  = 300   // canvas edge padding (generous overflow so zoomed panning never hits the wall)

/* ── Themes ─────────────────────────────────── */
const DARK = {
  canvas: '#0d1117', cardBg: '#161b22', cardBorder: '#30363d',
  headerBg: '#1c2128', headerText: '#e6edf3',
  keyColor: '#9cdcfe', strColor: '#a8cc8c', numColor: '#d2a679',
  boolColor: '#569cd6', nullColor: '#c586c0', nestedColor: '#8b949e',
  edge: 'rgba(88,166,255,0.4)', edgeDot: '#58a6ff', edgeLabel: '#8b949e',
  badge: { obj: { bg: 'rgba(86,156,214,0.15)', fg: '#569cd6' }, arr: { bg: 'rgba(88,166,255,0.15)', fg: '#58a6ff' } },
  rowDiv: 'rgba(48,54,61,0.6)', shadow: '0 4px 16px rgba(0,0,0,0.5)',
  matchRing: '#fbbf24', searchBg: '#161b22', searchBorder: '#30363d', searchText: '#e6edf3',
  btnBg: '#21262d', btnText: '#8b949e', btnBorder: '#30363d',
}
const LIGHT = {
  canvas: '#f6f8fa', cardBg: '#ffffff', cardBorder: '#d0d7de',
  headerBg: '#f6f8fa', headerText: '#1f2328',
  keyColor: '#0550ae', strColor: '#22863a', numColor: '#e36209',
  boolColor: '#0550ae', nullColor: '#8250df', nestedColor: '#656d76',
  edge: 'rgba(9,105,218,0.35)', edgeDot: '#0969da', edgeLabel: '#656d76',
  badge: { obj: { bg: 'rgba(5,80,174,0.08)', fg: '#0550ae' }, arr: { bg: 'rgba(9,105,218,0.1)', fg: '#0969da' } },
  rowDiv: 'rgba(208,215,222,0.7)', shadow: '0 2px 8px rgba(0,0,0,0.1)',
  matchRing: '#f59e0b', searchBg: '#ffffff', searchBorder: '#d0d7de', searchText: '#1f2328',
  btnBg: '#f6f8fa', btnText: '#656d76', btnBorder: '#d0d7de',
}

/* ── Helpers ─────────────────────────────────── */
function gtype(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}
function cardH(rowCount) { return HH + rowCount * RH + BPAD }

/* ── Build graph ─────────────────────────────── */
function buildGraph(data) {
  let uid = 0
  const nodes = {}, edges = []

  function process(value, label) {
    const id = `n${uid++}`
    const type = gtype(value)
    const rows = [], childIds = []

    const items = type === 'array'
      ? value.map((v, i) => [String(i), v])
      : type === 'object' ? Object.entries(value) : []

    for (const [k, v] of items) {
      const vt = gtype(v)
      if (vt === 'object' || vt === 'array') {
        const cid = process(v, k)
        childIds.push(cid)
        edges.push({ id: `e${edges.length}`, from: id, fromRow: rows.length, to: cid, label: k })
        rows.push({ key: k, type: vt, isNested: true, count: vt === 'array' ? v.length : Object.keys(v).length })
      } else {
        rows.push({ key: k, type: vt, value: v, isNested: false })
      }
    }

    nodes[id] = { id, kind: type === 'array' ? 'array' : 'object', label, rows, childIds }
    return id
  }

  const rootId = process(data, null)
  return { nodes, edges, rootId }
}

/* ── Horizontal layout (L→R) ─────────────────── */
function layoutH(nodes, rootId) {
  function subtreeH(id) {
    const n = nodes[id]
    n._h = cardH(n.rows.length)
    if (!n.childIds.length) { n._sh = n._h; return n._h }
    const sum = n.childIds.reduce((s, c) => s + subtreeH(c), 0) + (n.childIds.length - 1) * VG
    n._sh = Math.max(n._h, sum)
    return n._sh
  }
  subtreeH(rootId)

  function assign(id, x, y) {
    const n = nodes[id]
    n.x = x; n.y = y + Math.round((n._sh - n._h) / 2)
    if (!n.childIds.length) return
    let cy = y
    for (const cid of n.childIds) { assign(cid, x + NW + HG, cy); cy += nodes[cid]._sh + VG }
  }
  assign(rootId, PAD, PAD)
}

/* ── Vertical layout (T→B) ───────────────────── */
function layoutV(nodes, rootId) {
  // Compute subtree widths bottom-up
  function subtreeW(id) {
    const n = nodes[id]
    n._h = cardH(n.rows.length)
    if (!n.childIds.length) { n._sw = NW; return NW }
    const sum = n.childIds.reduce((s, c) => s + subtreeW(c), 0) + (n.childIds.length - 1) * HSG
    n._sw = Math.max(NW, sum)
    return n._sw
  }
  subtreeW(rootId)

  // Compute max height at each depth level
  const depthMaxH = {}
  function scanDepths(id, d) {
    const n = nodes[id]
    depthMaxH[d] = Math.max(depthMaxH[d] || 0, n._h)
    n.childIds.forEach(c => scanDepths(c, d + 1))
  }
  scanDepths(rootId, 0)

  // Cumulative Y offsets per depth
  const depthY = {}
  let yCur = PAD
  const maxDepth = Math.max(...Object.keys(depthMaxH).map(Number))
  for (let d = 0; d <= maxDepth; d++) {
    depthY[d] = yCur
    yCur += (depthMaxH[d] || 0) + VLG
  }

  // Assign positions top-down
  function assign(id, x, d) {
    const n = nodes[id]
    n.y = depthY[d]
    n.x = x + Math.round((n._sw - NW) / 2)
    if (!n.childIds.length) return
    let cx = x
    for (const cid of n.childIds) { assign(cid, cx, d + 1); cx += nodes[cid]._sw + HSG }
  }
  assign(rootId, PAD, 0)
}

/* ── Canvas dimensions ───────────────────────── */
function canvasDims(nodes) {
  let w = 0, h = 0
  for (const n of Object.values(nodes)) { w = Math.max(w, n.x + NW); h = Math.max(h, n.y + n._h) }
  return { w: w + PAD, h: h + PAD }
}

/* ── Value cell ──────────────────────────────── */
function Value({ row, C }) {
  if (row.isNested)
    return <span style={{ color: C.nestedColor, fontSize: 11 }}>{row.type === 'array' ? `[ ${row.count} ]` : `{ ${row.count} }`}</span>

  const colorMap = { string: C.strColor, number: C.numColor, boolean: C.boolColor, null: C.nullColor }
  const color = colorMap[row.type] || C.nestedColor
  const isHex = row.type === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(row.value)
  const display = row.type === 'string' ? `"${row.value}"` : String(row.value)

  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
      {isHex && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: row.value, flexShrink: 0, border: '1px solid rgba(128,128,128,0.35)' }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
    </span>
  )
}

/* ── Card ────────────────────────────────────── */
function Card({ node, C, isHighlighted }) {
  const isArr = node.kind === 'array'
  const badge = isArr ? C.badge.arr : C.badge.obj

  return (
    <div style={{
      position: 'absolute', left: node.x, top: node.y,
      width: NW, height: node._h,
      background: C.cardBg,
      border: `1.5px solid ${isHighlighted ? C.matchRing : C.cardBorder}`,
      borderRadius: 8, overflow: 'hidden',
      boxShadow: isHighlighted ? `0 0 0 2px ${C.matchRing}44, ${C.shadow}` : C.shadow,
      fontFamily: "'Menlo','Monaco','Consolas',monospace", fontSize: 12,
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      <div style={{ height: HH, background: C.headerBg, borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: badge.bg, color: badge.fg, flexShrink: 0 }}>
          {isArr ? 'Array' : 'Object'}
        </span>
        {node.label && (
          <span style={{ color: C.keyColor, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {node.label}
          </span>
        )}
        {isArr && <span style={{ color: C.nestedColor, fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>{node.rows.length} items</span>}
      </div>
      {node.rows.map((row, i) => (
        <div key={i} style={{ height: RH, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 5, borderBottom: i < node.rows.length - 1 ? `1px solid ${C.rowDiv}` : 'none', overflow: 'hidden' }}>
          <span style={{ color: isArr ? C.nestedColor : C.keyColor, flexShrink: 0, maxWidth: 86, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isArr ? row.key : `"${row.key}"`}
          </span>
          <span style={{ color: C.nestedColor, flexShrink: 0 }}>:</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}><Value row={row} C={C} /></span>
          {row.isNested && <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.edgeDot, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  )
}

/* ── Edge ────────────────────────────────────── */
function Edge({ edge, nodes, C, direction }) {
  const src = nodes[edge.from], tgt = nodes[edge.to]
  if (!src || !tgt) return null

  let sx, sy, tx, ty, d, labelX, labelY

  if (direction === 'v') {
    // Bottom-center of source → top-center of target
    sx = src.x + NW / 2
    sy = src.y + src._h
    tx = tgt.x + NW / 2
    ty = tgt.y
    const cp = VLG * 0.45
    d = `M ${sx} ${sy} C ${sx} ${sy + cp}, ${tx} ${ty - cp}, ${tx} ${ty}`
    labelX = (sx + tx) / 2
    labelY = (sy + ty) / 2
  } else {
    // Right-side row exit → left-center of target
    sx = src.x + NW
    sy = src.y + HH + (edge.fromRow + 0.5) * RH
    tx = tgt.x
    ty = tgt.y + tgt._h / 2
    const cp = HG * 0.5
    d = `M ${sx} ${sy} C ${sx + cp} ${sy}, ${tx - cp} ${ty}, ${tx} ${ty}`
    labelX = (sx + tx) / 2
    labelY = (sy + ty) / 2 - 6
  }

  return (
    <g>
      <path d={d} fill="none" stroke={C.edge} strokeWidth={1.5} />
      <circle cx={sx} cy={sy} r={3} fill={C.edgeDot} opacity={0.7} />
      <circle cx={tx} cy={ty} r={3} fill={C.edgeDot} opacity={0.7} />
      {edge.label && (
        <text x={labelX} y={labelY} textAnchor="middle"
          style={{ fontSize: 10, fill: C.edgeLabel, userSelect: 'none', pointerEvents: 'none' }}>
          {edge.label}
        </text>
      )}
    </g>
  )
}

/* ── Direction toggle button ─────────────────── */
function DirBtn({ active, onClick, children, C }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 10px', borderRadius: 5, border: `1px solid ${active ? '#58a6ff' : C.btnBorder}`,
      background: active ? 'rgba(88,166,255,0.12)' : C.btnBg,
      color: active ? '#58a6ff' : C.btnText,
      fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.12s',
    }}>
      {children}
    </button>
  )
}

/* ── Zoom icon buttons ───────────────────────── */
function ZoomBtn({ onClick, children, C, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 5, border: `1px solid ${C.btnBorder}`,
      background: C.btnBg, color: C.btnText,
      fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
      transition: 'all 0.12s', flexShrink: 0,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#58a6ff'; e.currentTarget.style.color = '#58a6ff' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.btnBorder; e.currentTarget.style.color = C.btnText }}
    >
      {children}
    </button>
  )
}

const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5
const STEP     = 0.15

/* ── Main ────────────────────────────────────── */
export default function GraphView({ data, isDark }) {
  const C = isDark ? DARK : LIGHT
  const [direction, setDirection]   = useState('h')
  const [nodeSearch, setNodeSearch] = useState('')
  const [zoom, setZoom]             = useState(1)
  const [panning, setPanning]       = useState(false)
  const scrollRef = useRef(null)
  const panStart  = useRef(null)

  const { nodes, edges, canvasW, canvasH } = useMemo(() => {
    if (!data) return { nodes: {}, edges: [], canvasW: 0, canvasH: 0 }
    const { nodes, edges, rootId } = buildGraph(data)
    if (direction === 'v') layoutV(nodes, rootId)
    else layoutH(nodes, rootId)
    const { w, h } = canvasDims(nodes)
    return { nodes, edges, canvasW: w, canvasH: h }
  }, [data, direction])

  const matchIds = useMemo(() => {
    if (!nodeSearch.trim()) return new Set()
    const q = nodeSearch.toLowerCase()
    return new Set(
      Object.values(nodes)
        .filter(n =>
          (n.label && n.label.toLowerCase().includes(q)) ||
          n.rows.some(r =>
            String(r.key).toLowerCase().includes(q) ||
            (!r.isNested && String(r.value).toLowerCase().includes(q))
          )
        )
        .map(n => n.id)
    )
  }, [nodes, nodeSearch])

  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      // Clamp per-event delta so a fast pinch doesn't jump wildly.
      // Math.pow(0.998, dy) gives ~0.2% zoom per pixel of scroll.
      const dy = Math.max(-40, Math.min(40, e.deltaY))
      setZoom(z => clampZoom(z * Math.pow(0.998, dy)))
    }
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    panStart.current = {
      x: e.clientX, y: e.clientY,
      sl: scrollRef.current?.scrollLeft ?? 0,
      st: scrollRef.current?.scrollTop  ?? 0,
      moved: false,
    }
    // Global listeners so panning survives leaving the container
    const onMove = (ev) => {
      if (!panStart.current) return
      const dx = ev.clientX - panStart.current.x
      const dy = ev.clientY - panStart.current.y
      if (!panStart.current.moved && Math.hypot(dx, dy) < 4) return
      panStart.current.moved = true
      setPanning(true)
      scrollRef.current.scrollLeft = panStart.current.sl - dx
      scrollRef.current.scrollTop  = panStart.current.st - dy
    }
    const onUp = () => {
      panStart.current = null
      setPanning(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [])

  const fitZoom = useCallback(() => {
    const el = scrollRef.current
    if (!el || !canvasW || !canvasH) return
    const fz = Math.min(el.clientWidth / canvasW, el.clientHeight / canvasH) * 0.95
    setZoom(clampZoom(fz))
  }, [canvasW, canvasH])

  const scaledW = Math.round(canvasW * zoom)
  const scaledH = Math.round(canvasH * zoom)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.canvas }}>

      {/* Scrollable canvas with zoom + pan */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1, overflow: 'auto', position: 'relative',
          cursor: panning ? 'grabbing' : 'grab',
          userSelect: panning ? 'none' : 'auto',
        }}
      >
        {/* Spacer that gives scroll its correct size at current zoom */}
        <div style={{ width: scaledW, height: scaledH, minWidth: '100%', minHeight: '100%', position: 'relative' }}>
          {/* Scaled canvas content */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: canvasW, height: canvasH,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}>
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={canvasW} height={canvasH}>
              {edges.map(e => <Edge key={e.id} edge={e} nodes={nodes} C={C} direction={direction} />)}
            </svg>
            {Object.values(nodes).map(n => (
              <Card key={n.id} node={n} C={C} isHighlighted={matchIds.has(n.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        borderTop: `1px solid ${C.btnBorder}`,
        background: isDark ? '#161b22' : '#f6f8fa',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Layout direction */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <DirBtn active={direction === 'h'} onClick={() => setDirection('h')} C={C}>⟶ Horizontal</DirBtn>
          <DirBtn active={direction === 'v'} onClick={() => setDirection('v')} C={C}>↓ Vertical</DirBtn>
        </div>

        <div style={{ width: 1, height: 16, background: C.btnBorder, flexShrink: 0 }} />

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <ZoomBtn onClick={() => setZoom(z => clampZoom(z - STEP))} C={C} title="Zoom out">−</ZoomBtn>
          <span
            onClick={() => setZoom(1)}
            title="Click to reset to 100%"
            style={{
              fontSize: 12, fontWeight: 500, color: C.btnText,
              minWidth: 42, textAlign: 'center',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <ZoomBtn onClick={() => setZoom(z => clampZoom(z + STEP))} C={C} title="Zoom in">+</ZoomBtn>
          <ZoomBtn onClick={fitZoom} C={C} title="Fit to screen">⊡</ZoomBtn>
        </div>

        <div style={{ width: 1, height: 16, background: C.btnBorder, flexShrink: 0 }} />

        {/* Search nodes */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <input
            type="text"
            value={nodeSearch}
            onChange={e => setNodeSearch(e.target.value)}
            placeholder="Search nodes…"
            style={{
              width: '100%',
              background: C.searchBg, border: `1px solid ${C.searchBorder}`,
              borderRadius: 6, padding: '4px 10px',
              paddingRight: nodeSearch ? 60 : 10,
              fontSize: 12, color: C.searchText, outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#58a6ff' }}
            onBlur={e => { e.target.style.borderColor = C.searchBorder }}
          />
          {nodeSearch && (
            <span style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: matchIds.size > 0 ? C.btnText : '#f85149',
              whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              {matchIds.size} node{matchIds.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
