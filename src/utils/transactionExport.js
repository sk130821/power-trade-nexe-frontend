import * as XLSX from 'xlsx'

function istString(createdAt) {
  if (createdAt == null) return ''
  return new Date(createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

function transactionsToAoA(rows, { includeMember = false } = {}) {
  const header = ['credited_ist', 'txn_id']
  if (includeMember) header.push('member_id', 'member_name', 'member_email')
  header.push(
    'income_type',
    'wallet_type',
    'amount_usd',
    'status',
    'description',
    'from_member_name',
    'level_no',
    'reference_id',
    'reference_type',
  )

  const body = (rows || []).map((r) => {
    const line = [istString(r.created_at), r.txn_id ?? '']
    if (includeMember) {
      line.push(
        r.member_id ?? '',
        r.member_name != null ? String(r.member_name) : '',
        r.member_email != null ? String(r.member_email) : '',
      )
    }
    line.push(
      r.income_type ?? '',
      r.wallet_type ?? '',
      Number(r.amount ?? 0),
      r.status ?? '',
      r.description != null ? String(r.description) : '',
      r.from_name != null ? String(r.from_name) : '',
      r.level_no ?? '',
      r.reference_id ?? '',
      r.reference_type ?? '',
    )
    return line
  })

  return [header, ...body]
}

/** Excel download — rows same shape as `/admin/transactions` or `/member/transactions`. */
export function downloadTransactionsExcel(rows, baseName = 'transaction-history', { includeMember = false, metaLines = [] } = {}) {
  const safe = String(baseName).replace(/[^\w.-]+/g, '_').slice(0, 120) || 'transaction-history'

  const meta = [['Transaction History'], ...metaLines.map((l) => [l]), []]
  const dataAoA = transactionsToAoA(rows, { includeMember })
  const sheetData = [...meta, ...dataAoA]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
  XLSX.writeFile(wb, `${safe}.xlsx`)
}
