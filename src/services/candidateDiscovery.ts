import type { PartGroup, PartOption } from '../types/hardware'
import { postJson } from './apiClient'
import { browseHardware } from './hardwareBrowse'

export interface CandidateDiscoveryResult {
  options: PartOption[]
  summary: string
  collection: string
  errors: string[]
}
const cache = new Map<string, { at: number; result: CandidateDiscoveryResult }>()
const model = (category: string, option: PartOption) => ({ id: option.id, category,
  brand: option.brand, modelName: option.name, specs: option.specs })

export async function discoverCandidates(group: PartGroup, selected: PartOption, collect: boolean, signal: AbortSignal, refresh = false) {
  const body = { selected: model(group.id, selected), collect,
    catalog: browseHardware(group).slice(0, 400).map(part => model(group.id, part)) }
  const key = JSON.stringify(body)
  const saved = cache.get(key)
  if (!refresh && saved && Date.now() - saved.at < 600000) return saved.result
  const result = await postJson<CandidateDiscoveryResult>('/market/alternatives/discover', body, signal)
  if (!signal.aborted) {
    if (cache.size >= 80) cache.delete(cache.keys().next().value!)
    cache.set(key, { at: Date.now(), result })
  }
  return result
}
