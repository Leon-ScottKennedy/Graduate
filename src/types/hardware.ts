export type Platform = 'jd' | 'taobao'

export interface PartOption {
  requiresQuote?: boolean
  specSource?: string
  priceSource?: {
    quoteId: string
    shop: string
    platform: 'jd' | 'taobao'
    observedAt: string
    productUrl: string
    basis: 'manual'
    presetPrice: number
  }
  compatibility?: {
    socket?: string
    memoryType?: string
    boardForm?: string
    supportedBoardForms?: string[]
    coolerSockets?: string[]
    gpuLengthMm?: number
    coolerHeightMm?: number
    maxGpuLengthMm?: number
    maxCoolerHeightMm?: number
    radiatorMm?: number
    supportedRadiatorsMm?: number[]
  }
  id: string
  brand: string
  name: string
  price: number // CNY; display estimate, not a platform product identifier.
  specs: string
  tag: string
  parameters?: Record<string, string>
  // Conservative prototype selection constraints; not a complete compatibility check.
  minPsuWatts?: number
  psuWatts?: number
  boardTier?: number
  minBoardTier?: number
  coolingTier?: number
  minCoolingTier?: number
}

export interface PartGroup {
  id: string
  label: string
  symbol: string
  color: string
  options: [PartOption, PartOption, ...PartOption[]]
}

// A standard hardware model is distinct from a merchant's product listing.
export interface HardwareRecord {
  id: string
  categoryId: string
  brand: string
  model: string
  name: string
  specifications: Record<string, string>
}

export interface ProductOffer {
  id: string
  hardwareId: string
  platform: Platform
  productId: string
  shop: string
  price: number
  currency: 'CNY'
  priceType: 'listed'
  productUrl: string | null
  collectedAt: string
  source: 'demo' | 'api'
}

export interface PriceSnapshot {
  productId: string
  platform: Platform
  price: number
  currency: 'CNY'
  priceType: 'listed'
  collectedAt: string
  taskId: string
}

export interface PlanDetail {
  part: string
  name: string
  price: number
  hardwareId: string
}
export interface ConfigPlan {
  name: string
  price: string
  desc: string
  specs: string[]
  featured?: boolean
  detail: PlanDetail[]
}
export interface ComparisonHardware {
  name: string
  specs: Record<string, string>
}

export interface JDProduct {
  id: string
  productId: string
  name: string
  brand: string
  shop: string
  price: number
  productUrl: string
  collectedAt: string
  platform: 'jd'
  priceType: 'listed'
  matchStatus: 'unverified'
}

export interface JDSearchResult {
  taskId: string
  keyword: string
  page: number
  pageSize: number
  status: 'running' | 'completed' | 'failed'
  collectedAt: string
  totalCount: number
  receivedCount: number
  validCount: number
  excludedCount: number
  duplicateCount: number
  hasMore: boolean
  items: JDProduct[]
}

export interface JDDetailResult extends JDSearchResult {
  method: string
  collectionKey: string
  skuIds: string[]
  notReturnedSkuIds: string[]
}

export interface JDPoolRun {
  taskId: string
  status: 'running' | 'completed' | 'failed'
  collectedAt: string
  pages: number
  receivedCount: number
  validCount: number
  excludedCount: number
  duplicateCount: number
  detailCount: number
  detailFailed: number
  errorCode: string | null
}
export interface JDPoolProduct {
  id: string
  itemId: string
  categoryId: string
  name: string
  brand: string
  shop: string
  price: number
  productUrl: string
  collectedAt: string
  detailsCollectedAt: string | null
  matchStatus: 'unverified'
}
export interface JDPoolCatalog {
  categoryId: string
  page: number
  totalCount: number
  hasMore: boolean
  coverage: { id: string; label: string; count: number }[]
  latestRun: JDPoolRun | null
  scan?: {
    scannedPages: number
    totalPages: number
    nextPage: number
    fullScanAt: string | null
  } | null
  items: JDPoolProduct[]
}
export interface JDPoolPrice {
  price: number | null
  collectedAt: string
  taskId: string
}
export interface JDCompareTarget {
  category: string
  brand: string
  modelName: string
  specs: string
}
export interface JDShopOffer {
  id: string
  name: string
  brand: string
  shop: string
  price: number
  productUrl: string
  collectedAt: string
  priceType: 'listed'
  mergedCount: number
  difference: number | null
  isLowest: boolean
}
export interface JDComparison {
  categoryId: string
  modelName: string
  brand: string
  specs: string
  shopCount: number
  priceType: 'listed'
  offers: JDShopOffer[]
}
