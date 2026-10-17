import type { HardwareRecord, ProductOffer } from '../types/hardware'
import { getJson } from './apiClient'

// Explicit real-data entry points. Pages still use catalogService's demo provider.
export const hardwareApi = {
  list: (signal?: AbortSignal) => getJson<HardwareRecord[]>('/hardware', signal),
  offers: (id: string, signal?: AbortSignal) =>
    getJson<ProductOffer[]>(`/hardware/${encodeURIComponent(id)}/offers`, signal),
}
