/** BNB Smart Chain in Trust Wallet deep links (coin param). */
export const BSC_TRUST_COIN_ID = '20000714'

/** USDT BEP-20 on BSC — default if admin has not set web3_payment_token. */
export const USDT_BSC_TOKEN = '0x55d398326f99059fF775485246999027B3197955'

export function getUsdtTokenId(settings) {
  const t = settings?.web3_payment_token?.trim() || settings?.payment_token?.trim()
  return t || USDT_BSC_TOKEN
}

/** Trust Wallet “send USDT on BSC” deep link (opens app on mobile). */
export function buildTrustWalletPayUrl({ address, settings, amount }) {
  const addr = typeof address === 'string' ? address.trim() : ''
  if (!addr) return null

  const params = new URLSearchParams()
  params.set('coin', BSC_TRUST_COIN_ID)
  params.set('address', addr)
  params.set('token_id', getUsdtTokenId(settings))

  const n = amount != null && amount !== '' ? Number(amount) : NaN
  if (Number.isFinite(n) && n > 0) {
    params.set('amount', String(n))
  }

  return `https://link.trustwallet.com/send?${params.toString()}`
}

export async function copyToClipboard(text) {
  const value = String(text || '')
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
