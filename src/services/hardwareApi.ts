import type {
  HardwareRecord,
  ProductOffer,
  JDSearchResult,
  JDDetailResult,
  JDPoolCatalog,
  JDPoolRun,
  JDPoolPrice,
  JDCompareTarget,
  JDComparison,
} from '../types/hardware'
import { getJson, postJson } from './apiClient'

// Configuration options remain preset; JD product quotes use these real API entry points.
export const hardwareApi = {
  list: (signal?: AbortSignal) => getJson<HardwareRecord[]>('/hardware', signal),
  offers: (id: string, signal?: AbortSignal) =>
    getJson<ProductOffer[]>(`/hardware/${encodeURIComponent(id)}/offers`, signal),
}

export const jdApi = {
  compare: (target: JDCompareTarget, signal?: AbortSignal) =>
    postJson<JDComparison>('/jd/compare', target, signal),
  compareHistory: (target: JDCompareTarget, offerId: string, signal?: AbortSignal) =>
    postJson<JDPoolPrice[]>('/jd/compare/history', { ...target, offerId }, signal),
  catalog: (category: string, q = '', page = 1, signal?: AbortSignal) =>
    getJson<JDPoolCatalog>(
      `/jd/catalog?${new URLSearchParams({ category, q, page: String(page) })}`,
      signal,
    ),
  collectPool: (signal?: AbortSignal, complete = false) =>
    postJson<JDPoolRun>('/jd/pool/collect', { pages: complete ? 30 : 3 }, signal),
  priceHistory: (id: string, signal?: AbortSignal) =>
    getJson<JDPoolPrice[]>(`/jd/catalog/${encodeURIComponent(id)}/history`, signal),
  details: (inputs: string, collectionKey: string, signal?: AbortSignal) =>
    postJson<JDDetailResult>('/jd/details', { inputs, collectionKey }, signal),
  cachedDetails: (collectionKey: string, signal?: AbortSignal) =>
    getJson<JDDetailResult | null>(`/jd/details?${new URLSearchParams({ collectionKey })}`, signal),
  status: (signal?: AbortSignal) =>
    getJson<{ configured: boolean; method: string }>('/jd/status', signal),
  search: (keyword: string, page = 1, signal?: AbortSignal) =>
    postJson<JDSearchResult>('/jd/search', { keyword, page, pageSize: 20 }, signal),
  cached: (keyword: string, page = 1, signal?: AbortSignal) =>
    getJson<JDSearchResult | null>(
      `/jd/search?${new URLSearchParams({ keyword, page: String(page), pageSize: '20' })}`,
      signal,
    ),
}
