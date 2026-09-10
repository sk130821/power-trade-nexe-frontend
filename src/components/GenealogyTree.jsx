import { useState, useMemo, useCallback, useEffect } from 'react'
import { Badge, Btn, Modal } from './ui/index.jsx'
import { fmt } from '../api/index.js'

function buildTree(root, flatMembers) {
  const byParent = new Map()
  for (const m of flatMembers) {
    const p = m.sponsor_id
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(m)
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => Number(a.id) - Number(b.id))
  }
  function nest(node, depth = 0) {
    const raw = byParent.get(node.id) || []
    return {
      ...node,
      level: depth,
      isRoot: depth === 0,
      children: raw.map((m) => nest({ ...m, children: [] }, depth + 1)),
    }
  }
  return nest({
    id: root.id,
    name: root.name,
    email: root.email,
    contact: root.contact,
    referral_code: root.referral_code,
    package_amount: root.package_amount,
    status: root.status,
    created_at: root.created_at,
    sponsor_id: root.sponsor_id ?? null,
    children: [],
  })
}

function collectIds(node, depth, maxDepth, set) {
  if (depth >= maxDepth) return
  for (const ch of node.children || []) {
    set.add(ch.id)
    collectIds(ch, depth + 1, maxDepth, set)
  }
}

/** Mask middle 4 digits of phone — e.g. 9876543210 → 987****3210 */
function maskContact(contact) {
  if (contact == null || contact === '') return '—'
  const raw = String(contact).trim()
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 5) return '****'
  const midStart = Math.floor((digits.length - 4) / 2)
  const maskedDigits = `${digits.slice(0, midStart)}****${digits.slice(midStart + 4)}`
  if (raw.startsWith('+')) {
    const prefix = raw.match(/^\+\d{1,3}/)?.[0] || '+'
    const prefixDigits = prefix.replace(/\D/g, '').length
    return `${prefix} ${maskedDigits.slice(prefixDigits)}`
  }
  return maskedDigits
}

/** Mask email — e.g. john@gmail.com → j****@g****.com */
function maskEmail(email) {
  if (email == null || email === '') return '—'
  const s = String(email).trim()
  const at = s.indexOf('@')
  if (at <= 0) return '****'
  const local = s.slice(0, at)
  const domain = s.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  const tld = dot >= 0 ? domain.slice(dot) : ''
  const domainName = dot >= 0 ? domain.slice(0, dot) : domain
  const maskedLocal = `${local[0] || '*'}****`
  const maskedDomain = `${(domainName[0] || '*')}****${tld}`
  return `${maskedLocal}@${maskedDomain}`
}

function nodeMatches(node, q) {
  if (!q) return true
  const s = q.toLowerCase()
  return (
    String(node.name || '').toLowerCase().includes(s) ||
    String(node.email || '').toLowerCase().includes(s) ||
    String(node.referral_code || '').toLowerCase().includes(s) ||
    String(node.id).includes(s)
  )
}

function subtreeHasMatch(node, q) {
  if (!q) return true
  if (nodeMatches(node, q)) return true
  return (node.children || []).some((ch) => subtreeHasMatch(ch, q))
}

export function buildDirectCountMap(flatMembers) {
  const map = new Map()
  for (const m of flatMembers || []) {
    const p = m.sponsor_id
    if (p != null) map.set(p, (map.get(p) || 0) + 1)
  }
  return map
}

export function GenealogyMemberDetailModal({ member, directCount, open, onClose }) {
  if (!member) return null
  const levelLabel = member.isRoot || member.level === 0 ? 'You (root)' : `Level ${member.level}`

  return (
    <Modal open={open} onClose={onClose} title="Member details" maxWidth={480}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--cyan)',
            background: 'var(--cyan-dim)',
            border: '1px solid rgba(0,229,255,0.25)',
          }}
        >
          {(member.name || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{member.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{levelLabel}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 0 }}>
        {[
          ['Member ID', member.referral_code || '—'],
          ['Email', maskEmail(member.email)],
          ['Contact', maskContact(member.contact)],
          ['Package', member.package_amount != null ? fmt.usd2(member.package_amount) : '—'],
          ['Status', null],
          ['Joined', member.created_at ? fmt.time(member.created_at) : '—'],
          ['Direct team', directCount != null ? `${directCount} member${directCount === 1 ? '' : 's'}` : '—'],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 0',
              borderBottom: '1px solid var(--border-sm)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
            {label === 'Status' ? (
              <Badge type={member.status}>{member.status}</Badge>
            ) : (
              <span
                style={{
                  color: 'var(--text-1)',
                  textAlign: 'right',
                  wordBreak: 'break-word',
                  fontFamily: label === 'Member ID' ? 'JetBrains Mono, monospace' : undefined,
                  fontSize: label === 'Email' ? 12 : 13,
                }}
              >
                {value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function MemberNodeCard({ node, childCount, onToggle, expanded, hasChildren, onSelect }) {
  const initial = (node.name || '?').trim().charAt(0).toUpperCase()
  const statusClass =
    node.status === 'active' ? 'gen-node--active' : node.status === 'pending' ? 'gen-node--pending' : 'gen-node--rejected'

  const handleCardClick = () => {
    onSelect?.(node)
  }

  return (
    <div className={`gen-node gen-node--clickable ${node.isRoot ? 'gen-node--root' : ''} ${statusClass}`}>
      <div className="gen-node__avatar" aria-hidden onClick={handleCardClick}>
        {initial}
      </div>
      <div className="gen-node__body" onClick={handleCardClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}>
        <div className="gen-node__title-row">
          <span className="gen-node__name">{node.name}</span>
          {node.isRoot ? <span className="gen-node__you">You</span> : null}
          {!node.isRoot && node.level ? <span className="gen-node__level">L{node.level}</span> : null}
          {!node.isRoot ? <Badge type={node.status}>{node.status}</Badge> : null}
        </div>
        <div className="gen-node__meta">
          <span className="gen-node__code">{node.referral_code}</span>
          <span className="gen-node__pkg">${node.package_amount}</span>
          {hasChildren ? <span className="gen-node__team">{childCount} direct</span> : null}
        </div>
        <div className="gen-node__hint">Tap for details</div>
        {hasChildren ? (
          <button
            type="button"
            className="gen-node__toggle"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
            aria-expanded={expanded}
          >
            {expanded ? '−' : '+'} {childCount} below
          </button>
        ) : null}
      </div>
    </div>
  )
}

function TreeBranch({ node, depth, expandedSet, onToggle, searchTerm, pageSize = 20, onMemberSelect }) {
  const kids = node.children || []
  const hasKids = kids.length > 0
  const isOpen = expandedSet.has(node.id)
  const filteredKids = searchTerm ? kids.filter((ch) => subtreeHasMatch(ch, searchTerm)) : kids

  if (searchTerm && !subtreeHasMatch(node, searchTerm)) return null

  const showKids = hasKids && isOpen && filteredKids.length > 0
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const visibleKids = filteredKids.slice(0, visibleCount)
  const hiddenCount = filteredKids.length - visibleKids.length

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [filteredKids.length, searchTerm, pageSize])

  return (
    <li className="gen-tree__branch" style={{ '--gen-depth': depth }}>
      <MemberNodeCard
        node={node}
        childCount={kids.length}
        hasChildren={hasKids}
        expanded={isOpen}
        onToggle={onToggle}
        onSelect={onMemberSelect}
      />
      {showKids ? (
        <ul className="gen-tree__children">
          {visibleKids.map((ch) => (
            <TreeBranch
              key={ch.id}
              node={ch}
              depth={depth + 1}
              expandedSet={expandedSet}
              onToggle={onToggle}
              searchTerm={searchTerm}
              pageSize={pageSize}
              onMemberSelect={onMemberSelect}
            />
          ))}
          {hiddenCount > 0 ? (
            <li className="gen-tree__more">
              <button
                type="button"
                className="gen-node__more-btn"
                onClick={() => setVisibleCount((n) => Math.min(n + pageSize, filteredKids.length))}
              >
                + {hiddenCount} more direct{hiddenCount === 1 ? '' : 's'} — tap to load
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  )
}

function useGenealogyPageSize() {
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w < 480) setPageSize(8)
      else if (w < 768) setPageSize(12)
      else setPageSize(24)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return pageSize
}

export function GenealogyTree({ rootMember, flatMembers, defaultOpenDepth = 2, onMemberSelect }) {
  const [searchTerm, setSearchTerm] = useState('')
  const pageSize = useGenealogyPageSize()

  const tree = useMemo(() => {
    if (!rootMember?.id) return null
    return buildTree(rootMember, flatMembers || [])
  }, [rootMember, flatMembers])

  const initExpanded = useCallback(() => {
    if (!tree) return new Set()
    const s = new Set([tree.id])
    collectIds(tree, 0, defaultOpenDepth, s)
    return s
  }, [tree, defaultOpenDepth])

  const [expanded, setExpanded] = useState(() => new Set())

  useEffect(() => {
    setExpanded(initExpanded())
  }, [initExpanded])

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    if (!tree) return
    const all = new Set([tree.id])
    function walk(n) {
      for (const ch of n.children || []) {
        all.add(ch.id)
        walk(ch)
      }
    }
    walk(tree)
    setExpanded(all)
  }

  const collapseAll = () => {
    if (!tree) return
    setExpanded(new Set([tree.id]))
  }

  if (!tree) return null

  const total = flatMembers?.length ?? 0

  return (
    <div className="gen-tree-panel">
      <div className="gen-tree-toolbar">
        <input
          type="search"
          className="gen-tree-search"
          placeholder="Search name, email, code, ID…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="gen-tree-toolbar__actions">
          <Btn type="button" size="sm" variant="ghost" onClick={expandAll}>
            Expand all
          </Btn>
          <Btn type="button" size="sm" variant="ghost" onClick={collapseAll}>
            Collapse all
          </Btn>
        </div>
      </div>
      <p className="gen-tree-hint">
        {total} downline member{total === 1 ? '' : 's'} · <strong>click any card</strong> for details ·{' '}
        <strong>+ N below</strong> to expand · scroll sideways if many directs
      </p>
      <div className="gen-tree-scroll">
        <div className="gen-tree">
          <ul className="gen-tree__root">
            <TreeBranch
              node={tree}
              depth={0}
              expandedSet={expanded}
              onToggle={toggle}
              searchTerm={searchTerm.trim()}
              pageSize={pageSize}
              onMemberSelect={onMemberSelect}
            />
          </ul>
        </div>
      </div>
    </div>
  )
}

/** Level-wise table for one generation */
export function GenealogyLevelTable({ level, members, onMemberSelect }) {
  if (!members?.length) {
    return <div className="gen-level-empty">No members at level {level}.</div>
  }
  return (
    <div className="gen-level-table-wrap">
      <table className="gen-level-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Code</th>
            <th>Package</th>
            <th>Status</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.id}
              className="gen-level-table__row--clickable"
              onClick={() => onMemberSelect?.(m)}
              title="Click for member details"
            >
              <td>
                <div className="gen-level-member">
                  <span className="gen-level-member__avatar">{(m.name || '?').charAt(0).toUpperCase()}</span>
                  <div>
                    <div className="gen-level-member__name">{m.name}</div>
                    <div className="gen-level-member__email">{maskEmail(m.email)}</div>
                  </div>
                </div>
              </td>
              <td data-label="Code"><span className="mono gen-level-code">{m.referral_code}</span></td>
              <td data-label="Package"><span className="mono gen-level-pkg">${m.package_amount}</span></td>
              <td data-label="Status"><Badge type={m.status}>{m.status}</Badge></td>
              <td className="gen-level-date" data-label="Joined">{fmt.date(m.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Level count summary cards */
export function GenealogyLevelSummary({ levels, activeLevel, onLevelClick }) {
  if (!levels?.length) return null
  return (
    <div className="gen-level-summary">
      {levels.map((L) => (
        <button
          key={L.level}
          type="button"
          className={`gen-level-summary__card${activeLevel === L.level ? ' gen-level-summary__card--active' : ''}`}
          onClick={() => onLevelClick?.(L.level)}
        >
          <div className="gen-level-summary__label">Level {L.level}</div>
          <div className="gen-level-summary__count">{L.count}</div>
          <div className="gen-level-summary__sub">member{L.count === 1 ? '' : 's'}</div>
        </button>
      ))}
    </div>
  )
}
