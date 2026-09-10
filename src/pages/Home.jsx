import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { MemberLogin } from './member/MemberAuth.jsx'

/** Public home — member login only. Admin uses /admin/login (not linked from here). */
export default function Home() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user?.role === 'member') return <Navigate to="/member/dashboard" replace />
  return <MemberLogin />
}
