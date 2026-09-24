import { useState } from 'react'

/** Client-side search + pagination for an in-memory list. */
export function useListControls<T>(items: T[], searchOf: (item: T) => string, pageSize = 15) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const q = query.trim().toLowerCase()
  const filtered = q ? items.filter((i) => searchOf(i).toLowerCase().includes(q)) : items
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)

  return {
    query,
    setQuery: (v: string) => {
      setQuery(v)
      setPage(0)
    },
    page: clampedPage,
    setPage,
    pageItems,
    filtered,
    total: filtered.length,
    totalPages,
    pageSize
  }
}
