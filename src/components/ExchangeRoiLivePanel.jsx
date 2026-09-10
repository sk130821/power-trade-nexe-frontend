import { TradeIntradayChart } from './TradeIntradayChart.jsx'
import { fmt } from '../api/index.js'

function SessionLiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--green)',
          animation: 'pulse 2s infinite',
          boxShadow: '0 0 8px var(--green)',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em' }}>
        Live
      </span>
    </span>
  )
}

/**
 * Exchange Trade ROI running — chart-first layout matching Live Trades.
 */
export function ExchangeRoiLivePanel({ slots = [], sessionDate, anchorPrice = 1000, compact = false }) {
  const live = Array.isArray(slots) ? slots.filter((s) => s?.roi_running !== false) : []
  if (!live.length) return null

  const priceAnchor = Number(anchorPrice) > 0 ? Number(anchorPrice) : 1000

  return (
    <div
      className="exchange-roi-live-panel"
      style={{
        marginBottom: compact ? 0 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {live.map((slot) => {
        const scrip = slot.trade_name || `Exchange Slot ${slot.slot}`
        const windowLabel =
          slot.open_time && slot.close_time
            ? `${String(slot.open_time).slice(0, 5)} – ${String(slot.close_time).slice(0, 5)} IST`
            : '—'

        return (
          <div key={slot.slot} className="day-trade-card" style={{ margin: 0 }}>
            <div className="day-trade-card-grid">
              <div className="day-trade-card-cell">
                <div className="day-trade-card-label">Exchange Trade</div>
                <div className="day-trade-card-scrip">{scrip}</div>
                <div className="day-trade-card-symbol">Slot {slot.slot}</div>
              </div>
              <div className="day-trade-card-cell">
                <div className="day-trade-card-label">Status</div>
                <SessionLiveDot />
                <div className="day-trade-card-chg day-trade-card-chg--up" style={{ marginTop: 6 }}>
                  Exchange Trading
                </div>
              </div>
              <div className="day-trade-card-cell">
                <div className="day-trade-card-label">Session</div>
                <div className="day-trade-card-ohl">
                  {sessionDate ? (
                    <>
                      Date <span>{fmt.date(sessionDate)}</span>
                      <br />
                    </>
                  ) : null}
                  Window <span>{windowLabel}</span>
                </div>
              </div>
            </div>

            <div className="day-trade-chart-section">
              <TradeIntradayChart
                symbol={scrip}
                anchorPrice={priceAnchor}
                live
                height={compact ? 220 : 280}
                compact={compact}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ExchangeRoiLiveBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 6,
        color: 'var(--green)',
        background: 'rgba(0,255,136,0.15)',
        border: '1px solid rgba(0,255,136,0.35)',
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--green)',
          animation: 'pulse 2s infinite',
        }}
      />
      Live
    </span>
  )
}
