import { useEffect, useState } from 'react'
import { memberAPI } from '../../api/index.js'
import { MemberLayout } from '../../components/layout/index.jsx'
import { Alert, Btn, Card, FormGroup, Input, Select, Spinner } from '../../components/ui/index.jsx'

const RELATION_OPTIONS = [
  { value: '', label: 'Select relation' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Other', label: 'Other' },
]

export function MemberNominee() {
  const [form, setForm] = useState({ nominee_name: '', nominee_contact: '', nominee_relation: '' })
  const [relationOther, setRelationOther] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await memberAPI.getNominee()
        if (cancelled) return
        const rel = data.nominee_relation || ''
        const known = RELATION_OPTIONS.some((o) => o.value && o.value === rel)
        setForm({
          nominee_name: data.nominee_name || '',
          nominee_contact: data.nominee_contact || '',
          nominee_relation: known ? rel : rel ? 'Other' : '',
        })
        setRelationOther(known ? '' : rel)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load nominee details')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const relation =
      form.nominee_relation === 'Other'
        ? relationOther.trim()
        : form.nominee_relation.trim()
    setSaving(true)
    try {
      const { data: res } = await memberAPI.updateNominee({
        nominee_name: form.nominee_name.trim(),
        nominee_contact: form.nominee_contact.trim(),
        nominee_relation: relation,
      })
      setSuccess(res.message || 'Nominee details saved')
      if (form.nominee_relation === 'Other' && relation) {
        setRelationOther(relation)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MemberLayout>
        <Spinner />
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="page-header">
        <div className="page-title">Nominee details</div>
        <div className="page-subtitle">
          Add or update your nominee — name, contact number, and relation with you.
        </div>
      </div>

      <div style={{ maxWidth: 480 }}>
        <Card title="My nominee">
          {success ? <Alert type="success" className="mb-4">{success}</Alert> : null}
          {error ? <Alert type="danger" className="mb-4" onClose={() => setError('')}>{error}</Alert> : null}
          <Alert type="info" className="mb-4">
            These details are stored on your member profile. Admin can view them for records only.
          </Alert>
          <form onSubmit={submit}>
            <FormGroup label="Nominee name" required>
              <Input
                value={form.nominee_name}
                onChange={set('nominee_name')}
                placeholder="Full name"
                required
                maxLength={255}
              />
            </FormGroup>
            <FormGroup label="Contact number" required hint="10-digit mobile (with or without +91)">
              <Input
                type="tel"
                value={form.nominee_contact}
                onChange={set('nominee_contact')}
                placeholder="Mobile number"
                required
                inputMode="numeric"
              />
            </FormGroup>
            <FormGroup label="Relation" required>
              <Select
                value={form.nominee_relation}
                onChange={set('nominee_relation')}
                options={RELATION_OPTIONS}
                required
              />
            </FormGroup>
            {form.nominee_relation === 'Other' && (
              <FormGroup label="Specify relation" required>
                <Input
                  value={relationOther}
                  onChange={(e) => setRelationOther(e.target.value)}
                  placeholder="e.g. Uncle, Wife, Friend"
                  required
                  maxLength={100}
                />
              </FormGroup>
            )}
            <Btn variant="primary" type="submit" loading={saving} full>
              Save nominee
            </Btn>
          </form>
        </Card>
      </div>
    </MemberLayout>
  )
}
