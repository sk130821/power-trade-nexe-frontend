import { useState, useRef } from 'react'
import { websiteContentAPI, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, FormGroup, Input, Spinner } from '../../components/ui/index.jsx'

export default function AdminWebsiteBanners() {
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState({ alt_text: 'Banner', sort_order: 0, is_active: true })
  const [file, setFile] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ alt_text: '', sort_order: 0, is_active: true })
  const [editFile, setEditFile] = useState(null)
  const fileInputRef = useRef(null)

  const { data, loading, error, refetch } = useApi(() => websiteContentAPI.adminList())
  const { mutate: create, loading: creating } = useMutation(websiteContentAPI.adminCreate)
  const { mutate: update } = useMutation(({ id, fd }) => websiteContentAPI.adminUpdate(id, fd))
  const { mutate: remove } = useMutation(websiteContentAPI.adminDelete)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const banners = data?.banners || []

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!file) {
      notify('Choose a banner image', 'danger')
      return
    }
    const fd = new FormData()
    fd.append('website_banner_image', file)
    fd.append('alt_text', form.alt_text)
    fd.append('sort_order', form.sort_order)
    fd.append('is_active', form.is_active ? '1' : '0')
    try {
      await create(fd)
      notify('Banner added — visible on marketing website Hero slider')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setForm({ alt_text: 'Banner', sort_order: banners.length + 1, is_active: true })
      await refetch()
    } catch (err) {
      notify(err.message || 'Upload failed — check image size/format', 'danger')
    }
  }

  const startEdit = (row) => {
    setEditId(row.id)
    setEditForm({
      alt_text: row.alt_text || 'Banner',
      sort_order: row.sort_order ?? 0,
      is_active: Number(row.is_active) === 1,
    })
    setEditFile(null)
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editId) return
    const fd = new FormData()
    fd.append('alt_text', editForm.alt_text)
    fd.append('sort_order', editForm.sort_order)
    fd.append('is_active', editForm.is_active ? '1' : '0')
    if (editFile) fd.append('website_banner_image', editFile)
    try {
      await update({ id: editId, fd })
      notify('Banner updated')
      setEditId(null)
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const del = async (row) => {
    if (!window.confirm(`Delete banner "${row.alt_text}"?`)) return
    try {
      await remove(row.id)
      notify('Deleted')
      if (editId === row.id) setEditId(null)
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Website Hero Banners</div>
        <div className="page-subtitle">
          Upload slider images for the public marketing site Hero section (recommended 1200×450 px).
          Login video/image popups are managed under Login video/image popup — they also show on the website.
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
      {error && <Alert type="danger">Could not load banners: {error}</Alert>}

      <div className="grid-2 mb-8">
        <Card title="➕ Add banner">
          <form onSubmit={submitCreate}>
            <FormGroup label="Image" required hint="JPEG, PNG, GIF, or WebP">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-card2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}
              />
            </FormGroup>
            <FormGroup label="Alt text">
              <Input value={form.alt_text} onChange={(e) => setForm((f) => ({ ...f, alt_text: e.target.value }))} />
            </FormGroup>
            <FormGroup label="Sort order" hint="Lower numbers appear first">
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </FormGroup>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 14 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Active (show on website)
            </label>
            <Btn type="submit" variant="primary" loading={creating}>Upload banner</Btn>
          </form>
        </Card>

        {editId ? (
          <Card title="✏️ Edit banner">
            <form onSubmit={submitEdit}>
              <FormGroup label="Replace image (optional)">
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
              </FormGroup>
              <FormGroup label="Alt text">
                <Input value={editForm.alt_text} onChange={(e) => setEditForm((f) => ({ ...f, alt_text: e.target.value }))} />
              </FormGroup>
              <FormGroup label="Sort order">
                <Input type="number" value={editForm.sort_order} onChange={(e) => setEditForm((f) => ({ ...f, sort_order: e.target.value }))} />
              </FormGroup>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 14 }}>
                <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Active
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="submit" variant="primary">Save</Btn>
                <Btn type="button" variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
              </div>
            </form>
          </Card>
        ) : (
          <Card title="ℹ️ Tips">
            <ul style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
              <li>Multiple banners rotate in the website home Hero slider.</li>
              <li>If no active banners exist, the site uses built-in default images.</li>
              <li>Welcome video/image popups use the same files as member login popups.</li>
            </ul>
          </Card>
        )}
      </div>

      <Card title={`All banners (${banners.length})`} noPad>
        {loading ? <Spinner /> : (
          <Table
            cols={[
              {
                key: 'image',
                label: 'Preview',
                render: (v, r) => (
                  <img
                    src={uploadUrl(v)}
                    alt={r.alt_text}
                    style={{ width: 120, height: 45, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                ),
              },
              { key: 'alt_text', label: 'Alt' },
              { key: 'sort_order', label: 'Order' },
              {
                key: 'is_active',
                label: 'Status',
                render: (v) => <Badge type={Number(v) === 1 ? 'active' : 'inactive'}>{Number(v) === 1 ? 'Active' : 'Hidden'}</Badge>,
              },
              {
                key: 'id',
                label: '',
                render: (_, r) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn size="sm" variant="ghost" onClick={() => startEdit(r)}>Edit</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => del(r)}>Delete</Btn>
                  </div>
                ),
              },
            ]}
            rows={banners}
            emptyText="No banners yet — upload one above"
          />
        )}
      </Card>
    </AdminLayout>
  )
}
