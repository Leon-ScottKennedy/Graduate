export interface PartOption {
  referencePrice?: {
    amount: number
    currency: 'CNY'
    basis: 'public' | 'estimated' | 'overseas'
    sourceName: string
    sourceUrl: string
    checkedAt: string
    note: string
  }
  observedMarketOffer?: NonNullable<PartOption['marketOffer']> & { price: number }
  marketOffer?: {
    id: string
    shop: string
    platform: 'jd' | 'taobao'
    productUrl: string
    collectedAt: string
  }
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
