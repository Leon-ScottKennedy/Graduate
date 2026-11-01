import type { PartGroup, PartOption } from '../types/hardware'
import { postJson } from './apiClient'
import { checkBuildCompatibility } from './buildCompatibility'
import { browseHardware } from './hardwareBrowse'
import { demandAxes, type DemandWeights } from './demandWeights'

export interface DiscoveredModel {
  category: string
  brand: string
  modelName: string
  specs: string
  reason: string
  reduceCategories: string[]
  optionIds: string[]
  offer: (NonNullable<PartOption['marketOffer']> & { price: number }) | null
  collection: string
  collectionErrors: string[]
  selectable: boolean
}
export interface DiscoveryResult { summary: string; recommendations: DiscoveredModel[] }
const cache = new Map<string, { at: number; result: DiscoveryResult }>()

export async function discoverRecommendations(catalog: PartGroup[], build: Record<string, PartOption>, budget: number,
  usage: string, category: string, purpose: 'similar' | 'rebalance' | 'workload', signal: AbortSignal, demandWeights?: DemandWeights) {
  const facts: Record<string, string> = { 'context.budget': String(budget), 'context.usage': usage,
    'context.priceRange': '相近替换默认最多加价15%；符合规格及兼容要求的更便宜型号不限制降价幅度。不能仅凭低价放宽性能、容量或平台条件。预算重分配不受单件加价限制，整机不得超预算。参考价可能为公开、历史、海外或估算值，不是实时售价。' }
  for (const [key, part] of Object.entries(build)) {
    facts[`build.${key}.name`] = part.name
    facts[`build.${key}.specs`] = part.specs
    facts[`build.${key}.price`] = part.requiresQuote ? '未知' : String(part.price)
  }
  if (demandWeights) {
    for (const axis of demandAxes) facts[`context.demand.${axis.id}`] = `${axis.label} ${demandWeights[axis.id]}%`
    facts['context.demandMeaning'] = '比例代表用途重要性，不是硬件预算百分比或性能跑分；综合全部占比分析整机，可以建议不同类别的替换，说明优先照顾哪些用途及牺牲哪些需求。'
  }
  const body = { facts, rules: checkBuildCompatibility(build), category, purpose,
    ...(demandWeights ? { demandWeights } : {}),
    catalog: catalog.flatMap(group => browseHardware(group).map(part => ({ id: part.id, category: group.id,
      brand: part.brand, modelName: part.name, specs: part.specs }))) }
  const key = JSON.stringify(body)
  const stored = cache.get(key)
  if (stored && Date.now() - stored.at < 600000) return stored.result
  const result = await postJson<DiscoveryResult>('/ai/recommendations', body, signal)
  if (!signal.aborted) {
    if (cache.size >= 20) cache.delete(cache.keys().next().value!)
    cache.set(key, { at: Date.now(), result })
  }
  return result
}

export function resolveDiscoveryCatalog(catalog: PartGroup[], result: DiscoveryResult): PartGroup[] {
  return catalog.map(group => ({ ...group, options: browseHardware(group).map(part => {
    const match = result.recommendations.find(model => model.category === group.id && model.optionIds.includes(part.id))
    if (!match?.offer) return part
    if (part.referencePrice) return { ...part, observedMarketOffer: match.offer }
    const { price, ...offer } = match.offer
    return { ...part, price, requiresQuote: false, marketOffer: offer, tag: '采集展示价 · 购买前核价' }
  }) as PartGroup['options'] }))
}
