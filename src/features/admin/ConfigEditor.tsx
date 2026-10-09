import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileCheck2, Upload } from 'lucide-react'
import { isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { SelectField, TextAreaField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { bundledPackages } from '../../packages/presentation.ts'
import type { Package } from '../auth/dto.ts'
import { adminKeys, packageConfigSchema } from './api.ts'
import { checkDraft, draftFromAuthored, formatDraft, type DraftCheck } from './config.ts'
import { adminFailure } from './denied.ts'
import styles from './Admin.module.css'

type Published = { package_id: string; config_version: number }

const storageKey = (packageId: string) => `tamagotchi-go:admin-draft:${packageId}`

function loadDraft(packageId: string): string {
  try {
    return window.localStorage.getItem(storageKey(packageId)) ?? ''
  } catch {
    return ''
  }
}

function keepDraft(packageId: string, text: string) {
  try {
    window.localStorage.setItem(storageKey(packageId), text)
  } catch {
    // A draft that cannot be kept locally is still exportable.
  }
}

/**
 * Full-definition editor. There is no browser read of the current configuration,
 * so a draft starts from this browser's saved copy, an import or a bundled package.
 */
export function ConfigEditor({ userId, pkg }: { userId: string; pkg: Package }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState(() => loadDraft(pkg.package_id))
  const [check, setCheck] = useState<DraftCheck | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const publish = useCommand<Published>({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.package(userId, pkg.package_id) })
      void queryClient.invalidateQueries({ queryKey: ['public', 'packages'] })
    },
  })
  const nextVersion = (pkg.config_version ?? 0) + 1

  const update = (value: string) => {
    setText(value)
    setCheck(null)
    keepDraft(pkg.package_id, value)
    if (publish.command && !publish.pending) publish.reset()
  }

  const exportDraft = () => {
    const blob = new Blob([text], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${pkg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-config-draft.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className={styles.panel} aria-labelledby="config-heading">
      <h2 id="config-heading">Configuration</h2>
      <p className={styles.muted}>
        {pkg.config_version === null ? 'No configuration has been published, so players cannot join yet.' : `Current version: v${pkg.config_version}.`} Publishing a full
        definition creates v{nextVersion}. Existing creatures keep the version they were created with; new starters use the new one.
      </p>
      <div className={styles.toolbar}>
        <SelectField label="Start from a bundled package" value="" onChange={(event) => {
          const authored = bundledPackages.get(event.target.value)
          if (authored) update(formatDraft(draftFromAuthored(authored, window.location.origin)))
        }}>
          <option value="">Choose…</option>
          {[...bundledPackages.values()].map((authored) => (
            <option key={authored.key} value={authored.key}>
              {authored.package.name}
            </option>
          ))}
        </SelectField>
        <label className={styles.fileButton}>
          <Upload size={16} aria-hidden="true" /> Import JSON
          <input
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (file.size > 256_000) return setImportError('That file is too large for a configuration draft.')
              setImportError(null)
              update(await file.text())
            }}
          />
        </label>
        <Button variant="quiet" icon={<Download size={16} aria-hidden="true" />} disabled={!text.trim()} onClick={exportDraft}>
          Export draft
        </Button>
      </div>
      {importError && <FormAlert title="Not imported.">{importError}</FormAlert>}
      <TextAreaField
        label="Definition draft (JSON)"
        hint="Saved in this browser only. It never contains credentials."
        value={text}
        rows={14}
        spellCheck={false}
        className={styles.code}
        onChange={(event) => update(event.target.value)}
      />
      <div className={styles.actions}>
        <Button variant="secondary" icon={<FileCheck2 size={16} aria-hidden="true" />} disabled={!text.trim()} onClick={() => setCheck(checkDraft(text))}>
          Check draft
        </Button>
        <Button
          variant="primary"
          disabled={check?.ok !== true}
          busy={publish.pending}
          onClick={() =>
            check?.ok &&
            publish.start({
              method: 'PUT',
              path: apiPath`/registry/v1/packages/${pkg.package_id}/stats`,
              body: { expected_package_revision: pkg.revision, definition: check.draft },
              idempotent: true,
              parse: (value) => packageConfigSchema.parse(value),
              actor: userId,
            })
          }
        >
          Publish as v{nextVersion}
        </Button>
      </div>
      {check && !check.ok && (
        <FormAlert title="The draft needs changes.">
          <ul className={styles.issues}>
            {check.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </FormAlert>
      )}
      {check?.ok && (
        <div className={styles.assets}>
          <p>
            Draft is valid: {check.draft.stats.length} stats, {check.draft.care_actions.length} care actions, starter {check.draft.starter.name}. Asset preview:
          </p>
          <ul>
            {check.draft.assets.map((asset) => (
              <li key={`${asset.sprite_ref}:${asset.url}`}>
                <AssetPreview url={asset.url} label={asset.sprite_ref} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {publish.data && <FormAlert title={`Published configuration v${publish.data.data.config_version}.`} tone="info">Map this version to a presentation in client-config.json so players see labelled care.</FormAlert>}
      {publish.error && (
        <FormAlert title={publish.uncertain ? 'We could not confirm the configuration was published.' : 'Configuration not published.'} correlationId={isApiError(publish.error) ? publish.error.correlationId : null}>
          <p>{isApiError(publish.error) && publish.error.status === 409 ? 'The package changed since this page loaded. Reload it and publish again.' : adminFailure(publish.error)}</p>
          {publish.uncertain && (
            <Button variant="quiet" onClick={publish.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
    </section>
  )
}

function AssetPreview({ url, label }: { url: string; label: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <figure className={styles.asset} data-broken={broken || undefined}>
      {broken ? <span className={styles.assetMissing}>Not reachable</span> : <img src={url} alt="" width={64} height={64} onError={() => setBroken(true)} />}
      <figcaption>{label}</figcaption>
    </figure>
  )
}
