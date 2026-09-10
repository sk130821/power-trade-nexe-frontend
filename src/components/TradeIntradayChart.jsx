// ═══════════════════════════════════════════
//  components/ui/TradeIntradayChart.jsx
//  Real NSE/BSE-style live intraday chart
//  Features: Candlestick / Line / Area
//            Live tick simulation
//            MA5, MA20, RSI
//            Volume bars
//            OHLC header stats
// ═══════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'

// ── Constants ──────────────────────────────
const TICK_INTERVAL_MS = 950
const NEW_CANDLE_EVERY  = 6       // ticks before a new candle is appended
const MAX_CANDLES       = 390     // max candles to keep in memory

// ── Helpers ────────────────────────────────
const rnd   = (min, max) => min + Math.random() * (max - min)
const fmt2  = (v)        => Number(v).toFixed(2)
const fmtVol = (v) => {
  if (v >= 1e7) return (v / 1e7).toFixed(2) + 'Cr'
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v
}
const fmtVolIN = (v) => v.toLocaleString('en-IN')

function calcMA(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null
    const s = arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0)
    return +( s / n).toFixed(2)
  })
}

function calcRSI(closes, n = 14) {
  if (closes.length < n + 1) return null
  let gains = 0, losses = 0
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  let ag = gains / n, al = losses / n
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    ag = ((n - 1) * ag + Math.max(0, d))  / n
    al = ((n - 1) * al + Math.max(0, -d)) / n
  }
  if (al === 0) return 100
  return +(100 - 100 / (1 + ag / al)).toFixed(1)
}

// Resolution configs: how many candles, minute-offset start, step in minutes
const RES_CONFIG = {
  '1m':  { n: 375, start: 555, step: 1  },
  '5m':  { n: 75,  start: 555, step: 5  },
  '15m': { n: 26,  start: 555, step: 15 },
  '1d':  { n: 30,  start: 555, step: 5, label:'days' },
}

function generateCandles(anchor, prevClose, cfg) {
  const { n, start, step } = cfg
  let price = prevClose
  const candles = []
  for (let i = 0; i < n; i++) {
    const o   = price
    const drift = rnd(-0.006, 0.009) * price + rnd(-0.003, 0.005) * price * Math.sin(i * 0.3)
    let c   = Math.max(anchor * 0.994, o + drift)
    const hi  = +Math.max(Math.max(o, c) + rnd(0.001, 0.004) * price, o, c).toFixed(2)
    const lo  = +Math.max(anchor * 0.992, Math.min(Math.min(o, c) - rnd(0.001, 0.003) * price, o, c)).toFixed(2)
    const vol = Math.round(rnd(50_000, 400_000))
    const t   = start + i * step
    const h   = Math.floor(t / 60)
    const m   = t % 60
    candles.push({
      time:  (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m,
      open:  +o.toFixed(2),
      high:  hi,
      low:   lo,
      close: +c.toFixed(2),
      vol,
    })
    price = c
  }
  return candles
}

// ── Custom Candlestick Bar via recharts customized shape ──
function CandleShape(props) {
  const { x, y, width, height, open, close, high, low, yScale } = props
  if (!yScale || open == null) return null
  const bull    = close >= open
  const color   = bull ? '#22c55e' : '#ef4444'
  const yOpen   = yScale(open)
  const yClose  = yScale(close)
  const yHigh   = yScale(high)
  const yLow    = yScale(low)
  const candleH = Math.max(1, Math.abs(yOpen - yClose))
  const candleY = Math.min(yOpen, yClose)
  const cx      = x + width / 2

  return (
    <g>
      {/* Wick */}
      <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
      {/* Body */}
      {bull
        ? <rect x={cx - width * 0.4} y={candleY} width={width * 0.8} height={candleH} fill={color} />
        : <rect x={cx - width * 0.4} y={candleY} width={width * 0.8} height={candleH} fill="transparent" stroke={color} strokeWidth={1} />
      }
    </g>
  )
}

// ── Custom Tooltip ──────────────────────────
function CustomTooltip({ active, payload, label, chartType }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  const bull = d.close >= d.open

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
      minWidth: 160,
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 6, fontSize: 10 }}>{label}</div>
      {chartType === 'candle' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#64748b' }}>O</span>
            <span style={{ color: '#f1f5f9' }}>{fmt2(d.open)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#64748b' }}>H</span>
            <span style={{ color: '#22c55e' }}>{fmt2(d.high)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#64748b' }}>L</span>
            <span style={{ color: '#ef4444' }}>{fmt2(d.low)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#64748b' }}>C</span>
            <span style={{ color: bull ? '#22c55e' : '#ef4444', fontWeight: 500 }}>{fmt2(d.close)}</span>
          </div>
          <div style={{ borderTop: '1px solid #334155', marginTop: 5, paddingTop: 5, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Vol</span>
            <span style={{ color: '#94a3b8' }}>{fmtVol(d.vol)}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#64748b' }}>LTP</span>
            <span style={{ color: '#00e5ff', fontWeight: 500 }}>{fmt2(d.close)}</span>
          </div>
          {d.ma5  != null && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span style={{ color: '#64748b' }}>MA5</span><span style={{ color: '#f59e0b' }}>{d.ma5}</span></div>}
          {d.ma20 != null && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span style={{ color: '#64748b' }}>MA20</span><span style={{ color: '#a855f7' }}>{d.ma20}</span></div>}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════
export function TradeIntradayChart({
  symbol      = '',
  exchange    = '',
  anchorPrice = 2808.30,
  live        = true,
  height      = 300,
  compact     = false,
}) {
  const ANCHOR     = Number(anchorPrice)
  const PREV_CLOSE = ANCHOR
  const displaySymbol = String(symbol || 'SCRIPT').trim() || 'SCRIPT'

  const [resolution, setResolution]   = useState('5m')
  const [chartType,  setChartType]    = useState('candle')
  const [candles,    setCandles]      = useState([])
  const [ltp,        setLtp]          = useState(ANCHOR)
  const [stats,      setStats]        = useState({ open: ANCHOR, high: ANCHOR, low: ANCHOR })
  const [indicators, setIndicators]   = useState({ ma5: null, ma20: null, rsi: null })
  const [plotWidth,  setPlotWidth]    = useState(0)

  const tickRef    = useRef(0)
  const candlesRef = useRef([])
  const plotRef    = useRef(null)

  const chartHeight = compact ? Math.max(height, 200) : height
  const yAxisWidth  = compact ? 30 : 36
  const chartMargin = { top: 4, right: 0, left: 0, bottom: 0 }

  useEffect(() => {
    const el = plotRef.current
    if (!el) return undefined
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setPlotWidth(w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact, chartHeight])

  // ── Init candles when resolution changes ──
  useEffect(() => {
    const cfg  = RES_CONFIG[resolution]
    const data = generateCandles(ANCHOR, PREV_CLOSE, cfg)
    candlesRef.current = data
    const closes = data.map(c => c.close)
    const ma5arr  = calcMA(closes, 5)
    const ma20arr = calcMA(closes, 20)
    const enriched = data.map((c, i) => ({ ...c, ma5: ma5arr[i], ma20: ma20arr[i] }))
    setCandles(enriched)
    const last = data[data.length - 1]
    setLtp(last.close)
    setStats({
      open: data[0].open,
      high: Math.max(...data.map(c => c.high)),
      low:  Math.min(...data.map(c => c.low)),
    })
    const rsi = calcRSI(closes)
    setIndicators({
      ma5:  ma5arr[ma5arr.length - 1],
      ma20: ma20arr[ma20arr.length - 1],
      rsi,
    })
    tickRef.current = 0
  }, [resolution])

  // ── Live tick simulation ──────────────────
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      tickRef.current++
      const data = candlesRef.current
      if (!data.length) return

      const last  = data[data.length - 1]
      const move  = rnd(-0.004, 0.007) * last.close
      const newC  = +Math.max(ANCHOR * 0.993, last.close + move).toFixed(2)

      // Mutate last candle in-place
      last.close = newC
      last.high  = +Math.max(last.high, newC).toFixed(2)
      last.low   = +Math.min(last.low,  newC).toFixed(2)
      last.vol  += Math.round(rnd(800, 6000))

      // Append new candle every N ticks
      if (tickRef.current % NEW_CANDLE_EVERY === 0) {
        const cfg  = RES_CONFIG[resolution]
        const tMin = cfg.start + data.length * cfg.step
        if (tMin <= 1020) {
          const h = Math.floor(tMin / 60)
          const m = tMin % 60
          const newCandle = {
            time:  (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m,
            open:  newC, high: newC, low: newC, close: newC, vol: 0,
          }
          data.push(newCandle)
          if (data.length > MAX_CANDLES) data.splice(0, 1)
        }
      }

      const closes  = data.map(c => c.close)
      const ma5arr  = calcMA(closes, 5)
      const ma20arr = calcMA(closes, 20)
      const enriched = data.map((c, i) => ({ ...c, ma5: ma5arr[i], ma20: ma20arr[i] }))

      setCandles([...enriched])
      setLtp(newC)
      setStats(prev => ({
        open: prev.open,
        high: Math.max(prev.high, newC),
        low:  Math.min(prev.low,  newC),
      }))
      setIndicators({
        ma5:  ma5arr[ma5arr.length - 1],
        ma20: ma20arr[ma20arr.length - 1],
        rsi:  calcRSI(closes),
      })
    }, TICK_INTERVAL_MS)

    return () => clearInterval(id)
  }, [live, resolution])

  // ── Derived values ────────────────────────
  const chg     = ltp - PREV_CLOSE
  const chgPct  = (chg / PREV_CLOSE) * 100
  const bull     = chg >= 0
  const ltpColor = bull ? '#22c55e' : '#ef4444'

  const totalVol = candles.reduce((s, c) => s + (c.vol || 0), 0)

  // Domain padding for Y axis
  const allClose = candles.map(c => c.close)
  const allHigh  = candles.map(c => c.high)
  const allLow   = candles.map(c => c.low)
  const yMin = allLow.length  ? Math.min(...allLow)  * 0.998 : ANCHOR * 0.995
  const yMax = allHigh.length ? Math.max(...allHigh) * 1.002 : ANCHOR * 1.005

  // ── Styles ───────────────────────────────
  const s = {
    chip:     { fontSize: 11, background: '#1e293b', padding: '2px 8px', borderRadius: 4, color: '#94a3b8' },
    statBox:  { background: '#1e293b', borderRadius: 6, padding: compact ? '6px 8px' : '8px 10px', flex: 1, minWidth: 0 },
    statLbl:  { fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 },
    statVal:  { fontSize: compact ? 12 : 13 },
    btnRes:   (active) => ({ fontFamily: 'inherit', fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `1px solid ${active ? '#00e5ff' : '#334155'}`, background: active ? 'rgba(0,229,255,0.1)' : '#1e293b', color: active ? '#00e5ff' : '#94a3b8', cursor: 'pointer', transition: 'all 0.15s' }),
    btnType:  (active) => ({ fontFamily: 'inherit', fontSize: 10, padding: '3px 8px', borderRadius: 4, border: `1px solid ${active ? '#00e5ff' : '#334155'}`, background: active ? 'rgba(0,229,255,0.1)' : '#1e293b', color: active ? '#00e5ff' : '#94a3b8', cursor: 'pointer', transition: 'all 0.15s' }),
  }

  const renderMainChart = () => {
    if (plotWidth <= 0) {
      return (
        <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
          Loading chart…
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        {chartType === 'candle' ? (
          <ComposedChart data={candles} margin={chartMargin}>
            <XAxis
              dataKey="time"
              tick={{ fill: '#475569', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              interval="preserveStartEnd"
              padding={{ left: 0, right: 0 }}
            />
            <YAxis
              orientation="right"
              domain={[yMin, yMax]}
              tick={{ fill: '#475569', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={yAxisWidth}
              tickMargin={2}
              tickCount={4}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip content={<CustomTooltip chartType="candle" />} />
            <ReferenceLine y={PREV_CLOSE} stroke="#334155" strokeDasharray="3 3" strokeWidth={1} />
            <Bar dataKey="close" isAnimationActive={false} barCategoryGap="4%" maxBarSize={compact ? 6 : 8} shape={(props) => {
              const { x, width, index } = props
              const c = candles[index]
              if (!c) return null
              const chartH = chartHeight - 30
              const range  = yMax - yMin
              const toY    = (v) => ((yMax - v) / range) * chartH + 6
              return (
                <CandleShape
                  key={index}
                  x={x}
                  width={width}
                  open={c.open}
                  close={c.close}
                  high={c.high}
                  low={c.low}
                  yScale={toY}
                />
              )
            }}>
              {candles.map((c, i) => (
                <Cell key={i} fill={c.close >= c.open ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="ma5"  stroke="#f59e0b" strokeWidth={1.2} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="ma20" stroke="#a855f7" strokeWidth={1.2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        ) : chartType === 'line' ? (
          <ComposedChart data={candles} margin={chartMargin}>
            <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} interval="preserveStartEnd" padding={{ left: 0, right: 0 }} />
            <YAxis orientation="right" domain={[yMin, yMax]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} width={yAxisWidth} tickMargin={2} tickCount={4} tickFormatter={v => v.toFixed(0)} />
            <Tooltip content={<CustomTooltip chartType="line" />} />
            <ReferenceLine y={PREV_CLOSE} stroke="#334155" strokeDasharray="3 3" strokeWidth={1} />
            <Line type="monotone" dataKey="close" stroke="#00e5ff" strokeWidth={1.8} dot={false} isAnimationActive={false} activeDot={{ r: 3, fill: '#00e5ff' }} />
            <Line type="monotone" dataKey="ma5"   stroke="#f59e0b" strokeWidth={1.1} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="ma20"  stroke="#a855f7" strokeWidth={1.1} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        ) : (
          <AreaChart data={candles} margin={chartMargin}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#00e5ff" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} interval="preserveStartEnd" padding={{ left: 0, right: 0 }} />
            <YAxis orientation="right" domain={[yMin, yMax]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} width={yAxisWidth} tickMargin={2} tickCount={4} tickFormatter={v => v.toFixed(0)} />
            <Tooltip content={<CustomTooltip chartType="area" />} />
            <ReferenceLine y={PREV_CLOSE} stroke="#334155" strokeDasharray="3 3" strokeWidth={1} />
            <Area type="monotone" dataKey="close" stroke="#00e5ff" strokeWidth={1.8} fill="url(#areaGrad)" dot={false} isAnimationActive={false} activeDot={{ r: 3, fill: '#00e5ff' }} />
            <Line type="monotone" dataKey="ma5"  stroke="#f59e0b" strokeWidth={1.1} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="ma20" stroke="#a855f7" strokeWidth={1.1} dot={false} connectNulls isAnimationActive={false} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    )
  }

  const chartBody = (
    <div className={`trade-intraday-chart${compact ? ' trade-intraday-chart--compact' : ''}`}>
      <div className="trade-intraday-chart__header">
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? 14 : 15, fontWeight: 500, color: '#f1f5f9', letterSpacing: '0.04em' }}>{displaySymbol}</span>
            {exchange ? <span style={s.chip}>{exchange}</span> : null}
            {live && (
              <>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'ltpBlink 1.2s infinite' }} />
                <span style={{ fontSize: 10, color: '#22c55e', letterSpacing: '0.06em' }}>LIVE</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: compact ? 22 : 28, fontWeight: 500, color: ltpColor, transition: 'color 0.3s' }}>{fmt2(ltp)}</span>
            <span style={{ fontSize: 13, color: ltpColor, fontWeight: 600 }}>
              {bull ? '+' : ''}{fmt2(chg)} ({bull ? '+' : ''}{chgPct.toFixed(2)}%)
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            Vol: {fmtVolIN(totalVol)}
          </div>
        </div>

        <div className="trade-intraday-chart__header-actions">
          <div className="trade-intraday-chart__controls-row" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {['1m','5m','15m','1d'].map(r => (
              <button key={r} type="button" style={s.btnRes(resolution === r)} onClick={() => setResolution(r)}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="trade-intraday-chart__controls-row" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[['candle','Candle'],['line','Line'],['area','Area']].map(([k, lbl]) => (
              <button key={k} type="button" style={s.btnType(chartType === k)} onClick={() => setChartType(k)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={s.statBox}>
          <div style={s.statLbl}>Open</div>
          <div style={{ ...s.statVal, color: '#f1f5f9' }}>{fmt2(stats.open)}</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statLbl}>High</div>
          <div style={{ ...s.statVal, color: '#22c55e' }}>{fmt2(stats.high)}</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statLbl}>Low</div>
          <div style={{ ...s.statVal, color: '#ef4444' }}>{fmt2(stats.low)}</div>
        </div>
        <div style={s.statBox}>
          <div style={s.statLbl}>Prev Close</div>
          <div style={{ ...s.statVal, color: '#f1f5f9' }}>{fmt2(PREV_CLOSE)}</div>
        </div>
      </div>

      <div className="trade-intraday-chart__plot" ref={plotRef}>
        <div className="trade-intraday-chart__plot-inner">
          {renderMainChart()}
        </div>
      </div>

      <div className="trade-intraday-chart__plot trade-intraday-chart__plot--vol" style={{ height: compact ? 48 : 56, marginTop: 4 }}>
        {plotWidth > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis orientation="right" tick={{ fill: '#475569', fontSize: 8 }} tickLine={false} axisLine={false} width={yAxisWidth} tickMargin={2} tickCount={2} tickFormatter={fmtVol} />
              <Bar dataKey="vol" isAnimationActive={false} radius={[1,1,0,0]}>
                {candles.map((c, i) => (
                  <Cell key={i} fill={c.close >= c.open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#475569', flexWrap: 'wrap' }}>
          <span>
            MA<span style={{ color: '#64748b' }}>5</span>{' '}
            <span style={{ color: '#f59e0b' }}>{indicators.ma5 ?? '—'}</span>
          </span>
          <span>
            MA<span style={{ color: '#64748b' }}>20</span>{' '}
            <span style={{ color: '#a855f7' }}>{indicators.ma20 ?? '—'}</span>
          </span>
          <span>
            RSI{' '}
            <span style={{
              color: indicators.rsi == null ? '#475569' : indicators.rsi > 70 ? '#ef4444' : indicators.rsi < 30 ? '#22c55e' : '#94a3b8'
            }}>
              {indicators.rsi ?? '—'}
            </span>
            {indicators.rsi > 70 && <span style={{ color: '#ef4444', marginLeft: 3 }}>OB</span>}
            {indicators.rsi < 30 && <span style={{ color: '#22c55e', marginLeft: 3 }}>OS</span>}
          </span>
        </div>
        <div style={{ fontSize: 9, color: '#334155', letterSpacing: '0.06em' }}>
          {candles.length} bars · {resolution.toUpperCase()}
        </div>
      </div>

      <style>{`@keyframes ltpBlink{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
    </div>
  )

  return chartBody
}

export default TradeIntradayChart