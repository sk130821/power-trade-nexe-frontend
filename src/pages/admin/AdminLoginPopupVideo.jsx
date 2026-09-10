import { useState } from 'react'
import { authAPI, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, FormGroup } from '../../components/ui/index.jsx'

export default function AdminLoginPopupVideo() {
  const [toast, setToast] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [markRemove, setMarkRemove] = useState(false)
  const { data, loading, refetch } = useApi(() => authAPI.getLoginPopup(), [], { initialData: {} })
  const { mutate: save, loading: saving } = useMutation(authAPI.updateLoginPopupVideo)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      const fd = new FormData()
      if (videoFile) fd.append('login_popup_video', videoFile)
      if (markRemove) fd.append('remove', '1')
      if (!videoFile && !markRemove) {
        notify('Choose a video file or remove the current one', 'danger')
        return
      }
      await save(fd)
      setVideoFile(null)
      setMarkRemove(false)
      notify('Login video saved — members will see it after login')
      refetch()
    } catch (err) {
      notify(err.response?.data?.error || err.message, 'danger')
    }
  }

  const currentVideo = markRemove ? null : data?.video

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Login video popup</div>
        <div className="page-subtitle">
          Plays in a popup when a member logs in. Uploading a new file deletes the previous video from the server.
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
      <div style={{ maxWidth: 640 }}>
        <Card title="Welcome video">
          {loading ? (
            <div style={{ padding: 24 }}>Loading…</div>
          ) : (
            <form onSubmit={submit}>
              {currentVideo ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Current video</div>
                  <video
                    src={uploadUrl(currentVideo)}
                    controls
                    style={{
                      width: '100%',
                      maxWidth: 480,
                      maxHeight: 270,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: '#000',
                    }}
                  />
                  <Btn
                    type="button"
                    variant="ghost"
                    size="sm"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setMarkRemove(true)
                      setVideoFile(null)
                    }}
                  >
                    Remove current video
                  </Btn>
                </div>
              ) : (
                <Alert type="info" className="mb-4">
                  No video uploaded yet — members will skip straight to the image popup (if set).
                </Alert>
              )}
              <FormGroup label="Upload video" hint="MP4, WebM, MOV — max 50 MB">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                  onChange={(e) => {
                    setVideoFile(e.target.files?.[0] || null)
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
                {videoFile ? (
                  <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 8 }}>Selected: {videoFile.name}</div>
                ) : null}
              </FormGroup>
              <Btn variant="primary" type="submit" loading={saving} icon="💾">
                Save video
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
