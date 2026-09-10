export const PAYMENT_TYPE_TRUST = 'trust_wallet'

export function paymentTypeLabel(type) {
  if (type === 'trust_wallet' || type === 'metamask') return 'USDT BEP20'
  if (type === 'cod') return 'Bank / COD'
  return type || '—'
}

export function isEvmTxHash(s) {
  return typeof s === 'string' && /^0x[a-fA-F0-9]{64}$/.test(s.trim())
}
