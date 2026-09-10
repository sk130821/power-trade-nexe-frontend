import * as XLSX from 'xlsx'

function istString(createdAt) {
  if (createdAt == null) return ''
  return new Date(createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

function membersToAoA(rows) {
  const header = [
    'registered_ist',
    'member_id',
    'referral_code',
    'name',
    'email',
    'contact',
    'package_usd',
    'plan_topup_count',
    'status',
    'sponsor_name',
    'wallet_address',
    'latest_payment_status',
    'latest_payment_for',
    'latest_payment_amount',
    'pending_payment_for',
    'pending_payment_amount',
  ]

  const body = (rows || []).map((r) => [
    istString(r.created_at),
    r.id ?? '',
    r.referral_code ?? '',
    r.name ?? '',
    r.email ?? '',
    r.contact ?? '',
    Number(r.package_amount ?? 0),
    Number(r.plan_topup_count ?? 0),
    r.status ?? '',
    r.sponsor_name ?? '',
    r.wallet_address ?? '',
    r.payment_status ?? '',
    r.payment_for ?? '',
    r.latest_payment_amount != null ? Number(r.latest_payment_amount) : '',
    r.pending_payment_for ?? '',
    r.pending_payment_amount != null ? Number(r.pending_payment_amount) : '',
  ])

  return [header, ...body]
}

/** Excel download — rows same shape as `/admin/members`. */
export function downloadMembersExcel(rows, baseName = 'admin-members', { metaLines = [] } = {}) {
  const safe = String(baseName).replace(/[^\w.-]+/g, '_').slice(0, 120) || 'admin-members'

  const meta = [['Members'], ...metaLines.map((l) => [l]), []]
  const dataAoA = membersToAoA(rows)
  const sheetData = [...meta, ...dataAoA]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  XLSX.utils.book_append_sheet(wb, ws, 'Members')
  XLSX.writeFile(wb, `${safe}.xlsx`)
}
