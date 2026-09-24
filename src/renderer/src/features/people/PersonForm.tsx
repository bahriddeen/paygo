import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TrustSelector } from './TrustLevel'
import type { Category, Client } from '@/lib/api'

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export interface PersonFormValues {
  name: string
  phone: string
  description: string
  trust_level: number
  group_id: number | null
}

export function PersonForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  pending
}: {
  initial?: Client | null
  categories: Category[]
  onSubmit: (v: PersonFormValues) => void
  onCancel: () => void
  pending?: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [trust, setTrust] = useState(initial?.trust_level ?? 3)
  const [groupId, setGroupId] = useState<number | null>(initial?.group_id ?? null)
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('clients.nameRequired'))
      return
    }
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      description: description.trim(),
      trust_level: trust,
      group_id: groupId
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="c-name">{t('clients.name')}</Label>
        <Input
          id="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-phone">{t('clients.phone')}</Label>
        <Input
          id="c-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998 90 123 45 67"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-desc">{t('clients.description')}</Label>
        <textarea
          id="c-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t('clients.trust')}</Label>
        <TrustSelector value={trust} onChange={setTrust} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-category">{t('clients.category')}</Label>
        <select
          id="c-category"
          className={selectClass}
          value={groupId ?? ''}
          onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t('clients.noCategory')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
