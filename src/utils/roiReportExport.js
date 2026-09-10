import * as XLSX from 'xlsx'

function num(v) {
  return Number(v || 0)
}

/**
 * Builds a multi-sheet .xlsx for an trade session report payload (matches admin API shape).
 */
export function downloadRoiSessionExcel(payload, baseName = 'live-session') {
  if (!payload?.trade) return
  const t = payload.trade
  const dateStr = String(t.trade_date || '').slice(0, 10)
  const safeName = `${baseName}-${dateStr || t.id}`.replace(/[^\w.-]+/g, '_')

  const wb = XLSX.utils.book_new()

  const full = payload.totalsFromLedger || {}
  const fil = payload.filteredTotals || {}
  const flt = payload.filter || {}
  const meta = payload.sessionMeta || {}

  const summaryRows = [
    ['trade session report'],
    ['Session', t.trade_name || ''],
    ['Date (IST trade_date)', t.trade_date || ''],
    ['Status', t.status || ''],
    ['Session total — Trade to joiners (ledger)', num(full.roi_to_participants)],
    ['Session total — level income (ledger)', num(full.level_income_total)],
    ['Session total — Trade + level', num(full.distribution_grand_total)],
    [''],
    ['Joined members (this session)', num(meta.total_participants)],
    ['Filter active?', flt.active ? 'YES' : 'NO'],
    flt.packages?.length ? ['Filter packages USD', flt.packages.join(', ')] : ['Filter packages USD', '—'],
    flt.slots?.length ? ['Filter ladder slots', flt.slots.join(', ')] : ['Filter ladder slots', '—'],
    [''],
    ['Filtered view — members', num(fil.participant_count)],
    ['Filtered — Trade paid sum', num(fil.roi_paid_sum)],
    ['Filtered — level income sum', num(fil.level_income_sum)],
    ['Filtered — distribution total', num(fil.distribution_sum)],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary')

  const part = payload.participants || []
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      part.map((r) => ({
        member_id: r.member_id,
        name: r.name,
        email: r.email,
        package_usd: num(r.package_amount),
        plan_topup_count: r.plan_topup_count,
        ladder_slot: r.topup_slot,
        joined_at: r.joined_at,
        roi_settled_at: r.roi_settled_at || '',
      }))
    ),
    'Participants'
  )

  const roiRows = payload.roiPaidToMembers || []
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      roiRows.map((r) => ({
        member_id: r.member_id,
        name: r.name,
        email: r.email,
        package_usd: num(r.package_amount),
        roi_amount_usd: num(r.roi_amount),
        txn_id: r.txn_id,
        credited_at: r.created_at,
      }))
    ),
    'Trade_credited'
  )

  const lvlRows = payload.levelIncomeByMember || []
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      lvlRows.map((r) => ({
        earner_member_id: r.member_id,
        name: r.name,
        email: r.email,
        earner_package_usd: num(r.package_amount),
        level_total_usd: num(r.level_total),
      }))
    ),
    'Level_income'
  )

  XLSX.writeFile(wb, `${safeName}.xlsx`)
}

/** One IST day — which members received Trade trade payout */
export function downloadDailyRoiRecipientsExcel(payload) {
  if (!payload?.members) return
  const wb = XLSX.utils.book_new()
  const d = payload.date || 'day'
  const safe = String(d).replace(/[^\d-]/g, '')

  const summary = [
    ['Trade payouts — members for one day (Asia/Kolkata credit date)'],
    ['date_IST', d],
    ['timezone_note', payload.timezone || ''],
    ['unique_members', payload.uniqueMembers ?? ''],
    ['payout_rows', payload.payoutRows ?? payload.members?.length ?? 0],
    ['live_total_usd', num(payload.roiTotalUsd)],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary')

  const rows = payload.members.map((r) => ({
    member_id: r.member_id,
    name: r.name,
    email: r.email,
    package_usd: num(r.package_amount),
    plan_topups: r.plan_topup_count,
    roi_amount_usd: num(r.roi_amount),
    txn_id: r.txn_id,
    credited_at_utc_storage: r.credited_at,
    roi_trade_id: r.roi_trade_id,
    session_date: r.session_trade_date ? String(r.session_trade_date).slice(0, 10) : '',
    session_name: r.session_name || '',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Members_trade_income')

  XLSX.writeFile(wb, `live-daily-members-${safe}.xlsx`)
}

/** Full month — daily trade income totals + month summary */
export function downloadMonthlyRoiDailyExcel(payload) {
  if (!payload?.days) return
  const wb = XLSX.utils.book_new()
  const label = payload.monthLabel || 'month'

  const ms = payload.monthSummary || {}
  const summary = [
    ['Month — daily trade income total (Trade Income, live income credits) by IST date'],
    ['month', label],
    ['range_start', payload.range?.start],
    ['range_end', payload.range?.end],
    ['timezone_note', payload.timezone || ''],
    ['month_live_total_usd', num(ms.roi_total_usd)],
    ['month_payout_row_count', ms.payout_row_count ?? ''],
    ['days_that_had_any_payout', ms.days_with_payout ?? ''],
    [''],
    ['Each day is listed in the "Daily_trade" sheet below.'],
    ['Extra sheets:', 'Daily_member_trade = day × member totals; Each_credit_row = every txn'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Month_summary')

  const dailyRows = payload.days.map((x) => ({
    date_IST: x.date,
    roi_total_usd: num(x.roi_total),
    payout_transactions: num(x.payout_count),
    unique_members_that_day: num(x.unique_members),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), 'Daily_trade')

  const flatMemberDay = []
  for (const x of payload.days || []) {
    for (const m of x.member_summary || []) {
      flatMemberDay.push({
        date_IST: x.date,
        member_id: m.member_id,
        name: m.name,
        email: m.email,
        package_usd: num(m.package_amount),
        roi_total_that_day_usd: num(m.roi_total_usd),
        credit_rows: m.credit_rows,
      })
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatMemberDay), 'Daily_member_trade')

  const flatTxns = []
  for (const x of payload.days || []) {
    for (const m of x.members || []) {
      flatTxns.push({
        date_IST: x.date,
        member_id: m.member_id,
        name: m.name,
        email: m.email,
        roi_amount_usd: num(m.roi_amount),
        txn_id: m.txn_id,
        roi_trade_id: m.roi_trade_id,
        session_date: m.session_trade_date ? String(m.session_trade_date).slice(0, 10) : '',
        credited_at: m.credited_at,
      })
    }
  }
  if (flatTxns.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatTxns), 'Each_credit_row')
  }

  const safeLabel = label.replace(/[^\w-]/g, '_')
  XLSX.writeFile(wb, `live-month-${safeLabel}.xlsx`)
}
