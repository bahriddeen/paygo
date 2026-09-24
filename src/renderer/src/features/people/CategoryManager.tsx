import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, Pencil, Trash2, Plus, Check } from 'lucide-react'
import {
  useCategories,
  useCreateCategory,
  useRenameCategory,
  useDeleteCategory,
  type ClientKind
} from '@/lib/api'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function CategoryManager({
  open,
  onClose,
  branchId,
  kind = 'client'
}: {
  open: boolean
  onClose: () => void
  branchId: number
  kind?: ClientKind
}) {
  const { t } = useTranslation()
  const cats = useCategories(branchId, kind)
  const create = useCreateCategory()
  const rename = useRenameCategory()
  const del = useDeleteCategory()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  return (
    <Modal open={open} onClose={onClose} title={t('clients.manageFolders')}>
      <div className="space-y-3">
        <ul className="divide-y divide-border">
          {(cats.data ?? []).map((cat) => (
            <li key={cat.id} className="flex items-center gap-2 py-2">
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              {editingId === cat.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="h-8 flex-1"
                />
              ) : (
                <span className="flex-1 truncate text-sm font-medium">{cat.name}</span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {cat.count}
              </span>
              {editingId === cat.id ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (editName.trim()) rename.mutate({ id: cat.id, name: editName.trim() })
                    setEditingId(null)
                  }}
                >
                  <Check className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingId(cat.id)
                    setEditName(cat.name)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => del.mutate(cat.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
          {(cats.data ?? []).length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">—</li>
          ) : null}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('clients.folderName')}
          />
          <Button
            disabled={!newName.trim()}
            onClick={() =>
              create.mutate(
                { branchId, name: newName.trim(), kind },
                { onSuccess: () => setNewName('') }
              )
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </Modal>
  )
}
