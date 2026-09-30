import { useState, useRef } from 'react'
import { memberAchievementAPI, uploadUrl } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, FormGroup, Input, Textarea, Spinner } from '../../components/ui/index.jsx'

export default function AdminMemberAchievements() {
  const [toast, setToast] = useState(null)
  const [filterQ, setFilterQ] = useState('')
  const [form, setForm] = useState({
    display_name: '',
    achievement: '',
    is_active: true,
  })
  const [file, setFile] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editPhoto, setEditPhoto] = useState('')
  const [editForm, setEditForm] = useState({
    display_name: '',
    achievement: '',
    is_active: true,
  })
  const [editFile, setEditFile] = useState(null)
  const fileRef = useRef(null)

  const listParams = filterQ.trim() ? { q: filterQ.trim() } : {}
  const { data, loading, error, refetch } = useApi(
    () => memberAchievementAPI.adminList(listParams),
    [filterQ],
  )
  const { mutate: create, loading: creating } = useMutation(memberAchievementAPI.adminCreate)
  const { mutate: update, loading: updating } = useMutation(({ id, fd }) => memberAchievementAPI.adminUpdate(id, fd))
  const { mutate: remove } = useMutation(memberAchievementAPI.adminDelete)
  const [deletingId, setDeletingId] = useState(null)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const rows = data?.achievements || []

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!file) {
      notify('Photo is required', 'danger')
      return
    }
    const fd = new FormData()
    fd.append('display_name', form.display_name.trim())
    fd.append('achievement', form.achievement.trim())
    fd.append('is_active', form.is_active ? '1' : '0')
    fd.append('achievement_photo', file)
    try {
      await create(fd)
      notify('Achievement saved — latest entries show on top')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setForm({ display_name: '', achievement: '', is_active: true })
      refetch()
    } catch (err) {
      notify(err.response?.data?.error || err.message, 'danger')
    }
  }

  const startEdit = (row) => {
    if (!row?.id) return
    setEditId(row.id)
    setEditPhoto(row.photo || '')
    setEditForm({
      display_name: row.display_name || '',
      achievement: row.achievement || '',
      is_active: Number(row.is_active) === 1,
    })
    setEditFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editId) return
    const fd = new FormData()
    fd.append('display_name', editForm.display_name.trim())
    fd.append('achievement', editForm.achievement.trim())
    fd.append('is_active', editForm.is_active ? '1' : '0')
    if (editFile) fd.append('achievement_photo', editFile)
    try {
      await update({ id: editId, fd })
      notify('Updated')
      setEditId(null)
      setEditPhoto('')
      refetch()
    } catch (err) {
      notify(err.response?.data?.error || err.message, 'danger')
    }
  }

  const del = async (row) => {
    if (!row?.id) return
    if (!window.confirm(`Delete achievement for ${row.display_name || 'this entry'}?`)) return
    try {
      setDeletingId(row.id)
      await remove(row.id)
      notify('Deleted')
      if (editId === row.id) {
        setEditId(null)
        setEditPhoto('')
      }
      refetch()
    } catch (err) {
      notify(err.response?.data?.error || err.message, 'danger')
    } finally {
      setDeletingId(null)
    }
  }

  const cols = [
    {
      key: 'photo',
      label: 'Photo',
      render: (_, row) => (
        <img
          src={uploadUrl(row.photo)}
          alt=""
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
        />
      ),
    },
    { key: 'display_name', label: 'Name' },
    {
      key: 'achievement',
      label: 'Achievement',
      render: (_, row) => (
        <div style={{ maxWidth: 220, fontSize: 12, lineHeight: 1.45 }} title={row.achievement}>
          {row.achievement?.length > 90 ? `${row.achievement.slice(0, 90)}…` : row.achievement}
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Visible',
      render: (_, row) => (
        <Badge type={Number(row.is_active) === 1 ? 'approved' : 'inactive'}>
          {Number(row.is_active) === 1 ? 'Yes' : 'Hidden'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn size="sm" variant="ghost" type="button" onClick={() => startEdit(row)}>Edit</Btn>
          <Btn
            size="sm"
            variant="danger"
            type="button"
            loading={deletingId === row.id}
            onClick={() => del(row)}
          >
            Delete
          </Btn>
        </div>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Member achievements</div>
        <div className="page-subtitle">
          Add name, photo and achievement text. All members see the same gallery; newest entry on top.
        </div>
      </div>
      {toast && <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert>}
      {error && <Alert type="danger">{error}</Alert>}

      {editId ? (
        <Card title={`Edit achievement #${editId}`} className="mb-4">
          <form onSubmit={submitEdit}>
            {editPhoto ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Current photo</div>
                <img
                  src={uploadUrl(editPhoto)}
                  alt=""
                  style={{
                    maxWidth: 200,
                    maxHeight: 160,
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <FormGroup label="Name" required>
                <Input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  required
                />
              </FormGroup>
              <FormGroup label="Replace photo (optional)">
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                />
              </FormGroup>
            </div>
            <FormGroup label="Achievement" required>
              <Textarea
                rows={4}
                value={editForm.achievement}
                onChange={(e) => setEditForm((f) => ({ ...f, achievement: e.target.value }))}
                required
              />
            </FormGroup>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Visible to member
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="primary" type="submit" loading={updating}>Update</Btn>
              <Btn variant="ghost" type="button" onClick={() => { setEditId(null); setEditPhoto('') }}>Cancel</Btn>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title="Add achievement">
        <form onSubmit={submitCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <FormGroup label="Name (on card)" required>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Any display name"
                required
              />
            </FormGroup>
            <FormGroup label="Photo" required>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </FormGroup>
          </div>
          <FormGroup label="Achievement" required>
            <Textarea
              rows={3}
              value={form.achievement}
              onChange={(e) => setForm((f) => ({ ...f, achievement: e.target.value }))}
              placeholder="What they achieved — reward, rank, event, etc."
              required
            />
          </FormGroup>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Show on member panel
          </label>
          <Btn variant="primary" type="submit" loading={creating}>
            Save achievement
          </Btn>
        </form>
      </Card>

      <Card title="All achievements (newest first)" noPad className="mt-4">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search name or achievement…"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <Btn variant="ghost" size="sm" type="button" onClick={() => refetch()}>Refresh</Btn>
        </div>
        {loading ? (
          <div style={{ padding: 24 }}><Spinner /></div>
        ) : (
          <Table cols={cols} rows={rows} emptyText="No achievements yet — add one above" />
        )}
      </Card>
    </AdminLayout>
  )
}
