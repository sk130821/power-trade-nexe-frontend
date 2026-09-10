import { useState, useEffect, useCallback } from 'react'

// Generic fetch hook
export function useApi(apiFn, deps = [], options = {}) {
  const { immediate = true, initialData = null } = options
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)

  const execute = useCallback(async (...args) => {
    const last = args[args.length - 1]
    const silent = last && typeof last === 'object' && !Array.isArray(last) && last.silent === true
    const fnArgs = silent ? args.slice(0, -1) : args

    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await apiFn(...fnArgs)
      setData(res.data)
      return res.data
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong'
      if (!silent) setError(msg)
      throw err
    } finally {
      if (!silent) setLoading(false)
    }
  }, deps)

  useEffect(() => {
    if (immediate) execute()
  }, [immediate, execute])

  return { data, loading, error, refetch: execute }
}

// Mutation hook (for POST/PUT/DELETE)
export function useMutation(apiFn) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const mutate = async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn(...args)
      return res.data
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }

  return { mutate, loading, error, setError }
}
