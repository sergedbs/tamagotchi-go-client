import { useQueries } from '@tanstack/react-query'
import { useApi } from '../../api/apiContext.ts'
import { apiPath } from '../../api/http.ts'
import { useConfig } from '../../app/configContext.ts'
import { resolveSpriteUrl, type PackageAssets } from '../../packages/assets.ts'
import { resolvePresentation } from '../../packages/presentation.ts'
import type { Tamagotchi } from './dto.ts'
import type { CreatureView } from './view.ts'

function versionKey(creature: Tamagotchi) {
  return `${creature.origin_package_id}@${creature.config_version}`
}

/**
 * Combines server creatures with their exact package/config presentation and the
 * public asset manifest for that version. Manifests are fetched once per version.
 */
export function useCreatureViews(creatures: Tamagotchi[]): CreatureView[] {
  const api = useApi()
  const config = useConfig()
  const versions = [...new Map(creatures.map((creature) => [versionKey(creature), creature])).values()]
  const manifests = useQueries({
    queries: versions.map((creature) => ({
      queryKey: ['public', 'package-assets', creature.origin_package_id, creature.config_version],
      staleTime: 10 * 60_000,
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        (
          await api.request<PackageAssets>({
            method: 'GET',
            path: apiPath`/registry/v1/packages/${creature.origin_package_id}/assets`,
            query: { config_version: creature.config_version },
            auth: 'public',
            signal,
          })
        ).data,
    })),
  })
  const byVersion = new Map(versions.map((creature, index) => [versionKey(creature), manifests[index]?.data]))
  return creatures.map((creature) => ({
    creature,
    artUrl: resolveSpriteUrl(byVersion.get(versionKey(creature)), creature.sprite_ref),
    presentation: resolvePresentation(config.package_presentations, creature.origin_package_id, creature.config_version),
  }))
}
