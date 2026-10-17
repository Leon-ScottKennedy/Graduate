export type Platform = 'jd' | 'taobao'

export interface PartOption {
  id: string
  brand: string
  name: string
  price: number // CNY; display estimate, not a platform product identifier.
  specs: string
  tag: string
  parameters?: Record<string, string>
}

export interface PartGroup {
  id: string
  label: string
  symbol: string
  color: string
  options: [PartOption, PartOption]
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
