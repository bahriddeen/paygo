import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useBranches, type Branch } from '@/lib/api'

const STORAGE_KEY = 'qarz.activeBranch'

interface BranchContextValue {
  branches: Branch[]
  activeBranch: Branch | null
  activeBranchId: number | null
  setActiveBranchId: (id: number) => void
  isLoading: boolean
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  activeBranch: null,
  activeBranchId: null,
  setActiveBranchId: () => {},
  isLoading: true
})

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: branches = [], isLoading } = useBranches()
  const [activeBranchId, setActiveId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? Number(saved) : null
  })

  // Default to the first branch once loaded, or if the saved one disappeared.
  useEffect(() => {
    if (branches.length === 0) return
    const exists = branches.some((b) => b.id === activeBranchId)
    if (!exists) setActiveId(branches[0].id)
  }, [branches, activeBranchId])

  const setActiveBranchId = (id: number): void => {
    localStorage.setItem(STORAGE_KEY, String(id))
    setActiveId(id)
  }

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      activeBranchId,
      activeBranch: branches.find((b) => b.id === activeBranchId) ?? null,
      setActiveBranchId,
      isLoading
    }),
    [branches, activeBranchId, isLoading]
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranch() {
  return useContext(BranchContext)
}
