import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload, FileSpreadsheet, FolderOpen, Save, Clock } from 'lucide-react'
import { useBackupStatus, useSetSetting } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/ui/infotip'
import { formatDate } from '@/lib/date'

const selectClass =
  'h-9 appearance-none rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** A labeled settings row: icon + title + info tooltip on the left, control on the right. */
function Item({
  icon,
  title,
  tip,
  children
}: {
  icon: ReactNode
  title: string
  tip: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="truncate text-sm font-medium">{title}</span>
        <InfoTip text={tip} />
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

export function DataBackup() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const backup = useBackupStatus()
  const setSetting = useSetSetting()
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const status = backup.data
  const refresh = (): void => {
    void qc.invalidateQueries()
  }

  async function doImport(): Promise<void> {
    setMsg(null)
    const r = await window.api.data.import(importMode)
    if (r.ok) {
      setMsg({ ok: true, text: t('settings.importDone') })
      refresh()
    } else if (r.error) {
      setMsg({ ok: false, text: t('settings.importError') })
    }
  }

  async function doExport(kind: 'json' | 'excel'): Promise<void> {
    setMsg(null)
    const r =
      kind === 'json' ? await window.api.data.exportJson() : await window.api.data.exportExcel()
    if (r.ok && r.path) setMsg({ ok: true, text: t('settings.exportDone', { path: r.path }) })
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
        {t('settings.dataBackup')}
      </h2>
      <div className="px-5 pb-5">
        <GroupTitle>{t('settings.exportImport')}</GroupTitle>
        <div className="divide-y divide-border">
          <Item icon={<Download className="size-4" />} title={t('settings.exportJson')} tip={t('settings.exportJsonTip')}>
            <Button variant="outline" size="sm" onClick={() => doExport('json')}>
              {t('settings.exportJson').split(' ')[0]}
            </Button>
          </Item>
          <Item icon={<FileSpreadsheet className="size-4" />} title={t('settings.exportExcel')} tip={t('settings.exportExcelTip')}>
            <Button variant="outline" size="sm" onClick={() => doExport('excel')}>
              Excel
            </Button>
          </Item>
          <Item icon={<Upload className="size-4" />} title={t('settings.importData')} tip={t('settings.importTip')}>
            <select
              aria-label={t('settings.importMode')}
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
              className={selectClass}
            >
              <option value="merge">{t('settings.importMerge')}</option>
              <option value="replace">{t('settings.importReplace')}</option>
            </select>
            <Button variant="outline" size="sm" onClick={doImport}>
              {t('settings.importData').split(' ')[0]}
            </Button>
          </Item>
        </div>

        <GroupTitle>{t('settings.autoBackup')}</GroupTitle>
        <div className="divide-y divide-border">
          <Item icon={<FolderOpen className="size-4" />} title={t('settings.backupFolder')} tip={t('settings.backupFolderTip')}>
            {status?.folder ? (
              <span className="max-w-[200px] truncate text-xs text-muted-foreground" title={status.folder}>
                {status.folder}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await window.api.backup.chooseFolder()
                if (r.ok) refresh()
              }}
            >
              {t('settings.chooseFolder')}
            </Button>
          </Item>
          <Item icon={<Clock className="size-4" />} title={t('settings.backupSchedule')} tip={t('settings.backupScheduleTip')}>
            <select
              className={selectClass}
              value={status?.schedule ?? 'off'}
              onChange={(e) =>
                setSetting.mutate({ key: 'backup_schedule', value: e.target.value }, { onSuccess: refresh })
              }
            >
              <option value="off">{t('settings.scheduleOff')}</option>
              <option value="daily">{t('settings.scheduleDaily')}</option>
              <option value="weekly">{t('settings.scheduleWeekly')}</option>
            </select>
          </Item>
          <Item icon={<Save className="size-4" />} title={t('settings.backupNow')} tip={t('settings.backupNowTip')}>
            <span className="text-xs text-muted-foreground">
              {status?.last ? formatDate(Number(status.last), i18n.language) : t('settings.never')}
            </span>
            <Button
              size="sm"
              disabled={!status?.folder}
              onClick={async () => {
                const r = await window.api.backup.now()
                if (r.ok && r.path) {
                  setMsg({ ok: true, text: t('settings.exportDone', { path: r.path }) })
                  refresh()
                }
              }}
            >
              {t('settings.backupNow')}
            </Button>
          </Item>
        </div>

        {msg ? (
          <p className={msg.ok ? 'mt-4 break-all text-sm text-primary' : 'mt-4 text-sm text-destructive'}>
            {msg.text}
          </p>
        ) : null}

        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t('settings.backupHint')}
        </p>
      </div>
    </section>
  )
}
