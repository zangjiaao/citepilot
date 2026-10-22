import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Studio } from '../../shared/types.ts'
import { api } from './api'

interface Health {
  ok: boolean
  llm: { enabled: boolean; model: string; baseUrl: string; label?: string; source?: string }
}

interface StudioContextValue {
  studios: Studio[]
  studio: Studio | null
  studioId: string
  setStudioId: (id: string) => void
  refresh: () => Promise<void>
  llm: Health['llm'] | null
  loading: boolean
  error: string
}

const StudioContext = createContext<StudioContextValue | null>(null)
const STORAGE_KEY = 'citepilot.studioId'

export function StudioProvider({ children }: { children: ReactNode }) {
  const [studios, setStudios] = useState<Studio[]>([])
  const [studioId, setStudioIdState] = useState('')
  const [llm, setLlm] = useState<Health['llm'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [health, payload] = await Promise.all([
        api<Health>('/api/health'),
        api<{ studios: Studio[] }>('/api/studios'),
      ])
      setLlm(health.llm)
      setStudios(payload.studios)
      const stored = localStorage.getItem(STORAGE_KEY)
      const next = payload.studios.find((item) => item.id === stored)?.id ?? payload.studios[0]?.id ?? ''
      setStudioIdState(next)
      if (next) localStorage.setItem(STORAGE_KEY, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const setStudioId = (id: string) => {
    setStudioIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const value = useMemo<StudioContextValue>(
    () => ({
      studios,
      studio: studios.find((item) => item.id === studioId) ?? null,
      studioId,
      setStudioId,
      refresh,
      llm,
      loading,
      error,
    }),
    [studios, studioId, llm, loading, error],
  )

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext)
  if (!value) throw new Error('品牌上下文还没有准备好')
  return value
}
