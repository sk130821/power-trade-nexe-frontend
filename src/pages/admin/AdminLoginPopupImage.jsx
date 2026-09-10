import { useState } from 'react'
import { authAPI, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, FormGroup } from '../../components/ui/index.jsx'

export default function AdminLoginPopupImage() {
  const [toast, setToast] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [markRemove, setMarkRemove] = useState(false)
  const { data, loading, refetch } = useApi(() => authAPI.getLoginPopup(), [], { initialData: {} })
  const { mutate: save, loading: saving } = useMutation(authAPI.updateLoginPopupImage)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const fd = new FormData()
      if (imageFile) fd.append('login_popup_image', imageFile)
      if (markRemove) fd.append('remove', '1')
      if (!imageFile && !markRemove) {
        notify('Choose an image file or remove the current one', 'danger')
        return
      }
      await save(fd)
      setImageFile(null)
      setMarkRemove(false)
      notify('Login image saved — shown after the member closes the video popup')
      refetch()
    } catch (err) {
      notify(err.response?.data?.error || err.message, 'danger')
    }
  }

  const currentImage = markRemove ? null : data?.image

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Login image popup</div>
        <div className="page-subtitle">
          Opens after the member closes the welcome video. If there is no video, this image shows right after login.
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
      <div style={{ maxWidth: 640 }}>
        <Card title="Welcome image">
          {loading ? (
            <div style={{ padding: 24 }}>Loading…</div>
          ) : (
            <form onSubmit={submit}>
              {currentImage ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Current image</div>
                  <img
                    src={uploadUrl(currentImage)}
                    alt="Login popup"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 320,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      objectFit: 'contain',
                      background: '#0a0e18',
                    }}
                  />
                  <Btn
                    type="button"
                    variant="ghost"
                    size="sm"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setMarkRemove(true)
                      setImageFile(null)
                    }}
                  >
                    Remove current image
                  </Btn>
                </div>
              ) : (
                <Alert type="info" className="mb-4">
                  No image uploaded yet.
                </Alert>
              )}
              <FormGroup label="Upload image" hint="PNG, JPG, GIF, or WebP">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    setImageFile(e.target.files?.[0] || null)
                    setMarkRemove(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-card2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                />
                {imageFile ? (
                  <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 8 }}>Selected: {imageFile.name}</div>
                ) : null}
              </FormGroup>
              <Btn variant="primary" type="submit" loading={saving} icon="💾">
                Save image
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
