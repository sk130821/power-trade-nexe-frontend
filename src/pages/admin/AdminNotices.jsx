import { useState } from 'react'
import { noticeAPI, fmt } from '../../api/index.js'
import { useApi, useMutation } from '../../hooks/useApi.js'
import { AdminLayout } from '../../components/layout/index.jsx'
import { Card, Btn, Alert, Table, Badge, Modal, FormGroup, Input, Textarea, Spinner } from '../../components/ui/index.jsx'

function activeBool(v) {
  return v === 1 || v === true || v === '1'
}

export default function AdminNotices() {
  const [toast, setToast] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState({ title: '', body: '', sort_order: 0, is_active: true })
  const { data, loading, refetch } = useApi(() => noticeAPI.adminList(), [])
  const { mutate: create, loading: creating } = useMutation(noticeAPI.adminCreate)
  const { mutate: update } = useMutation(noticeAPI.adminUpdate)
  const { mutate: remove } = useMutation(noticeAPI.adminDelete)

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    try {
      await create(form)
      notify('Notice will show to members (if Active)')
      setCreateOpen(false)
      setForm({ title: '', body: '', sort_order: 0, is_active: true })
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editRow) return
    try {
      await update(editRow.id, {
        title: form.title,
        body: form.body,
        sort_order: form.sort_order,
        is_active: form.is_active,
      })
      notify('Saved')
      setEditRow(null)
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const toggleActive = async (row) => {
    try {
      await update(row.id, { is_active: !activeBool(row.is_active) })
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const del = async (row) => {
    if (!window.confirm(`Delete: "${row.title}"?`)) return
    try {
      await remove(row.id)
      notify('Deleted')
      refetch()
    } catch (err) {
      notify(err.message, 'danger')
    }
  }

  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      title: row.title,
      body: row.body,
      sort_order: row.sort_order ?? 0,
      is_active: activeBool(row.is_active),
    })
  }

  const notices = data?.notices || []

  return (
    <AdminLayout>
      <div className="page-header">
        <div className="page-title">Member notices</div>
        <div className="page-subtitle">Create notices here — active ones appear at the top of all member pages (after login)</div>
      </div>
      {toast ? <Alert type={toast.type} onClose={() => setToast(null)}>{toast.msg}</Alert> : null}

      <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <Btn variant="primary" type="button" onClick={() => setCreateOpen(true)} icon="＋">
          New notice
        </Btn>
      </div>

      <Card noPad title={`All notices (${notices.length})`}>
        {loading ? (
          <div style={{ padding: 40 }}>
            <Spinner />
          </div>
        ) : (
          <Table
            cols={[
              {
                key: 'title',
                label: 'Title / preview',
                render: (v, r) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.body}</div>
                  </div>
                ),
              },
              { key: 'sort_order', label: 'Order', render: (v) => <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v}</span> },
              {
                key: 'is_active',
                label: 'Active',
                render: (v) => <Badge type={activeBool(v) ? 'active' : 'pending'}>{activeBool(v) ? 'yes' : 'no'}</Badge>,
              },
              {
                key: 'created_at',
                label: 'Created',
                render: (v) => <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmt.time(v)}</span>,
              },
              {
                key: 'id',
                label: 'Actions',
                render: (_, r) => (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                      {activeBool(r.is_active) ? 'Hide' : 'Show'}
                    </Btn>
                    <Btn type="button" size="sm" variant="outline-cyan" onClick={() => openEdit(r)}>
                      Edit
                    </Btn>
                    <Btn type="button" size="sm" variant="ghost" onClick={() => del(r)} style={{ color: 'var(--red)' }}>
                      Delete
                    </Btn>
                  </div>
                ),
              },
            ]}
            rows={notices}
            emptyText="No notices yet — click New notice"
            emptyIcon="📣"
          />
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New notice">
        <form onSubmit={submitCreate}>
          <FormGroup label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Important update" required />
          </FormGroup>
          <FormGroup label="Message" required hint="Members see the full text">
            <Textarea rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required />
          </FormGroup>
          <FormGroup label="Sort order" hint="Lower numbers appear first in the list">
            <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
          </FormGroup>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active (show to members)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" variant="primary" loading={creating}>Publish</Btn>
            <Btn type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Notice edit">
        <form onSubmit={submitEdit}>
          <FormGroup label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </FormGroup>
          <FormGroup label="Message" required>
            <Textarea rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required />
          </FormGroup>
          <FormGroup label="Sort order">
            <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
          </FormGroup>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn type="submit" variant="primary">Save</Btn>
            <Btn type="button" variant="ghost" onClick={() => setEditRow(null)}>Cancel</Btn>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}