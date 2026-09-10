import { Modal } from './ui/index.jsx'
import { uploadUrl } from '../api/index.js'

function isPdf(filename) {
  return String(filename || '').toLowerCase().endsWith('.pdf')
}

/** Admin / member — view payment receipt in a modal. */
export function PaymentReceiptModal({ open, onClose, receiptImage, title = 'Payment receipt' }) {
  if (!receiptImage) return null
  const src = uploadUrl(receiptImage)

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {isPdf(receiptImage) ? (
          <iframe
            title="Payment receipt PDF"
            src={src}
            style={{ width: '100%', minHeight: 480, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card2)' }}
          />
        ) : (
          <img
            src={src}
            alt="Payment receipt"
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 10, border: '1px solid var(--border)' }}
          />
        )}
        <a href={src} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', fontWeight: 500, fontSize: 13 }}>
          Open in new tab ↗
        </a>
      </div>
    </Modal>
  )
}
