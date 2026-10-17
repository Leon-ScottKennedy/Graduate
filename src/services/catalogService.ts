import { demoParts, demoSnapshot } from '../data/mock/catalog'
import type { ComparisonHardware, ConfigPlan, PartOption, ProductOffer } from '../types/hardware'
import { money } from '../utils/format'

// Local provider for the existing prototype. Real API access lives in hardwareApi.ts.
export function getBuildCatalog() {
  return demoParts
}

const demoOffers: ProductOffer[] = demoParts.flatMap((group) =>
  group.options.flatMap((option) =>
    [
      { platform: 'jd' as const, shop: '品牌旗舰店 · 示例', difference: 0 },
      { platform: 'taobao' as const, shop: '硬件专营店 · 示例', difference: 60 },
      { platform: 'jd' as const, shop: '硬件自营店 · 示例', difference: 100 },
    ].map((listing, index) => ({
      id: `demo-offer-${option.id}-${index}`,
      hardwareId: option.id,
      platform: listing.platform,
      productId: `demo-product-${option.id}-${index}`,
      shop: listing.shop,
      price: option.price + listing.difference,
      currency: 'CNY' as const,
      priceType: 'listed' as const,
      productUrl: null,
      collectedAt: demoSnapshot,
      source: 'demo' as const,
    })),
  ),
)

export function getOffers(hardwareId: string) {
  return demoOffers.filter((offer) => offer.hardwareId === hardwareId)
}

const planDefinitions = [
  { name: '办公影音', desc: '办公与学习', upgrades: [] as string[] },
  { name: '主流游戏', desc: '游戏与日常使用', featured: true, upgrades: ['gpu', 'power'] },
  { name: '高端创作', desc: '视频剪辑与多任务', upgrades: ['cpu', 'gpu', 'ram', 'ssd', 'power'] },
  { name: 'AI 工作站', desc: '本地计算方案示例', upgrades: demoParts.map((group) => group.id) },
]

export function getConfigPlans(): ConfigPlan[] {
  return planDefinitions.map((definition) => {
    const detail = demoParts.map((group) => {
      const option = group.options[definition.upgrades.includes(group.id) ? 1 : 0]
      return { part: group.label, name: option.name, price: option.price, hardwareId: option.id }
    })
    return {
      ...definition,
      price: money(detail.reduce((sum, item) => sum + item.price, 0)),
      specs: detail
        .filter((item) => ['处理器', '显卡', '内存', '固态硬盘'].includes(item.part))
        .map((item) => `${item.part} · ${item.name}`),
      detail,
    }
  })
}

export function getComparisonCatalog(): Record<string, ComparisonHardware[]> {
  return Object.fromEntries(
    demoParts
      .filter((group) => ['cpu', 'gpu'].includes(group.id))
      .map((group) => [
        group.id === 'cpu' ? 'CPU' : group.label,
        group.options.map((option: PartOption) => ({
          name: option.name,
          specs: {
            品牌: option.brand,
            ...option.parameters,
            规格: option.specs,
            参考价格: money(option.price),
          },
        })),
      ]),
  )
}
